// api.js — API 抽象层：支持多服务商图生图 + 图生视频

var AIEDIT_API = (function() {

  // 将本地图片路径转为 base64 data URL
  function loadImageAsBase64(path, callback) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      var dataUrl = canvas.toDataURL('image/png');
      callback(null, dataUrl);
    };
    img.onerror = function() {
      callback(new Error('无法加载图片: ' + path));
    };
    img.src = path;
  }

  // 图生图：调用 Agnes / Replicate / 自定义
  function generateImage(imageDataUrl, prompt, onProgress) {
    var cfg = AppSettings.get().img2img;

    if (cfg.provider === 'agnes') {
      return generateImageAgnes(cfg, imageDataUrl, prompt, onProgress);
    } else {
      // Replicate / 自定义暂用通用 OpenAI 兼容格式
      return generateImageGeneric(cfg, imageDataUrl, prompt, onProgress);
    }
  }

  function generateImageAgnes(cfg, imageDataUrl, prompt, onProgress) {
    return new Promise(function(resolve, reject) {
      var url = cfg.baseUrl.replace(/\/$/, '') + cfg.endpoint;
      var body = JSON.stringify({
        model: cfg.model,
        prompt: prompt,
        image: imageDataUrl,
        tags: ['img2img'],
        size: '1024x768',
        n: 1
      });

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: body
      })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ': ' + t); });
        return res.json();
      })
      .then(function(data) {
        // Agnes 图生图同步返回
        if (data.data && data.data.length > 0) {
          resolve({ imageUrl: data.data[0].url, imageB64: data.data[0].b64_json || null });
        } else if (data.url) {
          resolve({ imageUrl: data.url });
        } else {
          reject(new Error('未识别的返回格式: ' + JSON.stringify(data)));
        }
      })
      .catch(reject);
    });
  }

  function generateImageGeneric(cfg, imageDataUrl, prompt, onProgress) {
    return new Promise(function(resolve, reject) {
      var url = cfg.baseUrl.replace(/\/$/, '') + cfg.endpoint;
      var body = JSON.stringify({
        model: cfg.model,
        prompt: prompt,
        image: imageDataUrl,
        n: 1
      });

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: body
      })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ': ' + t); });
        return res.json();
      })
      .then(function(data) {
        if (data.data && data.data.length > 0) {
          resolve({ imageUrl: data.data[0].url, imageB64: data.data[0].b64_json || null });
        } else if (data.output) {
          resolve({ imageUrl: data.output });
        } else {
          reject(new Error('未识别的返回格式: ' + JSON.stringify(data)));
        }
      })
      .catch(reject);
    });
  }

  // 图生视频：调用 Agnes / Replicate / 自定义
  function generateVideo(imageDataUrl, prompt, onProgress) {
    var cfg = AppSettings.get().img2vid;

    if (cfg.provider === 'agnes') {
      return generateVideoAgnes(cfg, imageDataUrl, prompt, onProgress);
    } else {
      return generateVideoGeneric(cfg, imageDataUrl, prompt, onProgress);
    }
  }

  function generateVideoAgnes(cfg, imageDataUrl, prompt, onProgress) {
    return new Promise(function(resolve, reject) {
      var url = cfg.baseUrl.replace(/\/$/, '') + cfg.endpoint;
      var body = JSON.stringify({
        model: cfg.model,
        prompt: prompt || 'animate this image smoothly',
        image: imageDataUrl,
        num_frames: 121,
        frame_rate: 24
      });

      if (onProgress) onProgress('creating', 0);

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: body
      })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ': ' + t); });
        return res.json();
      })
      .then(function(data) {
        var taskId = data.task_id || data.id;
        if (!taskId) throw new Error('未获取到 task_id: ' + JSON.stringify(data));
        // 轮询等待完成
        pollVideoTask(cfg, taskId, 0, onProgress, resolve, reject);
      })
      .catch(reject);
    });
  }

  function pollVideoTask(cfg, taskId, attempt, onProgress, resolve, reject) {
    var maxAttempts = 120; // 最多等 10 分钟 (5s * 120)
    if (attempt >= maxAttempts) {
      reject(new Error('视频生成超时'));
      return;
    }

    var progress = Math.min(95, Math.round((attempt / 60) * 100));
    if (onProgress) onProgress('generating', progress);

    setTimeout(function() {
      var pollUrl = cfg.baseUrl.replace(/\/$/, '') + cfg.endpoint + '/' + taskId;
      fetch(pollUrl, {
        headers: {
          'Authorization': 'Bearer ' + cfg.apiKey
        }
      })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ': ' + t); });
        return res.json();
      })
      .then(function(data) {
        if (data.status === 'completed' || data.status === 'succeeded') {
          var videoUrl = data.video_url || data.output || data.url;
          if (!videoUrl) {
            // 某些字段名不一致的兜底
            videoUrl = data.remixed_from_video_id || data.result;
          }
          if (onProgress) onProgress('done', 100);
          resolve({ videoUrl: videoUrl, taskId: taskId });
        } else if (data.status === 'failed' || data.status === 'error') {
          reject(new Error('视频生成失败: ' + (data.error || JSON.stringify(data))));
        } else {
          pollVideoTask(cfg, taskId, attempt + 1, onProgress, resolve, reject);
        }
      })
      .catch(function(err) {
        // 网络错误后重试
        if (attempt < 5) {
          pollVideoTask(cfg, taskId, attempt + 1, onProgress, resolve, reject);
        } else {
          reject(err);
        }
      });
    }, 5000);
  }

  function generateVideoGeneric(cfg, imageDataUrl, prompt, onProgress) {
    return new Promise(function(resolve, reject) {
      var url = cfg.baseUrl.replace(/\/$/, '') + cfg.endpoint;
      var body = JSON.stringify({
        model: cfg.model,
        prompt: prompt || 'animate this image smoothly',
        image: imageDataUrl
      });

      if (onProgress) onProgress('creating', 0);

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.apiKey
        },
        body: body
      })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error('HTTP ' + res.status + ': ' + t); });
        return res.json();
      })
      .then(function(data) {
        var taskId = data.task_id || data.id;
        if (!taskId) {
          // 同步返回
          var videoUrl = data.video_url || data.output || data.url;
          if (videoUrl) {
            if (onProgress) onProgress('done', 100);
            resolve({ videoUrl: videoUrl });
          } else {
            reject(new Error('未识别的返回格式: ' + JSON.stringify(data)));
          }
          return;
        }
        pollVideoTask(cfg, taskId, 0, onProgress, resolve, reject);
      })
      .catch(reject);
    });
  }

  return {
    loadImageAsBase64: loadImageAsBase64,
    generateImage: generateImage,
    generateVideo: generateVideo
  };
})();
