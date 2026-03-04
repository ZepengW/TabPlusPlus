// background.js - Service Worker for TabPlusPlus

// Open side panel when the action icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// Allow side panel to open on all pages
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// Set up context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openTabPlusPlus",
    title: "Open TabPlusPlus",
    contexts: ["all"]
  });
  chrome.contextMenus.create({
    id: "addToBookmarks",
    title: "Add to Bookmarks",
    contexts: ["page", "link"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "openTabPlusPlus") {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } else if (info.menuItemId === "addToBookmarks") {
    const url = info.linkUrl || info.pageUrl;
    const title = info.linkText || tab.title || url;
    try {
      await chrome.bookmarks.create({ url, title });
      notifySidePanel({ type: "BOOKMARK_ADDED", url, title });
    } catch (e) {
      console.error("Failed to add bookmark:", e);
    }
  }
});

// Broadcast a message to the side panel if it is open
function notifySidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open; ignore the error
  });
}

// Tab event listeners – broadcast to side panel so it can refresh
chrome.tabs.onCreated.addListener((tab) => {
  notifySidePanel({ type: "TAB_CREATED", tab });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  notifySidePanel({ type: "TAB_REMOVED", tabId, removeInfo });
});

// Only forward updates that carry visible changes to the side panel
function isSignificantUpdate(changeInfo) {
  const keys = ["status", "title", "favIconUrl", "pinned", "audible", "mutedInfo"];
  return keys.some((k) => k in changeInfo) && changeInfo.status !== "loading";
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isSignificantUpdate(changeInfo)) {
    notifySidePanel({ type: "TAB_UPDATED", tabId, changeInfo, tab });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  notifySidePanel({ type: "TAB_ACTIVATED", activeInfo });
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  notifySidePanel({ type: "TAB_MOVED", tabId, moveInfo });
});

// Handle messages from the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TABS") {
    chrome.tabs.query({}).then((tabs) => sendResponse({ tabs }));
    return true; // keep channel open for async response
  }

  if (message.type === "CREATE_BOOKMARK") {
    const { url, title, parentId } = message;
    const opts = { url, title };
    if (parentId) opts.parentId = parentId;
    chrome.bookmarks.create(opts)
      .then((node) => sendResponse({ success: true, node }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === "DELETE_BOOKMARK") {
    chrome.bookmarks.remove(message.id)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === "UPDATE_BOOKMARK") {
    chrome.bookmarks.update(message.id, { title: message.title, url: message.url })
      .then((node) => sendResponse({ success: true, node }))
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.type === "OPEN_SIDE_PANEL") {
    chrome.windows.getCurrent().then((win) => {
      chrome.sidePanel.open({ windowId: win.id })
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
    });
    return true;
  }
});
