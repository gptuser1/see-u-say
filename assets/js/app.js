// 主逻辑：参考图管理、尺寸校验、生成图片、提示词优化
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  // ---- 元素引用 ----
  var promptEl = $("prompt");
  var widthEl = $("width");
  var heightEl = $("height");
  var sizeHint = $("size-hint");
  var generateBtn = $("generate-btn");

  var optimizeToggle = $("optimize-toggle");
  var optimizeBody = $("optimize-body");
  var providerSelect = $("provider-select");
  var modelSelect = $("model-select");
  var optimizeRule = $("optimize-rule");
  var thinkingToggle = $("thinking-toggle");
  var temperatureEl = $("temperature");
  var topPEl = $("top-p");
  var maxTokensEl = $("max-tokens");
  var optimizeBtn = $("optimize-btn");
  var optimizeResult = $("optimize-result");
  var optimizedPromptEl = $("optimized-prompt");
  var reoptimizeBtn = $("reoptimize-btn");
  var confirmPromptBtn = $("confirm-prompt-btn");

  var resultEmpty = $("result-empty");
  var resultLoading = $("result-loading");
  var resultError = $("result-error");
  var errorMsg = $("error-msg");
  var resultFigure = $("result-figure");
  var resultImage = $("result-image");
  var resultMeta = $("result-meta");
  var loadingText = $("loading-text");

  // 参考图槽位状态：每个槽位存 { blob, previewUrl, width, height } 或 null
  var refSlots = [null, null, null, null];
  var providersLoaded = false;
  var confirmedPrompt = null; // 优化确认后用于生成的 prompt

  // 鉴权：所有请求携带令牌；401 时清除令牌并要求重新登录
  function authHeaders(extra) {
    var h = extra || {};
    var token = (window.getAccessToken && window.getAccessToken()) || "";
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }
  function handleUnauthorized(resp) {
    if (resp && resp.status === 401 && window.logout) {
      showError("访问令牌已失效，请重新登录。");
      window.logout();
      return true;
    }
    return false;
  }

  // 退出登录
  var logoutBtn = $("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      if (window.logout) window.logout();
    });
  }

  // ==================== 尺寸校验 ====================
  function isMultipleOf64(v) { return v > 0 && v % 64 === 0; }
  function inRange(v) { return v >= 256 && v <= 1920; }

  function validateSize() {
    var w = parseInt(widthEl.value, 10);
    var h = parseInt(heightEl.value, 10);
    var ok = true;
    var msg = "宽高须为 64 的倍数，范围 256–1920。";
    if (!isMultipleOf64(w) || !inRange(w)) { ok = false; msg = "宽度须为 64 的倍数，范围 256–1920。"; }
    if (!isMultipleOf64(h) || !inRange(h)) { ok = false; msg = "高度须为 64 的倍数，范围 256–1920。"; }
    sizeHint.textContent = msg;
    sizeHint.classList.toggle("error", !ok);
    return ok;
  }
  widthEl.addEventListener("input", validateSize);
  heightEl.addEventListener("input", validateSize);

  // 尺寸预设
  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      widthEl.value = chip.getAttribute("data-w");
      heightEl.value = chip.getAttribute("data-h");
      validateSize();
    });
  });

  // ==================== 参考图槽位 ====================
  var slotEls = document.querySelectorAll(".ref-slot");
  slotEls.forEach(function (slot, idx) {
    var input = slot.querySelector('input[type="file"]');
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) handleFile(idx, input.files[0]);
    });
    // 拖拽支持
    slot.addEventListener("dragover", function (e) { e.preventDefault(); slot.classList.add("drag"); });
    slot.addEventListener("dragleave", function () { slot.classList.remove("drag"); });
    slot.addEventListener("drop", function (e) {
      e.preventDefault();
      slot.classList.remove("drag");
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(idx, f);
    });
  });

  function handleFile(idx, file) {
    if (!file.type.match(/image\/(png|jpeg|webp)/)) {
      showError("仅支持 PNG / JPEG / WebP 格式。");
      return;
    }
    ImageUtils.process(file).then(function (res) {
      setSlot(idx, res);
    }).catch(function () {
      showError("图片处理失败，请换一张。");
    });
  }

  function setSlot(idx, res) {
    refSlots[idx] = res;
    var slot = slotEls[idx];
    slot.classList.add("has-image");
    // 清空旧内容
    slot.querySelectorAll("img, .ref-slot__remove").forEach(function (n) { n.remove(); });
    var img = document.createElement("img");
    img.src = res.previewUrl;
    img.alt = "参考图 " + (idx + 1);
    slot.appendChild(img);
    var rm = document.createElement("button");
    rm.type = "button";
    rm.className = "ref-slot__remove";
    rm.textContent = "×";
    rm.setAttribute("aria-label", "移除参考图");
    rm.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      clearSlot(idx);
    });
    slot.appendChild(rm);
  }

  function clearSlot(idx) {
    refSlots[idx] = null;
    var slot = slotEls[idx];
    slot.classList.remove("has-image");
    slot.querySelectorAll("img, .ref-slot__remove").forEach(function (n) { n.remove(); });
    slot.querySelector('input[type="file"]').value = "";
  }

  // ==================== 结果展示 ====================
  function showState(state) {
    resultEmpty.hidden = state !== "empty";
    resultLoading.hidden = state !== "loading";
    resultError.hidden = state !== "error";
    resultFigure.hidden = state !== "figure";
  }
  function showError(msg) {
    errorMsg.textContent = msg;
    showState("error");
  }
  function showLoading(text) {
    loadingText.textContent = text || "正在生成…";
    showState("loading");
  }
  function showImage(b64, meta) {
    resultImage.src = "data:image/png;base64," + b64;
    resultMeta.textContent = meta || "";
    showState("figure");
  }

  // ==================== 生成图片 ====================
  generateBtn.addEventListener("click", function () {
    if (!validateSize()) return;
    var prompt = confirmedPrompt || promptEl.value.trim();
    if (!prompt) { showError("请输入提示词。"); return; }
    generate(prompt);
  });

  function generate(prompt) {
    showLoading("正在生成图片…");
    generateBtn.disabled = true;

    var form = new FormData();
    form.append("prompt", prompt);
    form.append("width", widthEl.value);
    form.append("height", heightEl.value);
    refSlots.forEach(function (res, idx) {
      if (res) form.append("input_image_" + idx, res.blob, "ref_" + idx + ".png");
    });

    fetch("/api/generate", { method: "POST", headers: authHeaders(), body: form })
      .then(function (r) {
        if (handleUnauthorized(r)) throw new Error("unauthorized");
        return r.json().then(function (d) { return { ok: r.ok, data: d }; });
      })
      .then(function (res) {
        generateBtn.disabled = false;
        var d = res.data || {};
        if (d.success && d.image) {
          var meta = widthEl.value + "×" + heightEl.value + " · " + refSlots.filter(Boolean).length + " 张参考图";
          showImage(d.image, meta);
        } else {
          var msg = d.error || "生成失败，请重试。";
          if (d.flagged) msg = "内容被安全过滤拦截，请调整提示词后重试。";
          showError(msg);
        }
      })
      .catch(function (err) {
        generateBtn.disabled = false;
        if (err.message !== "unauthorized") showError("网络错误：" + (err.message || "请求失败"));
      });
  }

  // ==================== 提示词优化 ====================
  optimizeToggle.addEventListener("change", function () {
    var on = optimizeToggle.checked;
    optimizeBody.hidden = !on;
    if (on) {
      optimizeBtn.disabled = false;
      if (!providersLoaded) loadProviders();
    } else {
      optimizeBtn.disabled = true;
      optimizeResult.hidden = true;
      confirmedPrompt = null;
    }
  });

  function loadProviders() {
    fetch("/api/providers", { headers: authHeaders() }).then(function (r) {
      if (handleUnauthorized(r)) throw new Error("unauthorized");
      return r.json();
    }).then(function (list) {
      if (!list || !list.length) {
        providerSelect.innerHTML = '<option>未配置提供商</option>';
        providerSelect.disabled = true;
        modelSelect.disabled = true;
        optimizeBtn.disabled = true;
        return;
      }
      providersLoaded = true;
      providerSelect.innerHTML = "";
      list.forEach(function (p, i) {
        var opt = document.createElement("option");
        opt.value = i;
        opt.textContent = p.name;
        providerSelect.appendChild(opt);
      });
      providerSelect.disabled = false;
      updateModels(list, 0);
      providerSelect.onchange = function () {
        updateModels(list, parseInt(providerSelect.value, 10));
      };
    }).catch(function (err) {
      if (err.message !== "unauthorized") providerSelect.innerHTML = '<option>加载失败</option>';
    });
  }

  function updateModels(list, idx) {
    modelSelect.innerHTML = "";
    var models = (list[idx] && list[idx].models) || [];
    models.forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      modelSelect.appendChild(opt);
    });
    modelSelect.disabled = !models.length;
  }

  function doOptimize() {
    var rule = optimizeRule.value.trim();
    var userPrompt = promptEl.value.trim();
    if (!userPrompt) { showError("请先输入原始提示词。"); return; }
    optimizeBtn.disabled = true;
    reoptimizeBtn.disabled = true;
    var old = optimizeBtn.textContent;
    optimizeBtn.textContent = "优化中…";

    var body = {
      providerIndex: parseInt(providerSelect.value, 10) || 0,
      model: modelSelect.value,
      systemPrompt: rule,
      userPrompt: userPrompt,
      thinkingEnabled: thinkingToggle.checked,
      temperature: parseFloat(temperatureEl.value),
      topP: parseFloat(topPEl.value),
      maxTokens: parseInt(maxTokensEl.value, 10),
    };

    fetch("/api/optimize", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    })
      .then(function (r) {
        if (handleUnauthorized(r)) throw new Error("unauthorized");
        return r.json();
      })
      .then(function (d) {
        optimizeBtn.disabled = false;
        reoptimizeBtn.disabled = false;
        optimizeBtn.textContent = old;
        if (d.success && d.optimizedPrompt != null) {
          optimizedPromptEl.value = d.optimizedPrompt;
          optimizeResult.hidden = false;
        } else {
          showError(d.error || "优化失败，请检查提供商配置。");
        }
      })
      .catch(function (err) {
        optimizeBtn.disabled = false;
        reoptimizeBtn.disabled = false;
        optimizeBtn.textContent = old;
        if (err.message !== "unauthorized") showError("网络错误：" + (err.message || "请求失败"));
      });
  }

  optimizeBtn.addEventListener("click", doOptimize);
  reoptimizeBtn.addEventListener("click", doOptimize);

  // 确认传入：把优化结果作为生成用的 prompt
  confirmPromptBtn.addEventListener("click", function () {
    var p = optimizedPromptEl.value.trim();
    if (!p) return;
    confirmedPrompt = p;
    promptEl.value = p;
    // 滚动到生成按钮
    generateBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // 用户手动改了 prompt 后，清除已确认状态
  promptEl.addEventListener("input", function () { confirmedPrompt = null; });

  // 初始校验
  validateSize();
})();
