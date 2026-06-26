// 参考图处理：把上传的图片缩放至 ≤512×512，保持原宽高比（等比缩放，不裁剪）
// 返回 { blob: Blob(png), previewUrl: string, width, height }
// 用途：满足 CF flux-2-klein-4b 参考图输入要求
window.ImageUtils = (function () {
  "use strict";
  var MAX_SIZE = 512;

  function loadImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
      img.src = url;
    });
  }

  // 等比缩放：最长边不超过 MAX_SIZE，短边自然适配，不强制正方形
  function process(file) {
    return loadImg(file).then(function (res) {
      var img = res.img;
      var sw = img.naturalWidth;
      var sh = img.naturalHeight;

      var scale = 1;
      if (sw > MAX_SIZE || sh > MAX_SIZE) {
        scale = Math.min(MAX_SIZE / sw, MAX_SIZE / sh);
      }
      var dw = Math.max(1, Math.round(sw * scale));
      var dh = Math.max(1, Math.round(sh * scale));

      var canvas = document.createElement("canvas");
      canvas.width = dw;
      canvas.height = dh;
      var ctx = canvas.getContext("2d");
      // 白底，避免透明图导出后异常
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, dw, dh);
      ctx.drawImage(img, 0, 0, dw, dh);
      URL.revokeObjectURL(res.url);

      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve({
            blob: blob,
            previewUrl: canvas.toDataURL("image/png"),
            width: dw,
            height: dh,
          });
        }, "image/png");
      });
    });
  }

  return { process: process, MAX_SIZE: MAX_SIZE };
})();
