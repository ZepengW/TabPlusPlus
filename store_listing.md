# TabPlusPlus — Chrome Web Store Listing Materials

This file contains all copy needed to publish TabPlusPlus on the Chrome Web Store.

---

## 1. Basic Info

| Field | Value |
|---|---|
| **Extension name** | TabPlusPlus |
| **Category** | Productivity |
| **Language** | English (primary); Chinese (Simplified) |
| **Version** | 1.2.0 |

---

## 2. Short Description
*(max 132 characters — shown in search results)*

```
Smart all-in-one tab & bookmark manager with side panel, session saving, duplicate cleaner, and instant search.
```
*(112 characters)*

---

## 3. Detailed Description
*(shown on the store listing page; supports basic formatting with line breaks)*

```
TabPlusPlus — Smart All-in-One Tab & Bookmark Manager

Tired of drowning in dozens of tabs? TabPlusPlus brings your entire browser under control with a sleek, always-visible Side Panel. Manage tabs, bookmarks, and sessions without ever leaving the page you're working on.

─── TAB MANAGEMENT ───────────────────────────
• Instant search — filter tabs by title or URL as you type
• Smart filters — All, Current Window, Audible, Pinned, Duplicates
• Flexible sorting — by Recent, Title, or Domain
• Group by domain — visually cluster related tabs together
• Bulk actions — select multiple tabs, then close or group in one click
• Real-time sync — the panel updates automatically as you browse

─── BOOKMARK MANAGER ────────────────────────
• Full-text search across all bookmarks instantly
• Two view modes — Folder (breadcrumb navigation) or Tree
• Add bookmarks right from the panel with title, URL, and folder selection
• Edit and delete via an inline right-click context menu
• Recent bookmarks section always at the top
• Right-click any page or link to add it as a bookmark

─── SESSION SAVER ───────────────────────────
• Snapshot all open tabs into a named session with one click
• Restore an entire browsing session exactly as you left it
• Up to 10 sessions stored locally — always available

─── DUPLICATE TAB CLEANER ───────────────────
• Detect and close duplicate tabs automatically
• Smart dedup by hostname + path (works even when query params differ)
• Available from the toolbar, popup, or right-click context menu

─── KEYBOARD NAVIGATION ─────────────────────
• Navigate tabs in sidebar order using custom keyboard shortcuts
• Assign your preferred keys at chrome://extensions/shortcuts

─── PRIVACY & SECURITY ──────────────────────
TabPlusPlus works entirely locally. No data is ever collected, transmitted, or shared. All settings and sessions are stored only on your device using Chrome's local storage. No external servers are contacted.

Click the T+ icon in your toolbar to get started.
```

---

## 4. Screenshots — Recommended Scenes

Produce screenshots at **1280 × 800 px** (or **640 × 400 px** minimum). Suggested scenes:

| # | Scene | What to show |
|---|---|---|
| 1 | **Side Panel — Tabs View** | Full browser with side panel open, showing a list of tabs with search bar, filter pills, and tab count badge |
| 2 | **Tab Filters & Sorting** | Filter pills highlighted (e.g. "Duplicates"), sort dropdown open, grouped-by-domain view |
| 3 | **Bulk Actions** | Multiple tabs selected with checkboxes; Close and Group buttons enabled in the bottom toolbar |
| 4 | **Bookmark Manager** | Bookmark view with folder breadcrumb navigation and tree expanded; search results visible |
| 5 | **Session Save & Restore** | Popup open showing saved sessions list; "Save Session" button highlighted |
| 6 | **Settings Page** | Settings screen showing all options (remember view, bookmark mode, keyboard shortcuts) |

---

## 5. Promotional Tile (Small — 440 × 280 px)

Suggested layout:
- Background: deep navy or dark teal gradient
- Center: large **T+** logo icon (white)
- Below logo: **TabPlusPlus** in bold white text
- Tagline beneath: *"Your browser. Organized."* in lighter weight

---

## 6. Marquee Promo Image (1400 × 560 px, optional)

Suggested layout:
- Left half: bold headline — *"All Your Tabs. Under Control."*
- Sub-text: *"Search, filter, save sessions, and clean duplicates — all in a persistent side panel."*
- Right half: browser screenshot showing the side panel in action

---

## 7. Privacy Policy Summary

**No data is collected.** TabPlusPlus does not transmit any user data to any server. All extension state (settings, saved sessions) is persisted exclusively in Chrome's `storage.local` API on the user's own device.

Permissions requested and their justifications:

| Permission | Justification |
|---|---|
| `tabs` | Required to list, search, filter, sort, group, and close open browser tabs |
| `bookmarks` | Required to read, add, edit, delete, and search Chrome bookmarks |
| `storage` | Required to persist user settings and saved sessions locally |
| `sessions` | Required to access recently closed tabs for session management |
| `contextMenus` | Required to add right-click shortcuts (Open Panel, Add Bookmark, Close Duplicates, Save Session) |
| `activeTab` | Required to detect the currently focused tab for keyboard navigation features |
| `sidePanel` | Required to render the persistent side panel UI |

---

## 8. Category & Tags

- **Primary category:** Productivity
- **Suggested tags:** tab manager, bookmark manager, session manager, tab organizer, side panel, productivity, duplicate tabs

---

## 9. Support / Contact

- **GitHub Issues:** https://github.com/ZepengW/TabPlusPlus/issues
- **Homepage / Source:** https://github.com/ZepengW/TabPlusPlus

---

## 10. Chinese Store Description (中文版)
*(for zh-CN locale)*

**短描述（132字以内）：**
```
智能一体化标签页与书签管理器，支持侧边栏、会话保存、重复标签清理和即时搜索。
```

**详细描述：**
```
TabPlusPlus — 智能一体化标签页与书签管理器

厌倦了在几十个标签页中迷失？TabPlusPlus 通过精致的常驻侧边栏，将整个浏览器置于你的掌控之下。无需离开正在浏览的页面，即可管理标签、书签和会话。

─── 标签页管理 ─────────────────────────────
• 即时搜索 — 输入即可按标题或 URL 过滤
• 智能过滤 — 全部、当前窗口、音频播放、已固定、重复
• 灵活排序 — 按最近使用、标题或域名
• 按域名分组 — 一键聚合同域名标签
• 批量操作 — 多选后一键关闭或分组
• 实时同步 — 浏览时面板自动更新

─── 书签管理 ───────────────────────────────
• 全文即时搜索所有书签
• 两种视图 — 文件夹（面包屑导航）或树状视图
• 直接在侧边栏添加书签（标题、URL、文件夹）
• 通过内联右键菜单编辑和删除书签
• 常用书签置顶显示
• 右键任意页面或链接即可添加书签

─── 会话保存 ───────────────────────────────
• 一键将所有标签快照为会话
• 精准还原完整浏览现场
• 本地存储最多 10 个会话

─── 重复标签清理 ────────────────────────────
• 自动检测并关闭重复标签（优先保留活跃/固定标签）
• 按域名+路径去重，忽略查询参数差异
• 可从工具栏、弹出框或右键菜单触发

─── 键盘快捷导航 ────────────────────────────
• 按侧边栏顺序导航标签，支持自定义快捷键
• 在 chrome://extensions/shortcuts 中分配按键

─── 隐私与安全 ─────────────────────────────
TabPlusPlus 完全在本地运行，不收集、传输或共享任何数据。所有设置和会话仅存储于你自己的设备中，不访问任何外部服务器。

点击工具栏中的 T+ 图标即可开始使用。
```
