// lib.jsx — 公共工具函数
// ExtendScript ES3 方言，无 let/const/箭头函数

function getScriptPath() {
  var scriptFile = new File($.fileName);
  return scriptFile.parent.fsName + '/';
}

function getTempDir() {
  var tempFolder = Folder.temp;
  if (!tempFolder.exists) {
    tempFolder.create();
  }
  var aieditFolder = new Folder(tempFolder.fsName + '/AIEDIT');
  if (!aieditFolder.exists) {
    aieditFolder.create();
  }
  return aieditFolder.fsName;
}

function getActiveComp() {
  var comp = app.project.activeItem;
  if (!comp || !(comp instanceof CompItem)) {
    return null;
  }
  return comp;
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_');
}

// 返回给前端的格式，CSInterface evalScript 读取脚本最后的值
'READY';
