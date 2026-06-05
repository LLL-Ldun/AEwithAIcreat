// settings.js — 设置面板逻辑
// 通过 CEP localStorage 持久化，不写入项目文件

var AIEDIT_SETTINGS_KEY = 'aiedit_settings_v1';

var DEFAULT_SETTINGS = {
  img2img: {
    provider: 'agnes',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    endpoint: '/images/generations',
    model: 'agnes-image-2.0-flash',
    apiKey: ''
  },
  img2vid: {
    provider: 'agnes',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    endpoint: '/videos',
    model: 'agnes-video-v2.0',
    apiKey: ''
  }
};

var AppSettings = (function() {
  var _settings = null;

  function load() {
    try {
      var raw = localStorage.getItem(AIEDIT_SETTINGS_KEY);
      if (raw) {
        _settings = JSON.parse(raw);
      } else {
        _settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch (e) {
      _settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
    return _settings;
  }

  function save() {
    localStorage.setItem(AIEDIT_SETTINGS_KEY, JSON.stringify(_settings));
    return true;
  }

  function get() {
    if (!_settings) load();
    return _settings;
  }

  function update(category, values) {
    if (!_settings) load();
    Object.keys(values).forEach(function(k) {
      _settings[category][k] = values[k];
    });
    return save();
  }

  function loadToUI() {
    var s = get();
    // 图生图
    document.getElementById('img2imgProvider').value = s.img2img.provider;
    document.getElementById('img2imgBaseUrl').value = s.img2img.baseUrl;
    document.getElementById('img2imgEndpoint').value = s.img2img.endpoint;
    document.getElementById('img2imgModel').value = s.img2img.model;
    document.getElementById('img2imgKey').value = s.img2img.apiKey;
    // 图生视频
    document.getElementById('img2vidProvider').value = s.img2vid.provider;
    document.getElementById('img2vidBaseUrl').value = s.img2vid.baseUrl;
    document.getElementById('img2vidEndpoint').value = s.img2vid.endpoint;
    document.getElementById('img2vidModel').value = s.img2vid.model;
    document.getElementById('img2vidKey').value = s.img2vid.apiKey;
  }

  function saveFromUI() {
    var s = get();
    s.img2img.provider = document.getElementById('img2imgProvider').value;
    s.img2img.baseUrl = document.getElementById('img2imgBaseUrl').value;
    s.img2img.endpoint = document.getElementById('img2imgEndpoint').value;
    s.img2img.model = document.getElementById('img2imgModel').value;
    s.img2img.apiKey = document.getElementById('img2imgKey').value;
    s.img2vid.provider = document.getElementById('img2vidProvider').value;
    s.img2vid.baseUrl = document.getElementById('img2vidBaseUrl').value;
    s.img2vid.endpoint = document.getElementById('img2vidEndpoint').value;
    s.img2vid.model = document.getElementById('img2vidModel').value;
    s.img2vid.apiKey = document.getElementById('img2vidKey').value;
    return save();
  }

  return {
    load: load,
    save: save,
    get: get,
    update: update,
    loadToUI: loadToUI,
    saveFromUI: saveFromUI
  };
})();
