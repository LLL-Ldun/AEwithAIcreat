// exportFrame.jsx — 导出当前时间指示器所在帧为 PNG
// 依赖: lib.jsx

function exportCurrentFrame() {
  var comp = getActiveComp();
  if (!comp) {
    return 'ERROR: 没有打开的合成';
  }

  var currentTime = comp.time;
  var frameIndex = Math.round(currentTime / comp.frameDuration);
  var tempDir = getTempDir();
  var fileName = sanitizeFileName(comp.name) + '_frame_' + frameIndex + '.png';
  var outputPath = tempDir + '/' + fileName;

  // 设置渲染队列
  var rq = app.project.renderQueue;
  var rqItem = rq.items.add(comp);
  rqItem.applyTemplate('Best Settings');

  var om = rqItem.outputModule(1);
  om.applyTemplate('PNG');

  var outputFile = new File(outputPath);
  rqItem.outputModule(1).file = outputFile;

  // 设置渲染范围为当前帧
  rqItem.timeSpanStart = currentTime;
  rqItem.timeSpanDuration = comp.frameDuration;

  // 执行渲染
  try {
    app.project.renderQueue.render();
  } catch (e) {
    return 'ERROR: 渲染失败 - ' + e.toString();
  }

  // 清理渲染队列
  rqItem.remove();

  if (outputFile.exists) {
    return outputFile.fsName;
  } else {
    return 'ERROR: 输出文件不存在 - ' + outputPath;
  }
}

exportCurrentFrame();
