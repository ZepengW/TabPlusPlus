// popup.js – TabPlusPlus popup logic

'use strict';

const $ = (id) => document.getElementById(id);

async function init() {
  await Promise.all([loadStats(), loadSessions()]);

  $('btnOpenPanel').addEventListener('click', openSidePanel);
  $('btnNewTab').addEventListener('click', () => chrome.tabs.create({}));
  $('btnCloseDupes').addEventListener('click', closeDuplicates);
  $('btnSaveSession').addEventListener('click', saveSession);
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function loadStats() {
  const [tabs, windows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getAll(),
  ]);
  $('statTabs').textContent    = tabs.length;
  $('statWindows').textContent = windows.length;

  try {
    const tree = await chrome.bookmarks.getTree();
    let count = 0;
    const walk = (nodes) => nodes.forEach((n) => { if (n.url) count++; if (n.children) walk(n.children); });
    walk(tree);
    $('statBookmarks').textContent = count;
  } catch {
    $('statBookmarks').textContent = '–';
  }
}

// ─── Open Side Panel ─────────────────────────────────────────────────────────
async function openSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
}

// ─── Close Duplicates ────────────────────────────────────────────────────────
async function closeDuplicates() {
  const tabs = await chrome.tabs.query({});
  const seen = new Map();
  const toClose = [];

  tabs.forEach((tab) => {
    if (!tab.url) return;
    let url;
    try { const u = new URL(tab.url); url = u.hostname + u.pathname; } catch (e) { console.warn('URL parse failed:', tab.url, e); url = tab.url; }
    if (seen.has(url)) {
      toClose.push(tab.id);
    } else {
      seen.set(url, tab.id);
    }
  });

  if (toClose.length === 0) {
    showToast('No duplicate tabs found');
    return;
  }

  await chrome.tabs.remove(toClose);
  showToast(`Closed ${toClose.length} duplicate${toClose.length > 1 ? 's' : ''}`, 'success');
  await loadStats();
}

// ─── Save Session ────────────────────────────────────────────────────────────
async function saveSession() {
  const tabs = await chrome.tabs.query({});
  const validTabs = tabs.filter((t) => t.url && !t.url.startsWith('chrome://'));
  const session = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    tabs: validTabs.map((t) => ({ url: t.url, title: t.title })),
  };

  const { sessions = [] } = await chrome.storage.local.get('sessions');
  sessions.unshift(session);
  if (sessions.length > 10) sessions.length = 10;
  await chrome.storage.local.set({ sessions });

  showToast(`Session saved (${validTabs.length} tabs)`, 'success');
  await loadSessions();
}

// ─── Sessions ────────────────────────────────────────────────────────────────
async function loadSessions() {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  const container = $('sessionList');

  if (sessions.length === 0) {
    container.innerHTML = '<p class="empty-msg">No saved sessions yet.</p>';
    return;
  }

  container.innerHTML = '';
  const recent = sessions.slice(0, 3);
  recent.forEach((session) => {
    const item = document.createElement('div');
    item.className = 'session-item';

    const meta = document.createElement('div');
    meta.className = 'session-meta';

    const date = document.createElement('div');
    date.className = 'session-date';
    date.textContent = session.date;

    const label = document.createElement('div');
    label.className = 'session-tabs';
    const titles = session.tabs.slice(0, 3).map((t) => t.title || t.url).join(', ');
    label.textContent = `${session.tabs.length} tab${session.tabs.length !== 1 ? 's' : ''}: ${titles}`;
    label.title = session.tabs.map((t) => t.title || t.url).join('\n');

    meta.append(date, label);

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'session-restore';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => restoreSession(session));

    item.append(meta, restoreBtn);
    container.appendChild(item);
  });
}

async function restoreSession(session) {
  for (const { url } of session.tabs) {
    await chrome.tabs.create({ url, active: false });
  }
  showToast(`Restored ${session.tabs.length} tabs`, 'success');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = '') {
  const wrap = $('toastWrap');
  const toast = document.createElement('div');
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 2000);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
