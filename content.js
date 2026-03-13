// content.js – Injects the TabPlusPlus floating overlay into the current page
// This replaces the Chrome side-panel approach: the panel now floats over the
// browser content and takes zero space when hidden.

(function () {
  'use strict';

  // Guard against double-injection
  if (document.getElementById('tabplusplus-overlay-container')) return;

  const PANEL_WIDTH = 360;
  const MAX_Z_INDEX = 2147483647; // Max safe CSS z-index value
  let isVisible = false;

  // ─── Overlay container ──────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'tabplusplus-overlay-container';
  Object.assign(container.style, {
    position:     'fixed',
    top:          '5vh',
    right:        '16px',
    width:        PANEL_WIDTH + 'px',
    height:       '90vh',
    maxHeight:    '90vh',
    zIndex:       String(MAX_Z_INDEX),
    borderRadius: '14px',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)',
    overflow:     'hidden',
    transition:   'opacity 0.22s ease, transform 0.22s ease',
    opacity:      '0',
    transform:    'translateX(24px)',
    pointerEvents:'none',
  });

  // ─── iframe ─────────────────────────────────────────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.id  = 'tabplusplus-iframe';
  iframe.src = chrome.runtime.getURL('sidepanel.html') + '?overlay=1';
  Object.assign(iframe.style, {
    width:        '100%',
    height:       '100%',
    border:       'none',
    display:      'block',
    borderRadius: '14px',
  });
  container.appendChild(iframe);

  // ─── Trigger tab (T+ strip on the right edge, shown when panel is hidden) ──
  const triggerTab = document.createElement('div');
  triggerTab.id = 'tabplusplus-trigger-tab';
  triggerTab.title = 'Open TabPlusPlus';
  triggerTab.textContent = 'T+';
  Object.assign(triggerTab.style, {
    position:     'fixed',
    top:          '50%',
    right:        '0',
    transform:    'translateY(-50%)',
    width:        '22px',
    height:       '64px',
    background:   'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '8px 0 0 8px',
    zIndex:       String(MAX_Z_INDEX - 1),
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    writingMode:  'vertical-lr',
    fontSize:     '9px',
    fontWeight:   '800',
    color:        'rgba(255,255,255,.9)',
    letterSpacing:'1.5px',
    textTransform:'uppercase',
    userSelect:   'none',
    opacity:      '0',
    pointerEvents:'none',
    transition:   'opacity 0.22s ease',
    boxShadow:    '-2px 0 8px rgba(0,0,0,.18)',
    fontFamily:   '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });

  document.documentElement.appendChild(container);
  document.documentElement.appendChild(triggerTab);

  // ─── Show / Hide helpers ────────────────────────────────────────────────────
  function show() {
    isVisible = true;
    container.style.opacity      = '1';
    container.style.transform    = 'translateX(0)';
    container.style.pointerEvents= 'all';
    triggerTab.style.opacity      = '0';
    triggerTab.style.pointerEvents= 'none';
  }

  function hide() {
    isVisible = false;
    container.style.opacity      = '0';
    container.style.transform    = 'translateX(24px)';
    container.style.pointerEvents= 'none';
    triggerTab.style.opacity      = '1';
    triggerTab.style.pointerEvents= 'auto';
  }

  function toggle() {
    if (isVisible) hide();
    else show();
  }

  // Trigger tab click expands the panel
  triggerTab.addEventListener('click', show);

  // ─── Messages from background script ───────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TOGGLE_OVERLAY') {
      toggle();
      sendResponse({ visible: isVisible });
      return true;
    }
    if (message.type === 'SHOW_OVERLAY') {
      show();
      sendResponse({ visible: true });
      return true;
    }
    if (message.type === 'HIDE_OVERLAY') {
      hide();
      sendResponse({ visible: false });
      return true;
    }
  });

  // ─── Messages from the panel iframe ────────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (event.data === 'TABPLUSPLUS_CLOSE') hide();
    if (event.data === 'TABPLUSPLUS_HIDE')  hide();
  });
})();
