// sidepanel.js – Full-featured tab and bookmark manager for TabPlusPlus

'use strict';

// ─── i18n helper ─────────────────────────────────────────────────────────────
function t(key, ...subs) {
  let msg = chrome.i18n.getMessage(key);
  if (!msg) return key;
  return subs.reduce((s, v, i) => s.replaceAll('{' + (i + 1) + '}', String(v)), msg);
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}

// ─── Default Settings ────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  rememberLastView: true,
  rememberFilters: true,
  bookmarkViewMode: 'flat',  // 'flat' | 'tree'
  showRecentBookmarks: true,
  recentBookmarksCount: 5,
  enableTabNavShortcut: true, // enable keyboard shortcut for tab navigation in panel order
  overlayPosition: 'right',  // 'right' | 'left'
};

const OPEN_ALL_CONFIRM_THRESHOLD = 10;

// ─── Tab Group Color Map ──────────────────────────────────────────────────────
const GROUP_COLORS = {
  grey:   '#9E9E9E',
  blue:   '#1A73E8',
  red:    '#D93025',
  yellow: '#F29900',
  green:  '#188038',
  pink:   '#E52592',
  purple: '#8430CE',
  cyan:   '#007B83',
  orange: '#FA903E',
};

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

  customTabOrder: [],     // custom panel ordering (list of tab IDs)

  tabGroups: [],          // chrome.TabGroup[] – native Chrome tab groups
  selectedGroupColor: 'blue', // color selected in group modal
  groupModalTarget: null, // { group: TabGroup|null, tabIds: number[]|null }
  collapsedDomainGroups: new Set(), // domain strings whose groups are collapsed

  bookmarks: [],          // current folder nodes
  bookmarkPath: [{ id: '0', title: '' }],
  bookmarkSearchResults: null, // null = not searching
  bookmarkViewMode: 'flat',    // 'flat' | 'tree'
  bookmarkTreeExpanded: new Set(), // folder IDs expanded in tree view
  bookmarkFullTree: null,      // cached full bookmark tree

  recentBookmarks: [],    // recently accessed bookmarks [{id,title,url}]
  settings: { ...DEFAULT_SETTINGS },

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
  // Apply i18n strings first so UI is localised before any async load
  applyI18n();
  // Initialise bookmarkPath title after i18n is applied
  state.bookmarkPath = [{ id: '0', title: t('all_bookmarks') }];

  const win = await chrome.windows.getCurrent();
  state.currentWindowId = win.id;

  // Load persisted settings and preferences first
  await loadSettings();

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
  $('tabSort').addEventListener('change', (e) => {
    const newSort = e.target.value;
    if (newSort !== 'custom') {
      // Hide the custom option again when switching away
      const customOpt = e.target.querySelector('option[value="custom"]');
      if (customOpt) customOpt.hidden = true;
      state.customTabOrder = [];
    }
    state.tabSort = newSort;
    persistPreferences();
    renderTabView();
  });
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
  $('btnBookmarkView').addEventListener('click', toggleBookmarkViewMode);

  // Settings button – opens dedicated settings page
  $('btnSettings').addEventListener('click', openSettings);

  // Context menu
  $('ctxOpen').addEventListener('click', ctxOpen);
  $('ctxOpenAll').addEventListener('click', ctxOpenAll);
  $('ctxEdit').addEventListener('click', ctxEdit);
  $('ctxDelete').addEventListener('click', ctxDelete);
  document.addEventListener('click', hideContextMenu);
  document.addEventListener('keydown', onKeyDown);

  // Edit modal
  $('btnCloseModal').addEventListener('click', closeEditModal);
  $('btnCancelEdit').addEventListener('click', closeEditModal);
  $('btnConfirmEdit').addEventListener('click', confirmEdit);
  editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

  // Group modal
  $('btnCloseGroupModal').addEventListener('click', hideGroupModal);
  $('btnCancelGroup').addEventListener('click', hideGroupModal);
  $('btnConfirmGroup').addEventListener('click', confirmGroupModal);
  $('groupModal').addEventListener('click', (e) => { if (e.target === $('groupModal')) hideGroupModal(); });
  $('colorSwatches').addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    state.selectedGroupColor = swatch.dataset.color;
    document.querySelectorAll('.color-swatch').forEach((s) =>
      s.classList.toggle('active', s.dataset.color === state.selectedGroupColor)
    );
  });

  // Listen for background messages (tab events)
  chrome.runtime.onMessage.addListener(onBackgroundMessage);

  // React to settings changes made in the separate settings page
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      state.settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
      onSettingsChanged();
    }
  });

  // Mark panel as open in session storage so background can respond to keyboard commands
  chrome.storage.session.set({ sidePanelOpen: true }).catch(() => {});
  window.addEventListener('unload', () => {
    chrome.storage.session.set({ sidePanelOpen: false }).catch(() => {});
  });

  // Start in saved view
  if (state.view === 'bookmarks') {
    applyPreferencesToUI();
    await loadBookmarks();
    await loadBookmarkCount();
  } else {
    applyPreferencesToUI();
    await loadTabs();
    await loadBookmarkCount();
  }
}

// ─── View Switching ──────────────────────────────────────────────────────────
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.nav-tab').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );
  $('viewTabs').classList.toggle('hidden', view !== 'tabs');
  $('viewBookmarks').classList.toggle('hidden', view !== 'bookmarks');

  persistPreferences();
  if (view === 'bookmarks') loadBookmarks();
}

// ─── Tab Management ──────────────────────────────────────────────────────────
async function loadTabs() {
  showTabSkeleton(true);
  const [tabs, tabGroups] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabGroups ? chrome.tabGroups.query({}).catch(() => []) : Promise.resolve([]),
  ]);
  state.tabs = tabs;
  state.tabGroups = tabGroups;
  // Keep custom order in sync when tabs change externally
  if (state.tabSort === 'custom' && state.customTabOrder.length > 0) {
    syncCustomOrder();
  }
  tabCountBadge.textContent = tabs.length;
  renderTabView();
  showTabSkeleton(false);
}

function renderTabView() {
  let tabs = filterTabs(state.tabs);
  tabs = sortTabs(tabs);
  state.filteredTabs = tabs;

  // Keep session storage up to date for keyboard-shortcut tab navigation
  chrome.storage.session.set({
    panelTabOrder: tabs.map((t) => t.id),
    enableTabNavShortcut: state.settings.enableTabNavShortcut,
  }).catch(() => {});

  if (tabs.length === 0) {
    tabList.innerHTML = '';
    tabList.appendChild(emptyState(t('empty_tabs')));
    updateToolbarState();
    return;
  }

  const hasNativeGroups = tabs.some((t) => t.groupId !== -1);

  if (hasNativeGroups) {
    renderWithNativeGroups(tabs);
  } else if (state.groupByDomain) {
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
    case 'custom': {
      const order = state.customTabOrder;
      if (order.length > 0) {
        copy.sort((a, b) => {
          const ai = order.indexOf(a.id);
          const bi = order.indexOf(b.id);
          return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
        });
      }
      break;
    }
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
  const domainGroups = groupTabs(tabs);
  const frag = document.createDocumentFragment();
  const colors = ['#667eea','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316'];
  let colorIdx = 0;
  domainGroups.forEach((domainTabs, domain) => {
    const color = colors[colorIdx % colors.length];
    colorIdx++;
    frag.appendChild(createDomainGroupHeader(domain, domainTabs.length, color));
    if (!state.collapsedDomainGroups.has(domain)) {
      domainTabs.forEach((tab) => frag.appendChild(createTabItem(tab)));
    }
  });
  tabList.innerHTML = '';
  tabList.appendChild(frag);
}

function renderWithNativeGroups(tabs) {
  // Split tabs into native-grouped and ungrouped
  const groupMap = new Map(); // groupId → tab[]
  const ungrouped = [];

  tabs.forEach((tab) => {
    if (tab.groupId !== -1) {
      if (!groupMap.has(tab.groupId)) groupMap.set(tab.groupId, []);
      groupMap.get(tab.groupId).push(tab);
    } else {
      ungrouped.push(tab);
    }
  });

  const frag = document.createDocumentFragment();

  // Render each native Chrome group
  groupMap.forEach((groupTabs, groupId) => {
    const group = state.tabGroups.find((g) => g.id === groupId) ||
      { id: groupId, title: '', color: 'grey', collapsed: false };
    frag.appendChild(createNativeGroupHeader(group, groupTabs.length));
    if (!group.collapsed) {
      groupTabs.forEach((tab) => frag.appendChild(createTabItem(tab)));
    }
  });

  // Render ungrouped tabs below (with optional domain grouping)
  if (ungrouped.length > 0) {
    if (state.groupByDomain && ungrouped.length > 1) {
      const domainGroups = groupTabs(ungrouped);
      const colors = ['#667eea','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316'];
      let colorIdx = 0;
      domainGroups.forEach((domainTabs, domain) => {
        const color = colors[colorIdx % colors.length];
        colorIdx++;
        frag.appendChild(createDomainGroupHeader(domain, domainTabs.length, color));
        if (!state.collapsedDomainGroups.has(domain)) {
          domainTabs.forEach((tab) => frag.appendChild(createTabItem(tab)));
        }
      });
    } else {
      ungrouped.forEach((tab) => frag.appendChild(createTabItem(tab)));
    }
  }

  tabList.innerHTML = '';
  tabList.appendChild(frag);
}

function createDomainGroupHeader(domain, tabCount, color) {
  const header = document.createElement('div');
  header.className = 'group-header';
  header.dataset.domain = domain;
  header.draggable = true;

  const dot = document.createElement('div');
  dot.className = 'group-dot';
  dot.style.background = color;

  const isCollapsed = state.collapsedDomainGroups.has(domain);
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'group-collapse-btn';
  collapseBtn.title = isCollapsed ? t('group_expand') : t('group_collapse');
  collapseBtn.innerHTML = isCollapsed ? chevronRightSvg() : chevronDownSvg();
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDomainGroupCollapse(domain);
  });

  const label = document.createElement('span');
  label.textContent = domain;

  const count = document.createElement('span');
  count.className = 'group-count';
  count.textContent = tabCount;

  // Drag handlers for group reordering
  header.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    dragSrcDomain = domain;
    dragSrcId = null;
    dragSrcGroupId = null;
    dragSrcTabGroupId = -1;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  header.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.classList.remove('drag-over-before', 'drag-over-after');
    el.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-before' : 'drag-over-after');
  });
  header.addEventListener('dragleave', (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over-before', 'drag-over-after');
    }
  });
  header.addEventListener('dragend', (e) => {
    e.currentTarget.classList.remove('dragging', 'drag-over-before', 'drag-over-after');
    tabList.querySelectorAll('.drag-over, .drag-over-before, .drag-over-after')
      .forEach((el) => el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after'));
    dragSrcDomain = null;
    dragSrcTabGroupId = -1;
  });
  header.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const insertAfter = e.currentTarget.classList.contains('drag-over-after');
    e.currentTarget.classList.remove('drag-over-before', 'drag-over-after');
    const targetDomain = e.currentTarget.dataset.domain;

    if (dragSrcId !== null) {
      // A single tab dropped on a domain group header → move before/after first tab of this domain
      const domainTabIds = state.filteredTabs
        .filter((t) => getDomain(t.url) === targetDomain)
        .map((t) => t.id);
      const order = getOrBuildCustomOrder();
      const refId = insertAfter
        ? [...order].reverse().find((id) => domainTabIds.includes(id))
        : order.find((id) => domainTabIds.includes(id));
      if (refId !== undefined && dragSrcId !== refId) {
        state.customTabOrder = insertAfter
          ? applyReorderAfter([dragSrcId], refId, order)
          : applyReorder([dragSrcId], refId, order);
        switchToCustomSort();
      }
    } else if (dragSrcDomain !== null && dragSrcDomain !== targetDomain) {
      // A domain group dragged onto another domain group → reorder
      const srcTabIds = state.filteredTabs
        .filter((t) => getDomain(t.url) === dragSrcDomain)
        .map((t) => t.id);
      const tgtTabIds = state.filteredTabs
        .filter((t) => getDomain(t.url) === targetDomain)
        .map((t) => t.id);
      const order = getOrBuildCustomOrder();
      const refId = insertAfter
        ? [...order].reverse().find((id) => tgtTabIds.includes(id))
        : order.find((id) => tgtTabIds.includes(id));
      if (srcTabIds.length > 0 && refId !== undefined) {
        state.customTabOrder = insertAfter
          ? applyReorderAfter(srcTabIds, refId, order)
          : applyReorder(srcTabIds, refId, order);
        switchToCustomSort();
      }
    }
    dragSrcDomain = null;
    dragSrcId = null;
  });

  const actions = document.createElement('div');
  actions.className = 'group-actions';

  const selectAllDomainBtn = makeTabBtn(checkSquareSvg(), t('group_select_all'));
  selectAllDomainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectAllInDomainGroup(domain);
  });

  const closeDomainBtn = makeTabBtn(closeSvg(), t('group_close_all'), 'close');
  closeDomainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDomainGroup(domain);
  });

  actions.append(selectAllDomainBtn, closeDomainBtn);
  header.append(dot, collapseBtn, label, actions, count);
  return header;
}

function toggleDomainGroupCollapse(domain) {
  if (state.collapsedDomainGroups.has(domain)) {
    state.collapsedDomainGroups.delete(domain);
  } else {
    state.collapsedDomainGroups.add(domain);
  }
  renderTabView();
}

function createNativeGroupHeader(group, tabCount) {
  const header = document.createElement('div');
  header.className = 'native-group-header';
  header.dataset.groupId = group.id;

  // Group headers are draggable to support custom reordering
  header.draggable = true;
  header.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    dragSrcGroupId = group.id;
    dragSrcId = null;
    dragSrcDomain = null;
    dragSrcTabGroupId = -1;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  header.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const el = e.currentTarget;
    el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
    if (dragSrcGroupId !== null) {
      // Group-on-group: show before/after indicator
      const rect = el.getBoundingClientRect();
      el.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-before' : 'drag-over-after');
    } else if (dragSrcId !== null || dragSrcDomain !== null) {
      // Tab or domain group dropped on native group header: show join indicator
      el.classList.add('drag-over');
    }
  });
  header.addEventListener('dragleave', (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
    }
  });
  header.addEventListener('dragend', (e) => {
    e.currentTarget.classList.remove('dragging', 'drag-over', 'drag-over-before', 'drag-over-after');
    tabList.querySelectorAll('.drag-over, .drag-over-before, .drag-over-after')
      .forEach((el) => el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after'));
    dragSrcGroupId = null;
    dragSrcTabGroupId = -1;
  });
  header.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const insertAfter = e.currentTarget.classList.contains('drag-over-after');
    e.currentTarget.classList.remove('drag-over', 'drag-over-before', 'drag-over-after');
    const targetGroupId = parseInt(e.currentTarget.dataset.groupId, 10);

    if (dragSrcGroupId !== null && dragSrcGroupId !== targetGroupId) {
      // Group dragged onto another group header → move src group before/after target group
      const srcTabIds = getGroupTabIds(dragSrcGroupId);
      const tgtTabIds = getGroupTabIds(targetGroupId);
      const order = getOrBuildCustomOrder();
      const refId = insertAfter
        ? [...order].reverse().find((id) => tgtTabIds.includes(id))
        : order.find((id) => tgtTabIds.includes(id));
      if (srcTabIds.length > 0 && refId !== undefined) {
        state.customTabOrder = insertAfter
          ? applyReorderAfter(srcTabIds, refId, order)
          : applyReorder(srcTabIds, refId, order);
        switchToCustomSort();
      }
    } else if (dragSrcId !== null) {
      // Single tab dragged onto a native group header → add to this Chrome group
      if (dragSrcTabGroupId !== targetGroupId) {
        chrome.tabs.group({ tabIds: [dragSrcId], groupId: targetGroupId })
          .then(() => loadTabs())
          .catch(() => showToast(t('toast_op_failed'), 'error'));
      }
    }
    dragSrcId = null;
    dragSrcGroupId = null;
    dragSrcDomain = null;
  });

  const colorDot = document.createElement('div');
  colorDot.className = 'native-group-color';
  colorDot.style.background = GROUP_COLORS[group.color] || '#9E9E9E';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'native-group-collapse';
  collapseBtn.title = group.collapsed ? t('group_expand') : t('group_collapse');
  collapseBtn.innerHTML = group.collapsed ? chevronRightSvg() : chevronDownSvg();
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleGroupCollapse(group);
  });

  const titleSpan = document.createElement('span');
  titleSpan.className = 'native-group-title';
  titleSpan.textContent = group.title || t('unnamed_group');

  const countBadge = document.createElement('span');
  countBadge.className = 'group-count';
  countBadge.textContent = tabCount;

  const actions = document.createElement('div');
  actions.className = 'native-group-actions';

  const editBtn = makeTabBtn(editSvg(), t('group_edit_btn'));
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showGroupModal(group, null);
  });

  const selectAllGroupBtn = makeTabBtn(checkSquareSvg(), t('group_select_all'));
  selectAllGroupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectAllInGroup(group);
  });

  const closeGroupBtn = makeTabBtn(closeSvg(), t('group_close_all'), 'close');
  closeGroupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTabGroup(group);
  });

  const ungroupBtn = makeTabBtn(ungroupSvg(), t('group_ungroup'));
  ungroupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ungroupTabGroup(group);
  });

  actions.append(selectAllGroupBtn, closeGroupBtn, editBtn, ungroupBtn);
  header.append(colorDot, collapseBtn, titleSpan, actions, countBadge);
  return header;
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
  title.textContent = tab.title || t('tab_new_title');
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
    tab.pinned ? t('tab_unpin') : t('tab_pin'),
    tab.pinned ? 'pinned-active' : ''
  );
  pinBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePin(tab); });

  const muteBtn = makeTabBtn(
    tab.mutedInfo?.muted ? unMuteSvg() : muteSvg(),
    tab.mutedInfo?.muted ? t('tab_unmute') : t('tab_mute'),
    tab.mutedInfo?.muted ? 'muted-active' : ''
  );
  muteBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(tab); });

  const closeBtn = makeTabBtn(closeSvg(), t('tab_close'), 'close');
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
  if (state.tabSort === 'custom') syncCustomOrder();
  tabCountBadge.textContent = state.tabs.length;
  renderTabView();
  showToast(t('toast_tab_closed'));
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
  if (state.tabSort === 'custom') syncCustomOrder();
  tabCountBadge.textContent = state.tabs.length;
  renderTabView();
  showToast(t('toast_tabs_closed', ids.length));
}

async function groupSelectedTabs() {
  const ids = [...state.selectedTabs];
  if (ids.length === 0) { showToast(t('toast_select_tabs_first'), 'error'); return; }
  showGroupModal(null, ids);
}

// ─── Native Tab Group Management ─────────────────────────────────────────────
function showGroupModal(group, tabIds) {
  state.groupModalTarget = { group, tabIds };
  $('groupNameInput').value = group?.title || '';
  state.selectedGroupColor = group?.color || 'blue';
  document.querySelectorAll('.color-swatch').forEach((s) =>
    s.classList.toggle('active', s.dataset.color === state.selectedGroupColor)
  );
  $('groupModalTitle').textContent = group ? t('group_modal_edit') : t('group_modal_create');
  $('groupModal').classList.remove('hidden');
  $('groupNameInput').focus();
}

function hideGroupModal() {
  $('groupModal').classList.add('hidden');
  state.groupModalTarget = null;
}

async function confirmGroupModal() {
  const { group, tabIds } = state.groupModalTarget || {};
  const title = $('groupNameInput').value.trim();
  const color = state.selectedGroupColor;
  try {
    if (group) {
      // Edit existing group
      await chrome.tabGroups.update(group.id, { title, color });
      showToast(t('toast_group_updated'), 'success');
    } else if (tabIds && tabIds.length >= 1) {
      // Create new group from selected tabs
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title, color });
      state.selectedTabs.clear();
      showToast(t('toast_group_created'), 'success');
    }
    hideGroupModal();
    await loadTabs();
  } catch {
    showToast(t('toast_op_failed'), 'error');
  }
}

async function toggleGroupCollapse(group) {
  try {
    await chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
    await loadTabs();
  } catch {
    showToast(t('toast_op_failed'), 'error');
  }
}

async function ungroupTabGroup(group) {
  try {
    const groupTabIds = state.tabs
      .filter((t) => t.groupId === group.id)
      .map((t) => t.id);
    if (groupTabIds.length > 0) {
      await chrome.tabs.ungroup(groupTabIds);
    }
    await loadTabs();
    showToast(t('toast_ungrouped'));
  } catch {
    showToast(t('toast_op_failed'), 'error');
  }
}

function selectAllInGroup(group) {
  const groupTabs = state.tabs.filter((t) => t.groupId === group.id);
  const allSelected = groupTabs.every((t) => state.selectedTabs.has(t.id));
  if (allSelected) {
    groupTabs.forEach((t) => state.selectedTabs.delete(t.id));
  } else {
    groupTabs.forEach((t) => state.selectedTabs.add(t.id));
  }
  renderTabView();
}

async function closeTabGroup(group) {
  const groupTabIds = state.tabs
    .filter((t) => t.groupId === group.id)
    .map((t) => t.id);
  if (groupTabIds.length === 0) return;
  try {
    await chrome.tabs.remove(groupTabIds);
    state.tabs = state.tabs.filter((t) => t.groupId !== group.id);
    groupTabIds.forEach((id) => state.selectedTabs.delete(id));
    tabCountBadge.textContent = state.tabs.length;
    renderTabView();
    showToast(t('toast_group_closed', groupTabIds.length), 'success');
  } catch {
    showToast(t('toast_op_failed'), 'error');
  }
}

function selectAllInDomainGroup(domain) {
  const domainTabs = state.filteredTabs.filter((t) => getDomain(t.url) === domain);
  const allSelected = domainTabs.every((t) => state.selectedTabs.has(t.id));
  if (allSelected) {
    domainTabs.forEach((t) => state.selectedTabs.delete(t.id));
  } else {
    domainTabs.forEach((t) => state.selectedTabs.add(t.id));
  }
  renderTabView();
}

async function closeDomainGroup(domain) {
  const domainTabIds = state.filteredTabs
    .filter((t) => getDomain(t.url) === domain)
    .map((t) => t.id);
  if (domainTabIds.length === 0) return;
  try {
    await chrome.tabs.remove(domainTabIds);
    const domainTabIdSet = new Set(domainTabIds);
    state.tabs = state.tabs.filter((t) => !domainTabIdSet.has(t.id));
    domainTabIds.forEach((id) => state.selectedTabs.delete(id));
    if (state.tabSort === 'custom') syncCustomOrder();
    tabCountBadge.textContent = state.tabs.length;
    renderTabView();
    showToast(t('toast_group_closed', domainTabIds.length), 'success');
  } catch {
    showToast(t('toast_op_failed'), 'error');
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
  showToast(t('toast_session_saved', tabs.length), 'success');
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
  persistPreferences();
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
  persistPreferences();
  renderTabView();
}

// ─── Drag & Drop Reorder ─────────────────────────────────────────────────────
let dragSrcId = null;         // tab ID being dragged
let dragSrcGroupId = null;    // native Chrome group ID being dragged (from group header)
let dragSrcDomain = null;     // domain string being dragged (from domain group header)
let dragSrcTabGroupId = -1;   // Chrome groupId the dragged tab belongs to (-1 if ungrouped)

function onDragStart(e) {
  dragSrcId = parseInt(e.currentTarget.dataset.tabId, 10);
  dragSrcGroupId = null;
  dragSrcDomain = null;
  const tab = state.tabs.find((t) => t.id === dragSrcId);
  dragSrcTabGroupId = tab?.groupId ?? -1;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.classList.remove('drag-over-before', 'drag-over-after');
  el.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-before' : 'drag-over-after');
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over-before', 'drag-over-after');
  }
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging', 'drag-over-before', 'drag-over-after');
  tabList.querySelectorAll('.drag-over, .drag-over-before, .drag-over-after')
    .forEach((el) => el.classList.remove('drag-over', 'drag-over-before', 'drag-over-after'));
  dragSrcId = null;
  dragSrcGroupId = null;
  dragSrcDomain = null;
  dragSrcTabGroupId = -1;
}

function onDrop(e) {
  e.preventDefault();
  const insertAfter = e.currentTarget.classList.contains('drag-over-after');
  e.currentTarget.classList.remove('drag-over-before', 'drag-over-after');
  const targetId = parseInt(e.currentTarget.dataset.tabId, 10);
  if (!targetId) return;

  if (dragSrcGroupId !== null) {
    // A native group is being dragged – move all its tabs before/after this tab
    const groupTabIds = getGroupTabIds(dragSrcGroupId);
    if (groupTabIds.length > 0) {
      const order = getOrBuildCustomOrder();
      state.customTabOrder = insertAfter
        ? applyReorderAfter(groupTabIds, targetId, order)
        : applyReorder(groupTabIds, targetId, order);
      switchToCustomSort();
    }
    return;
  }

  if (dragSrcDomain !== null) {
    // A domain group is being dragged – move all its tabs before/after this tab
    const srcTabIds = state.filteredTabs
      .filter((t) => getDomain(t.url) === dragSrcDomain)
      .map((t) => t.id);
    if (srcTabIds.length > 0 && !srcTabIds.includes(targetId)) {
      const order = getOrBuildCustomOrder();
      state.customTabOrder = insertAfter
        ? applyReorderAfter(srcTabIds, targetId, order)
        : applyReorder(srcTabIds, targetId, order);
      switchToCustomSort();
    }
    return;
  }

  if (!dragSrcId || dragSrcId === targetId) return;

  // If the dragged tab is in a native group and the target is ungrouped → ungroup the tab
  if (dragSrcTabGroupId !== -1) {
    const targetTab = state.tabs.find((t) => t.id === targetId);
    if (targetTab && targetTab.groupId === -1) {
      chrome.tabs.ungroup([dragSrcId])
        .then(() => loadTabs())
        .catch(() => showToast(t('toast_op_failed'), 'error'));
      return;
    }
  }

  // Panel-only reorder
  const order = getOrBuildCustomOrder();
  state.customTabOrder = insertAfter
    ? applyReorderAfter([dragSrcId], targetId, order)
    : applyReorder([dragSrcId], targetId, order);
  switchToCustomSort();
}

// ─── Custom Sort Helpers ─────────────────────────────────────────────────────

/** Build the current panel display order as a flat list of all tab IDs. */
function getOrBuildCustomOrder() {
  if (state.customTabOrder.length > 0) {
    return [...state.customTabOrder];
  }
  // Seed from the current sorted display order, then append any undisplayed tabs
  const displayed = sortTabs(filterTabs(state.tabs)).map((t) => t.id);
  const displayedSet = new Set(displayed);
  state.tabs.forEach((t) => { if (!displayedSet.has(t.id)) displayed.push(t.id); });
  return displayed;
}

/** Remove deleted tabs from customTabOrder; append newly-added tabs at the end. */
function syncCustomOrder() {
  const allIds = new Set(state.tabs.map((t) => t.id));
  const kept = state.customTabOrder.filter((id) => allIds.has(id));
  const keptSet = new Set(kept);
  state.tabs.forEach((t) => { if (!keptSet.has(t.id)) kept.push(t.id); });
  state.customTabOrder = kept;
}

/** Move `idsToMove` to just before `beforeId` in `order`. Returns a new array. */
function applyReorder(idsToMove, beforeId, order) {
  const moveSet = new Set(idsToMove);
  const rest = order.filter((id) => !moveSet.has(id));
  const pos = rest.indexOf(beforeId);
  if (pos !== -1) {
    rest.splice(pos, 0, ...idsToMove);
  } else {
    rest.push(...idsToMove);
  }
  return rest;
}

/** Move `idsToMove` to just after `afterId` in `order`. Returns a new array. */
function applyReorderAfter(idsToMove, afterId, order) {
  const moveSet = new Set(idsToMove);
  const rest = order.filter((id) => !moveSet.has(id));
  const pos = rest.indexOf(afterId);
  if (pos !== -1) {
    rest.splice(pos + 1, 0, ...idsToMove);
  } else {
    rest.push(...idsToMove);
  }
  return rest;
}

/** Get tab IDs belonging to a native group, in their current index order. */
function getGroupTabIds(groupId) {
  return state.tabs
    .filter((t) => t.groupId === groupId)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((t) => t.id);
}

/** Switch the sort mode to 'custom' and show the custom option in the dropdown. */
function switchToCustomSort() {
  state.tabSort = 'custom';
  const sel = $('tabSort');
  const customOpt = sel ? sel.querySelector('option[value="custom"]') : null;
  if (customOpt) {
    customOpt.hidden = false;
    sel.value = 'custom';
  }
  persistPreferences();
  renderTabView();
  showToast(t('toast_custom_sort'));
}

// ─── Bookmark Management ─────────────────────────────────────────────────────
async function loadBookmarks(nodeId) {
  // If in tree mode, always load full tree
  if (state.bookmarkViewMode === 'tree') {
    await loadBookmarksTree();
    return;
  }
  // Flat (folder) mode
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
  bookmarkList.innerHTML = '';
  const frag = document.createDocumentFragment();

  // Show recent bookmarks at root level in flat mode
  const isRoot = state.bookmarkPath.length === 1 && !state.bookmarkSearchResults;
  if (isRoot && state.settings.showRecentBookmarks && state.recentBookmarks.length > 0) {
    frag.appendChild(createRecentBookmarksSection());
  }

  if (nodes.length === 0) {
    frag.appendChild(emptyState(t('empty_folder')));
  } else {
    nodes.forEach((node) => frag.appendChild(createBookmarkItem(node)));
  }
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
    try {
      // Use Chrome's built-in favicon cache (no external requests needed)
      img.src = `chrome://favicon/size/16@1x/${new URL(node.url).origin}`;
    } catch {
      img.style.display = 'none';
    }
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
  titleEl.textContent = node.title || getDomain(node.url) || t('tab_new_title');
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
    editBtn.title = t('ctx_edit');
    editBtn.innerHTML = editSvg();
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(node); });
    actions.appendChild(editBtn);
  } else {
    // Folder: add "Open all" button
    const openAllBtn = document.createElement('button');
    openAllBtn.className = 'bm-btn';
    openAllBtn.title = t('ctx_open_all');
    openAllBtn.innerHTML = openAllSvg();
    openAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Load children if not available
      const children = await chrome.bookmarks.getChildren(node.id);
      openAllInFolder({ ...node, children });
    });
    actions.appendChild(openAllBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'bm-btn delete';
  delBtn.title = t('ctx_delete');
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
      recordBookmarkAccess(node);
      chrome.tabs.create({ url: node.url });
    } else {
      navigateInto(node);
    }
  });

  return item;
}

function navigateInto(node) {
  state.bookmarkPath.push({ id: node.id, title: node.title || t('bookmark_form_folder_label') });
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
  if (!url) { showToast(t('toast_url_required'), 'error'); return; }
  try {
    await chrome.bookmarks.create({ title: title || url, url, parentId });
    hideAddBookmarkForm();
    await loadBookmarks();
    showToast(t('toast_bookmark_saved'), 'success');
  } catch (e) {
    showToast(t('toast_save_failed', e.message), 'error');
  }
}

async function deleteBookmark(node) {
  const confirmMsg = node.url
    ? t('confirm_delete_bookmark', node.title)
    : t('confirm_delete_folder', node.title);
  if (!confirm(confirmMsg)) return;
  try {
    if (node.url) {
      await chrome.bookmarks.remove(node.id);
    } else {
      await chrome.bookmarks.removeTree(node.id);
    }
    await loadBookmarks();
    showToast(t('toast_deleted'), 'success');
  } catch (e) {
    showToast(t('toast_delete_failed', e.message), 'error');
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
    showToast(t('toast_bookmark_updated'), 'success');
  } catch (e) {
    showToast(t('toast_save_failed', e.message), 'error');
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

// ─── Bookmark Tree View ──────────────────────────────────────────────────────
async function loadBookmarksTree() {
  showBkSkeleton(true);
  try {
    const fullTree = await chrome.bookmarks.getTree();
    state.bookmarkFullTree = fullTree;
    renderBookmarksTree(fullTree[0].children || []);
    // Hide breadcrumb in tree mode
    breadcrumb.innerHTML = `<span class="breadcrumb-item active">${t('all_bookmarks_tree')}</span>`;
    await loadBookmarkCount();
  } catch (e) {
    showToast(t('toast_op_failed'), 'error');
  }
  showBkSkeleton(false);
}

function renderBookmarksTree(nodes) {
  bookmarkList.innerHTML = '';
  const frag = document.createDocumentFragment();

  // Show recent bookmarks section at top
  if (state.settings.showRecentBookmarks && state.recentBookmarks.length > 0) {
    frag.appendChild(createRecentBookmarksSection());
  }

  buildTreeNodes(nodes, frag, 0);
  bookmarkList.appendChild(frag);
}

function buildTreeNodes(nodes, container, level) {
  nodes.forEach((node) => {
    const item = createTreeItem(node, level);
    container.appendChild(item);
    if (!node.url && node.children && node.children.length > 0) {
      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children';
      childWrap.dataset.folderId = node.id;
      if (!state.bookmarkTreeExpanded.has(node.id)) {
        childWrap.classList.add('collapsed');
      }
      buildTreeNodes(node.children, childWrap, level + 1);
      container.appendChild(childWrap);
    }
  });
}

function createTreeItem(node, level) {
  const item = document.createElement('div');
  item.className = 'bookmark-item tree-item';
  item.dataset.bmId = node.id;
  item.style.paddingLeft = (8 + level * 14) + 'px';

  if (!node.url) {
    // Folder: show expand/collapse toggle
    const isExpanded = state.bookmarkTreeExpanded.has(node.id);
    const expandBtn = document.createElement('button');
    expandBtn.className = 'tree-expand-btn';
    expandBtn.innerHTML = isExpanded ? chevronDownSvg() : chevronRightSvg();
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTreeFolder(node.id);
    });
    item.appendChild(expandBtn);
  } else {
    const spacer = document.createElement('div');
    spacer.className = 'tree-spacer';
    item.appendChild(spacer);
  }

  // Icon
  const iconWrap = document.createElement('div');
  iconWrap.className = 'bookmark-icon';
  if (node.url) {
    const img = document.createElement('img');
    try { img.src = `chrome://favicon/size/16@1x/${new URL(node.url).origin}`; } catch { img.style.display = 'none'; }
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
  titleEl.textContent = node.title || getDomain(node.url) || t('tab_new_title');
  info.appendChild(titleEl);

  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';

  if (node.url) {
    const editBtn = document.createElement('button');
    editBtn.className = 'bm-btn';
    editBtn.title = t('ctx_edit');
    editBtn.innerHTML = editSvg();
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(node); });
    actions.appendChild(editBtn);
  } else if (node.children && node.children.length > 0) {
    const openAllBtn = document.createElement('button');
    openAllBtn.className = 'bm-btn';
    openAllBtn.title = t('ctx_open_all');
    openAllBtn.innerHTML = openAllSvg();
    openAllBtn.addEventListener('click', (e) => { e.stopPropagation(); openAllInFolder(node); });
    actions.appendChild(openAllBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'bm-btn delete';
  delBtn.title = t('ctx_delete');
  delBtn.innerHTML = trashSvg();
  delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteBookmark(node); });
  actions.appendChild(delBtn);

  item.append(iconWrap, info, actions);

  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    state.contextTarget = { type: 'bookmark', node };
    showContextMenu(e.clientX, e.clientY, !!node.url);
  });

  item.addEventListener('click', () => {
    if (node.url) {
      recordBookmarkAccess(node);
      chrome.tabs.create({ url: node.url });
    } else {
      toggleTreeFolder(node.id);
    }
  });

  return item;
}

function toggleTreeFolder(folderId) {
  if (state.bookmarkTreeExpanded.has(folderId)) {
    state.bookmarkTreeExpanded.delete(folderId);
  } else {
    state.bookmarkTreeExpanded.add(folderId);
  }
  // Toggle visibility of children without full re-render
  const childWrap = bookmarkList.querySelector(`.tree-children[data-folder-id="${folderId}"]`);
  if (childWrap) {
    childWrap.classList.toggle('collapsed', !state.bookmarkTreeExpanded.has(folderId));
    // Update expand button icon
    const item = bookmarkList.querySelector(`.tree-item[data-bm-id="${folderId}"]`);
    if (item) {
      const btn = item.querySelector('.tree-expand-btn');
      if (btn) btn.innerHTML = state.bookmarkTreeExpanded.has(folderId) ? chevronDownSvg() : chevronRightSvg();
    }
  } else if (state.bookmarkFullTree) {
    // Children container not yet rendered – re-render tree
    renderBookmarksTree(state.bookmarkFullTree[0].children || []);
  }
}

// Toggle bookmark view mode between flat and tree
function toggleBookmarkViewMode() {
  state.bookmarkViewMode = state.bookmarkViewMode === 'flat' ? 'tree' : 'flat';
  updateBookmarkViewButton();
  // Reset path when switching to tree mode
  if (state.bookmarkViewMode === 'tree') {
    state.bookmarkPath = [{ id: '0', title: t('all_bookmarks') }];
  }
  loadBookmarks();
}

function updateBookmarkViewButton() {
  const btn = $('btnBookmarkView');
  if (state.bookmarkViewMode === 'tree') {
    btn.classList.add('active');
    btn.title = t('btn_bookmark_view_tree');
    $('bmViewIcon').innerHTML = `<path d="M3 3h4v4H3zM3 10h4v4H3zM3 17h4v4H3z"/><line x1="10" y1="5" x2="21" y2="5"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="19" x2="21" y2="19"/>`;
  } else {
    btn.classList.remove('active');
    btn.title = t('btn_bookmark_view_flat');
    $('bmViewIcon').innerHTML = `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>`;
  }
}

// Open all bookmarks in a folder
async function openAllInFolder(node) {
  if (!node.children) return;
  const urls = [];
  const collect = (nodes) => nodes.forEach((n) => { if (n.url) urls.push(n.url); if (n.children) collect(n.children); });
  collect(node.children);
  if (urls.length === 0) { showToast(t('empty_no_bookmarks'), 'error'); return; }
  if (urls.length > OPEN_ALL_CONFIRM_THRESHOLD) {
    if (!confirm(t('confirm_open_tabs', urls.length))) return;
  }
  urls.forEach((url) => chrome.tabs.create({ url, active: false }));
  showToast(t('toast_opened_tabs', urls.length), 'success');
}

// ─── Recent Bookmarks ────────────────────────────────────────────────────────
async function recordBookmarkAccess(node) {
  if (!node.url) return;
  const entry = { id: node.id, title: node.title || node.url, url: node.url };
  state.recentBookmarks = state.recentBookmarks.filter((b) => b.id !== node.id);
  state.recentBookmarks.unshift(entry);
  const max = state.settings.recentBookmarksCount || 5;
  if (state.recentBookmarks.length > max) state.recentBookmarks.length = max;
  await chrome.storage.local.set({ recentBookmarks: state.recentBookmarks });
}

function createRecentBookmarksSection() {
  const section = document.createElement('div');
  section.className = 'recent-section';

  const header = document.createElement('div');
  header.className = 'recent-header';
  header.innerHTML = `<span class="recent-label">${t('recent_label')}</span>`;
  section.appendChild(header);

  state.recentBookmarks.forEach((bm) => {
    const item = document.createElement('div');
    item.className = 'bookmark-item recent-item';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'bookmark-icon';
    const img = document.createElement('img');
    try { img.src = `chrome://favicon/size/16@1x/${new URL(bm.url).origin}`; } catch { img.style.display = 'none'; }
    img.alt = '';
    img.onerror = () => (img.style.display = 'none');
    iconWrap.appendChild(img);

    const info = document.createElement('div');
    info.className = 'bookmark-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'bookmark-title';
    titleEl.textContent = bm.title;
    info.appendChild(titleEl);

    item.append(iconWrap, info);
    item.addEventListener('click', () => {
      recordBookmarkAccess(bm);
      chrome.tabs.create({ url: bm.url });
    });
    section.appendChild(item);
  });

  return section;
}

// ─── Settings ────────────────────────────────────────────────────────────────
async function loadSettings() {
  const stored = await chrome.storage.local.get([
    'settings', 'lastView', 'lastTabFilter', 'lastTabSort',
    'lastGroupByDomain', 'recentBookmarks', 'lastCustomTabOrder',
  ]);
  state.settings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  state.recentBookmarks = stored.recentBookmarks || [];

  if (state.settings.rememberLastView && stored.lastView) {
    state.view = stored.lastView;
  }
  if (state.settings.rememberFilters) {
    if (stored.lastTabFilter) state.tabFilter = stored.lastTabFilter;
    if (stored.lastTabSort) state.tabSort = stored.lastTabSort;
    if (stored.lastGroupByDomain !== undefined) state.groupByDomain = !!stored.lastGroupByDomain;
    if (stored.lastCustomTabOrder) state.customTabOrder = stored.lastCustomTabOrder;
  }
  state.bookmarkViewMode = state.settings.bookmarkViewMode || 'flat';
}

function applyPreferencesToUI() {
  // Apply saved tab filter
  document.querySelectorAll('.filter-btn').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.filter === state.tabFilter)
  );
  // Apply saved sort
  const sortSel = $('tabSort');
  if (sortSel) {
    if (state.tabSort === 'custom') {
      // Show the custom option before setting the value
      const customOpt = sortSel.querySelector('option[value="custom"]');
      if (customOpt) customOpt.hidden = false;
    }
    sortSel.value = state.tabSort;
  }
  // Apply group by domain
  $('btnGroupBy').classList.toggle('active', state.groupByDomain);
  // Apply bookmark view mode icon
  updateBookmarkViewButton();
  // Apply view switch UI
  document.querySelectorAll('.nav-tab').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.view === state.view)
  );
  $('viewTabs').classList.toggle('hidden', state.view !== 'tabs');
  $('viewBookmarks').classList.toggle('hidden', state.view !== 'bookmarks');
}

async function persistPreferences() {
  if (!state.settings.rememberLastView && !state.settings.rememberFilters) return;
  const data = {};
  if (state.settings.rememberLastView) data.lastView = state.view;
  if (state.settings.rememberFilters) {
    data.lastTabFilter = state.tabFilter;
    data.lastTabSort = state.tabSort;
    data.lastGroupByDomain = state.groupByDomain;
    data.lastCustomTabOrder = state.customTabOrder;
  }
  await chrome.storage.local.set(data);
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
}

// ─── React to settings changes (from separate settings page) ─────────────────
function onSettingsChanged() {
  const newViewMode = state.settings.bookmarkViewMode;
  if (newViewMode !== state.bookmarkViewMode) {
    state.bookmarkViewMode = newViewMode;
    updateBookmarkViewButton();
    if (state.view === 'bookmarks') loadBookmarks();
  }
  // Update session storage with latest enableTabNavShortcut flag
  chrome.storage.session.set({ enableTabNavShortcut: state.settings.enableTabNavShortcut }).catch(() => {});
}

// ─── Context Menu ────────────────────────────────────────────────────────────
function showContextMenu(x, y, isBookmarkUrl = false) {
  // isBookmarkUrl: true = bookmark link; false = folder or tab
  $('ctxOpen').style.display = isBookmarkUrl ? '' : 'none';
  $('ctxOpenAll').style.display = (!isBookmarkUrl && state.contextTarget?.type === 'bookmark') ? '' : 'none';
  $('ctxEdit').style.display = isBookmarkUrl ? '' : 'none';
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

async function ctxOpenAll(e) {
  e.stopPropagation();
  hideContextMenu();
  const t = state.contextTarget;
  if (!t || t.type !== 'bookmark' || t.node.url) return;
  const children = await chrome.bookmarks.getChildren(t.node.id);
  openAllInFolder({ ...t.node, children });
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
    case 'TAB_GROUP_CREATED':
    case 'TAB_GROUP_UPDATED':
    case 'TAB_GROUP_REMOVED':
    case 'TAB_GROUP_MOVED':
      if (state.view === 'tabs') loadTabs();
      break;
    case 'BOOKMARK_ADDED':
      loadBookmarkCount();
      if (state.view === 'bookmarks') loadBookmarks();
      break;
    case 'DUPLICATES_CLOSED':
      if (state.view === 'tabs') loadTabs();
      showToast(
        message.count === 1
          ? t('toast_dup_closed_one', message.count)
          : t('toast_dup_closed', message.count),
        'success'
      );
      break;
    case 'SESSION_SAVED':
      showToast(t('toast_session_saved', message.count), 'success');
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
const checkSquareSvg = () => svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/>');
const pinSvg    = () => svg('<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>');
const pinFilledSvg = () => svg('<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>', 'fill="currentColor"');
const muteSvg   = () => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>');
const unMuteSvg = () => svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>');
const editSvg   = () => svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');
const trashSvg  = () => svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>');
const chevronRightSvg = () => svg('<polyline points="9 18 15 12 9 6"/>');
const chevronDownSvg  = () => svg('<polyline points="6 9 12 15 18 9"/>');
const openAllSvg = () => svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>');
const ungroupSvg = () => svg('<rect x="2" y="3" width="8" height="7" rx="1"/><rect x="14" y="14" width="8" height="7" rx="1"/><line x1="10" y1="6.5" x2="12" y2="6.5"/><line x1="12" y1="6.5" x2="12" y2="17.5"/><line x1="12" y1="17.5" x2="14" y2="17.5"/>',  'stroke-linecap="round"');
// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
