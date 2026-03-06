const ARROW_MAP = { U: '↑', D: '↓', L: '←', R: '→' };

document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enableToggle');
    const trailToggle = document.getElementById('trailToggle');
    const list = document.getElementById('gestureList');
    const optionsLink = document.getElementById('openOptions');

    // Load settings
    chrome.storage.sync.get('settings', (data) => {
        const settings = data.settings || {};
        toggle.checked = settings.enabled !== false;
        trailToggle.checked = settings.showTrail !== false;
        renderGestures(settings.gestures || {});
    });

    // Toggle enable/disable
    toggle.addEventListener('change', () => {
        chrome.storage.sync.get('settings', (data) => {
            const settings = data.settings || {};
            settings.enabled = toggle.checked;
            chrome.storage.sync.set({ settings });
        });
    });

    // Toggle trail visibility
    trailToggle.addEventListener('change', () => {
        chrome.storage.sync.get('settings', (data) => {
            const settings = data.settings || {};
            settings.showTrail = trailToggle.checked;
            chrome.storage.sync.set({ settings });
        });
    });

    // Open options page
    optionsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });

    function renderGestures(gestures) {
        list.innerHTML = '';
        const sorted = Object.entries(gestures).sort((a, b) => a[0].length - b[0].length);
        for (const [code, def] of sorted) {
            const item = document.createElement('div');
            item.className = 'gesture-item';

            const arrows = document.createElement('div');
            arrows.className = 'gesture-arrows';
            arrows.textContent = code.split('').map((c) => ARROW_MAP[c] || c).join(' ');

            const label = document.createElement('div');
            label.className = 'gesture-label';
            label.textContent = def.label;

            item.appendChild(arrows);
            item.appendChild(label);
            list.appendChild(item);
        }

        // Add wheel hint
        const wheelHint = document.createElement('div');
        wheelHint.className = 'gesture-item gesture-hint';
        const wheelIcon = document.createElement('div');
        wheelIcon.className = 'gesture-arrows';
        wheelIcon.textContent = '🖱️';
        const wheelLabel = document.createElement('div');
        wheelLabel.className = 'gesture-label';
        wheelLabel.textContent = '右クリック + ホイール → タブ切替';
        wheelHint.appendChild(wheelIcon);
        wheelHint.appendChild(wheelLabel);
        list.appendChild(wheelHint);
    }
});
