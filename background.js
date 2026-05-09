// background.js - Service Worker for TabPlusPlus

// ─── Action icon click: toggle the native Chrome side panel ──────────────────
// openPanelOnActionClick: true lets Chrome handle the open/close toggle natively.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const TAB_GROUP_NONE_ID = -1;
const TAB_MENU_IDS = {
  root: 'tabActionsRoot',
  closeCurrent: 'tabCloseCurrent',
  closeGroupOthers: 'tabCloseGroupOthers',
  closeWindowOthers: 'tabCloseWindowOthers',
  closeOthers: 'tabCloseOthers',
  closeRight: 'tabCloseRight',
  reopenClosed: 'tabReopenClosed',
};

function getLocalizedMessage(key, fallback) {
  return chrome.i18n.getMessage(key) || fallback;
}

// ─── Context menus ────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openTabPlusPlus',
    title: 'Open TabPlusPlus',
    contexts: ['all'],
  });
  chrome.contextMenus.create({
    id: 'addToBookmarks',
    title: 'Add to Bookmarks',
    contexts: ['page', 'link'],
  });
  chrome.contextMenus.create({
    id: 'closeDuplicateTabs',
    title: 'Close Duplicate Tabs',
    contexts: ['all'],
  });
  chrome.contextMenus.create({
    id: 'saveTabSession',
    title: 'Save Current Session',
    contexts: ['all'],
  });
  chrome.contextMenus.create({
    id: TAB_MENU_IDS.root,
    title: getLocalizedMessage('ctx_tab_actions_root', 'TabPlusPlus Tab Actions'),
    contexts: ['tab'],
  });
  chrome.contextMenus.create({
    id: TAB_MENU_IDS.closeCurrent,
    parentId: TAB_MENU_IDS.root,
    title: getLocalizedMessage('ctx_tab_close_current', 'Close Current Tab'),
    contexts: ['tab'],
  });
  chrome.contextMenus.create({
    id: TAB_MENU_IDS.closeGroupOthers,
    parentId: TAB_MENU_IDS.root,
    title: getLocalizedMessage('ctx_tab_close_group_others', 'Close Other Tabs in Group'),
    contexts: ['tab'],
  });
  chrome.contextMenus.create({
    id: TAB_MENU_IDS.closeWindowOthers,
    parentId: TAB_MENU_IDS.root,
    title: getLocalizedMessage('ctx_tab_close_window_others', 'Close Other Tabs in This Window'),
    contexts: ['tab'],
  });
  chrome.contextMenus.create({
    id: TAB_MENU_IDS.closeOthers,
    parentId: TAB_MENU_IDS.root,
    title: getLocalizedMessage('ctx_tab_close_others', 'Close Other Tabs'),
    contexts: ['tab'],
  });
  chrome.contextMenus.create({
    id: TAB_MENU_IDS.closeRight,
    parentId: TAB_MENU_IDS.root,
    title: getLocalizedMessage('ctx_tab_close_right', 'Close Tabs to the Right'),
    contexts: ['tab'],
  });
  chrome.contextMenus.create({
    id: TAB_MENU_IDS.reopenClosed,
    parentId: TAB_MENU_IDS.root,
    title: getLocalizedMessage('ctx_tab_reopen_closed', 'Reopen Last Closed Tab'),
    contexts: ['tab'],
  });
});

// ─── Context menu clicks ──────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (await handleTabMenuClick(info, tab)) return;

  if (info.menuItemId === 'openTabPlusPlus') {
    await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }

  if (info.menuItemId === 'addToBookmarks') {
    const url   = info.linkUrl || info.pageUrl;
    const title = info.linkText || tab.title || url;
    try {
      await chrome.bookmarks.create({ url, title });
      notifySidePanel({ type: 'BOOKMARK_ADDED', url, title });
    } catch (e) {
      console.error('Failed to add bookmark:', e);
    }
  }

  if (info.menuItemId === 'closeDuplicateTabs') {
    const tabs = await chrome.tabs.query({});
    const seen   = new Map();
    const toClose = [];
    // Sort so active/pinned tabs are considered first – they will be kept
    const sorted = [...tabs].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return 0;
    });
    sorted.forEach((t) => {
      if (!t.url) return;
      // Use hostname + pathname as the dedup key (intentionally ignores query
      // params so e.g. "example.com/page?lang=en" and "?lang=fr" collapse).
      let key;
      try {
        const u = new URL(t.url);
        key = u.hostname + u.pathname;
      } catch {
        key = t.url;
      }
      if (seen.has(key)) toClose.push(t.id);
      else seen.set(key, t.id);
    });
    if (toClose.length > 0) {
      await chrome.tabs.remove(toClose);
      notifySidePanel({ type: 'DUPLICATES_CLOSED', count: toClose.length });
    }
  }

  if (info.menuItemId === 'saveTabSession') {
    const tabs = await chrome.tabs.query({});
    const validTabs = tabs.filter((t) => t.url && !t.url.startsWith('chrome://'));
    const session = {
      id:   Date.now(),
      date: new Date().toLocaleString(),
      tabs: validTabs.map((t) => ({ url: t.url, title: t.title })),
    };
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    sessions.unshift(session);
    if (sessions.length > 10) sessions.length = 10;
    await chrome.storage.local.set({ sessions });
    notifySidePanel({ type: 'SESSION_SAVED', count: validTabs.length });
  }
});

async function handleTabMenuClick(info, fallbackTab) {
  const tabMenuIds = new Set(Object.values(TAB_MENU_IDS));
  if (!tabMenuIds.has(info.menuItemId)) return false;
  if (info.menuItemId === TAB_MENU_IDS.root) return true;

  const currentTab = await getCurrentContextTab(info, fallbackTab);
  if (!currentTab) return true;

  if (info.menuItemId === TAB_MENU_IDS.closeCurrent) {
    await chrome.tabs.remove(currentTab.id).catch(() => {});
    return true;
  }

  if (info.menuItemId === TAB_MENU_IDS.closeGroupOthers) {
    if (currentTab.groupId === TAB_GROUP_NONE_ID) return true;
    const tabsInGroup = await chrome.tabs.query({
      windowId: currentTab.windowId,
      groupId: currentTab.groupId,
    });
    const toClose = tabsInGroup.map((t) => t.id).filter((id) => id !== currentTab.id);
    if (toClose.length) await chrome.tabs.remove(toClose).catch(() => {});
    return true;
  }

  if (info.menuItemId === TAB_MENU_IDS.closeWindowOthers) {
    const windowTabs = await chrome.tabs.query({ windowId: currentTab.windowId });
    const toClose = windowTabs.map((t) => t.id).filter((id) => id !== currentTab.id);
    if (toClose.length) await chrome.tabs.remove(toClose).catch(() => {});
    return true;
  }

  if (info.menuItemId === TAB_MENU_IDS.closeOthers) {
    const allTabs = await chrome.tabs.query({});
    const tabsByWindow = new Map();
    allTabs.forEach((t) => {
      let windowTabs = tabsByWindow.get(t.windowId);
      if (!windowTabs) {
        windowTabs = [];
        tabsByWindow.set(t.windowId, windowTabs);
      }
      windowTabs.push(t);
    });

    const toClose = [];
    tabsByWindow.forEach((windowTabs, windowId) => {
      if (windowId === currentTab.windowId) {
        toClose.push(...windowTabs.map((t) => t.id).filter((id) => id !== currentTab.id));
        return;
      }
      if (windowTabs.length <= 1) return;
      // Keep priority: active tab > pinned tab > first tab, to avoid closing entire windows.
      let keepTab = windowTabs[0];
      for (const t of windowTabs) {
        if (t.active) {
          keepTab = t;
          break;
        }
        if (t.pinned && !keepTab.pinned) keepTab = t;
      }
      toClose.push(...windowTabs.map((t) => t.id).filter((id) => id !== keepTab.id));
    });
    if (toClose.length) await chrome.tabs.remove(toClose).catch(() => {});
    return true;
  }

  if (info.menuItemId === TAB_MENU_IDS.closeRight) {
    const windowTabs = await chrome.tabs.query({ windowId: currentTab.windowId });
    const toClose = windowTabs
      .filter((t) => t.index > currentTab.index)
      .map((t) => t.id);
    if (toClose.length) await chrome.tabs.remove(toClose).catch(() => {});
    return true;
  }

  if (info.menuItemId === TAB_MENU_IDS.reopenClosed) {
    await chrome.sessions.restore().catch(() => {});
    return true;
  }

  return true;
}

async function getCurrentContextTab(info, fallbackTab) {
  if (typeof info.tabId === 'number') {
    const tabFromInfo = await chrome.tabs.get(info.tabId).catch(() => null);
    if (tabFromInfo) return tabFromInfo;
  }
  if (fallbackTab?.id) {
    const tabFromFallback = await chrome.tabs.get(fallbackTab.id).catch(() => null);
    if (tabFromFallback) return tabFromFallback;
  }
  return null;
}

// ─── Broadcast a message to all extension contexts (side panel) ───────────────
function notifySidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // No listeners open; ignore
  });
}

// ─── Keyboard commands ────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'navigate-tab-next') {
    await navigateTabInPanelOrder(1);
  } else if (command === 'navigate-tab-prev') {
    await navigateTabInPanelOrder(-1);
  }
});

async function navigateTabInPanelOrder(direction) {
  try {
    const data = await chrome.storage.session.get(['sidePanelOpen', 'panelTabOrder', 'enableTabNavShortcut']);
    // Only act when the side panel is open and the feature is enabled
    if (!data.sidePanelOpen || !data.enableTabNavShortcut) return;
    const order = data.panelTabOrder;
    if (!Array.isArray(order) || order.length === 0) return;

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;

    const currentIndex = order.indexOf(activeTab.id);
    let nextIndex;
    if (currentIndex === -1) {
      nextIndex = direction === 1 ? 0 : order.length - 1;
    } else {
      nextIndex = (currentIndex + direction + order.length) % order.length;
    }

    const nextTabId = order[nextIndex];
    const nextTab = await chrome.tabs.get(nextTabId).catch(() => null);
    if (!nextTab) return;

    await chrome.tabs.update(nextTabId, { active: true });
    await chrome.windows.update(nextTab.windowId, { focused: true });
  } catch (e) {
    console.debug('TabPlusPlus: navigateTabInPanelOrder failed', e);
  }
}

// ─── Tab event listeners ──────────────────────────────────────────────────────
chrome.tabs.onCreated.addListener((tab) => {
  notifySidePanel({ type: 'TAB_CREATED', tab });
});

// ─── Tab group event listeners ────────────────────────────────────────────────
if (chrome.tabGroups) {
  chrome.tabGroups.onCreated.addListener((group) => {
    notifySidePanel({ type: 'TAB_GROUP_CREATED', group });
  });
  chrome.tabGroups.onUpdated.addListener((group) => {
    notifySidePanel({ type: 'TAB_GROUP_UPDATED', group });
  });
  chrome.tabGroups.onRemoved.addListener((group) => {
    notifySidePanel({ type: 'TAB_GROUP_REMOVED', group });
  });
  chrome.tabGroups.onMoved.addListener((group) => {
    notifySidePanel({ type: 'TAB_GROUP_MOVED', group });
  });
}

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  notifySidePanel({ type: 'TAB_REMOVED', tabId, removeInfo });
});

function isSignificantUpdate(changeInfo) {
  // status is handled separately from other keys:
  // - ignore all non-complete status transitions (e.g. loading/unloaded)
  // - treat a standalone complete transition as significant to refresh once
  const hasStatus = Object.prototype.hasOwnProperty.call(changeInfo, 'status');
  if (hasStatus && changeInfo.status !== 'complete') return false;

  const keys = ['title', 'url', 'favIconUrl', 'pinned', 'audible', 'mutedInfo', 'groupId'];
  if (keys.some((k) => k in changeInfo)) return true;
  return hasStatus;
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isSignificantUpdate(changeInfo)) {
    notifySidePanel({ type: 'TAB_UPDATED', tabId, changeInfo, tab });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  notifySidePanel({ type: 'TAB_ACTIVATED', activeInfo });
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  notifySidePanel({ type: 'TAB_MOVED', tabId, moveInfo });
});

// ─── Messages from the panel ──────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TABS') {
    chrome.tabs.query({}).then((tabs) => sendResponse({ tabs }));
    return true;
  }

  if (message.type === 'CREATE_BOOKMARK') {
    const { url, title, parentId } = message;
    const opts = { url, title };
    if (parentId) opts.parentId = parentId;
    chrome.bookmarks.create(opts)
      .then((node) => sendResponse({ success: true, node }))
      .catch((e)  => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'DELETE_BOOKMARK') {
    chrome.bookmarks.remove(message.id)
      .then(()   => sendResponse({ success: true }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'UPDATE_BOOKMARK') {
    chrome.bookmarks.update(message.id, { title: message.title, url: message.url })
      .then((node) => sendResponse({ success: true, node }))
      .catch((e)  => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.windows.getCurrent().then((win) => {
      chrome.sidePanel.open({ windowId: win.id })
        .then(()   => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
    });
    return true;
  }
});
