/* ============================================================
   router.js — hash-based routing (Sourcing)
   ============================================================ */
(function () {
    const routes = [
        { re: /^#\/rfx\/new$/, view: () => window.Views.rfxForm(null, parseQuery()) },
        { re: /^#\/rfx\/([^/?]+)\/edit$/, view: (m) => window.Views.rfxForm(m[1], parseQuery()) },
        { re: /^#\/rfx\/([^/?]+)\/respond$/, view: (m) => window.Views.supplierResponse(m[1]) },
        { re: /^#\/rfx\/([^/?]+)$/, view: (m) => window.Views.rfxDetail(m[1]) },
        { re: /^#\/rfx$/, view: () => window.Views.rfxList() },
        { re: /^#\/suppliers$/, view: () => window.Views.suppliers() }
    ];

    function parseQuery() {
        const q = {};
        const i = window.location.hash.indexOf('?');
        if (i === -1) return q;
        new URLSearchParams(window.location.hash.slice(i + 1)).forEach((v, k) => q[k] = v);
        return q;
    }

    function render() {
        const hash = window.location.hash || '#/rfx';
        const path = hash.split('?')[0];
        window.UI.renderHeader();
        let matched = false;
        for (const r of routes) {
            const m = path.match(r.re);
            if (m) { r.view(m); matched = true; break; }
        }
        if (!matched) { window.location.hash = '#/rfx'; return; }
        window.scrollTo(0, 0);
        if (window.I18N) window.I18N.apply();
    }

    function start() {
        window.addEventListener('hashchange', render);
        // re-render header badges when state changes (view handles its own re-render on nav)
        window.Store.subscribe(() => { window.UI.renderHeader(); });
        if (!window.location.hash) window.location.hash = '#/rfx';
        else render();
    }

    window.Router = { start, render, parseQuery };
})();
