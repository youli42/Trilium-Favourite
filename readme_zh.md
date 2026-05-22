<!-- 本文件是中文版，英文版见 readme.md -->

> 📖 本文档为中文版，英文版见 [readme.md](readme.md)。

# 收藏夹面板 — Trilium 收藏管理

## 概述

Trilium 虽然有内置的书签系统，但缺乏一个可视化面板来一览所有收藏的笔记。在笔记树中逐个翻找收藏过的笔记非常不便。

本插件在 Trilium 前端展示页面下增加了一个 **收藏夹面板**，将带有指定标签（默认 `#favourite`）的笔记以 **卡片网格** 的形式集中展示，支持：

- **卡片布局** — 每篇笔记一张卡片，包含标题（粗体）、描述（引用格式）、标签（胶囊形状）
- **高级标签筛选** — 两级标签选择：点击标签名筛选该名下所有笔记，点击标签值精确匹配。已选标签在可移除栏中显示
- **文字搜索** — 与标签筛选组合，在后端执行分页搜索
- **分页浏览** — 支持每页数量切换（25/50/100/200），上/下翻页
- **标签范围限定** — 只显示当前收藏夹笔记中的标签，不展示全库无关信息
- **自定义图标** — 卡片标题图标优先使用笔记自己的 `#iconClass`（Box Icons），未设置时默认 `bx bx-note`
- **颜色高亮** — 带有 `#color` 标签的笔记，卡片边框和标题使用对应颜色
- **自适应网格** — 卡片根据页面宽度自动排列、自动换行
- **跟随主题** — 样式使用 CSS 变量，自动适配 Trilium 的亮暗主题

![演示](file/show.png)

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

| 属性               | 说明                             | 默认值      |
| ------------------ | -------------------------------- | ----------- |
| `#favLabel`        | 收藏标签名                       | `favourite` |
| `#favDescLines`    | 描述显示行数                     | `3`         |
| `#favInheritColor` | 是否使用继承的颜色（true/false） | `false`     |

你可以克隆该面板，给每个副本设置不同的 `#favLabel`，实现多个分类收藏夹（如 `#bookmark`、`#readlater`、`#project`）。

## 开发概述

### 所用 API

| API                                          | 用途                                   |
| -------------------------------------------- | -------------------------------------- |
| `api.searchForNotes("#favourite")`           | 搜索所有带指定标签的笔记               |
| `api.runOnBackend(callback, args)`           | 在后端执行配置读取、标签加载、分页搜索 |
| `api.sql.getRows(query, params)`             | SQL 查询，用于加载限定范围内的标签     |
| `note.getAttributes()`                       | 获取笔记的所有标签（后端）             |
| `note.getContent()`                          | 获取笔记 HTML 正文，提取描述文本       |
| `api.activateNote(noteId)`                   | 点击卡片跳转到对应笔记                 |
| `api.getNote(noteId)`                        | 按 ID 获取笔记（后端）                 |
| `note.getParentNotes()`                      | 向上遍历笔记树找到收藏夹面板           |
| `getComputedStyle(document.documentElement)` | 读取 Trilium 主题 CSS 变量             |

### 实现要点

1. **配置读取**：JS 代码从自身向上遍历笔记树：`api.currentNote（JS 代码）→ 父级（HTML 模板）→ 父级（收藏夹面板）`。通过 `api.runOnBackend` 在后端读取提升属性，确保可靠访问。

2. **标签加载**：通过后端 SQL 查询（带子查询过滤），只加载当前收藏夹笔记范围内的标签。系统标签（`color`、`iconClass`、`archived`、`docName`、`customResourceProvider` 等）以及 `favLabel` 本身被排除。

3. **两级标签筛选**：每个标签芯片有两个可点击区域：
   - **标签名**：按标签名筛选，显示所有带有该标签的笔记（不论值）
   - **标签值（若有）**：精确匹配标签名+值
   二者可组合使用，已选筛选条件在标签上方可移除栏中展示。

4. **搜索执行**：将 `#favLabel` + 文字搜索 + 已选标签组合成 Trilium 搜索查询字符串，在后端分页执行。返回结果包含标签、iconClass、color 和描述（通过正则去 HTML 标签，不在后端使用 DOM）。

5. **卡片图标**：遍历笔记自身标签查找 `iconClass`。存在时渲染 `<i>` 元素加载 Box Icons 图标类；不存在时默认 `bx bx-note`。

6. **卡片颜色**：默认只从 `getAttributes()` 中取笔记自身的 `#color`（按 noteId 过滤）。开启 `favInheritColor = true` 后使用 `getLabelValue('color')` 获取继承颜色。

7. **分页控件**：后端返回切片结果和总数。`<select>` 下拉框显式读取 `--main-text-color` 和 `--main-background-color` CSS 变量，确保跟随主题。

### 插件结构

本插件沿用 Trilium 前端插件的标准 `render` 笔记模式：

```
nlKR1j0QzfmS（前端展示页面）
  └── 1Mn93zMdll8N 收藏夹面板（render）
        ├── ~renderNote
        └── ZwetGOsxjRRi html（code, mime: text/html）
              └── PaGSIRd20Aup js（code, mime: application/javascript;env=frontend）
```
