// app.js — 主逻辑：CSInterface 通信 + 三步骤状态管理

var CSInterface = window.CSInterface || null;
var csi = CSInterface ? new CSInterface() : null;

var APP = (function() {
  // 当前状态
  var state = {
    firstFramePath: null,
    firstFrameB64: null,
    effectPath: null,
    effectB64: null,
    videoPath: null,
    videoTaskId: null
  };

  // === ExtendScript 通信 ===
  function callExtendScript(script, callback) {
    if (!csi) {
      console.warn('CEP 环境不可用，使用模拟模式');
      // 模拟模式用于浏览器开发
      simulateExtendScript(script, callback);
      return;
    }
    csi.evalScript(script, function(res) {
      if (callback) callback(res);
    });
  }

  function simulateExtendScript(script, callback) {
    // 浏览器开发时返回假数据
    if (script.indexOf('exportCurrentFrame') > -1) {
      setTimeout(function() {
        callback('SIMULATED:/tmp/aiedit_frame.png');
      }, 300);
    } else if (script.indexOf('importFileToComp') > -1) {
      setTimeout(function() {
        callback('OK');
      }, 200);
    } else {
      callback('SIMULATED');
    }
  }

  // === 步骤 1：截取当前帧 ===
  function captureFrame() {
    setStatus('statusCapture', '正在导出当前帧...', 'info');
    var script = 'var lib = $.evalFile(getScriptPath() + "lib.jsx");\n' +
                 '$.evalFile(getScriptPath() + "exportFrame.jsx");\n' +
                 'exportCurrentFrame();';
    callExtendScript(script, function(result) {
      var path = (result || '').trim();
      if (path && path.indexOf('ERROR:') === -1) {
        state.firstFramePath = path;
        state.firstFrameB64 = null;
        showPreviewImage('previewFirstFrame', path);
        setStatus('statusCapture', '截图完成: ' + getFileName(path), 'ok');
        document.getElementById('btnGenerateImg').disabled = false;
      } else {
        setStatus('statusCapture', path || '截图失败', 'err');
      }
    });
  }

  // === 步骤 2：生成效果图 ===
  function generateEffect() {
    var prompt = document.getElementById('promptEffect').value.trim();
    if (!prompt) {
      setStatus('statusImg', '请输入效果描述', 'err');
      return;
    }
    if (!state.firstFramePath) {
      setStatus('statusImg', '请先截取当前帧', 'err');
      return;
    }

    setStatus('statusImg', '正在加载截图...', 'info');
    showProgress('progressImg', true);

    // 优先用路径加载为 base64，CEP 环境可直接读本地文件
    var imgPath = state.firstFramePath;
    var imgEl = document.getElementById('previewFirstFrame').querySelector('img');
    var dataUrl = imgEl ? imgEl.src : imgPath;

    if (dataUrl && dataUrl.indexOf('data:') === 0) {
      doGenerateEffect(dataUrl, prompt);
    } else {
      // CEP 环境：通过 canvas 读取已显示的图片
      var img = imgEl;
      if (!img) {
        img = new Image();
        img.src = imgPath;
        img.onload = function() {
          var canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          doGenerateEffect(canvas.toDataURL('image/png'), prompt);
        };
        img.onerror = function() {
          setStatus('statusImg', '无法加载截图', 'err');
          showProgress('progressImg', false);
        };
      } else {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        doGenerateEffect(canvas.toDataURL('image/png'), prompt);
      }
    }
  }

  function doGenerateEffect(dataUrl, prompt) {
    setStatus('statusImg', '正在生成效果图...', 'info');
    AIEDIT_API.generateImage(dataUrl, prompt, null)
      .then(function(result) {
        var url = result.imageUrl || result.imageB64;
        state.effectPath = url;
        state.effectB64 = result.imageB64 || null;
        showPreviewImage('previewEffect', url);
        setStatus('statusImg', '效果图生成完成', 'ok');
        showProgress('progressImg', false);
        document.getElementById('btnGenerateVid').disabled = false;
      })
      .catch(function(err) {
        setStatus('statusImg', '生成失败: ' + err.message, 'err');
        showProgress('progressImg', false);
      });
  }

  // === 步骤 3：生成视频 ===
  function generateVideo() {
    if (!state.effectPath && !state.effectB64) {
      setStatus('statusVid', '请先生成效果图', 'err');
      return;
    }

    var prompt = document.getElementById('promptVideo').value.trim() || 'animate this image smoothly';
    setStatus('statusVid', '正在创建视频任务...', 'info');
    showProgress('progressVid', true);

    var dataUrl = state.effectB64 || state.effectPath;

    // 如果是 URL，先转 base64
    if (dataUrl.indexOf('data:') !== 0) {
      loadUrlAsDataUrl(dataUrl, function(b64) {
        doGenerateVideo(b64, prompt);
      });
    } else {
      doGenerateVideo(dataUrl, prompt);
    }
  }

  function doGenerateVideo(dataUrl, prompt) {
    AIEDIT_API.generateVideo(dataUrl, prompt, function(stage, progress) {
      if (stage === 'creating') {
        setProgressFill('progressVidFill', 5);
        setStatus('statusVid', '视频生成中...', 'info');
      } else if (stage === 'generating') {
        setProgressFill('progressVidFill', progress);
        setStatus('statusVid', '视频生成中... ' + progress + '%', 'info');
      } else if (stage === 'done') {
        setProgressFill('progressVidFill', 100);
      }
    })
    .then(function(result) {
      state.videoPath = result.videoUrl;
      state.videoTaskId = result.taskId || null;
      showPreviewVideo('previewVideo', result.videoUrl);
      setStatus('statusVid', '视频生成完成', 'ok');
      showProgress('progressVid', false);
      document.getElementById('btnImport').disabled = false;
    })
    .catch(function(err) {
      setStatus('statusVid', '生成失败: ' + err.message, 'err');
      showProgress('progressVid', false);
    });
  }

  // === 导入到合成末尾 ===
  function importToComp() {
    if (!state.videoPath) {
      setStatus('statusVid', '没有可导入的视频', 'err');
      return;
    }

    setStatus('statusVid', '正在导入...', 'info');
    var script = 'var lib = $.evalFile(getScriptPath() + "lib.jsx");\n' +
                 '$.evalFile(getScriptPath() + "importToComp.jsx");\n' +
                 'importFileToComp("' + state.videoPath.replace(/\\/g, '\\\\') + '");';
    callExtendScript(script, function(result) {
      var res = (result || '').trim();
      if (res === 'OK') {
        setStatus('statusVid', '已导入合成末尾', 'ok');
      } else {
        setStatus('statusVid', '导入失败: ' + res, 'err');
      }
    });
  }

  // === UI 辅助 ===
  function showPreviewImage(containerId, src) {
    var container = document.getElementById(containerId);
    container.innerHTML = '<img src="' + src + '" alt="preview">';
  }

  function showPreviewVideo(containerId, src) {
    var container = document.getElementById(containerId);
    container.innerHTML = '<video src="' + src + '" controls></video>';
  }

  function setStatus(id, msg, type) {
    var el = document.getElementById(id);
    el.textContent = msg;
    el.className = 'status status-' + (type || 'info');
  }

  function setProgressFill(id, pct) {
    document.getElementById(id).style.width = pct + '%';
  }

  function showProgress(id, visible) {
    var el = document.getElementById(id);
    if (visible) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
      setProgressFill(id + 'Fill', 0);
    }
  }

  function getFileName(path) {
    var parts = (path || '').replace(/\\/g, '/').split('/');
    return parts[parts.length - 1];
  }

  function loadUrlAsDataUrl(url, callback) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      callback(canvas.toDataURL('image/png'));
    };
    img.onerror = function() {
      callback(url); // 无法转换就用原 URL
    };
    img.src = url;
  }

  // === 初始化 ===
  function init() {
    AppSettings.load();
    AppSettings.loadToUI();

    document.getElementById('btnSettings').addEventListener('click', function() {
      var panel = document.getElementById('settingsPanel');
      panel.classList.toggle('hidden');
    });

    document.getElementById('btnSaveSettings').addEventListener('click', function() {
      AppSettings.saveFromUI();
      document.getElementById('settingsStatus').textContent = '已保存';
      document.getElementById('settingsStatus').className = 'settings-status status-ok';
    });

    document.getElementById('btnCapture').addEventListener('click', captureFrame);
    document.getElementById('btnGenerateImg').addEventListener('click', generateEffect);
    document.getElementById('btnGenerateVid').addEventListener('click', generateVideo);
    document.getElementById('btnImport').addEventListener('click', importToComp);

    // 预设标签点击
    var tags = document.querySelectorAll('.preset-tag');
    tags.forEach(function(tag) {
      tag.addEventListener('click', function() {
        document.getElementById('promptEffect').value = this.getAttribute('data-prompt');
      });
    });

    // 加载预设配置到设置面板
    AppSettings.loadToUI();
  }

  return { init: init };
})();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  APP.init();
});
