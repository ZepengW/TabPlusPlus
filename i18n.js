// i18n.js – Shared i18n module for TabPlusPlus
// Supports manual language override stored in chrome.storage.local

'use strict';

const TabI18n = (() => {
  let _messages = null;

  // Load language preference from storage and fetch messages if needed
  async function init() {
    const { settings } = await chrome.storage.local.get('settings');
    const lang = settings?.language || 'auto';

    if (lang !== 'auto') {
      try {
        const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
        const resp = await fetch(url);
        if (resp.ok) {
          _messages = await resp.json();
        } else {
          _messages = null;
        }
      } catch (e) {
        _messages = null;
      }
    } else {
      _messages = null;
    }
  }

  // Look up a message key, substituting {1}, {2}, … placeholders
  function t(key, ...subs) {
    let msg;
    if (_messages && _messages[key]) {
      msg = _messages[key].message;
    } else {
      msg = chrome.i18n.getMessage(key);
    }
    if (!msg) return key;
    return subs.reduce((s, v, i) => s.replaceAll('{' + (i + 1) + '}', String(v)), msg);
  }

  // Apply translations to all data-i18n / data-i18n-placeholder / data-i18n-title elements
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

  return { init, t, applyI18n };
})();
