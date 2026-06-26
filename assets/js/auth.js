// 令牌鉴权：进入站点的访问控制
// 令牌存于 sessionStorage，所有 /api/* 请求携带 Authorization: Bearer <token>
(function () {
  "use strict";
  var TOKEN_KEY = "see-u-say-token";
  var authEl = document.getElementById("auth");
  var form = document.getElementById("auth-form");
  var input = document.getElementById("token-input");
  var errorEl = document.getElementById("auth-error");
  var submitBtn = document.getElementById("auth-submit");

  // 暴露给其他脚本：获取令牌
  window.getAccessToken = function () {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  };
  // 暴露：登出（供顶栏退出按钮调用）
  window.logout = function () {
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  };

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  // 启动时尝试用已存令牌校验；通过则隐藏遮罩，否则显示登录
  function bootstrap() {
    var token = window.getAccessToken();
    if (!token) {
      showAuth();
      return;
    }
    // 静默校验令牌是否有效
    fetch("/api/auth", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    }).then(function (r) {
      if (r.ok) {
        authEl.hidden = true;
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        showAuth();
      }
    }).catch(function () { showAuth(); });
  }

  function showAuth() {
    authEl.hidden = false;
    input.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var token = input.value.trim();
    if (!token) { showError("请输入访问令牌。"); return; }
    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "校验中…";

    fetch("/api/auth", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    }).then(function (r) {
      submitBtn.disabled = false;
      submitBtn.textContent = "进入";
      if (r.ok) {
        sessionStorage.setItem(TOKEN_KEY, token);
        authEl.hidden = true;
      } else if (r.status === 401) {
        showError("令牌无效，请重新输入。");
      } else {
        showError("校验失败，请稍后重试。");
      }
    }).catch(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = "进入";
      showError("网络错误，请稍后重试。");
    });
  });

  bootstrap();
})();
