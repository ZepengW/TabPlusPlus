// settings.js – Standalone settings page for TabPlusPlus

'use strict';

// ─── i18n helper (delegates to shared TabI18n module) ────────────────────────
function t(key, ...subs) { return TabI18n.t(key, ...subs); }
function applyI18n() { TabI18n.applyI18n(); }

const DEFAULT_SETTINGS = {
  rememberLastView: true,
  rememberFilters: true,
  bookmarkViewMode: 'flat',
  showRecentBookmarks: true,
  recentBookmarksCount: 5,
  enableTabNavShortcut: true,
  overlayPosition: 'right', // 'right' | 'left'
  language: 'auto',         // 'auto' | 'en' | 'zh_CN'
};

const $ = (id) => document.getElementById(id);

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  await TabI18n.init();
  applyI18n();
  await loadSettings();
  attachListeners();
}

// ─── Load ────────────────────────────────────────────────────────────────────
async function loadSettings() {
  const stored = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  applyToUI(s);
}

function applyToUI(s) {
  $('settingRememberView').checked    = s.rememberLastView;
  $('settingRememberFilters').checked = s.rememberFilters;
  $('settingShowRecent').checked      = s.showRecentBookmarks;
  $('settingRecentCount').value       = s.recentBookmarksCount;
  $('settingTabNavShortcut').checked  = s.enableTabNavShortcut;
  $('settingLanguage').value          = s.language || 'auto';

  const bmRadio = document.querySelector(`input[name="bookmarkViewMode"][value="${s.bookmarkViewMode}"]`);
  if (bmRadio) bmRadio.checked = true;

  $('recentCountRow').classList.toggle('hidden', !s.showRecentBookmarks);
}

// ─── Save ────────────────────────────────────────────────────────────────────
async function saveSettings() {
  const stored = await chrome.storage.local.get('settings');
  const prevLang = stored.settings?.language || 'auto';

  const settings = readFromUI();
  await chrome.storage.local.set({ settings });

  if (settings.language !== prevLang) {
    showToast(t('settings_language_changed'), 'success');
    setTimeout(() => location.reload(), 800);
  } else {
    showToast(t('settings_saved'), 'success');
  }
}

function readFromUI() {
  return {
    rememberLastView:    $('settingRememberView').checked,
    rememberFilters:     $('settingRememberFilters').checked,
    showRecentBookmarks: $('settingShowRecent').checked,
    recentBookmarksCount: parseInt($('settingRecentCount').value, 10) || 5,
    bookmarkViewMode:    document.querySelector('input[name="bookmarkViewMode"]:checked')?.value || 'flat',
    enableTabNavShortcut: $('settingTabNavShortcut').checked,
    language:            $('settingLanguage').value || 'auto',
  };
}

// ─── Reset ───────────────────────────────────────────────────────────────────
async function resetSettings() {
  if (!confirm(t('settings_reset_confirm'))) return;
  const stored = await chrome.storage.local.get('settings');
  const prevLang = stored.settings?.language || 'auto';

  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS } });
  applyToUI({ ...DEFAULT_SETTINGS });
  showToast(t('settings_reset_done'), 'success');

  if (DEFAULT_SETTINGS.language !== prevLang) {
    setTimeout(() => location.reload(), 800);
  }
}

// ─── Listeners ───────────────────────────────────────────────────────────────
function attachListeners() {
  $('btnSave').addEventListener('click', saveSettings);
  $('btnReset').addEventListener('click', resetSettings);

  $('settingShowRecent').addEventListener('change', (e) => {
    $('recentCountRow').classList.toggle('hidden', !e.target.checked);
  });

  // Open chrome://extensions/shortcuts when user clicks the links
  const openShortcutsPage = (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };
  $('shortcutSettingsLink').addEventListener('click', openShortcutsPage);
  $('shortcutSettingsLink2').addEventListener('click', openShortcutsPage);

  // Open browser appearance settings for sidebar position configuration
  $('browserSidebarSettingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://settings/appearance' });
  });
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(message, type = '') {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `sp-toast${type ? ' ' + type : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 2200);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
