<!-- This is the English version. Chinese version available at readme_zh.md -->

> 📖 This document is in English. 中文版本: [readme_zh.md](readme_zh.md).

# Favourites Panel — Trilium Favourites Management

## Overview

Trilium has a built-in bookmark system, but there's no visual panel to browse all bookmarked/favourited notes at a glance. Manually navigating through the note tree to find favourited notes is tedious.

This plugin adds a **Favourites Panel** to Trilium's frontend showcase page. It collects notes with a configurable label (default `#favourite`) and displays them as a **card grid** view, with the following features:

- **Card Layout** — Each note is shown as a card with title (bold), description (blockquote), and tags (pills)
- **Tag Filtering** — Click a tag on any card or in the tag bar to filter notes by that tag
- **Text Search** — Filter cards by title, content, or tag name in real-time
- **Custom Icon** — Card title icon uses the note's own `#iconClass` (Box Icons), falls back to type emoji
- **Color Accent** — Cards with a `#color` label use that color for the border and title text
- **Responsive Grid** — Cards auto-arrange and wrap based on page width
- **Theme Aware** — Styling follows Trilium's theme using CSS variables

## Installation

### Option 1: Manual File Copy

1. Open the note `nlKR1j0QzfmS` (Frontend Showcase) in Trilium
2. Create the following structure under that note:

```
Favourites Panel (render type)
  └── ~renderNote → html (code, mime: text/html)
                      └── js (code, mime: application/javascript;env=frontend)
```

3. Copy the contents of `html模板.html` into the **html** note
4. Copy the contents of `js逻辑.js` into the **js** note
5. Set the `~renderNote` relation on the **Favourites Panel** note pointing to the **html** note
6. (Optional) Add relevant promoted attributes (see Configuration below)

### Option 2: Import Archive

Download the latest archive from the [Releases](../../releases) page and import it directly into Trilium via the **Import** function.

## Configuration (Promoted Attributes)

The panel reads its configuration from promoted attributes on the render note itself.
Edit them in the note's attribute panel (labeled fields will appear automatically).

| Attribute | Description | Default |
|-----------|-------------|---------|
| `#favLabel` | The label to search for | `favourite` |
| `#favDescLines` | Number of description lines to show | `3` |
| `#favInheritColor` | Whether to use inherited `#color` labels (true/false) | `false` |

You can clone this panel and give each clone a different `#favLabel` to create multiple categorised collections (e.g. `#bookmark`, `#readlater`, `#project`).

## Development Overview

### APIs Used

| API | Purpose |
|-----|---------|
| `api.searchForNotes("#favourite")` | Search all notes with the configured label |
| `note.getLabels()` | Get own labels (for tags, iconClass, color) |
| `note.getLabelValue("color")` | Get effective color (own or inherited) |
| `note.getContent()` | Get note HTML content for description |
| `api.activateNote(noteId)` | Navigate to a note on card click |

### Implementation Details

1. **Config Reading**: The panel searches for itself using `api.searchForNotes("#favPanelId = main")` to find its own render note, then reads promoted attributes (`favLabel`, `favDescLines`, `favInheritColor`) from it. This avoids the trap of using `api.currentNote` (which points to the JS code note, not the render note).

2. **Label Exclusion**: System labels (`color`, `iconClass`, `archived`, etc.) and the configured `favLabel` are excluded from the tag list, so they only serve their functional purpose without cluttering the UI.

3. **Card Icons**: Iterates `note.getLabels()` (own labels only) to find `iconClass`. If present, renders an `<i>` element with the Box Icons class; otherwise falls back to a type-based emoji.

4. **Card Colors**: By default uses only the note's own `#color` label (not inherited). Set `favInheritColor = true` to use the effective color including inheritance.

5. **Live Filtering**: Both tag filter and text search operate on the already-loaded data in memory. Tag filter uses OR logic (note matching ANY selected tag is shown); text search uses AND logic combined with tag filter.

### Plugin Structure

This plugin follows the standard Trilium frontend render note pattern:

```
nlKR1j0QzfmS (Frontend Showcase)
  └── 1Mn93zMdll8N 收藏夹面板 (render)
        ├── ~renderNote
        └── ZwetGOsxjRRi html (code, mime: text/html)
              └── PaGSIRd20Aup js (code, mime: application/javascript;env=frontend)
```

## Changelog

```
bef1045 同步 HTML 模板的彩色边框 CSS 到仓库文件
b0fd142 新增 favInheritColor 提升属性，控制是否使用继承颜色
e47b1c6 卡片使用笔记自身的 color 标签渲染边框和标题颜色
6b90afa 移除 favLabel 兜底逻辑，改用 #favPanelId=main 搜索面板笔记读取配置
b88e2bc 将 Trilium 笔记中的 HTML 模板和 JS 逻辑同步到仓库文件
b1b95f0 修复: api.currentNote→api.startNote 修复 promoted 属性读取 + favLabel 自动去除 # 前缀
dc2f704 新增 promoted 属性配置、卡片标签可点击筛选、图标使用笔记自己的 iconClass
4108bbe 完成收藏夹面板 HTML 模板与 JS 逻辑
```
