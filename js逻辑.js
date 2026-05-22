// 收藏夹面板 - 高级标签筛选版
(function() {
  'use strict';

  var _cfgFavLabel, _cfgDescLines, _cfgInheritColor;

  async function readConfig() {
    var config = await api.runOnBackend(function(scriptId) {
      var scriptNote = api.getNote(scriptId);
      if (!scriptNote) throw new Error('无法获取当前脚本笔记');
      var parents = scriptNote.getParentNotes();
      if (!parents || parents.length === 0) throw new Error('脚本笔记无父级');
      var htmlNote = parents[0];
      var grandParents = htmlNote.getParentNotes();
      if (!grandParents || grandParents.length === 0) throw new Error('HTML 模板无父级');
      var renderNote = grandParents[0];
      return {
        favLabel: renderNote.getLabelValue('favLabel'),
        descLines: renderNote.getLabelValue('favDescLines'),
        inheritColor: renderNote.getLabelValue('favInheritColor')
      };
    }, [api.currentNote.noteId]);

    var raw = config.favLabel;
    if (!raw) throw new Error('缺少 #favLabel 属性，请在笔记属性中设置要搜索的标签名');
    _cfgFavLabel  = raw.replace(/^#+/, '');
    _cfgDescLines = parseInt(config.descLines) || 3;
    _cfgInheritColor = config.inheritColor === 'true';
    document.getElementById('fav-app').style.setProperty('--fav-desc-lines', _cfgDescLines);
  }

  function stripHtml(text) {
    return text.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function truncate(text, maxLen) {
    if (!text) return '';
    var t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= maxLen) return t;
    return t.substring(0, maxLen) + '…';
  }

  function tagKey(name, value) {
    return name + '\x00' + (value || '');
  }

  function parseTagKey(key) {
    var idx = key.indexOf('\x00');
    return { name: key.substring(0, idx), value: key.substring(idx + 1) || '' };
  }

  function formatTagDisplay(name, value) {
    return value ? name + ': ' + value : name;
  }

  var allTags = [];
  var selectedTags = {};
  var selectedNames = {};
  var currentPage = 1;
  var pageSize = 25;
  var searchInput, tagInput, selectedTagsEl, tagRowsEl, metaEl, gridEl;

  var EXCLUDED_LABELS = {
    color: true, iconClass: true, archived: true, cssClass: true,
    workspace: true, workspaceIcon: true, workspaceTabIcon: true,
    keyboardShortcut: true, pageSize: true, disableInclusion: true,
    searchHome: true, inbox: true, calendarRoot: true, dateNote: true,
    sorted: true, label: true, favPanelId: true,
    docName: true, customResourceProvider: true,
    appCss: true, appScript: true, shareCss: true, shareJs: true,
    customWidget: true, widget: true, runOnInstance: true,
    runOnFrontend: true, run: true, appTheme: true,
    template: true, inherit: true, relation: true
  };

  function isSystemLabel(name) {
    return EXCLUDED_LABELS[name] === true
      || name === _cfgFavLabel
      || name.indexOf('label:') === 0
      || name.indexOf('relation:') === 0;
  }

  async function loadAllTags() {
    try {
      allTags = await api.runOnBackend(function() {
        var rows = api.sql.getRows(
          "SELECT attr.name, COALESCE(attr.value, '') as value, COUNT(*) as cnt " +
          "FROM attributes attr " +
          "WHERE attr.type = 'label' AND attr.isDeleted = 0 " +
          "GROUP BY attr.name, attr.value " +
          "ORDER BY cnt DESC"
        );
        return rows.map(function(r) {
          return { name: r.name, value: r.value, count: r.cnt };
        });
      }, []);
    } catch (e) {
      console.error('Failed to load tags', e);
      allTags = [];
    }
  }

  function renderTags(filterText) {
    var filtered = allTags.filter(function(t) {
      if (isSystemLabel(t.name)) return false;
      if (filterText) {
        var ft = filterText.toLowerCase();
        return formatTagDisplay(t.name, t.value).toLowerCase().indexOf(ft) >= 0;
      }
      return true;
    });

    filtered.sort(function(a, b) { return b.count - a.count || a.name.localeCompare(b.name) || a.value.localeCompare(b.value); });

    var ROWS = 2, TAGS_PER_ROW = 10;
    var visible = filtered.slice(0, ROWS * TAGS_PER_ROW);

    tagRowsEl.innerHTML = '';

    if (visible.length === 0) {
      tagRowsEl.innerHTML = '<div class="fav-empty-tags">没有匹配的标签</div>';
      return;
    }

    for (var r = 0; r < ROWS; r++) {
      var start = r * TAGS_PER_ROW;
      var end = Math.min(start + TAGS_PER_ROW, visible.length);
      if (start >= visible.length) break;

      var row = document.createElement('div');
      row.className = 'fav-tag-row';

      for (var i = start; i < end; i++) {
        var t = visible[i];
        var chip = document.createElement('span');
        chip.className = 'fav-tag-chip';

        var key = tagKey(t.name, t.value);
        if (selectedTags[key]) chip.classList.add('active');
        if (selectedNames[t.name]) chip.classList.add('name-active');

        var ns = document.createElement('span');
        ns.className = 'tag-name';
        ns.textContent = t.name;
        (function(n) {
          ns.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleName(n);
          });
        })(t.name);
        chip.appendChild(ns);

        if (t.value) {
          var ss = document.createElement('span');
          ss.className = 'tag-sep';
          ss.textContent = ':';
          var vs = document.createElement('span');
          vs.className = 'tag-value';
          vs.textContent = t.value;
          (function(n, v) {
            vs.addEventListener('click', function(e) {
              e.stopPropagation();
              toggleTag(n, v);
            });
          })(t.name, t.value);
          chip.appendChild(ss);
          chip.appendChild(vs);
        }

        if (t.count > 0) {
          var cs = document.createElement('span');
          cs.className = 'tag-count';
          cs.textContent = t.count;
          chip.appendChild(cs);
        }

        row.appendChild(chip);
      }
      tagRowsEl.appendChild(row);
    }
  }

  function toggleTag(name, value) {
    var key = tagKey(name, value);
    if (selectedTags[key]) delete selectedTags[key];
    else selectedTags[key] = true;
    renderSelectedTagsBar();
    renderTags(tagInput.value);
    performSearch();
  }

  function toggleName(name) {
    if (selectedNames[name]) delete selectedNames[name];
    else selectedNames[name] = true;
    renderSelectedTagsBar();
    renderTags(tagInput.value);
    performSearch();
  }

  function clearSelected() {
    selectedTags = {};
    selectedNames = {};
    renderSelectedTagsBar();
    renderTags(tagInput.value);
    performSearch();
  }

  function renderSelectedTagsBar() {
    selectedTagsEl.innerHTML = '';
    var nk = Object.keys(selectedNames);
    var vk = Object.keys(selectedTags);
    if (nk.length === 0 && vk.length === 0) return;

    nk.forEach(function(name) {
      var tag = document.createElement('span');
      tag.className = 'fav-selected-tag';
      tag.style.borderColor = 'rgba(100,200,100,0.5)';
      tag.appendChild(document.createTextNode(name + ' *'));
      var remove = document.createElement('span');
      remove.className = 'remove-tag';
      remove.textContent = '✕';
      remove.addEventListener('click', function(e) { e.stopPropagation(); toggleName(name); });
      tag.appendChild(remove);
      selectedTagsEl.appendChild(tag);
    });

    vk.forEach(function(key) {
      var p = parseTagKey(key);
      var tag = document.createElement('span');
      tag.className = 'fav-selected-tag';
      tag.appendChild(document.createTextNode(formatTagDisplay(p.name, p.value)));
      var remove = document.createElement('span');
      remove.className = 'remove-tag';
      remove.textContent = '✕';
      (function(n, v) {
        remove.addEventListener('click', function(e) { e.stopPropagation(); toggleTag(n, v); });
      })(p.name, p.value);
      tag.appendChild(remove);
      selectedTagsEl.appendChild(tag);
    });

    var clearBtn = document.createElement('span');
    clearBtn.className = 'fav-selected-tag';
    clearBtn.textContent = '清空全部';
    clearBtn.style.cursor = 'pointer';
    clearBtn.addEventListener('click', clearSelected);
    selectedTagsEl.appendChild(clearBtn);
  }

  function buildQuery(textQuery) {
    var parts = ['#' + _cfgFavLabel];
    if (textQuery) parts.push(textQuery);
    var nk = Object.keys(selectedNames);
    var vk = Object.keys(selectedTags);
    nk.forEach(function(name) { parts.push('#' + name); });
    if (vk.length > 0) {
      var byName = {};
      vk.forEach(function(key) {
        var p = parseTagKey(key);
        if (selectedNames[p.name]) return;
        if (!byName[p.name]) byName[p.name] = [];
        byName[p.name].push(p.value);
      });
      for (var name in byName) {
        var vals = byName[name];
        if (vals.length === 1) {
          var v = vals[0];
          if (v.indexOf(' ') >= 0 || v.indexOf('"') >= 0 || v.indexOf('(') >= 0 || v.indexOf(')') >= 0 || v.indexOf('#') >= 0) {
            parts.push('#' + name + ' = "' + v.replace(/"/g, '\\"') + '"');
          } else {
            parts.push('#' + name + ' = ' + v);
          }
        } else {
          var orParts = vals.map(function(v) {
            if (v.indexOf(' ') >= 0 || v.indexOf('"') >= 0 || v.indexOf('(') >= 0 || v.indexOf(')') >= 0 || v.indexOf('#') >= 0) {
              return '#' + name + ' = "' + v.replace(/"/g, '\\"') + '"';
            }
            return '#' + name + ' = ' + v;
          });
          parts.push('(' + orParts.join(' or ') + ')');
        }
      }
    }
    return parts.join(' ');
  }

  async function performSearch(page) {
    if (page !== undefined) currentPage = page;
    else currentPage = 1;
    var textQuery = searchInput.value.trim();
    metaEl.innerHTML = '搜索中...';
    gridEl.innerHTML = '';
    var query = buildQuery(textQuery);
    var offset = (currentPage - 1) * pageSize;

    try {
      var result = await api.runOnBackend(function(q, limit, off) {
        var all = api.searchForNotes(q);
        var total = all.length;
        var pageNotes = all.slice(off, off + limit).map(function(n) {
          var attrs = n.getAttributes();
          var tags = attrs.filter(function(a) { return a.type === 'label'; }).map(function(a) {
            return { name: a.name, value: a.value || '' };
          });
          var content = '';
          try {
            var raw = n.getContent();
            content = (raw || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
          } catch (e) {}
          return { noteId: n.noteId, title: n.title, type: n.type, mime: n.mime, tags: tags, description: content };
        });
        return { total: total, notes: pageNotes };
      }, [query, pageSize, offset]);

      var notes = result.notes;
      var totalCount = result.total;
      var totalPages = Math.ceil(totalCount / pageSize);
      metaEl.innerHTML = '';

      if (totalPages > 1) {
        var info = document.createElement('span');
        info.textContent = currentPage + '/' + totalPages + ' 页，共 ' + totalCount + ' 条';

        var select = document.createElement('select');
        select.className = 'page-select';
        var rs = getComputedStyle(document.documentElement);
        select.style.color = rs.getPropertyValue('--main-text-color').trim() || 'inherit';
        select.style.backgroundColor = rs.getPropertyValue('--main-background-color').trim() || 'transparent';
        [25, 50, 100, 200].forEach(function(s) {
          var opt = document.createElement('option');
          opt.value = s; opt.textContent = s + ' 条/页';
          if (s === pageSize) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', function() { pageSize = parseInt(this.value); performSearch(1); });
        metaEl.appendChild(select);
        metaEl.appendChild(info);

        if (currentPage > 1) {
          var prevBtn = document.createElement('button');
          prevBtn.className = 'page-btn'; prevBtn.textContent = '‹ 上一页';
          (function(p) { prevBtn.addEventListener('click', function() { performSearch(p); }); })(currentPage - 1);
          metaEl.appendChild(prevBtn);
        }
        if (currentPage < totalPages) {
          var nextBtn = document.createElement('button');
          nextBtn.className = 'page-btn'; nextBtn.textContent = '下一页 ›';
          (function(p) { nextBtn.addEventListener('click', function() { performSearch(p); }); })(currentPage + 1);
          metaEl.appendChild(nextBtn);
        }
      } else {
        metaEl.textContent = totalCount + ' 条结果';
      }

      if (notes.length === 0) {
        gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">🔍</div><p>没有找到匹配的笔记</p></div>';
        return;
      }

      for (var i = 0; i < notes.length; i++) {
        (function(n) {
          var card = document.createElement('div');
          card.className = 'fav-card';
          card.addEventListener('click', function() { api.activateNote(n.noteId); });

          var cardColor = '';
          for (var t = 0; t < n.tags.length; t++) { if (n.tags[t].name === 'color') { cardColor = n.tags[t].value; break; } }
          if (cardColor) card.style.borderColor = cardColor;

          var titleRow = document.createElement('div');
          titleRow.className = 'fav-card-title';
          var iconEl = document.createElement('span');
          iconEl.className = 'fav-card-title-icon i-class';
          var iTag = document.createElement('i');
          var ownIcon = '';
          for (var t = 0; t < n.tags.length; t++) { if (n.tags[t].name === 'iconClass') { ownIcon = n.tags[t].value; break; } }
          iTag.className = ownIcon || 'bx bx-note';
          iconEl.appendChild(iTag);
          var titleText = document.createElement('span');
          titleText.className = 'fav-card-title-text';
          titleText.textContent = n.title;
          titleText.title = n.title;
          titleRow.appendChild(iconEl);
          titleRow.appendChild(titleText);
          if (cardColor) titleText.style.color = cardColor;
          card.appendChild(titleRow);

          var descEl = document.createElement('div');
          descEl.className = 'fav-card-desc';
          if (n.description) {
            descEl.textContent = n.description;
          } else {
            descEl.style.display = 'none';
          }
          card.appendChild(descEl);

          var displayTags = n.tags.filter(function(t) {
            return !isSystemLabel(t.name) && t.name !== 'color' && t.name !== 'iconClass';
          });
          if (displayTags.length > 0) {
            var tagsEl = document.createElement('div');
            tagsEl.className = 'fav-card-tags';
            displayTags.forEach(function(tag) {
              var tagEl = document.createElement('span');
              tagEl.className = 'fav-card-tag';
              tagEl.textContent = formatTagDisplay(tag.name, tag.value);
              tagEl.addEventListener('click', function(e) { e.stopPropagation(); toggleTag(tag.name, tag.value); });
              tagsEl.appendChild(tagEl);
            });
            card.appendChild(tagsEl);
          }
          gridEl.appendChild(card);
        })(notes[i]);
      }
    } catch (e) {
      metaEl.innerHTML = '';
      metaEl.textContent = '搜索失败';
      gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">⚠️</div><p>' + e.message + '</p></div>';
      console.error('收藏夹搜索失败', e);
    }
  }

  async function init() {
    searchInput = document.getElementById('fav-search-input');
    tagInput = document.getElementById('fav-tag-input');
    selectedTagsEl = document.getElementById('fav-selected-tags');
    tagRowsEl = document.getElementById('fav-tag-rows');
    metaEl = document.getElementById('fav-meta');
    gridEl = document.getElementById('fav-grid');

    try {
      await readConfig();
      await loadAllTags();
      renderTags('');
      performSearch();
      searchInput.addEventListener('input', function() { performSearch(1); });
      tagInput.addEventListener('input', function() { renderTags(this.value); });
    } catch (e) {
      metaEl.textContent = '加载失败';
      gridEl.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">⚠️</div><p>' + e.message + '</p></div>';
      console.error('收藏夹面板初始化失败', e);
    }
  }

  init();
})();
