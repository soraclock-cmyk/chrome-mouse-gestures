const ARROW_MAP = { U: '↑', D: '↓', L: '←', R: '→' };

const ACTION_LABELS = {
    back: '戻る',
    forward: '進む',
    newTab: '新しいタブ',
    closeTab: 'タブを閉じる',
    restoreTab: '閉じたタブを復元',
    reload: '再読み込み',
    scrollTop: 'ページ先頭',
    scrollBottom: 'ページ末尾',
    prevTab: '前のタブ',
    nextTab: '次のタブ',
};

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
    gestures: DEFAULT_GESTURES,
};

let currentSettings = {};
let editingGestureCode = null; // null = adding, string = editing existing

document.addEventListener('DOMContentLoaded', () => {
    const enabledEl = document.getElementById('enabled');
    const showTrailEl = document.getElementById('showTrail');
    const thresholdEl = document.getElementById('threshold');
    const thresholdValueEl = document.getElementById('thresholdValue');
    const trailColorEl = document.getElementById('trailColor');
    const trailWidthEl = document.getElementById('trailWidth');
    const trailWidthValueEl = document.getElementById('trailWidthValue');
    const gestureTableEl = document.getElementById('gestureTable');
    const addGestureBtn = document.getElementById('addGestureBtn');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const toast = document.getElementById('toast');

    // Modal elements
    const modal = document.getElementById('gestureModal');
    const modalTitle = document.getElementById('modalTitle');
    const gesturePreview = document.getElementById('gesturePreview');
    const clearGestureBtn = document.getElementById('clearGestureBtn');
    const actionSelect = document.getElementById('actionSelect');
    const labelInput = document.getElementById('labelInput');
    const modalError = document.getElementById('modalError');
    const modalSaveBtn = document.getElementById('modalSaveBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const dirBtns = document.querySelectorAll('.dir-btn:not(.dir-btn-clear)');

    let modalGestureCode = '';

    // ── Slider live updates ──
    thresholdEl.addEventListener('input', () => {
        thresholdValueEl.textContent = thresholdEl.value + 'px';
    });
    trailWidthEl.addEventListener('input', () => {
        trailWidthValueEl.textContent = trailWidthEl.value + 'px';
    });

    // ── Load settings ──
    chrome.storage.sync.get('settings', (data) => {
        currentSettings = data.settings || JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        applyToUI(currentSettings);
    });

    function applyToUI(s) {
        enabledEl.checked = s.enabled !== false;
        showTrailEl.checked = s.showTrail !== false;
        thresholdEl.value = s.threshold || 30;
        thresholdValueEl.textContent = (s.threshold || 30) + 'px';
        trailColorEl.value = s.trailColor || '#4fc3f7';
        trailWidthEl.value = s.trailWidth || 3;
        trailWidthValueEl.textContent = (s.trailWidth || 3) + 'px';
        renderGestures(s.gestures || DEFAULT_GESTURES);
    }

    // ── Render gesture table ──
    function renderGestures(gestures) {
        gestureTableEl.innerHTML = '';
        const sorted = Object.entries(gestures).sort((a, b) => a[0].length - b[0].length);

        for (const [code, def] of sorted) {
            const row = document.createElement('div');
            row.className = 'gesture-row';

            // Arrows display
            const arrows = document.createElement('span');
            arrows.className = 'gesture-arrows';
            arrows.textContent = code.split('').map((c) => ARROW_MAP[c] || c).join(' ');

            // Action label
            const actionLabel = document.createElement('span');
            actionLabel.className = 'gesture-action';
            actionLabel.textContent = def.label;

            // Info container
            const info = document.createElement('div');
            info.className = 'gesture-info';
            info.appendChild(arrows);
            info.appendChild(actionLabel);

            // Buttons container
            const btns = document.createElement('div');
            btns.className = 'gesture-row-btns';

            // Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-icon btn-edit';
            editBtn.textContent = '✎';
            editBtn.title = '編集';
            editBtn.addEventListener('click', () => openEditModal(code, def));

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon btn-delete';
            deleteBtn.textContent = '✕';
            deleteBtn.title = '削除';
            deleteBtn.addEventListener('click', () => deleteGesture(code));

            // Toggle
            const toggle = document.createElement('label');
            toggle.className = 'toggle';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = def.disabled !== true;
            checkbox.dataset.code = code;
            const slider = document.createElement('span');
            slider.className = 'slider';
            toggle.appendChild(checkbox);
            toggle.appendChild(slider);

            btns.appendChild(editBtn);
            btns.appendChild(deleteBtn);
            btns.appendChild(toggle);

            row.appendChild(info);
            row.appendChild(btns);
            gestureTableEl.appendChild(row);
        }
    }

    // ── Delete gesture ──
    function deleteGesture(code) {
        const arrows = code.split('').map((c) => ARROW_MAP[c] || c).join(' ');
        if (confirm(`ジェスチャー「${arrows}」を削除しますか？`)) {
            delete currentSettings.gestures[code];
            renderGestures(currentSettings.gestures);
        }
    }

    // ── Modal: Open for Add ──
    addGestureBtn.addEventListener('click', () => {
        editingGestureCode = null;
        modalTitle.textContent = '新しいジェスチャーを追加';
        modalSaveBtn.textContent = '追加';
        modalGestureCode = '';
        updateGesturePreview();
        actionSelect.value = 'back';
        labelInput.value = '';
        modalError.style.display = 'none';
        modal.style.display = 'flex';
    });

    // ── Modal: Open for Edit ──
    function openEditModal(code, def) {
        editingGestureCode = code;
        modalTitle.textContent = 'ジェスチャーを編集';
        modalSaveBtn.textContent = '保存';
        modalGestureCode = code;
        updateGesturePreview();
        actionSelect.value = def.action;
        labelInput.value = def.label || '';
        modalError.style.display = 'none';
        modal.style.display = 'flex';
    }

    // ── Modal: Close ──
    modalCancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    function closeModal() {
        modal.style.display = 'none';
        editingGestureCode = null;
        modalGestureCode = '';
    }

    // ── Modal: Direction buttons ──
    dirBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const dir = btn.dataset.dir;
            // Prevent consecutive same directions
            if (modalGestureCode.length > 0 && modalGestureCode[modalGestureCode.length - 1] === dir) {
                return;
            }
            if (modalGestureCode.length >= 5) return; // max 5 directions
            modalGestureCode += dir;
            updateGesturePreview();

            // Auto-fill label if empty
            if (!labelInput.value) {
                const actionVal = actionSelect.value;
                labelInput.value = ACTION_LABELS[actionVal] || '';
            }
        });
    });

    clearGestureBtn.addEventListener('click', () => {
        modalGestureCode = '';
        updateGesturePreview();
    });

    function updateGesturePreview() {
        if (modalGestureCode.length === 0) {
            gesturePreview.innerHTML = '<span class="gesture-preview-placeholder">方向ボタンを押してパターンを作成</span>';
        } else {
            const arrows = modalGestureCode.split('').map((c) => ARROW_MAP[c] || c).join(' ');
            gesturePreview.innerHTML = `<span class="gesture-preview-arrows">${arrows}</span>`;
        }
    }

    // ── Modal: Auto-fill label on action change ──
    actionSelect.addEventListener('change', () => {
        const actionVal = actionSelect.value;
        labelInput.value = ACTION_LABELS[actionVal] || '';
    });

    // ── Modal: Save ──
    modalSaveBtn.addEventListener('click', () => {
        const code = modalGestureCode;
        const action = actionSelect.value;
        const label = labelInput.value.trim() || ACTION_LABELS[action] || action;

        // Validation
        if (code.length === 0) {
            showModalError('ジェスチャーパターンを入力してください。');
            return;
        }

        // Check for duplicate (only if adding or changing code)
        if (code !== editingGestureCode && currentSettings.gestures[code]) {
            showModalError(`ジェスチャー「${code.split('').map((c) => ARROW_MAP[c]).join(' ')}」は既に使用されています。`);
            return;
        }

        // If editing and code changed, remove old entry
        if (editingGestureCode && editingGestureCode !== code) {
            delete currentSettings.gestures[editingGestureCode];
        }

        currentSettings.gestures[code] = { action, label };
        renderGestures(currentSettings.gestures);
        closeModal();
    });

    function showModalError(msg) {
        modalError.textContent = msg;
        modalError.style.display = 'block';
        setTimeout(() => { modalError.style.display = 'none'; }, 3000);
    }

    // ── Save all settings ──
    saveBtn.addEventListener('click', () => {
        currentSettings.enabled = enabledEl.checked;
        currentSettings.showTrail = showTrailEl.checked;
        currentSettings.threshold = parseInt(thresholdEl.value, 10);
        currentSettings.trailColor = trailColorEl.value;
        currentSettings.trailWidth = parseInt(trailWidthEl.value, 10);

        // Update disabled states from toggles
        const checkboxes = gestureTableEl.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((cb) => {
            const code = cb.dataset.code;
            if (currentSettings.gestures[code]) {
                if (cb.checked) {
                    delete currentSettings.gestures[code].disabled;
                } else {
                    currentSettings.gestures[code].disabled = true;
                }
            }
        });

        chrome.storage.sync.set({ settings: currentSettings }, () => {
            showToast();
        });
    });

    // ── Reset ──
    resetBtn.addEventListener('click', () => {
        if (confirm('すべての設定をデフォルトに戻しますか？')) {
            currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            applyToUI(currentSettings);
            chrome.storage.sync.set({ settings: currentSettings }, () => {
                showToast();
            });
        }
    });

    function showToast() {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
});
