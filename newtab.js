(() => {
    'use strict';

    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const shortcutsEl = document.getElementById('shortcuts');

    // ── Clock ──
    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${h}:${m}`;

        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        dateEl.textContent = `${now.getFullYear()}年 ${months[now.getMonth()]} ${now.getDate()}日（${days[now.getDay()]}）`;
    }

    updateClock();
    setInterval(updateClock, 1000);

    // ── Search ──
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;

        // Detect if it's a URL
        if (/^(https?:\/\/|www\.)/.test(query) || /^[\w-]+\.\w{2,}/.test(query)) {
            const url = query.startsWith('http') ? query : `https://${query}`;
            window.location.href = url;
        } else {
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
    });

    // ── Top Sites (shortcuts) ──
    if (chrome.topSites) {
        chrome.topSites.get((sites) => {
            const top = sites.slice(0, 8);
            shortcutsEl.innerHTML = '';
            for (const site of top) {
                const a = document.createElement('a');
                a.className = 'shortcut';
                a.href = site.url;
                a.title = site.title || site.url;

                const icon = document.createElement('div');
                icon.className = 'shortcut-icon';

                // Favicon
                const favicon = document.createElement('img');
                favicon.className = 'shortcut-favicon';
                const domain = new URL(site.url).hostname;
                favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=48`;
                favicon.onerror = () => {
                    favicon.remove();
                    icon.textContent = site.title ? site.title[0].toUpperCase() : '🔗';
                };
                icon.appendChild(favicon);

                const label = document.createElement('span');
                label.className = 'shortcut-label';
                label.textContent = site.title || domain;

                a.appendChild(icon);
                a.appendChild(label);
                shortcutsEl.appendChild(a);
            }
        });
    }
})();
