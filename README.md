<div align="center">
  <h1>TabPlusPlus</h1>
  <p><strong>智能一体化 Tab 管理插件 · Smart All-in-One Tab Manager</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Manifest-v3-blue?style=flat-square" alt="Manifest v3" />
    <img src="https://img.shields.io/badge/Chrome-Side%20Panel-green?style=flat-square" alt="Chrome Side Panel" />
    <img src="https://img.shields.io/badge/Version-1.2.0-orange?style=flat-square" alt="Version" />
    <img src="https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square" alt="License" />
  </p>
  <p>
    <a href="#english">English</a> ·
    <a href="#中文">中文</a>
  </p>
</div>

---

<a id="english"></a>

## 🌟 Overview

**TabPlusPlus** is a powerful Chrome extension that brings your tabs and bookmarks under one roof — in a sleek, always-visible **Side Panel**. Stop hunting through a sea of tiny tab icons. With real-time search, smart filters, session saving, and duplicate cleanup, TabPlusPlus gives you a calm, organized browser experience that keeps up with how you actually work.

---

## ✨ Features

### 🗂 Tab Management — Full Control in the Side Panel
- **Instant search** — filter tabs by title or URL as you type
- **Smart filters** — quickly see All tabs, Current Window only, Audible tabs, Pinned tabs, or Duplicates
- **Flexible sorting** — order tabs by Recent, Title, or Domain
- **Group by domain** — visually cluster related tabs together at a glance
- **Bulk actions** — select multiple tabs then close or group them in one click
- **Real-time sync** — the panel updates automatically as you open, close, and navigate tabs

### 🔖 Bookmark Management — Your Library, Always at Hand
- **Full-text search** across all bookmarks instantly
- **Two view modes** — navigate by folder (breadcrumb navigation) or browse the full tree
- **Add bookmarks** directly from the side panel with title, URL, and folder selection
- **Edit & delete** any bookmark via an inline context menu
- **Recent bookmarks** section surfaces your most-used links at the top
- **Right-click shortcut** — add the current page or any link to bookmarks from the context menu

### 💾 Session Management — Never Lose Your Work
- **Save sessions** — snapshot all open tabs into a named session with a single click
- **Restore sessions** — reopen an entire browsing session exactly as you left it
- **Up to 10 sessions** stored locally, always available

### 🧹 Duplicate Tab Cleaner
- Detects and closes duplicate tabs automatically, keeping the most important tab (active/pinned first)
- Smart deduplication by hostname + pathname — works even when query parameters differ
- Accessible from the toolbar, popup quick-action, and right-click context menu

### ⌨️ Keyboard Navigation
- Navigate tabs **in sidebar order** using fully customizable keyboard shortcuts
- Configure your preferred key combinations at `chrome://extensions/shortcuts`
- Works seamlessly alongside the side panel's current filter and sort state

### 🎛 Settings & Preferences
- Remember your last active view (Tabs or Bookmarks) across sessions
- Persist filter and sort preferences between browser restarts
- Choose a default bookmark view mode (Folder or Tree)
- Control the number of recent bookmarks shown
- Enable or disable keyboard tab navigation independently

### 📊 At-a-Glance Stats
- Popup badge shows live counts of open tabs, browser windows, and total bookmarks

---

## 🔒 Privacy

TabPlusPlus works **entirely locally**. It does not collect, transmit, or share any user data. All session data is stored in Chrome's local storage on your own device. No external servers are contacted.

**Permissions used:**

| Permission | Why it's needed |
|---|---|
| `tabs` | Read and manage open tabs |
| `bookmarks` | Read and manage your bookmarks |
| `storage` | Save settings and sessions locally |
| `sessions` | Access recently closed tabs |
| `contextMenus` | Add right-click shortcuts |
| `activeTab` | Detect the currently focused tab |
| `sidePanel` | Render the persistent side panel |

---

## 🚀 Installation

### From the Chrome Web Store *(recommended)*
1. Visit the [TabPlusPlus page on the Chrome Web Store](#) *(link coming soon)*
2. Click **Add to Chrome**
3. Click the **T+** icon in your toolbar to open the side panel

### Manual / Developer Install
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the repository folder
5. Click the **T+** icon in your toolbar to get started

---

## 🗺 Usage Guide

| Action | How to do it |
|---|---|
| Open / close side panel | Click the **T+** toolbar icon |
| Search tabs | Type in the search box in the Tabs view |
| Filter tabs | Click a filter pill (All / Current Window / Audible / Pinned / Duplicates) |
| Sort tabs | Use the sort dropdown (Recent / Title / Domain) |
| Group by domain | Click the **Group** toggle button |
| Select multiple tabs | Check the checkboxes next to tabs, then use toolbar actions |
| Close duplicate tabs | Click **Close Dupes** in the popup or use the right-click menu |
| Save a session | Click **Save** in the toolbar or **Save Session** in the popup |
| Restore a session | Click a session in the **Recent Sessions** list in the popup |
| Add a bookmark | Click **+** in the Bookmarks view, or right-click any page/link |
| Edit / delete a bookmark | Right-click the bookmark in the panel |
| Navigate tabs with keyboard | Enable in Settings, then assign shortcuts at `chrome://extensions/shortcuts` |

---

## 🤝 Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch and open a Pull Request

---

## 📄 License

MIT © [ZepengW](https://github.com/ZepengW)

---

<a id="中文"></a>

## 🌟 简介

**TabPlusPlus** 是一款强大的 Chrome 扩展，将标签页管理和书签管理整合到一个精致的**侧边栏面板**中。告别在密密麻麻的标签图标中来回翻找的烦恼。借助实时搜索、智能过滤、会话保存和重复标签清理，TabPlusPlus 为你带来更平静、更有序的浏览体验。

---

## ✨ 核心功能

### 🗂 标签页管理 — 在侧边栏中完全掌控
- **即时搜索** — 输入即可按标题或 URL 过滤标签页
- **智能过滤** — 快速查看全部、当前窗口、正在播放音频、已固定或重复的标签
- **灵活排序** — 按最近使用、标题或域名排序
- **按域名分组** — 一键将同域名标签聚合显示
- **批量操作** — 多选标签后一键关闭或分组
- **实时同步** — 打开、关闭或切换标签时面板自动更新

### 🔖 书签管理 — 随时触手可及的知识库
- **全文即时搜索** 所有书签
- **两种视图模式** — 文件夹视图（面包屑导航）或完整树状视图
- **直接添加书签** — 在侧边栏内填写标题、URL 和文件夹后一键保存
- **编辑和删除** — 通过内联右键菜单操作任意书签
- **最近书签** — 常用链接置顶显示
- **右键快捷** — 在任意页面或链接上右键即可添加书签

### 💾 会话管理 — 永不丢失工作现场
- **保存会话** — 一键将所有标签页快照为一个会话
- **恢复会话** — 精准还原上次的完整浏览状态
- **本地存储最多 10 个会话**，随时可用

### 🧹 重复标签清理
- 自动检测并关闭重复标签，优先保留活跃/固定的标签
- 按域名 + 路径去重（忽略查询参数差异）
- 可从工具栏、弹出框快捷操作或右键菜单触发

### ⌨️ 键盘快捷导航
- 按**侧边栏顺序**在标签页间导航，支持自定义快捷键
- 在 `chrome://extensions/shortcuts` 中分配你喜欢的按键组合
- 与侧边栏当前过滤/排序状态完美配合

### 🎛 设置与偏好
- 跨会话记住最后活跃的视图（标签页或书签）
- 在浏览器重启后保留过滤和排序偏好
- 自定义书签默认视图模式
- 控制最近书签显示数量
- 独立开关键盘标签导航功能

### 📊 一目了然的统计
- 弹出框实时显示当前标签页数、窗口数和书签总数

---

## 🔒 隐私说明

TabPlusPlus **完全在本地运行**，不收集、传输或共享任何用户数据。所有会话数据仅存储于你自己设备上的 Chrome 本地存储中，不访问任何外部服务器。

**所需权限说明：**

| 权限 | 用途 |
|---|---|
| `tabs` | 读取和管理已打开的标签页 |
| `bookmarks` | 读取和管理书签 |
| `storage` | 在本地保存设置和会话 |
| `sessions` | 访问最近关闭的标签页 |
| `contextMenus` | 添加右键菜单快捷方式 |
| `activeTab` | 检测当前聚焦的标签页 |
| `sidePanel` | 渲染持久侧边栏面板 |

---

## 🚀 安装方式

### 从 Chrome 网上应用店安装 *(推荐)*
1. 访问 [Chrome 网上应用店中的 TabPlusPlus 页面](#)（链接即将上线）
2. 点击 **添加至 Chrome**
3. 点击工具栏中的 **T+** 图标打开侧边栏

### 手动 / 开发者安装
1. 下载或克隆本仓库
2. 打开 Chrome，访问 `chrome://extensions`
3. 启用右上角的**开发者模式**
4. 点击**加载已解压的扩展程序**并选择仓库文件夹
5. 点击工具栏中的 **T+** 图标即可开始使用

---

## 🗺 使用指南

| 操作 | 方法 |
|---|---|
| 打开 / 关闭侧边栏 | 点击 **T+** 工具栏图标 |
| 搜索标签页 | 在标签页视图的搜索框中输入 |
| 过滤标签页 | 点击过滤按钮（全部 / 当前窗口 / 音频 / 已固定 / 重复） |
| 排序标签页 | 使用排序下拉菜单 |
| 按域名分组 | 点击 **Group** 切换按钮 |
| 多选标签页 | 勾选标签旁的复选框，然后使用工具栏操作 |
| 清理重复标签 | 点击弹出框中的 **Close Dupes** 或使用右键菜单 |
| 保存会话 | 点击工具栏 **Save** 或弹出框中的 **Save Session** |
| 恢复会话 | 点击弹出框 **Recent Sessions** 列表中的条目 |
| 添加书签 | 点击书签视图中的 **+**，或右键任意页面/链接 |
| 编辑/删除书签 | 在面板中右键点击书签 |
| 键盘导航标签 | 在设置中启用，然后在 `chrome://extensions/shortcuts` 分配快捷键 |

---

## 🤝 贡献

欢迎贡献代码！请先开 Issue 讨论你的想法，再提交 Pull Request。

---

## 📄 许可证

MIT © [ZepengW](https://github.com/ZepengW)