// 收藏夹面板 - 高级标签筛选版（优化版）
(function() {
  'use strict';

  var _cfgFavLabel, _cfgDescLines, _cfgInheritColor;

  async function readConfig() {
    var config = await api.runOnBackend(function(sid) {
      var sn = api.getNote(sid);
      if (!sn) throw new Error('无法获取当前脚本笔记');
      var p = sn.getParentNotes();
      if (!p || !p.length) throw new Error('脚本笔记无父级');
      var gp = p[0].getParentNotes();
      if (!gp || !gp.length) throw new Error('HTML 模板无父级');
      var rn = gp[0];
      return { favLabel: rn.getLabelValue('favLabel'), descLines: rn.getLabelValue('favDescLines'), inheritColor: rn.getLabelValue('favInheritColor') };
    }, [api.currentNote.noteId]);

    var raw = config.favLabel;
    if (!raw) throw new Error('缺少 #favLabel 属性，请在笔记属性中设置要搜索的标签名');
    _cfgFavLabel  = raw.replace(/^#+/, '');
    _cfgDescLines = parseInt(config.descLines) || 3;
    _cfgInheritColor = config.inheritColor === 'true';
    document.getElementById('fav-app').style.setProperty('--fav-desc-lines', _cfgDescLines);
  }

  function tagKey(name, value) { return name + '\x00' + (value || ''); }
  function parseTagKey(key) { var i = key.indexOf('\x00'); return { name: key.substring(0, i), value: key.substring(i + 1) || '' }; }
  function fmtTag(name, value) { return value ? name + ': ' + value : name; }
  function escTagVal(v) {
    return v.indexOf(' ') >= 0 || v.indexOf('"') >= 0 || v.indexOf('(') >= 0 || v.indexOf(')') >= 0 || v.indexOf('#') >= 0
      ? '"' + v.replace(/"/g, '\\"') + '"' : v;
  }

  var allTags = [], selectedTags = {}, selectedNames = {};
  var currentPage = 1, pageSize = 25;
  var _cachedNoteIds = [], _cachedTotal = 0;
  var _searchSeq = 0;
  var searchInput, tagInput, selectedTagsEl, tagRowsEl, metaEl, gridEl;

  var _sysLabels = {
    color: 1, iconClass: 1, archived: 1, cssClass: 1,
    workspace: 1, workspaceIcon: 1, workspaceTabIcon: 1,
    keyboardShortcut: 1, pageSize: 1, disableInclusion: 1,
    searchHome: 1, inbox: 1, calendarRoot: 1, dateNote: 1,
    sorted: 1, label: 1, favPanelId: 1,
    docName: 1, customResourceProvider: 1,
    appCss: 1, appScript: 1, shareCss: 1, shareJs: 1,
    customWidget: 1, widget: 1, runOnInstance: 1,
    runOnFrontend: 1, run: 1, appTheme: 1,
    template: 1, inherit: 1, relation: 1
  };

  function isSys(name) {
    return _sysLabels[name] === 1 || name === _cfgFavLabel || name.indexOf('label:') === 0 || name.indexOf('relation:') === 0;
  }

  async function loadAllTags() {
    try {
      allTags = await api.runOnBackend(function(label) {
        var rows = api.sql.getRows(
          "SELECT a.name, COALESCE(a.value,'') v, COUNT(*) c FROM attributes a " +
          "WHERE a.type='label' AND a.isDeleted=0 AND a.noteId IN (" +
            "SELECT f.noteId FROM attributes f WHERE f.type='label' AND f.name=? AND f.isDeleted=0" +
          ") GROUP BY a.name,a.v ORDER BY c DESC", [label]);
        return rows.map(function(r) { return { name: r.name, value: r.v, count: r.c }; });
      }, [_cfgFavLabel]);
    } catch (e) { console.error('loadAllTags', e); allTags = []; }
  }

  function renderTags(ft) {
    var filtered = allTags.filter(function(t) {
      if (isSys(t.name)) return false;
      return !ft || fmtTag(t.name, t.value).toLowerCase().indexOf(ft.toLowerCase()) >= 0;
    });
    filtered.sort(function(a, b) { return b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : (a.value < b.value ? -1 : a.value > b.value ? 1 : 0)); });
    var visible = filtered.slice(0, 20);
    tagRowsEl.innerHTML = '';
    if (!visible.length) { tagRowsEl.innerHTML = '<div class="fav-empty-tags">没有匹配的标签</div>'; return; }

    for (var r = 0; r < 2; r++) {
      var start = r * 10, end = Math.min(start + 10, visible.length);
      if (start >= visible.length) break;
      var row = document.createElement('div');
      row.className = 'fav-tag-row';
      for (var i = start; i < end; i++) {
        var t = visible[i], key = tagKey(t.name, t.value);
        var chip = document.createElement('span');
        chip.className = 'fav-tag-chip';
        if (selectedTags[key]) chip.classList.add('active');
        if (selectedNames[t.name]) chip.classList.add('name-active');

        var ns = document.createElement('span');
        ns.className = 'tag-name'; ns.textContent = t.name;
        ns.addEventListener('click', function(n) { return function(e) { e.stopPropagation(); toggleName(n); }; }(t.name));
        chip.appendChild(ns);

        if (t.value) {
          var ss = document.createElement('span'); ss.className = 'tag-sep'; ss.textContent = ':';
          var vs = document.createElement('span'); vs.className = 'tag-value'; vs.textContent = t.value;
          vs.addEventListener('click', function(n, v) { return function(e) { e.stopPropagation(); toggleTag(n, v); }; }(t.name, t.value));
          chip.appendChild(ss); chip.appendChild(vs);
        }
        if (t.count > 0) { var cs = document.createElement('span'); cs.className = 'tag-count'; cs.textContent = t.count; chip.appendChild(cs); }
        row.appendChild(chip);
      }
      tagRowsEl.appendChild(row);
    }
  }

  function updateTagActiveState() {
    var chips = tagRowsEl.querySelectorAll('.fav-tag-chip');
    var sorted = allTags.filter(function(t) { return !isSys(t.name); })
      .sort(function(a, b) { return b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : (a.value < b.value ? -1 : a.value > b.value ? 1 : 0)); })
      .slice(0, 20);
    for (var i = 0; i < sorted.length && i < chips.length; i++) {
      var key = tagKey(sorted[i].name, sorted[i].value);
      chips[i].classList.toggle('active', !!selectedTags[key]);
      chips[i].classList.toggle('name-active', !!selectedNames[sorted[i].name]);
    }
  }

  function toggleTag(name, value) {
    var key = tagKey(name, value);
    if (selectedTags[key]) delete selectedTags[key]; else selectedTags[key] = true;
    renderSelectedBar(); updateTagActiveState(); performSearch(1);
  }

  function toggleName(name) {
    if (selectedNames[name]) delete selectedNames[name]; else selectedNames[name] = true;
    renderSelectedBar(); updateTagActiveState(); performSearch(1);
  }

  function clearSelected() {
    selectedTags = {}; selectedNames = {};
    renderSelectedBar();
    var chips = tagRowsEl.querySelectorAll('.fav-tag-chip');
    for (var i = 0; i < chips.length; i++) { chips[i].classList.remove('active'); chips[i].classList.remove('name-active'); }
    performSearch(1);
  }

  function renderSelectedBar() {
    selectedTagsEl.innerHTML = '';
    var nk = Object.keys(selectedNames), vk = Object.keys(selectedTags);
    if (!nk.length && !vk.length) return;
    nk.forEach(function(n) {
      var el = document.createElement('span');
      el.className = 'fav-selected-tag'; el.style.borderColor = 'rgba(100,200,100,0.5)';
      el.appendChild(document.createTextNode(n + ' *'));
      var rm = document.createElement('span'); rm.className = 'remove-tag'; rm.textContent = '✕';
      rm.addEventListener('click', function(e) { e.stopPropagation(); toggleName(n); });
      el.appendChild(rm); selectedTagsEl.appendChild(el);
    });
    vk.forEach(function(k) {
      var p = parseTagKey(k);
      var el = document.createElement('span');
      el.className = 'fav-selected-tag';
      el.appendChild(document.createTextNode(fmtTag(p.name, p.value)));
      var rm = document.createElement('span'); rm.className = 'remove-tag'; rm.textContent = '✕';
      rm.addEventListener('click', function(n, v) { return function(e) { e.stopPropagation(); toggleTag(n, v); }; }(p.name, p.value));
      el.appendChild(rm); selectedTagsEl.appendChild(el);
    });
    var clr = document.createElement('span');
    clr.className = 'fav-selected-tag'; clr.textContent = '清空全部'; clr.style.cursor = 'pointer';
    clr.addEventListener('click', clearSelected);
    selectedTagsEl.appendChild(clr);
  }

  function buildQuery(textQuery) {
    var parts = ['#' + _cfgFavLabel];
    if (textQuery) parts.push(textQuery);
    Object.keys(selectedNames).forEach(function(n) { parts.push('#' + n); });
    var vk = Object.keys(selectedTags);
    if (vk.length) {
      var byName = {};
      vk.forEach(function(k) {
        var p = parseTagKey(k);
        if (selectedNames[p.name]) return;
        if (!byName[p.name]) byName[p.name] = [];
        byName[p.name].push(p.value);
      });
      for (var name in byName) {
        var vals = byName[name];
        parts.push(vals.length === 1 ? '#' + name + ' = ' + escTagVal(vals[0]) : '(' + vals.map(function(v) { return '#' + name + ' = ' + escTagVal(v); }).join(' or ') + ')');
      }
    }
    return parts.join(' ');
  }

  function runSearch(query) {
    return api.runOnBackend(function(q) {
      var all = api.searchForNotes(q);
      return { total: all.length, ids: all.map(function(n) { return n.noteId; }) };
    }, [query]);
  }

  function fetchDetails(ids) {
    if (!ids || !ids.length) return Promise.resolve([]);
    return api.runOnBackend(function(noteIds) {
      return noteIds.map(function(id) {
        var n = api.getNote(id);
        if (!n) return null;
        var attrs = n.getAttributes();
        var tags = attrs.filter(function(a) { return a.type === 'label'; }).map(function(a) { return { name: a.name, value: a.value || '' }; });
        var desc = '';
        try { var raw = n.getContent(); desc = (raw || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200); } catch (e) {}
        return { noteId: n.noteId, title: n.title, type: n.type, mime: n.mime, tags: tags, description: desc };
      }).filter(function(n) { return n !== null; });
    }, [ids]);
  }

  async function performSearch(page) {
    currentPage = (page !== undefined) ? page : 1;
    var tq = searchInput.value.trim();
    var seq = ++_searchSeq;
    metaEl.innerHTML = '搜索中...';
    gridEl.innerHTML = '';
    var query = buildQuery(tq);

    try {
      var sr = await runSearch(query);
      if (seq !== _searchSeq) return;
      _cachedNoteIds = sr.ids; _cachedTotal = sr.total;
      await renderCurrentPage(seq);
    } catch (e) {
      if (seq !== _searchSeq) return;
      metaEl.innerHTML = ''; metaEl.textContent = '搜索失败';
      gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">⚠️</div><p>' + e.message + '</p></div>';
      console.error('搜索失败', e);
    }
  }

  async function renderCurrentPage(seq) {
    var total = _cachedTotal, totalPages = Math.ceil(total / pageSize);
    var off = (currentPage - 1) * pageSize;
    var pageIds = _cachedNoteIds.slice(off, off + pageSize);
    metaEl.innerHTML = '';

    if (totalPages > 1) {
      var info = document.createElement('span');
      info.textContent = currentPage + '/' + totalPages + ' 页，共 ' + total + ' 条';
      var sel = document.createElement('select');
      sel.className = 'page-select';
      var rs = getComputedStyle(document.documentElement);
      sel.style.color = rs.getPropertyValue('--main-text-color').trim() || 'inherit';
      sel.style.backgroundColor = rs.getPropertyValue('--main-background-color').trim() || 'transparent';
      [25, 50, 100, 200].forEach(function(s) {
        var o = document.createElement('option'); o.value = s; o.textContent = s + ' 条/页';
        if (s === pageSize) o.selected = true; sel.appendChild(o);
      });
      sel.addEventListener('change', function() { pageSize = parseInt(this.value); renderCurrentPage(++_searchSeq); });
      metaEl.appendChild(sel); metaEl.appendChild(info);
      if (currentPage > 1) { var pb = document.createElement('button'); pb.className = 'page-btn'; pb.textContent = '‹ 上一页'; pb.addEventListener('click', function() { currentPage--; renderCurrentPage(++_searchSeq); }); metaEl.appendChild(pb); }
      if (currentPage < totalPages) { var nb = document.createElement('button'); nb.className = 'page-btn'; nb.textContent = '下一页 ›'; nb.addEventListener('click', function() { currentPage++; renderCurrentPage(++_searchSeq); }); metaEl.appendChild(nb); }
    } else { metaEl.textContent = total + ' 条结果'; }

    if (!pageIds.length) { gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">🔍</div><p>没有找到匹配的笔记</p></div>'; return; }

    var notes = await fetchDetails(pageIds);
    if (seq !== _searchSeq) return;
    renderCards(notes);
  }

  function renderCards(notes) {
    if (!notes.length) { gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">🔍</div><p>没有找到匹配的笔记</p></div>'; return; }
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < notes.length; i++) {
      (function(n) {
        var card = document.createElement('div');
        card.className = 'fav-card';
        card.addEventListener('click', function() { api.activateNote(n.noteId); });
        var cc = '';
        for (var t = 0; t < n.tags.length; t++) { if (n.tags[t].name === 'color') { cc = n.tags[t].value; break; } }
        if (cc) card.style.borderColor = cc;
        var tr = document.createElement('div');
        tr.className = 'fav-card-title';
        var ie = document.createElement('span'); ie.className = 'fav-card-title-icon i-class';
        var it = document.createElement('i');
        var oi = '';
        for (var t = 0; t < n.tags.length; t++) { if (n.tags[t].name === 'iconClass') { oi = n.tags[t].value; break; } }
        it.className = oi || 'bx bx-note'; ie.appendChild(it);
        var tt = document.createElement('span');
        tt.className = 'fav-card-title-text'; tt.textContent = n.title; tt.title = n.title;
        tr.appendChild(ie); tr.appendChild(tt);
        if (cc) tt.style.color = cc;
        card.appendChild(tr);
        var de = document.createElement('div');
        de.className = 'fav-card-desc';
        if (n.description) { de.textContent = n.description; } else { de.style.display = 'none'; }
        card.appendChild(de);
        var dispTags = [];
        for (var t = 0; t < n.tags.length; t++) {
          var tag = n.tags[t];
          if (_sysLabels[tag.name] === 1 || tag.name === _cfgFavLabel || tag.name.indexOf('label:') === 0 || tag.name.indexOf('relation:') === 0 || tag.name === 'color' || tag.name === 'iconClass') continue;
          dispTags.push(tag);
        }
        if (dispTags.length) {
          var te = document.createElement('div');
          te.className = 'fav-card-tags';
          for (var t = 0; t < dispTags.length; t++) {
            (function(tag) {
              var el = document.createElement('span');
              el.className = 'fav-card-tag'; el.textContent = fmtTag(tag.name, tag.value);
              el.addEventListener('click', function(e) { e.stopPropagation(); toggleTag(tag.name, tag.value); });
              te.appendChild(el);
            })(dispTags[t]);
          }
          card.appendChild(te);
        }
        fragment.appendChild(card);
      })(notes[i]);
    }
    gridEl.appendChild(fragment);
  }

  async function init() {
    searchInput = document.getElementById('fav-search-input');
    tagInput = document.getElementById('fav-tag-input');
    selectedTagsEl = document.getElementById('fav-selected-tags');
    tagRowsEl = document.getElementById('fav-tag-rows');
    metaEl = document.getElementById('fav-meta');
    gridEl = document.getElementById('fav-grid');
    try {
      await readConfig(); await loadAllTags(); renderTags(''); performSearch();
      searchInput.addEventListener('input', function() { performSearch(1); });
      tagInput.addEventListener('input', function() { renderTags(this.value); });
    } catch (e) {
      metaEl.textContent = '加载失败';
      gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">⚠️</div><p>' + e.message + '</p></div>';
      console.error('初始化失败', e);
    }
  }

  init();
})();
