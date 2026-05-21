<!-- 本文件是中文版，英文版见 readme.md -->

> 📖 本文档为中文版，英文版见 [readme.md](readme.md)。

# 收藏夹面板 — Trilium 收藏管理

## 概述

Trilium 虽然有内置的书签系统，但缺乏一个可视化面板来一览所有收藏的笔记。在笔记树中逐个翻找收藏过的笔记非常不便。

本插件在 Trilium 前端展示页面下增加了一个 **收藏夹面板**，将带有指定标签（默认 `#favourite`）的笔记以 **卡片网格** 的形式集中展示，支持：

- **卡片布局** — 每篇笔记一张卡片，包含标题（粗体）、描述（引用格式）、标签（胶囊形状）
- **标签筛选** — 点击卡片上的标签或标签栏中的标签，按标签过滤笔记
- **文字搜索** — 按标题、内容、标签名实时过滤
- **自定义图标** — 卡片标题图标优先使用笔记自己的 `#iconClass`（Box Icons），未设置时回退为类型 emoji
- **颜色高亮** — 带有 `#color` 标签的笔记，卡片边框和标题使用对应颜色
- **自适应网格** — 卡片根据页面宽度自动排列、自动换行
- **跟随主题** — 样式使用 CSS 变量，自动适配 Trilium 的亮暗主题

## 安装指南

### 方式一：手动复制文件

1. 在 Trilium 中打开 `nlKR1j0QzfmS`（前端展示页面）笔记
2. 在该笔记下创建以下结构：

```
收藏夹面板（render 类型）
  └── ~renderNote → html（code, mime: text/html）
                      └── js（code, mime: application/javascript;env=frontend）
```

3. 将 `html模板.html` 的内容复制到 **html** 笔记中
4. 将 `js逻辑.js` 的内容复制到 **js** 笔记中
5. 为 **收藏夹面板** 笔记设置 `~renderNote` 关系指向 **html** 笔记
6. （可选）添加进阶提升属性（见下方配置说明）

### 方式二：导入压缩包

从 [Releases](../../releases) 页面下载最新版的压缩包，在 Trilium 中通过 **导入** 功能直接导入即可。

## 进阶配置（Promoted 属性）

面板从自身笔记的提升属性中读取配置。在笔记的"标签"面板中即可看到可编辑字段。

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `#favLabel` | 收藏标签名 | `favourite` |
| `#favDescLines` | 描述显示行数 | `3` |
| `#favInheritColor` | 是否使用继承的颜色（true/false） | `false` |

你可以克隆该面板，给每个副本设置不同的 `#favLabel`，实现多个分类收藏夹（如 `#bookmark`、`#readlater`、`#project`）。

## 开发概述

### 所用 API

| API | 用途 |
|-----|------|
| `api.searchForNotes("#favourite")` | 搜索所有带指定标签的笔记 |
| `note.getLabels()` | 获取笔记自身的标签（用于标签列表、iconClass、color） |
| `note.getLabelValue("color")` | 获取有效颜色（自身或继承） |
| `note.getContent()` | 获取笔记 HTML 正文，提取描述文本 |
| `api.activateNote(noteId)` | 点击卡片跳转到对应笔记 |

### 实现要点

1. **配置读取**：面板通过 `api.searchForNotes("#favPanelId = main")` 搜索自身（而不是依赖 `api.currentNote`，因为 `currentNote` 指向的是 JS 代码笔记而非渲染目标笔记），然后从搜索结果中读取提升属性。

2. **标签排除**：系统标签（`color`、`iconClass`、`archived` 等）以及当前配置的 `favLabel` 不会出现在标签栏和卡片标签中，保证 UI 整洁。

3. **卡片图标**：遍历 `note.getLabels()`（仅自身标签）查找 `iconClass`。存在时渲染 `<i>` 元素加载 Box Icons 图标类；不存在时使用类型对应的 emoji。

4. **卡片颜色**：默认只使用笔记自身的 `#color`（不含继承）。开启 `favInheritColor = true` 后使用继承链上的有效颜色。

5. **实时筛选**：标签筛选和文字搜索均在内存中对已加载的数据进行操作。标签筛选为 OR 逻辑（任一选中标签匹配即显示）；文字搜索与标签筛选为 AND 逻辑。

### 插件结构

本插件沿用 Trilium 前端插件的标准 `render` 笔记模式：

```
nlKR1j0QzfmS（前端展示页面）
  └── 1Mn93zMdll8N 收藏夹面板（render）
        ├── ~renderNote
        └── ZwetGOsxjRRi html（code, mime: text/html）
              └── PaGSIRd20Aup js（code, mime: application/javascript;env=frontend）
```


