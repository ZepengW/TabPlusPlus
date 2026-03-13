// settings.js – Standalone settings page for TabPlusPlus

'use strict';

const DEFAULT_SETTINGS = {
  rememberLastView: true,
  rememberFilters: true,
  autoHide: false,
  autoHideDelay: 3,
  bookmarkViewMode: 'flat',
  showRecentBookmarks: true,
  recentBookmarksCount: 5,
};

const $ = (id) => document.getElementById(id);

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
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
  $('settingRememberView').checked   = s.rememberLastView;
  $('settingRememberFilters').checked = s.rememberFilters;
  $('settingAutoHide').checked       = s.autoHide;
  $('settingAutoHideDelay').value    = s.autoHideDelay;
  $('settingShowRecent').checked     = s.showRecentBookmarks;
  $('settingRecentCount').value      = s.recentBookmarksCount;

  const bmRadio = document.querySelector(`input[name="bookmarkViewMode"][value="${s.bookmarkViewMode}"]`);
  if (bmRadio) bmRadio.checked = true;

  $('autoHideDelayRow').classList.toggle('hidden', !s.autoHide);
  $('recentCountRow').classList.toggle('hidden', !s.showRecentBookmarks);
}

// ─── Save ────────────────────────────────────────────────────────────────────
async function saveSettings() {
  const settings = readFromUI();
  await chrome.storage.local.set({ settings });
  showToast('Settings saved', 'success');
}

function readFromUI() {
  return {
    rememberLastView:    $('settingRememberView').checked,
    rememberFilters:     $('settingRememberFilters').checked,
    autoHide:            $('settingAutoHide').checked,
    autoHideDelay:       parseInt($('settingAutoHideDelay').value, 10) || 3,
    showRecentBookmarks: $('settingShowRecent').checked,
    recentBookmarksCount: parseInt($('settingRecentCount').value, 10) || 5,
    bookmarkViewMode:    document.querySelector('input[name="bookmarkViewMode"]:checked')?.value || 'flat',
  };
}

// ─── Reset ───────────────────────────────────────────────────────────────────
async function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  await chrome.storage.local.set({ settings: { ...DEFAULT_SETTINGS } });
  applyToUI({ ...DEFAULT_SETTINGS });
  showToast('Settings reset to defaults', 'success');
}

// ─── Listeners ───────────────────────────────────────────────────────────────
function attachListeners() {
  $('btnSave').addEventListener('click', saveSettings);
  $('btnReset').addEventListener('click', resetSettings);

  $('settingAutoHide').addEventListener('change', (e) => {
    $('autoHideDelayRow').classList.toggle('hidden', !e.target.checked);
  });
  $('settingShowRecent').addEventListener('change', (e) => {
    $('recentCountRow').classList.toggle('hidden', !e.target.checked);
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
