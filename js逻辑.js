// 收藏夹面板 - 展示所有带有指定标签的笔记
(function() {
  'use strict';

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

  function findOwnValue(labels, name) {
    for (var i = 0; i < labels.length; i++) {
      if (labels[i] && labels[i].name === name) return labels[i].value || '';
    }
    return '';
  }

  var EXCLUDED_LABELS = {
    color: true, iconClass: true, archived: true, cssClass: true,
    workspace: true, workspaceIcon: true, workspaceTabIcon: true,
    keyboardShortcut: true, pageSize: true, disableInclusion: true,
    searchHome: true, inbox: true, calendarRoot: true, dateNote: true,
    sorted: true, label: true, favPanelId: true
  };

  function isSystemLabel(name) {
    return EXCLUDED_LABELS[name] === true
      || name === _cfgFavLabel
      || name.indexOf('label:') === 0
      || name.indexOf('relation:') === 0;
  }

  var _cfgFavLabel, _cfgDescLines;
  var allNotes = [], tagMap = {}, activeTags = {}, searchTerm = '';
  var searchInput, tagBarEl, metaEl, gridEl;

  async function readConfig() {
    var results = await api.searchForNotes('#favPanelId = main');
    if (!results || results.length === 0) {
      throw new Error('未找到面板配置：收藏夹面板缺少 #favPanelId = main 标签');
    }
    var panelNote = results[0];
    var raw = panelNote.getLabelValue('favLabel');
    if (!raw) {
      throw new Error('缺少 #favLabel 属性，请在笔记属性中设置要搜索的标签名');
    }
    _cfgFavLabel  = raw.replace(/^#+/, '');
    _cfgDescLines = parseInt(panelNote.getLabelValue('favDescLines')) || 3;
    document.getElementById('fav-app').style.setProperty('--fav-desc-lines', _cfgDescLines);
  }

  async function loadFavourites() {
    metaEl.textContent = '加载中…';
    gridEl.innerHTML = '';
    tagBarEl.innerHTML = '';
    allNotes = [];
    tagMap = {};
    activeTags = {};

    try {
      await readConfig();

      var notes = await api.searchForNotes('#' + _cfgFavLabel);
      if (!notes || notes.length === 0) {
        metaEl.textContent = '暂无收藏笔记';
        gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">⭐</div><p>还没有收藏笔记</p><p class="fav-hint">给笔记添加 #' + _cfgFavLabel + ' 标签即可在此显示</p></div>';
        return;
      }

      for (var i = 0; i < notes.length; i++) {
        var note = notes[i];
        var labels;
        try { labels = note.getLabels() || []; } catch (e) { labels = []; }

        var ownIcon  = findOwnValue(labels, 'iconClass');
        var ownColor = findOwnValue(labels, 'color');

        var tags = [];
        for (var j = 0; j < labels.length; j++) {
          var lb = labels[j];
          if (!lb || lb.name === 'color' || lb.name === 'iconClass' || isSystemLabel(lb.name)) continue;
          var display = lb.value ? lb.name + ': ' + lb.value : lb.name;
          var key = lb.name + '\x00' + (lb.value || '');
          tags.push({ name: lb.name, value: lb.value || '', display: display, key: key });
          if (!tagMap[key]) tagMap[key] = { name: lb.name, value: lb.value || '', display: display, count: 0 };
          tagMap[key].count++;
        }

        var description = '';
        try { description = truncate(stripHtml(await note.getContent()), 200); } catch (e) {}

        allNotes.push({
          noteId: note.noteId, title: note.title, type: note.type, mime: note.mime,
          iconClass: ownIcon, cardColor: ownColor, description: description, tags: tags
        });
      }

      renderTagBar();
      metaEl.textContent = notes.length + ' 条收藏笔记（标签: #' + _cfgFavLabel + '）';
      renderCards();

    } catch (e) {
      metaEl.textContent = '加载失败';
      gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">⚠️</div><p>' + e.message + '</p><p class="fav-hint" style="margin-top:12px;font-size:11px;word-break:break-all;">请在收藏夹面板笔记属性中设置 #favLabel</p></div>';
      console.error('收藏夹面板加载失败', e);
    }
  }

  function renderTagBar() {
    tagBarEl.innerHTML = '';
    var keys = Object.keys(tagMap);
    var sorted = keys.map(function(k) { return tagMap[k]; }).sort(function(a, b) { return b.count - a.count || a.display.localeCompare(b.display); });
    if (sorted.length === 0) return;

    for (var i = 0; i < sorted.length; i++) {
      (function(key, display, count) {
        var chip = document.createElement('span');
        chip.className = 'fav-tag-chip';
        if (activeTags[key]) chip.classList.add('active');
        chip.textContent = display + ' ' + count;
        chip.addEventListener('click', function() { toggleTagFilter(key); });
        tagBarEl.appendChild(chip);
      })(sorted[i].name + '\x00' + sorted[i].value, sorted[i].display, sorted[i].count);
    }
  }

  function updateTagBarActiveState() {
    var chips = tagBarEl.querySelectorAll('.fav-tag-chip');
    var keys = Object.keys(tagMap);
    var sorted = keys.map(function(k) { return tagMap[k]; }).sort(function(a, b) { return b.count - a.count || a.display.localeCompare(b.display); });
    for (var i = 0; i < sorted.length && i < chips.length; i++) {
      var key = sorted[i].name + '\x00' + sorted[i].value;
      chips[i].classList.toggle('active', !!activeTags[key]);
    }
  }

  function toggleTagFilter(key) {
    if (activeTags[key]) delete activeTags[key];
    else activeTags[key] = true;
    updateTagBarActiveState();
    renderCards();
  }

  function renderCards() {
    gridEl.innerHTML = '';
    var filtered = allNotes.filter(function(n) {
      var tagKeys = Object.keys(activeTags);
      if (tagKeys.length > 0) {
        var ntk = {};
        for (var t = 0; t < n.tags.length; t++) ntk[n.tags[t].key] = true;
        var match = false;
        for (var k = 0; k < tagKeys.length; k++) { if (ntk[tagKeys[k]]) { match = true; break; } }
        if (!match) return false;
      }
      if (searchTerm) {
        var st = searchTerm.toLowerCase();
        if (n.title.toLowerCase().indexOf(st) < 0 && n.description.toLowerCase().indexOf(st) < 0) {
          var inTags = false;
          for (var t = 0; t < n.tags.length; t++) { if (n.tags[t].display.toLowerCase().indexOf(st) >= 0) { inTags = true; break; } }
          if (!inTags) return false;
        }
      }
      return true;
    });

    var total = allNotes.length;
    metaEl.textContent = filtered.length < total ? filtered.length + ' / ' + total + ' 条收藏笔记（标签: #' + _cfgFavLabel + '）' : total + ' 条收藏笔记（标签: #' + _cfgFavLabel + '）';

    if (filtered.length === 0) {
      gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">🔍</div><p>没有匹配的笔记</p></div>';
      return;
    }

    for (var i = 0; i < filtered.length; i++) {
      var n = filtered[i];
      var card = document.createElement('div');
      card.className = 'fav-card';
      (function(id) { card.addEventListener('click', function() { api.activateNote(id); }); })(n.noteId);

      if (n.cardColor) card.style.borderColor = n.cardColor;

      var titleRow = document.createElement('div');
      titleRow.className = 'fav-card-title';
      var iconEl = document.createElement('span');
      iconEl.className = 'fav-card-title-icon';
      if (n.iconClass) {
        iconEl.className = 'fav-card-title-icon i-class';
        var iTag = document.createElement('i');
        iTag.className = n.iconClass;
        iconEl.appendChild(iTag);
      } else {
        iconEl.textContent = getFallbackIcon(n.type, n.mime);
      }
      var titleText = document.createElement('span');
      titleText.className = 'fav-card-title-text';
      titleText.textContent = n.title;
      titleText.title = n.title;
      titleRow.appendChild(iconEl);
      titleRow.appendChild(titleText);
      if (n.cardColor) titleText.style.color = n.cardColor;
      card.appendChild(titleRow);

      if (n.description) {
        var descEl = document.createElement('div');
        descEl.className = 'fav-card-desc';
        descEl.textContent = n.description;
        card.appendChild(descEl);
      }

      if (n.tags.length > 0) {
        var tagsEl = document.createElement('div');
        tagsEl.className = 'fav-card-tags';
        for (var t = 0; t < n.tags.length; t++) {
          (function(ti) {
            var tagEl = document.createElement('span');
            tagEl.className = 'fav-card-tag';
            tagEl.textContent = ti.display;
            tagEl.addEventListener('click', function(e) { e.stopPropagation(); toggleTagFilter(ti.key); });
            tagsEl.appendChild(tagEl);
          })(n.tags[t]);
        }
        card.appendChild(tagsEl);
      }

      gridEl.appendChild(card);
    }
  }

  function init() {
    searchInput = document.getElementById('fav-search-input');
    tagBarEl = document.getElementById('fav-tag-bar');
    metaEl = document.getElementById('fav-meta');
    gridEl = document.getElementById('fav-grid');
    loadFavourites();
    searchInput.addEventListener('input', function() { searchTerm = this.value.trim(); renderCards(); });
  }

  init();
})();
