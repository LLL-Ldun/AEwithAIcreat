// importToComp.jsx — 导入素材文件到当前合成末尾
// 依赖: lib.jsx

function importFileToComp(filePath) {
  var comp = getActiveComp();
  if (!comp) {
    return 'ERROR: 没有打开的合成';
  }

  var importFile = new File(filePath);
  if (!importFile.exists) {
    return 'ERROR: 文件不存在 - ' + filePath;
  }

  var importOptions = new ImportOptions(importFile);
  var footage;
  try {
    footage = app.project.importFile(importOptions);
  } catch (e) {
    return 'ERROR: 导入失败 - ' + e.toString();
  }

  if (!footage) {
    return 'ERROR: 导入返回空';
  }

  // 创建图层，追加到合成末尾
  var layer = comp.layers.add(footage);

  // 移动到合成末尾
  // 获取当前合成的出点
  var maxOutPoint = 0;
  for (var i = 1; i <= comp.layers.length; i++) {
    var l = comp.layers[i];
    if (l.outPoint > maxOutPoint) {
      maxOutPoint = l.outPoint;
    }
  }

  // 将新图层放在最后
  layer.startTime = maxOutPoint;

  return 'OK';
}

// 从 CSInterface 调用时传入文件路径作为参数
var inputPath = '';
try {
  inputPath = arguments[0];
} catch (e) {
  inputPath = '';
}
importFileToComp(inputPath);
