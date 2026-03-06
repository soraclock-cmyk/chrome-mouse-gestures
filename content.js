// ══════════════════════════════════════════════
//  Mouse Gesture — Content Script
//  Right-click + drag to trigger browser actions
//  Right-click + wheel to switch tabs
// ══════════════════════════════════════════════

(() => {
    'use strict';

    // Prevent double-init
    if (window.__mouseGestureInitialized__) return;
    window.__mouseGestureInitialized__ = true;

    // ── State ──
    let isGesturing = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let anchorX = 0;  // anchor point for direction detection
    let anchorY = 0;
    let directions = [];
    let lastDirection = '';
    let suppressContext = false;
    let settings = null;
    let canvas = null;
    let ctx = null;
    let hud = null;
    let directionHud = null;
    let hasMoved = false;  // track if mouse actually moved during gesture

    // ── Direction map for arrows ──
    const ARROW_MAP = { U: '↑', D: '↓', L: '←', R: '→' };
    const ACTION_LABELS = {};

    // ── Load settings ──
    function loadSettings() {
        try {
            chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response) {
                    settings = response;
                    if (settings.gestures) {
                        Object.keys(ACTION_LABELS).forEach((k) => delete ACTION_LABELS[k]);
                        Object.entries(settings.gestures).forEach(([code, def]) => {
                            ACTION_LABELS[code] = def.label;
                        });
                    }
                }
            });
        } catch (e) {
            // Extension context invalidated (e.g., after update)
        }
    }

    loadSettings();

    // Listen for settings changes
    try {
        chrome.storage.onChanged.addListener(() => loadSettings());
    } catch (e) { /* ignore */ }

    // ── Check if trail/HUD should be shown ──
    function shouldShowTrail() {
        return settings && settings.showTrail !== false;
    }

    // ── Create overlay canvas ──
    function createCanvas() {
        if (!shouldShowTrail()) return;
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.id = '__gesture_canvas__';
        canvas.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      z-index: 2147483647;
      pointer-events: none;
    `;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.documentElement.appendChild(canvas);
        ctx = canvas.getContext('2d');
    }

    function removeCanvas() {
        if (canvas) {
            canvas.remove();
            canvas = null;
            ctx = null;
        }
    }

    // ── Create HUD overlay ──
    function createHud() {
        if (!shouldShowTrail()) return;
        if (hud) return;

        directionHud = document.createElement('div');
        directionHud.id = '__gesture_dir_hud__';
        directionHud.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      pointer-events: none;
      font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
      font-size: 48px;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 2px 20px rgba(79,195,247,0.8), 0 0 60px rgba(79,195,247,0.4);
      letter-spacing: 12px;
      opacity: 0;
      transition: opacity 0.15s ease;
    `;
        document.documentElement.appendChild(directionHud);

        hud = document.createElement('div');
        hud.id = '__gesture_hud__';
        hud.style.cssText = `
      position: fixed;
      top: calc(50% + 40px); left: 50%;
      transform: translate(-50%, 0);
      z-index: 2147483647;
      pointer-events: none;
      font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
      font-size: 16px;
      font-weight: 500;
      color: rgba(255,255,255,0.85);
      background: rgba(30,30,30,0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 6px 18px;
      border-radius: 8px;
      border: 1px solid rgba(79,195,247,0.3);
      opacity: 0;
      transition: opacity 0.15s ease;
      white-space: nowrap;
    `;
        document.documentElement.appendChild(hud);
    }

    function removeHud() {
        if (hud) { hud.remove(); hud = null; }
        if (directionHud) { directionHud.remove(); directionHud = null; }
    }

    function updateHud() {
        if (!directionHud || !hud) return;
        const code = directions.join('');
        if (code.length === 0) {
            directionHud.style.opacity = '0';
            hud.style.opacity = '0';
            return;
        }
        const arrows = directions.map((d) => ARROW_MAP[d] || d).join(' ');
        directionHud.textContent = arrows;
        directionHud.style.opacity = '1';

        const label = ACTION_LABELS[code];
        if (label) {
            hud.textContent = label;
            hud.style.opacity = '1';
        } else {
            hud.textContent = '';
            hud.style.opacity = '0';
        }
    }

    // ── Gesture detection ──
    function getDirection(dx, dy, threshold) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < threshold && absDy < threshold) return null;
        if (absDx > absDy) {
            return dx > 0 ? 'R' : 'L';
        } else {
            return dy > 0 ? 'D' : 'U';
        }
    }

    // ── Draw trail segment ──
    function drawTrail(x1, y1, x2, y2) {
        if (!ctx) return;
        const color = (settings && settings.trailColor) || '#4fc3f7';
        const width = (settings && settings.trailWidth) || 3;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.stroke();
    }

    // ── Event Handlers ──
    function onMouseDown(e) {
        if (e.button !== 2) return; // right-click only
        if (!settings || !settings.enabled) return;

        isGesturing = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        lastX = e.clientX;
        lastY = e.clientY;
        anchorX = e.clientX;
        anchorY = e.clientY;
        directions = [];
        lastDirection = '';
        suppressContext = false;

        createCanvas();
        createHud();
    }

    function onMouseMove(e) {
        if (!isGesturing) return;

        const threshold = (settings && settings.threshold) || 30;
        const dx = e.clientX - anchorX;
        const dy = e.clientY - anchorY;

        // Draw trail from last point (always update for smooth trail)
        if (shouldShowTrail()) {
            drawTrail(lastX, lastY, e.clientX, e.clientY);
        }

        // Always update lastX/lastY for smooth trail drawing
        lastX = e.clientX;
        lastY = e.clientY;

        const dir = getDirection(dx, dy, threshold);
        if (dir && dir !== lastDirection) {
            directions.push(dir);
            lastDirection = dir;
            // Reset anchor point for next direction detection
            anchorX = e.clientX;
            anchorY = e.clientY;
            hasMoved = true;
            if (shouldShowTrail()) {
                updateHud();
            }
        }

        // Check total movement from start (even before direction detected)
        const totalDx = e.clientX - startX;
        const totalDy = e.clientY - startY;
        if (Math.abs(totalDx) > 5 || Math.abs(totalDy) > 5) {
            hasMoved = true;
        }

        if (hasMoved) {
            suppressContext = true;
        }
    }

    function onMouseUp(e) {
        if (e.button !== 2) return;
        if (!isGesturing) return;

        isGesturing = false;
        removeCanvas();
        removeHud();

        const gestureCode = directions.join('');
        if (gestureCode.length > 0) {
            try {
                chrome.runtime.sendMessage({ type: 'gesture', gesture: gestureCode });
            } catch (err) { /* ignore */ }
        }

        directions = [];
        lastDirection = '';
    }

    // ── Right-click + Mouse Wheel → Tab switching ──
    function onWheel(e) {
        if (!isGesturing) return;
        if (!settings || !settings.enabled) return;

        e.preventDefault();
        e.stopPropagation();
        suppressContext = true;

        const direction = e.deltaY > 0 ? 'next' : 'prev';
        try {
            chrome.runtime.sendMessage({ type: 'wheelTab', direction });
        } catch (err) { /* ignore */ }
    }

    function onContextMenu(e) {
        if (suppressContext) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            suppressContext = false;
            return false;
        }
    }

    // ── Prevent text selection during gesture ──
    function onSelectStart(e) {
        if (isGesturing) {
            e.preventDefault();
        }
    }

    // ── Scroll handler (from background) ──
    try {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'scrollTo') {
                if (message.position === 'top') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else if (message.position === 'bottom') {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                }
            }
        });
    } catch (e) { /* ignore */ }

    // ── Resize handler ──
    window.addEventListener('resize', () => {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
    });

    // ── Attach event listeners ──
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('selectstart', onSelectStart, true);
})();
