# 收藏夹面板 - Trilium 插件

## 结构

- `nlKR1j0QzfmS` (前端展示页面)
  - `1Mn93zMdll8N` (收藏夹面板) - type: render
    - `ZwetGOsxjRRi` (html) - type: code, mime: text/html
      - `PaGSIRd20Aup` (js) - type: code, mime: application/javascript;env=frontend

## 功能

- 展示所有带有指定标签的笔记（默认为 `#favourite`）
- 卡片布局：标题（粗体）、描述（引用格式）、标签（胶囊形状）
- 卡片标签可点击筛选
- 卡片标题图标使用笔记自己的 iconClass（Box Icons）
- 点击卡片打开对应笔记
- 卡片自动排列，自适应宽度
- 筛选：按标签点击筛选 + 按标题/内容/标签文字搜索
- 风格跟随 Trilium 主题

## 进阶配置（Promoted 属性）

在笔记属性中可自定义：

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `#favLabel` | 收藏标签名 | `favourite` |
| `#favDescLines` | 描述显示行数 | `3` |

## 提交记录

1. 创建收藏夹面板笔记结构（render note→HTML→JS）
2. 完成 HTML 模板与 JS 逻辑实现
3. 新增 promoted 属性配置、卡片标签可点击筛选、卡片图标使用笔记自己的 iconClass
