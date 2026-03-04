// sidepanel.js – Full-featured tab and bookmark manager for TabPlusPlus

'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  view: 'tabs',           // 'tabs' | 'bookmarks'
  tabs: [],               // all chrome tabs
  filteredTabs: [],       // tabs after search+filter
  tabFilter: 'all',       // active filter pill
  tabSort: 'recent',      // active sort
  groupByDomain: false,   // group mode
  selectedTabs: new Set(),
  currentWindowId: null,

  bookmarks: [],          // current folder nodes
  bookmarkPath: [{ id: '0', title: 'All Bookmarks' }],
  bookmarkSearchResults: null, // null = not searching

  contextTarget: null,    // { type: 'bookmark', node } | { type: 'tab', tab }
};

// ─── DOM Refs ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const tabList        = $('tabList');
const bookmarkList   = $('bookmarkList');
const tabSearch      = $('tabSearch');
const tabSearchClear = $('tabSearchClear');
const bkSearch       = $('bookmarkSearch');
const bkSearchClear  = $('bookmarkSearchClear');
const tabCountBadge  = $('tabCountBadge');
const bkCountBadge   = $('bookmarkCountBadge');
const contextMenu    = $('contextMenu');
const toastContainer = $('toastContainer');
const editModal      = $('editModal');
const breadcrumb     = $('breadcrumb');

// ─── Initialisation ──────────────────────────────────────────────────────────
async function init() {
  const win = await chrome.windows.getCurrent();
  state.currentWindowId = win.id;

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Tab view controls
  tabSearch.addEventListener('input', onTabSearchInput);
  tabSearchClear.addEventListener('click', () => { tabSearch.value = ''; onTabSearchInput(); });
  document.querySelectorAll('.filter-btn').forEach((btn) =>
    btn.addEventListener('click', () => setTabFilter(btn.dataset.filter))
  );
  $('tabSort').addEventListener('change', (e) => { state.tabSort = e.target.value; renderTabView(); });
  $('btnGroupBy').addEventListener('click', toggleGroupBy);
  $('btnSelectAll').addEventListener('click', toggleSelectAll);
  $('btnCloseSelected').addEventListener('click', closeSelectedTabs);
  $('btnGroupSelected').addEventListener('click', groupSelectedTabs);
  $('btnSaveSession').addEventListener('click', saveSession);

  // Bookmark view controls
  bkSearch.addEventListener('input', onBkSearchInput);
  bkSearchClear.addEventListener('click', () => { bkSearch.value = ''; onBkSearchInput(); });
  $('btnAddBookmark').addEventListener('click', toggleAddBookmarkForm);
  $('btnSaveBookmark').addEventListener('click', saveBookmark);
  $('btnCancelBookmark').addEventListener('click', hideAddBookmarkForm);

  // Context menu
  $('ctxOpen').addEventListener('click', ctxOpen);
  $('ctxEdit').addEventListener('click', ctxEdit);
  $('ctxDelete').addEventListener('click', ctxDelete);
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('keydown', onKeyDown);

  // Edit modal
  $('btnCloseModal').addEventListener('click', closeEditModal);
  $('btnCancelEdit').addEventListener('click', closeEditModal);
  $('btnConfirmEdit').addEventListener('click', confirmEdit);
  editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

  // Listen for background messages (tab events)
  chrome.runtime.onMessage.addListener(onBackgroundMessage);

  await loadTabs();
  await loadBookmarkCount();
}

// ─── View Switching ──────────────────────────────────────────────────────────
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-tab').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );
  $('viewTabs').classList.toggle('hidden', view !== 'tabs');
  $('viewBookmarks').classList.toggle('hidden', view !== 'bookmarks');

  if (view === 'bookmarks') loadBookmarks();
}

// ─── Tab Management ──────────────────────────────────────────────────────────
async function loadTabs() {
  showTabSkeleton(true);
  const tabs = await chrome.tabs.query({});
  state.tabs = tabs;
  tabCountBadge.textContent = tabs.length;
  renderTabView();
  showTabSkeleton(false);
}

function renderTabView() {
  let tabs = filterTabs(state.tabs);
  tabs = sortTabs(tabs);
  state.filteredTabs = tabs;

  if (tabs.length === 0) {
    tabList.innerHTML = '';
    tabList.appendChild(emptyState('No tabs match your search.'));
    updateToolbarState();
    return;
  }

  if (state.groupByDomain) {
    renderGrouped(tabs);
  } else {
    const frag = document.createDocumentFragment();
    tabs.forEach((tab) => frag.appendChild(createTabItem(tab)));
    tabList.innerHTML = '';
    tabList.appendChild(frag);
  }
  updateToolbarState();
}

function filterTabs(tabs) {
  const q = tabSearch.value.trim().toLowerCase();
  return tabs.filter((tab) => {
    // Text search
    if (q) {
      const haystack = ((tab.title || '') + ' ' + (tab.url || '')).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    // Active filter
    switch (state.tabFilter) {
      case 'current': return tab.windowId === state.currentWindowId;
      case 'audible': return tab.audible;
      case 'pinned':  return tab.pinned;
      case 'duplicates': return isDuplicate(tab, tabs);
      default: return true;
    }
  });
}

function isDuplicate(tab, allTabs) {
  if (!tab.url) return false;
  const url = normalizeUrl(tab.url);
  return allTabs.filter((t) => normalizeUrl(t.url) === url).length > 1;
}

function normalizeUrl(url) {
  try { const u = new URL(url); return u.hostname + u.pathname; } catch { return url; }
}

function sortTabs(tabs) {
  const copy = [...tabs];
  switch (state.tabSort) {
    case 'title':
      copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'domain':
      copy.sort((a, b) => getDomain(a.url).localeCompare(getDomain(b.url)));
      break;
    default: // recent – keep browser order (index)
      copy.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }
  return copy;
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url || ''; }
}

function groupTabs(tabs) {
  const groups = new Map();
  tabs.forEach((tab) => {
    const domain = getDomain(tab.url) || 'Other';
    if (!groups.has(domain)) groups.set(domain, []);
    groups.get(domain).push(tab);
  });
  return groups;
}

function renderGrouped(tabs) {
  const groups = groupTabs(tabs);
  const frag = document.createDocumentFragment();
  const colors = ['#667eea','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316'];
  let colorIdx = 0;
  groups.forEach((groupTabs, domain) => {
    const header = document.createElement('div');
    header.className = 'group-header';
    const dot = document.createElement('div');
    dot.className = 'group-dot';
    dot.style.background = colors[colorIdx % colors.length];
    colorIdx++;
    const label = document.createElement('span');
    label.textContent = domain;
    const count = document.createElement('span');
    count.className = 'group-count';
    count.textContent = groupTabs.length;
    header.append(dot, label, count);
    frag.appendChild(header);
    groupTabs.forEach((tab) => frag.appendChild(createTabItem(tab)));
  });
  tabList.innerHTML = '';
  tabList.appendChild(frag);
}

function createTabItem(tab) {
  const item = document.createElement('div');
  item.className = 'tab-item';
  item.dataset.tabId = tab.id;
  if (tab.active && tab.windowId === state.currentWindowId) item.classList.add('active');
  if (state.selectedTabs.has(tab.id)) item.classList.add('selected');

  // Drag & drop
  item.draggable = true;
  item.addEventListener('dragstart', onDragStart);
  item.addEventListener('dragover', onDragOver);
  item.addEventListener('drop', onDrop);
  item.addEventListener('dragleave', onDragLeave);
  item.addEventListener('dragend', onDragEnd);

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tab-checkbox';
  checkbox.checked = state.selectedTabs.has(tab.id);
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    toggleTabSelection(tab.id, checkbox.checked);
  });

  // Favicon
  const favicon = createFavicon(tab);

  // Info
  const info = document.createElement('div');
  info.className = 'tab-info';
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || 'New Tab';
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = getDomain(tab.url) || tab.url || '';
  info.append(title, url);

  // Badges
  const badges = document.createElement('div');
  badges.className = 'tab-badges';
  if (tab.pinned) badges.appendChild(makeBadge('📌', 'pinned'));
  if (tab.audible) badges.appendChild(makeBadge('🔊', 'audible'));
  if (tab.mutedInfo?.muted) badges.appendChild(makeBadge('🔇', 'muted'));

  // Actions
  const actions = document.createElement('div');
  actions.className = 'tab-actions';

  const pinBtn = makeTabBtn(
    tab.pinned ? pinFilledSvg() : pinSvg(),
    tab.pinned ? 'Unpin' : 'Pin',
    tab.pinned ? 'pinned-active' : ''
  );
  pinBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePin(tab); });

  const muteBtn = makeTabBtn(
    tab.mutedInfo?.muted ? unMuteSvg() : muteSvg(),
    tab.mutedInfo?.muted ? 'Unmute' : 'Mute',
    tab.mutedInfo?.muted ? 'muted-active' : ''
  );
  muteBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(tab); });

  const closeBtn = makeTabBtn(closeSvg(), 'Close tab', 'close');
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeTab(tab.id); });

  actions.append(pinBtn, muteBtn, closeBtn);
  item.append(checkbox, favicon, info, badges, actions);

  // Click to activate tab
  item.addEventListener('click', (e) => {
    if (e.target === checkbox) return;
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  });

  return item;
}

function createFavicon(tab) {
  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.src = tab.favIconUrl;
    img.alt = '';
    img.onerror = () => img.replaceWith(faviconPlaceholder(tab));
    return img;
  }
  return faviconPlaceholder(tab);
}

function faviconPlaceholder(tab) {
  const el = document.createElement('div');
  el.className = 'tab-favicon-placeholder';
  el.textContent = (tab.title || 'T').charAt(0).toUpperCase();
  return el;
}

function makeBadge(icon, cls) {
  const b = document.createElement('span');
  b.className = `tab-badge ${cls}`;
  b.textContent = icon;
  return b;
}

function makeTabBtn(svgStr, title, extraClass = '') {
  const btn = document.createElement('button');
  btn.className = `tab-btn ${extraClass}`.trim();
  btn.title = title;
  btn.innerHTML = svgStr;
  return btn;
}

// ─── Tab Actions ─────────────────────────────────────────────────────────────
async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  state.tabs = state.tabs.filter((t) => t.id !== tabId);
  state.selectedTabs.delete(tabId);
  tabCountBadge.textContent = state.tabs.length;
  renderTabView();
  showToast('Tab closed');
}

async function togglePin(tab) {
  await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
  await loadTabs();
}

async function toggleMute(tab) {
  await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
  await loadTabs();
}

function toggleTabSelection(tabId, checked) {
  if (checked) state.selectedTabs.add(tabId);
  else state.selectedTabs.delete(tabId);
  const item = tabList.querySelector(`[data-tab-id="${tabId}"]`);
  if (item) item.classList.toggle('selected', checked);
  updateToolbarState();
}

function toggleSelectAll() {
  const allSelected = state.filteredTabs.every((t) => state.selectedTabs.has(t.id));
  if (allSelected) {
    state.filteredTabs.forEach((t) => state.selectedTabs.delete(t.id));
  } else {
    state.filteredTabs.forEach((t) => state.selectedTabs.add(t.id));
  }
  renderTabView();
}

async function closeSelectedTabs() {
  const ids = [...state.selectedTabs];
  if (ids.length === 0) return;
  await chrome.tabs.remove(ids);
  state.tabs = state.tabs.filter((t) => !state.selectedTabs.has(t.id));
  state.selectedTabs.clear();
  tabCountBadge.textContent = state.tabs.length;
  renderTabView();
  showToast(`Closed ${ids.length} tab${ids.length > 1 ? 's' : ''}`);
}

async function groupSelectedTabs() {
  const ids = [...state.selectedTabs];
  if (ids.length < 2) { showToast('Select 2+ tabs to group', 'error'); return; }
  try {
    await chrome.tabs.group({ tabIds: ids });
    state.selectedTabs.clear();
    await loadTabs();
    showToast('Tabs grouped');
  } catch {
    showToast('Grouping failed', 'error');
  }
}

async function saveSession() {
  const tabs = state.tabs.filter((t) => !t.url.startsWith('chrome://'));
  const session = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    tabs: tabs.map((t) => ({ url: t.url, title: t.title })),
  };
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  sessions.unshift(session);
  if (sessions.length > 10) sessions.length = 10;
  await chrome.storage.local.set({ sessions });
  showToast(`Session saved (${tabs.length} tabs)`, 'success');
}

function updateToolbarState() {
  const hasSelection = state.selectedTabs.size > 0;
  $('btnCloseSelected').disabled = !hasSelection;
  $('btnGroupSelected').disabled = !hasSelection;
}

// ─── Filter / Sort Controls ──────────────────────────────────────────────────
function setTabFilter(filter) {
  state.tabFilter = filter;
  document.querySelectorAll('.filter-btn').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.filter === filter)
  );
  renderTabView();
}

function onTabSearchInput() {
  const q = tabSearch.value.trim();
  tabSearchClear.classList.toggle('visible', q.length > 0);
  renderTabView();
}

function toggleGroupBy() {
  state.groupByDomain = !state.groupByDomain;
  $('btnGroupBy').classList.toggle('active', state.groupByDomain);
  renderTabView();
}

// ─── Drag & Drop Reorder ─────────────────────────────────────────────────────
let dragSrcId = null;

function onDragStart(e) {
  dragSrcId = parseInt(e.currentTarget.dataset.tabId, 10);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging', 'drag-over');
  tabList.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
}

async function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const targetId = parseInt(e.currentTarget.dataset.tabId, 10);
  if (!dragSrcId || dragSrcId === targetId) return;
  const targetTab = state.tabs.find((t) => t.id === targetId);
  if (!targetTab) return;
  await chrome.tabs.move(dragSrcId, { index: targetTab.index });
  await loadTabs();
}

// ─── Bookmark Management ─────────────────────────────────────────────────────
async function loadBookmarks(nodeId) {
  showBkSkeleton(true);
  const id = nodeId ?? state.bookmarkPath[state.bookmarkPath.length - 1].id;
  const tree = await chrome.bookmarks.getChildren(id);
  state.bookmarks = tree;
  renderBookmarks(tree);
  renderBreadcrumb();
  showBkSkeleton(false);
  await loadBookmarkCount();
}

async function loadBookmarkCount() {
  try {
    const tree = await chrome.bookmarks.getTree();
    let count = 0;
    const walk = (nodes) => nodes.forEach((n) => { if (n.url) count++; if (n.children) walk(n.children); });
    walk(tree);
    bkCountBadge.textContent = count;
  } catch { bkCountBadge.textContent = '?'; }
}

function renderBookmarks(nodes) {
  if (nodes.length === 0) {
    bookmarkList.innerHTML = '';
    bookmarkList.appendChild(emptyState('This folder is empty.'));
    return;
  }
  const frag = document.createDocumentFragment();
  nodes.forEach((node) => frag.appendChild(createBookmarkItem(node)));
  bookmarkList.innerHTML = '';
  bookmarkList.appendChild(frag);
}

function createBookmarkItem(node) {
  const item = document.createElement('div');
  item.className = 'bookmark-item';
  item.dataset.bmId = node.id;

  // Icon
  const iconWrap = document.createElement('div');
  iconWrap.className = 'bookmark-icon';
  if (node.url) {
    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${getDomain(node.url)}&sz=16`;
    img.alt = '';
    img.onerror = () => (img.style.display = 'none');
    iconWrap.appendChild(img);
  } else {
    iconWrap.innerHTML = `<svg class="folder-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
  }

  const info = document.createElement('div');
  info.className = 'bookmark-info';
  const titleEl = document.createElement('div');
  titleEl.className = 'bookmark-title';
  titleEl.textContent = node.title || (node.url ? new URL(node.url).hostname : 'Untitled');
  info.appendChild(titleEl);
  if (node.url) {
    const urlEl = document.createElement('div');
    urlEl.className = 'bookmark-url';
    urlEl.textContent = node.url;
    info.appendChild(urlEl);
  }

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';

  if (node.url) {
    const editBtn = document.createElement('button');
    editBtn.className = 'bm-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = editSvg();
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(node); });
    actions.appendChild(editBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'bm-btn delete';
  delBtn.title = 'Delete';
  delBtn.innerHTML = trashSvg();
  delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteBookmark(node); });
  actions.appendChild(delBtn);

  item.append(iconWrap, info, actions);

  // Right-click context menu
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.contextTarget = { type: 'bookmark', node };
    showContextMenu(e.clientX, e.clientY, !!node.url);
  });

  // Click
  item.addEventListener('click', () => {
    if (node.url) {
      chrome.tabs.create({ url: node.url });
    } else {
      navigateInto(node);
    }
  });

  return item;
}

function navigateInto(node) {
  state.bookmarkPath.push({ id: node.id, title: node.title || 'Folder' });
  loadBookmarks(node.id);
}

function renderBreadcrumb() {
  breadcrumb.innerHTML = '';
  state.bookmarkPath.forEach((crumb, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-separator';
      sep.textContent = '›';
      breadcrumb.appendChild(sep);
    }
    const el = document.createElement('span');
    el.className = 'breadcrumb-item' + (idx === state.bookmarkPath.length - 1 ? ' active' : '');
    el.textContent = crumb.title;
    el.dataset.id = crumb.id;
    if (idx < state.bookmarkPath.length - 1) {
      el.addEventListener('click', () => {
        state.bookmarkPath = state.bookmarkPath.slice(0, idx + 1);
        loadBookmarks(crumb.id);
      });
    }
    breadcrumb.appendChild(el);
  });
}

// ─── Bookmark CRUD ───────────────────────────────────────────────────────────
function toggleAddBookmarkForm() {
  const form = $('addBookmarkForm');
  const isHidden = form.classList.contains('hidden');
  if (isHidden) {
    form.classList.remove('hidden');
    populateFolderDropdown($('bookmarkFolder'));
    // Pre-fill with active tab info
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        $('bookmarkTitle').value = tab.title || '';
        $('bookmarkUrl').value = tab.url || '';
      }
    });
  } else {
    hideAddBookmarkForm();
  }
}

function hideAddBookmarkForm() {
  $('addBookmarkForm').classList.add('hidden');
  $('bookmarkTitle').value = '';
  $('bookmarkUrl').value = '';
}

async function populateFolderDropdown(select) {
  select.innerHTML = '';
  const addFolders = (nodes, depth = 0) => {
    nodes.forEach((n) => {
      if (!n.url) {
        const opt = document.createElement('option');
        opt.value = n.id;
        opt.textContent = '  '.repeat(depth) + (n.title || 'Folder');
        select.appendChild(opt);
        if (n.children) addFolders(n.children, depth + 1);
      }
    });
  };
  const tree = await chrome.bookmarks.getTree();
  addFolders(tree[0].children || []);
  // Pre-select current folder
  const currentId = state.bookmarkPath[state.bookmarkPath.length - 1].id;
  select.value = currentId;
}

async function saveBookmark() {
  const title = $('bookmarkTitle').value.trim();
  const url   = $('bookmarkUrl').value.trim();
  const parentId = $('bookmarkFolder').value;
  if (!url) { showToast('URL is required', 'error'); return; }
  try {
    await chrome.bookmarks.create({ title: title || url, url, parentId });
    hideAddBookmarkForm();
    await loadBookmarks();
    showToast('Bookmark saved', 'success');
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
}

async function deleteBookmark(node) {
  const label = node.url ? 'bookmark' : 'folder';
  if (!confirm(`Delete this ${label}: "${node.title}"?`)) return;
  try {
    if (node.url) {
      await chrome.bookmarks.remove(node.id);
    } else {
      await chrome.bookmarks.removeTree(node.id);
    }
    await loadBookmarks();
    showToast('Deleted', 'success');
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

function openEditModal(node) {
  state.contextTarget = { type: 'bookmark', node };
  $('editTitle').value = node.title || '';
  $('editUrl').value = node.url || '';
  editModal.classList.remove('hidden');
  $('editTitle').focus();
}

function closeEditModal() {
  editModal.classList.add('hidden');
  state.contextTarget = null;
}

async function confirmEdit() {
  const target = state.contextTarget;
  if (!target || target.type !== 'bookmark') return;
  const title = $('editTitle').value.trim();
  const url   = $('editUrl').value.trim();
  try {
    await chrome.bookmarks.update(target.node.id, { title, url: url || undefined });
    closeEditModal();
    await loadBookmarks();
    showToast('Bookmark updated', 'success');
  } catch (e) {
    showToast('Update failed: ' + e.message, 'error');
  }
}

// ─── Bookmark Search ─────────────────────────────────────────────────────────
function onBkSearchInput() {
  const q = bkSearch.value.trim();
  bkSearchClear.classList.toggle('visible', q.length > 0);
  if (!q) {
    state.bookmarkSearchResults = null;
    loadBookmarks();
    return;
  }
  searchBookmarks(q);
}

async function searchBookmarks(query) {
  const results = await chrome.bookmarks.search(query);
  state.bookmarkSearchResults = results;
  renderBookmarks(results);
}

// ─── Context Menu ────────────────────────────────────────────────────────────
function showContextMenu(x, y, showEdit = true) {
  $('ctxEdit').style.display = showEdit ? '' : 'none';
  contextMenu.style.left = x + 'px';
  contextMenu.style.top  = y + 'px';
  contextMenu.classList.remove('hidden');
  // Keep inside viewport
  requestAnimationFrame(() => {
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth)  contextMenu.style.left = (x - rect.width)  + 'px';
    if (rect.bottom > window.innerHeight) contextMenu.style.top = (y - rect.height) + 'px';
  });
}

function hideContextMenu() { contextMenu.classList.add('hidden'); }

function ctxOpen(e) {
  e.stopPropagation();
  hideContextMenu();
  const t = state.contextTarget;
  if (!t) return;
  if (t.type === 'bookmark' && t.node.url) chrome.tabs.create({ url: t.node.url });
}

function ctxEdit(e) {
  e.stopPropagation();
  hideContextMenu();
  const t = state.contextTarget;
  if (!t) return;
  if (t.type === 'bookmark') openEditModal(t.node);
}

function ctxDelete(e) {
  e.stopPropagation();
  hideContextMenu();
  const t = state.contextTarget;
  if (!t) return;
  if (t.type === 'bookmark') deleteBookmark(t.node);
}

// ─── Background Messages ─────────────────────────────────────────────────────
function onBackgroundMessage(message) {
  switch (message.type) {
    case 'TAB_CREATED':
    case 'TAB_REMOVED':
    case 'TAB_UPDATED':
    case 'TAB_MOVED':
      if (state.view === 'tabs') loadTabs();
      break;
    case 'TAB_ACTIVATED':
      if (state.view === 'tabs') refreshActiveState(message.activeInfo);
      break;
    case 'BOOKMARK_ADDED':
      loadBookmarkCount();
      if (state.view === 'bookmarks') loadBookmarks();
      break;
  }
}

function refreshActiveState(activeInfo) {
  tabList.querySelectorAll('.tab-item').forEach((item) => {
    const id = parseInt(item.dataset.tabId, 10);
    const tab = state.tabs.find((t) => t.id === id);
    const isActive = id === activeInfo.tabId && tab?.windowId === activeInfo.windowId;
    item.classList.toggle('active', isActive);
  });
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (!editModal.classList.contains('hidden')) { closeEditModal(); return; }
    if (!contextMenu.classList.contains('hidden')) { hideContextMenu(); return; }
    if (state.view === 'tabs' && tabSearch.value) { tabSearch.value = ''; onTabSearchInput(); return; }
    if (state.view === 'bookmarks' && bkSearch.value) { bkSearch.value = ''; onBkSearchInput(); }
  }
}

// ─── Toast Notifications ─────────────────────────────────────────────────────
function showToast(message, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 2200);
}

// ─── Skeleton Helpers ────────────────────────────────────────────────────────
function showTabSkeleton(show) {
  const sk = $('tabSkeleton');
  if (sk) sk.style.display = show ? 'flex' : 'none';
}

function showBkSkeleton(show) {
  const sk = $('bookmarkSkeleton');
  if (sk) sk.style.display = show ? 'flex' : 'none';
}

function emptyState(text) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="8" y1="15" x2="16" y2="15"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
    <p>${text}</p>`;
  return el;
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────
const svg = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ${extra}>${d}</svg>`;

const closeSvg  = () => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>');
const pinSvg    = () => svg('<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>');
const pinFilledSvg = () => svg('<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>', 'fill="currentColor"');
const muteSvg   = () => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>');
const unMuteSvg = () => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>');
const editSvg   = () => svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');
const trashSvg  = () => svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>');

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
