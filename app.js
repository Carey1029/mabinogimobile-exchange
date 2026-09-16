(function () {
  "use strict";

  var state = {
    data: null,
    mode: "item", // "item" | "resource"
  };

  var els = {
    modeTabs: document.querySelectorAll(".mode-tab"),
    select: document.getElementById("picker-select"),
    reminderNote: document.querySelector(".reminder-note"),
    resultArea: document.getElementById("result-area"),
    notesArea: document.getElementById("notes-area"),
    notesList: document.getElementById("notes-list"),
    updatedAt: document.getElementById("updated-at"),
  };

  var CATEGORY_TXT_CLASS = {
    "加工品": "txt-processed",
    "料理成品": "txt-cooking",
    "一般取得材料": "txt-material",
    "NPC物品": "txt-npc",
  };
  var DEFAULT_TXT_CLASS = "txt-other";

  var MAX_DEPTH = 8;

  /* ---------------- 星空裝飾（不需等資料載入即可先顯示） ---------------- */
  (function buildSky() {
    var sky = document.getElementById("sky-deco");
    if (!sky) return;
    var starCount = 55;
    for (var i = 0; i < starCount; i++) {
      var s = document.createElement("div");
      s.className = "star";
      var size = (Math.random() * 2.2 + 1).toFixed(1);
      s.style.width = size + "px";
      s.style.height = size + "px";
      s.style.top = (Math.random() * 100).toFixed(1) + "%";
      s.style.left = (Math.random() * 100).toFixed(1) + "%";
      s.style.animationDelay = (Math.random() * 3.2).toFixed(2) + "s";
      s.style.boxShadow = "0 0 " + (size * 2) + "px rgba(255,255,255,0.9)";
      sky.appendChild(s);
    }
    var sparklePositions = [
      [6, 10], [88, 16], [14, 68], [92, 62], [50, 6], [76, 84],
    ];
    sparklePositions.forEach(function (pos, i) {
      var sp = document.createElement("div");
      sp.className = "sparkle";
      sp.style.top = pos[0] + "%";
      sp.style.left = pos[1] + "%";
      sp.style.animationDelay = (i * 0.6).toFixed(2) + "s";
      sp.innerHTML = window.MapleIcons ? window.MapleIcons.markup("sparkle4") : "";
      sky.appendChild(sp);
    });
  })();

  function txtClass(name) {
    var cat = (state.data.itemCategory || {})[name];
    return CATEGORY_TXT_CLASS[cat] || DEFAULT_TXT_CLASS;
  }

  function categoryIcon(name) {
    var cat = (state.data.itemCategory || {})[name];
    return window.MapleIcons.categoryIconName(cat);
  }

  fetch("data.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("data.json 讀取失敗 (" + res.status + ")");
      return res.json();
    })
    .then(function (json) {
      state.data = json;
      renderNotes();
      renderUpdatedAt();
      populateSelect();
      wireEvents();
      window.MapleIcons.apply(document);
    })
    .catch(function (err) {
      els.resultArea.innerHTML =
        '<div class="empty-state"><span class="empty-icon" data-icon="warning"></span>' +
        "<p>無法載入資料 (data.json)。<br>請確認 data.json 與 index.html 放在同一層目錄。<br>" +
        "<small>" + escapeHtml(err.message) + "</small></p></div>";
      window.MapleIcons.apply(els.resultArea);
      console.error(err);
    });

  function zhSort(a, b) { return a.localeCompare(b, "zh-Hant-TW"); }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function renderUpdatedAt() {
    var iso = state.data.generatedAt;
    var text = "資料版本：未知";
    if (iso) {
      try {
        var d = new Date(iso);
        text =
          "資料更新時間：" +
          d.getFullYear() + "/" + pad2(d.getMonth() + 1) + "/" + pad2(d.getDate()) +
          " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + "（依瀏覽器時區顯示）";
      } catch (e) {}
    }
    els.updatedAt.textContent = text;
  }

  function renderNotes() {
    var notes = state.data.notes || [];
    if (!notes.length) return;
    els.notesArea.hidden = false;
    els.notesList.innerHTML = notes
      .map(function (n) {
        var parts = [];
        if (n.region) parts.push(n.region);
        if (n.npc) parts.push(n.npc);
        return "<li>" + escapeHtml(parts.join(" · ")) + "</li>";
      })
      .join("");
  }

  /* ---------------- Select population ---------------- */

  function categoryOrder() {
    return state.data.categoryOrder || ["加工品", "料理成品", "一般取得材料", "NPC物品", "未分類"];
  }

  function namesForMode() {
    var items = state.data.items || {};
    if (state.mode === "item") return Object.keys(items);
    var set = {};
    Object.keys(items).forEach(function (itemName) {
      items[itemName].forEach(function (recipe) {
        if (recipe.resource && recipe.resource.name) set[recipe.resource.name] = true;
      });
    });
    return Object.keys(set);
  }

  function populateSelect() {
    var names = namesForMode();
    var byCategory = {};
    names.forEach(function (name) {
      var cat = (state.data.itemCategory || {})[name] || "未分類";
      byCategory[cat] = byCategory[cat] || [];
      byCategory[cat].push(name);
    });

    var html = '<option value="">— 請選擇 —</option>';
    categoryOrder().forEach(function (cat) {
      var list = byCategory[cat];
      if (!list || !list.length) return;
      list.sort(zhSort);
      html += '<optgroup label="【' + escapeHtml(cat) + '】">';
      list.forEach(function (name) {
        html += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + "</option>";
      });
      html += "</optgroup>";
    });
    els.select.innerHTML = html;

    setReminderText(
      state.mode === "item"
        ? "目前僅列出有兌換價值之物品。數量為單日可兌換最大值。"
        : "以下列出目前資料中所有可作為兌換素材的資源。數量為單日可兌換最大值。"
    );
  }

  function setReminderText(text) {
    var iconSpan = els.reminderNote.querySelector(".reminder-icon");
    els.reminderNote.innerHTML = "";
    els.reminderNote.appendChild(iconSpan);
    els.reminderNote.appendChild(document.createTextNode(text));
  }

  function wireEvents() {
    els.modeTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        els.modeTabs.forEach(function (t) {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        state.mode = tab.getAttribute("data-mode");
        populateSelect();
        window.MapleIcons.apply(document);
        showEmptyState();
      });
    });

    els.select.addEventListener("change", function () {
      var name = els.select.value;
      if (!name) { showEmptyState(); return; }
      renderFullResult(name);
      window.MapleIcons.apply(els.resultArea);
    });

    els.resultArea.addEventListener("click", function (e) {
      var el = e.target.closest("[data-jump]");
      if (el) jumpTo(el.getAttribute("data-jump"));
    });
  }

  function showEmptyState() {
    els.resultArea.innerHTML =
      '<div class="empty-state"><span class="empty-icon" data-icon="book"></span>' +
      "<p>選擇上方頁籤，並從下拉選單挑一個名稱，<br>手冊會翻開對應的兌換路線。</p></div>";
    window.MapleIcons.apply(els.resultArea);
  }

  function jumpTo(name) {
    var items = state.data.items || {};
    state.mode = items[name] ? "item" : "resource";
    els.modeTabs.forEach(function (t) {
      var active = t.getAttribute("data-mode") === state.mode;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    populateSelect();
    els.select.value = name;
    renderFullResult(name);
    window.MapleIcons.apply(document);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- 單一節點（上游／下游共用同一種樣式） ---------------- */

  function stepBadge(n) {
    return n ? '<span class="step-num">' + n + "</span>" : "";
  }

  function flowNodeHtml(itemName, recipe, stepIndex) {
    var region = recipe.region ? escapeHtml(recipe.region) : "未知地區";
    var npc = recipe.npc ? escapeHtml(recipe.npc) : "未知NPC";
    var star = recipe.recommended
      ? '<span class="flow-star" data-icon="star" title="推薦兌換"></span>'
      : "";
    var qtyLine = recipe.resultQty
      ? '<span class="meta-dot">·</span><span class="result-qty">每次兌換可得 × ' + recipe.resultQty + "</span>"
      : "";

    var needHtml = "";
    if (recipe.resource && recipe.resource.name) {
      var isCraftable = !!state.data.items[recipe.resource.name];
      var cls = txtClass(recipe.resource.name);
      var jumpAttr = isCraftable ? ' data-jump="' + escapeHtml(recipe.resource.name) + '"' : "";
      var jumpCls = isCraftable ? " is-jumpable" : "";
      needHtml =
        '<div class="need-line">消耗：<span class="res-name ' + cls + jumpCls + '"' + jumpAttr + ">" +
        escapeHtml(recipe.resource.name) + "</span> × " + recipe.resource.qty + "</div>";
    }

    return (
      '<div class="flow-node">' +
      '<div class="flow-node-head">' +
      stepBadge(stepIndex) +
      '<span class="flow-node-icon" data-icon="' + categoryIcon(itemName) + '"></span>' +
      '<span class="flow-node-name ' + txtClass(itemName) + '">' + escapeHtml(itemName) + "</span>" +
      star +
      "</div>" +
      '<div class="flow-node-meta">向 <span class="npc-name">' + npc + "</span>" +
      '<span class="region-plain">（' + region + "）</span>兌換" + qtyLine + "</div>" +
      needHtml +
      "</div>"
    );
  }

  function arrowHtml() {
    return '<div class="flow-arrow"><span class="flow-arrow-icon" data-icon="arrowDown"></span></div>';
  }

  /* ---------------- 上游：如何取得（依「先取得的先顯示」排序） ---------------- */

  function buildUpstreamFlow(itemName, visitedSet, depth, stepCounter) {
    var recipes = (state.data.items || {})[itemName];
    if (!recipes || depth > MAX_DEPTH) return "";

    var baseVisited = new Set(visitedSet);
    baseVisited.add(itemName);

    var branchesHtml = [];
    recipes.forEach(function (recipe) {
      var subHtml = "";
      var subName = recipe.resource ? recipe.resource.name : null;
      if (subName && state.data.items[subName] && !baseVisited.has(subName)) {
        subHtml = buildUpstreamFlow(subName, baseVisited, depth + 1, stepCounter);
      }
      stepCounter.n += 1;
      var thisNode = flowNodeHtml(itemName, recipe, stepCounter.n);
      var branch = subHtml ? subHtml + arrowHtml() + thisNode : thisNode;
      branchesHtml.push('<div class="flow-branch">' + branch + "</div>");
    });

    return branchesHtml.join('<div class="flow-or">或</div>');
  }

  /* ---------------- 下游：可以進一步兌換成（自然按時間順序） ---------------- */

  function findDownstreamUsers(name) {
    var items = state.data.items || {};
    var users = [];
    Object.keys(items).forEach(function (itemName) {
      items[itemName].forEach(function (recipe) {
        if (recipe.resource && recipe.resource.name === name) {
          users.push({ itemName: itemName, recipe: recipe });
        }
      });
    });
    return users;
  }

  function buildDownstreamFlow(name, visitedSet, depth, stepCounter) {
    var users = findDownstreamUsers(name);
    if (!users.length || depth > MAX_DEPTH) return "";

    var visited = new Set(visitedSet);
    visited.add(name);

    var parts = [];
    if (users.length > 1) {
      parts.push('<div class="flow-branch-caption">「' + escapeHtml(name) + '」同時可用於以下 ' + users.length + ' 種兌換：</div>');
    }

    users.forEach(function (u, idx) {
      stepCounter.n += 1;
      var branchHtml = arrowHtml() + flowNodeHtml(u.itemName, u.recipe, stepCounter.n);
      if (!visited.has(u.itemName)) {
        branchHtml += buildDownstreamFlow(u.itemName, visited, depth + 1, stepCounter);
      }
      parts.push('<div class="flow-branch">' + branchHtml + "</div>");
    });

    return parts.join("");
  }

  /* ---------------- 統一結果呈現：不論從哪個模式選擇，都完整顯示上下游 ---------------- */

  function renderFullResult(name) {
    var items = state.data.items || {};
    var isObtainable = !!items[name];
    var html = "";

    html +=
      '<div class="target-plaque"><span class="plaque-icon" data-icon="' + categoryIcon(name) + '"></span><div>' +
      '<div class="plaque-title">' + escapeHtml(name) + "</div>" +
      '<div class="plaque-sub">兌換手冊資訊</div></div></div>';

    // 如何取得
    html += '<div class="section-label"><span class="sec-icon" data-icon="chest"></span>如何取得「' + escapeHtml(name) + '」</div>';
    if (isObtainable) {
      var upCounter = { n: 0 };
      html += '<div class="flow">' + buildUpstreamFlow(name, new Set(), 0, upCounter) + "</div>";
    } else {
      html +=
        '<p class="hint-line">「' + escapeHtml(name) +
        '」目前不是可直接向 NPC 兌換的物品，通常是透過採集、戰鬥掉落或料理／加工取得的基礎素材。</p>';
    }

    // 可以進一步兌換成
    html += '<div class="section-label"><span class="sec-icon" data-icon="branch"></span>「' + escapeHtml(name) + '」可以進一步兌換成</div>';
    var downCounter = { n: 0 };
    var downstreamHtml = buildDownstreamFlow(name, new Set(), 0, downCounter);
    if (downstreamHtml) {
      html += '<div class="flow">' + downstreamHtml + "</div>";
    } else {
      html += '<p class="hint-line">目前資料中沒有找到需要用「' + escapeHtml(name) + '」兌換的其他物品，這裡就是這條路線的終點。</p>';
    }

    els.resultArea.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
