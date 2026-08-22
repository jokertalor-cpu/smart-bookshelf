(() => {
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);

    const safeBookId = value => {
        const id = Number.parseInt(value, 10);
        return Number.isSafeInteger(id) && id > 0 ? String(id) : '';
    };

    const getPublicClient = () => {
        if (!window.supabase?.createClient) return null;
        const url = typeof SUPABASE_URL !== 'undefined'
            ? SUPABASE_URL
            : (typeof SB_URL !== 'undefined' ? SB_URL : '');
        const key = typeof SUPABASE_KEY !== 'undefined'
            ? SUPABASE_KEY
            : (typeof SB_KEY !== 'undefined' ? SB_KEY : '');
        if (!url || !key) return null;
        try {
            return window.supabase.createClient(url, key);
        } catch (_) {
            return null;
        }
    };

    const isSafeAssetUrl = value => {
        try {
            const url = new URL(String(value || ''), window.location.href);
            const allowedHosts = new Set([
                'mituedqotwbmporkwbqf.supabase.co',
                'admin-vercel.jokertalor.workers.dev',
                'www.panoramyanmar.com',
                'dzge6hlvluam4.cloudfront.net'
            ]);
            return url.protocol === 'https:' && allowedHosts.has(url.hostname) ? url.href : '';
        } catch (_) {
            return '';
        }
    };

    const initSearch = () => {
        const form = document.querySelector('[data-sb-search-form]');
        const input = document.querySelector('[data-sb-search-input]');
        const suggestions = document.querySelector('[data-sb-search-suggestions]');
        if (!form || !input || !suggestions) return;

        const client = getPublicClient();
        let requestNumber = 0;
        let timer;

        const hideSuggestions = () => {
            suggestions.innerHTML = '';
            suggestions.style.display = 'none';
        };

        const renderSuggestions = rows => {
            const safeRows = (rows || []).map(book => {
                const id = safeBookId(book.id);
                if (!id) return '';
                return `<a class="sb-search-suggestion" href="detail.html?id=${encodeURIComponent(id)}"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author || 'Unknown Author')}</small></a>`;
            }).join('');
            suggestions.innerHTML = safeRows;
            suggestions.style.display = safeRows ? 'block' : 'none';
        };

        input.addEventListener('input', () => {
            window.clearTimeout(timer);
            const keyword = input.value.trim();
            if (!client || keyword.length < 2) {
                hideSuggestions();
                return;
            }
            const currentRequest = ++requestNumber;
            timer = window.setTimeout(async () => {
                try {
                    const { data, error } = await client
                        .from('books')
                        .select('id, title, author')
                        .ilike('title', `%${keyword}%`)
                        .limit(5);
                    if (currentRequest !== requestNumber || input.value.trim() !== keyword) return;
                    if (error) throw error;
                    renderSuggestions(data);
                } catch (_) {
                    if (currentRequest === requestNumber) hideSuggestions();
                }
            }, 180);
        });

        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') hideSuggestions();
            if (event.key === 'Escape') hideSuggestions();
        });

        document.addEventListener('click', event => {
            if (!form.contains(event.target)) hideSuggestions();
        });

        form.addEventListener('submit', event => {
            if (!input.value.trim()) {
                event.preventDefault();
                input.focus();
                return;
            }
            hideSuggestions();
        });

        if (client) {
            client.from('seasonal_themes')
                .select('icon_url, category, start_date, end_date')
                .eq('is_active', true)
                .then(({ data, error }) => {
                    if (error || !data?.length) return;
                    const today = new Date();
                    const month = today.getMonth() + 1;
                    const mmdd = `${String(month).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    let pool = data.filter(theme => theme.category === 'festival' && mmdd >= theme.start_date && mmdd <= theme.end_date);
                    if (!pool.length) {
                        const season = month >= 3 && month <= 5 ? 'summer' : (month >= 6 && month <= 10 ? 'rainy' : 'winter');
                        pool = data.filter(theme => theme.category === season);
                    }
                    const icon = pool.length ? isSafeAssetUrl(pool[Math.floor(Math.random() * pool.length)].icon_url) : '';
                    if (icon) input.style.backgroundImage = `url("${icon}")`;
                })
                .catch(() => {});
        }
    };

    const initNavigation = () => {
        const toggle = document.querySelector('[data-sb-menu-toggle]');
        const links = document.querySelector('[data-sb-header-links]');
        const overlay = document.querySelector('[data-sb-menu-overlay]');
        if (!toggle || !links || !overlay) return;

        const closeMenu = () => {
            links.classList.remove('active');
            overlay.classList.remove('active');
            document.body.classList.remove('sb-menu-open');
            toggle.setAttribute('aria-expanded', 'false');
        };

        toggle.addEventListener('click', () => {
            const isOpen = links.classList.toggle('active');
            overlay.classList.toggle('active', isOpen);
            document.body.classList.toggle('sb-menu-open', isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
        });
        overlay.addEventListener('click', closeMenu);
        links.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeMenu();
        });
    };

    const init = () => {
        initNavigation();
        initSearch();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
