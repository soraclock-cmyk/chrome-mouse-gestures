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
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get('settings', (data) => {
    if (!data.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    } else {
      // Merge new defaults (e.g., showTrail) for existing installs
      const merged = { ...DEFAULT_SETTINGS, ...data.settings };
      if (merged.showTrail === undefined) merged.showTrail = true;
      chrome.storage.sync.set({ settings: merged });
    }
  });
});

// ── Get full settings, merging defaults ──
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get('settings', (data) => {
      resolve(data.settings || DEFAULT_SETTINGS);
    });
  });
}

// ── Message handler from content script ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'gesture') {
    handleGesture(message.gesture, sender.tab);
    sendResponse({ ok: true });
  }
  if (message.type === 'getSettings') {
    getSettings().then((settings) => sendResponse(settings));
    return true; // async
  }
  if (message.type === 'wheelTab') {
    handleWheelTab(message.direction, sender.tab);
    sendResponse({ ok: true });
  }
});

// ── Execute gesture action ──
async function handleGesture(gestureCode, tab) {
  const settings = await getSettings();
  if (!settings.enabled) return;

  const gestureDef = settings.gestures[gestureCode];
  if (!gestureDef) return;
  if (gestureDef.disabled) return;

  await executeAction(gestureDef.action, tab);
}

// ── Handle wheel tab switching ──
async function handleWheelTab(direction, tab) {
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
  switch (action) {
    case 'back':
      chrome.tabs.goBack(tab.id);
      break;

    case 'forward':
      chrome.tabs.goForward(tab.id);
      break;

    case 'newTab':
      chrome.tabs.create({ active: true });
      break;

    case 'closeTab':
      chrome.tabs.remove(tab.id);
      break;

    case 'restoreTab':
      chrome.sessions.restore();
      break;

    case 'reload':
      chrome.tabs.reload(tab.id);
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
      const prevIdx = (idx - 1 + tabs.length) % tabs.length;
      chrome.tabs.update(tabs[prevIdx].id, { active: true });
      break;
    }

    case 'nextTab': {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const idx = tabs.findIndex((t) => t.id === tab.id);
      const nextIdx = (idx + 1) % tabs.length;
      chrome.tabs.update(tabs[nextIdx].id, { active: true });
      break;
    }
  }
}
