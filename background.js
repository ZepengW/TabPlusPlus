// background.js - Service Worker for TabPlusPlus

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isRestrictedPage(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://')
  );
}

// ─── Action icon click: toggle overlay in the active tab ─────────────────────
// The popup has been removed; the icon click now shows/hides the floating panel.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || isRestrictedPage(tab.url)) {
    // Fallback for restricted pages (chrome://, about:, etc.)
    await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
  } catch {
    // Content script not yet active on this tab – inject it first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    } catch (e) {
      console.warn('TabPlusPlus: could not inject overlay', e);
    }
  }
});

// Prevent the side panel from auto-opening when the action icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

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
    if (!tab.id || isRestrictedPage(tab.url)) {
      await chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
      return;
    }
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
      } catch (e) {
        console.warn('TabPlusPlus: could not inject overlay', e);
      }
    }
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

// ─── Broadcast a message to all extension contexts (side panel / overlay) ─────
function notifySidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // No listeners open; ignore
  });
}

// ─── Tab event listeners ──────────────────────────────────────────────────────
chrome.tabs.onCreated.addListener((tab) => {
  notifySidePanel({ type: 'TAB_CREATED', tab });
});

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

