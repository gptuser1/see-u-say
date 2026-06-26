// 三态主题切换：light / dark / auto（跟随系统）
// 持久化到 localStorage，auto 模式监听系统主题变化
(function () {
  "use strict";
  var STORAGE_KEY = "see-u-say-theme";
  var MODES = ["light", "auto", "dark"];
  var root = document.documentElement;
  var buttons = document.querySelectorAll(".theme-toggle__btn");

  function apply(mode) {
    root.setAttribute("data-theme", mode);
    buttons.forEach(function (btn) {
      var isActive = btn.getAttribute("data-theme-set") === mode;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function init() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (MODES.indexOf(saved) === -1) saved = "auto";
    apply(saved);
  }

  // 按钮点击直接设定对应模式
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = btn.getAttribute("data-theme-set");
      localStorage.setItem(STORAGE_KEY, mode);
      apply(mode);
    });
  });

  // auto 模式下系统主题变化无需额外处理：CSS 媒体查询已覆盖
  // 仅需确保 data-theme 仍为 auto（用户手动切换后会被覆盖，符合预期）

  init();
})();
