(() => {
    const initHeader = () => {
        const toggle = document.querySelector('[data-sb-menu-toggle]');
        const links = document.querySelector('[data-sb-header-links]');
        const overlay = document.querySelector('[data-sb-menu-overlay]');
        const searchForm = document.querySelector('[data-sb-search-form]');
        const searchInput = document.querySelector('[data-sb-search-input]');

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

        if (searchForm && searchInput) {
            searchForm.addEventListener('submit', event => {
                const query = searchInput.value.trim();
                if (!query) {
                    event.preventDefault();
                    searchInput.focus();
                }
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeader, { once: true });
    } else {
        initHeader();
    }
})();
