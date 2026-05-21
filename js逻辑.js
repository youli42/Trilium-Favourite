// 收藏夹面板 - 展示所有带有指定标签的笔记
(function() {
  'use strict';

  /* ================================================================
     CONFIG — 从 promoted 属性读取，用户可在笔记属性中修改

     注意：必须使用 api.startNote 而非 api.currentNote。
     api.currentNote 返回的是 JS 代码笔记本身，
     而 api.startNote 才返回被渲染的收藏夹面板笔记（即带 promoted 属性的那个）。
     ================================================================ */

  var _cfgFavLabel, _cfgDescLines;

  function readConfig() {
    try {
      var src = api.startNote;
      if (src && typeof src.getLabelValue === 'function') {
        var raw = (src.getLabelValue('favLabel') || 'favourite').trim();
        _cfgFavLabel  = raw.replace(/^#+/, '');  // 去除用户可能误输入的 # 前缀
        _cfgDescLines = parseInt(src.getLabelValue('favDescLines')) || 3;
        return;
      }
    } catch (e) { /* 降级到默认值 */ }

    _cfgFavLabel  = 'favourite';
    _cfgDescLines = 3;
  }

  readConfig();

  // 将 descLines 写入 CSS 变量，控制描述行数
  document.getElementById('fav-app').style.setProperty('--fav-desc-lines', _cfgDescLines);

  /* ================================================================
     HELPERS
     ================================================================ */

  function getFallbackIcon(type, mime) {
    var icons = {
      text: '📝', code: '💻', file: '📄', image: '🖼️',
      search: '🔍', book: '📓', relationMap: '🔗', render: '🎨',
      mermaid: '🔷', webView: '🌐'
    };
    if (mime) {
      if (mime.indexOf('mermaid') >= 0) return icons.mermaid;
      if (mime.indexOf('javascript') >= 0) return '🟨';
      if (mime.indexOf('html') >= 0) return icons.webView;
    }
    return icons[type] || '📌';
  }

  function stripHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent || d.innerText || '';
  }

  function truncate(text, maxLen) {
    if (!text) return '';
    var t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= maxLen) return t;
    return t.substring(0, maxLen) + '…';
  }

  /* 从标签列表中找到笔记自己设置的 iconClass（不含继承） */
  function findOwnIconClass(labels) {
    for (var i = 0; i < labels.length; i++) {
      if (labels[i] && labels[i].name === 'iconClass') {
        return labels[i].value || '';
      }
    }
    return '';
  }

  /* ── system label exclude list ── */
  var EXCLUDED_LABELS = {
    'color': true,
    'iconClass': true,
    'archived': true,
    'cssClass': true,
    'workspace': true,
    'workspaceIcon': true,
    'workspaceTabIcon': true,
    'keyboardShortcut': true,
    'pageSize': true,
    'disableInclusion': true,
    'searchHome': true,
    'inbox': true,
    'calendarRoot': true,
    'dateNote': true,
    'sorted': true,
    'label': true,
    'favPanelId': true
  };

  function isSystemLabel(name) {
    return EXCLUDED_LABELS[name] === true
      || name === _cfgFavLabel
      || name.indexOf('label:') === 0
      || name.indexOf('relation:') === 0;
  }

  /* ================================================================
     STATE
     ================================================================ */

  var allNotes   = [];
  var tagMap     = {};    // key → { name, value, display, count }
  var activeTags = {};    // key → true
  var searchTerm = '';

  /* ================================================================
     DOM REFS
     ================================================================ */

  var searchInput, tagBarEl, metaEl, gridEl;

  /* ================================================================
     LOAD
     ================================================================ */

  async function loadFavourites() {
    metaEl.textContent = '加载中…';
    gridEl.innerHTML   = '';
    tagBarEl.innerHTML = '';
    allNotes   = [];
    tagMap     = {};
    activeTags = {};

    try {
      var searchQuery = '#' + _cfgFavLabel;
      var notes = await api.searchForNotes(searchQuery);

      if (!notes || notes.length === 0) {
        metaEl.textContent = '暂无收藏笔记';
        gridEl.innerHTML =
          '<div class="fav-empty">'
            + '<div class="fav-empty-icon">⭐</div>'
            + '<p>还没有收藏笔记</p>'
            + '<p class="fav-hint">给笔记添加 #' + _cfgFavLabel + ' 标签即可在此显示</p>'
          + '</div>';
        return;
      }

      for (var i = 0; i < notes.length; i++) {
        var note = notes[i];

        var labels;
        try {
          labels = note.getLabels() || [];
        } catch (e) {
          labels = [];
        }

        /* 提取笔记自己的 iconClass */
        var ownIcon = findOwnIconClass(labels);

        /* 收集标签（非系统标签） */
        var tags = [];
        for (var j = 0; j < labels.length; j++) {
          var lb = labels[j];
          if (!lb || isSystemLabel(lb.name)) continue;
          var display = lb.value ? lb.name + ': ' + lb.value : lb.name;
          var key     = lb.name + '\x00' + (lb.value || '');
          tags.push({ name: lb.name, value: lb.value || '', display: display, key: key });
          if (!tagMap[key]) {
            tagMap[key] = { name: lb.name, value: lb.value || '', display: display, count: 0 };
          }
          tagMap[key].count++;
        }

        /* 获取内容用于描述 */
        var description = '';
        try {
          var content = await note.getContent();
          description = truncate(stripHtml(content), 200);
        } catch (e) {
          // 某些笔记类型不支持 getContent
        }

        allNotes.push({
          noteId: note.noteId,
          title:  note.title,
          type:   note.type,
          mime:   note.mime,
          iconClass: ownIcon,
          description: description,
          tags: tags
        });
      }

      renderTagBar();
      metaEl.textContent = notes.length + ' 条收藏笔记（标签: #' + _cfgFavLabel + '）';
      renderCards();

    } catch (e) {
      metaEl.textContent = '加载失败';
      gridEl.innerHTML =
        '<div class="fav-empty">'
          + '<div class="fav-empty-icon">⚠️</div>'
          + '<p>' + e.message + '</p>'
        + '</div>';
      console.error('收藏夹面板加载失败', e);
    }
  }

  /* ================================================================
     TAG BAR
     ================================================================ */

  function renderTagBar() {
    tagBarEl.innerHTML = '';

    var keys  = Object.keys(tagMap);
    var sorted = keys.map(function(k) { return tagMap[k]; })
      .sort(function(a, b) { return b.count - a.count || a.display.localeCompare(b.display); });

    if (sorted.length === 0) return;

    for (var i = 0; i < sorted.length; i++) {
      var t = sorted[i];
      (function(key, display, count) {
        var chip = document.createElement('span');
        chip.className = 'fav-tag-chip';
        if (activeTags[key]) chip.classList.add('active');
        chip.textContent = display + ' ' + count;
        chip.addEventListener('click', function() {
          toggleTagFilter(key);
        });
        tagBarEl.appendChild(chip);
      })(t.name + '\x00' + t.value, t.display, t.count);
    }
  }

  function updateTagBarActiveState() {
    var chips = tagBarEl.querySelectorAll('.fav-tag-chip');
    var keys  = Object.keys(tagMap);
    var sorted = keys.map(function(k) { return tagMap[k]; })
      .sort(function(a, b) { return b.count - a.count || a.display.localeCompare(b.display); });

    for (var i = 0; i < sorted.length && i < chips.length; i++) {
      var key = sorted[i].name + '\x00' + sorted[i].value;
      if (activeTags[key]) {
        chips[i].classList.add('active');
      } else {
        chips[i].classList.remove('active');
      }
    }
  }

  function toggleTagFilter(key) {
    if (activeTags[key]) {
      delete activeTags[key];
    } else {
      activeTags[key] = true;
    }
    updateTagBarActiveState();
    renderCards();
  }

  /* ================================================================
     RENDER CARDS
     ================================================================ */

  function renderCards() {
    gridEl.innerHTML = '';

    /* ── filter ── */

    var filtered = allNotes.filter(function(n) {
      // 标签筛选（OR 逻辑）
      var tagKeys = Object.keys(activeTags);
      if (tagKeys.length > 0) {
        var noteTagKeys = {};
        for (var t = 0; t < n.tags.length; t++) {
          noteTagKeys[n.tags[t].key] = true;
        }
        var matchTag = false;
        for (var k = 0; k < tagKeys.length; k++) {
          if (noteTagKeys[tagKeys[k]]) { matchTag = true; break; }
        }
        if (!matchTag) return false;
      }

      // 文字筛选（标题 / 描述 / 标签名）
      if (searchTerm) {
        var st = searchTerm.toLowerCase();
        var inTitle = n.title.toLowerCase().indexOf(st) >= 0;
        var inDesc  = n.description.toLowerCase().indexOf(st) >= 0;
        var inTags  = false;
        for (var t = 0; t < n.tags.length; t++) {
          if (n.tags[t].display.toLowerCase().indexOf(st) >= 0) { inTags = true; break; }
        }
        if (!inTitle && !inDesc && !inTags) return false;
      }

      return true;
    });

    /* ── meta ── */

    var total = allNotes.length;
    metaEl.textContent = filtered.length < total
      ? filtered.length + ' / ' + total + ' 条收藏笔记（标签: #' + _cfgFavLabel + '）'
      : total + ' 条收藏笔记（标签: #' + _cfgFavLabel + '）';

    if (filtered.length === 0) {
      gridEl.innerHTML =
        '<div class="fav-empty">'
          + '<div class="fav-empty-icon">🔍</div>'
          + '<p>没有匹配的笔记</p>'
        + '</div>';
      return;
    }

    /* ── build cards ── */

    for (var i = 0; i < filtered.length; i++) {
      var n = filtered[i];
      var card = document.createElement('div');
      card.className = 'fav-card';
      (function(id) {
        card.addEventListener('click', function() { api.activateNote(id); });
      })(n.noteId);

      /* ── title row ── */
      var titleRow = document.createElement('div');
      titleRow.className = 'fav-card-title';

      var iconEl = document.createElement('span');
      iconEl.className = 'fav-card-title-icon';

      if (n.iconClass) {
        // 使用笔记自己的图标（Box Icons CSS 类）
        iconEl.className = 'fav-card-title-icon i-class';
        var iTag = document.createElement('i');
        iTag.className = n.iconClass;
        iconEl.appendChild(iTag);
      } else {
        // 回退到类型 emoji
        iconEl.textContent = getFallbackIcon(n.type, n.mime);
      }

      var titleText = document.createElement('span');
      titleText.className = 'fav-card-title-text';
      titleText.textContent = n.title;
      titleText.title = n.title;

      titleRow.appendChild(iconEl);
      titleRow.appendChild(titleText);
      card.appendChild(titleRow);

      /* ── description ── */
      if (n.description) {
        var descEl = document.createElement('div');
        descEl.className = 'fav-card-desc';
        descEl.textContent = n.description;
        card.appendChild(descEl);
      }

      /* ── tags ── */
      if (n.tags.length > 0) {
        var tagsEl = document.createElement('div');
        tagsEl.className = 'fav-card-tags';

        for (var t = 0; t < n.tags.length; t++) {
          (function(tagInfo) {
            var tagEl = document.createElement('span');
            tagEl.className = 'fav-card-tag';
            tagEl.textContent = tagInfo.display;
            // 点击卡片标签 → 切换筛选
            tagEl.addEventListener('click', function(e) {
              e.stopPropagation();
              toggleTagFilter(tagInfo.key);
            });
            tagsEl.appendChild(tagEl);
          })(n.tags[t]);
        }

        card.appendChild(tagsEl);
      }

      gridEl.appendChild(card);
    }
  }

  /* ================================================================
     INIT
     ================================================================ */

  function init() {
    searchInput = document.getElementById('fav-search-input');
    tagBarEl    = document.getElementById('fav-tag-bar');
    metaEl      = document.getElementById('fav-meta');
    gridEl      = document.getElementById('fav-grid');

    loadFavourites();

    searchInput.addEventListener('input', function() {
      searchTerm = this.value.trim();
      renderCards();
    });
  }

  init();
})();
