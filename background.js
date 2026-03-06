// ── Default gesture mappings ──
const DEFAULT_GESTURES = {
  'L': { action: 'back', label: '戻る' },
  'R': { action: 'forward', label: '進む' },
  'D': { action: 'newTab', label: '新しいタブ' },
  'UD': { action: 'reload', label: '再読み込み' },
  'DR': { action: 'closeTab', label: 'タブを閉じる' },
  'DL': { action: 'restoreTab', label: '閉じたタブを復元' },
  'U': { action: 'scrollTop', label: 'ページ先頭' },
  'RU': { action: 'scrollBottom', label: 'ページ末尾' },
  'LU': { action: 'prevTab', label: '前のタブ' },
  'LR': { action: 'nextTab', label: '次のタブ' },
};

const DEFAULT_SETTINGS = {
  enabled: true,
  threshold: 30,
  trailColor: '#4fc3f7',
  trailWidth: 3,
  showTrail: true,
  gestures: DEFAULT_GESTURES,
};

// ── Initialize storage on install ──
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.sync.get('settings', (data) => {
    if (details.reason === 'install' || !data.settings) {
      // Fresh install: write defaults
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    } else {
      // Update: preserve user gestures, only backfill new top-level setting keys
      const merged = { ...DEFAULT_SETTINGS, ...data.settings };
      merged.gestures = data.settings.gestures || DEFAULT_GESTURES;
      chrome.storage.sync.set({ settings: merged });
    }
  });
});

// ── Get full settings, merging defaults ──
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      // Always ensure defaults are available
      resolve({
        ...DEFAULT_SETTINGS,
        ...settings,
        gestures: settings.gestures || DEFAULT_GESTURES
      });
    });
  });
}

// ── Message handler from content script ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'gesture') {
    handleGesture(message.gesture, sender.tab);
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === 'getSettings') {
    getSettings().then((settings) => sendResponse(settings));
    return true; // async response
  }
  if (message.type === 'wheelTab') {
    handleWheelTab(message.direction, sender.tab);
    sendResponse({ ok: true });
    return false;
  }
});

// ── Execute gesture action ──
async function handleGesture(gestureCode, tab) {
  if (!tab) return;
  const settings = await getSettings();
  if (!settings.enabled) return;

  const gestureDef = settings.gestures[gestureCode];
  if (!gestureDef) return;
  if (gestureDef.disabled) return;

  await executeAction(gestureDef.action, tab);
}

// ── Handle wheel tab switching ──
async function handleWheelTab(direction, tab) {
  if (!tab) return;
  const settings = await getSettings();
  if (!settings.enabled) return;

  if (direction === 'next') {
    await executeAction('nextTab', tab);
  } else {
    await executeAction('prevTab', tab);
  }
}

// ── Execute an action ──
async function executeAction(action, tab) {
  try {
    switch (action) {
      case 'back':
        await chrome.tabs.goBack(tab.id);
        break;

      case 'forward':
        await chrome.tabs.goForward(tab.id);
        break;

      case 'newTab':
        await chrome.tabs.create({ active: true });
        break;

      case 'closeTab':
        await chrome.tabs.remove(tab.id);
        break;

      case 'restoreTab':
        await chrome.sessions.restore();
        break;

      case 'reload':
        await chrome.tabs.reload(tab.id);
        break;

      case 'scrollTop':
        chrome.tabs.sendMessage(tab.id, { type: 'scrollTo', position: 'top' }).catch(() => { });
        break;

      case 'scrollBottom':
        chrome.tabs.sendMessage(tab.id, { type: 'scrollTo', position: 'bottom' }).catch(() => { });
        break;

      case 'prevTab': {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const idx = tabs.findIndex((t) => t.id === tab.id);
        if (idx !== -1) {
          const prevIdx = (idx - 1 + tabs.length) % tabs.length;
          await chrome.tabs.update(tabs[prevIdx].id, { active: true });
        }
        break;
      }

      case 'nextTab': {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const idx = tabs.findIndex((t) => t.id === tab.id);
        if (idx !== -1) {
          const nextIdx = (idx + 1) % tabs.length;
          await chrome.tabs.update(tabs[nextIdx].id, { active: true });
        }
        break;
      }
    }
  } catch (err) {
    console.warn('[Mouse Gestures] Action failed:', action, err.message);
  }
}
