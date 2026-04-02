// background.js - Service Worker for TabPlusPlus

// ─── Action icon click: toggle the native Chrome side panel ──────────────────
// openPanelOnActionClick: true lets Chrome handle the open/close toggle natively.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

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
});

// ─── Context menu clicks ──────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
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
  const keys = ['status', 'title', 'favIconUrl', 'pinned', 'audible', 'mutedInfo'];
  return keys.some((k) => k in changeInfo) && changeInfo.status !== 'loading';
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
