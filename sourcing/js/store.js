/* ============================================================
   store.js — localStorage-backed application state (Sourcing)
   Server copy (data/state.json) is the durable source of truth;
   localStorage is a fast local cache. Every mutation goes through
   Store.set(); breaking data changes get a versioned migration.
   ============================================================ */
(function () {
    const KEY = 'dmp_sourcing_state_v1';
    let state = null;
    let loadedSavedAt = 0;   // __savedAt as it was when loaded — the honest age of the local copy
    const listeners = new Set();

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return null;
    }

    // noStamp: write-through without advancing __savedAt — used at boot, where
    // migrations rewrite the state but it is NOT newer user data.
    function persist(noStamp) {
        if (!noStamp) state.__savedAt = Date.now();
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
        scheduleServerSave();
    }

    let saveTimer = null;
    let syncPending = false;
    function scheduleServerSave() {
        if (typeof fetch !== 'function' || syncPending) return;   // never race the initial pull
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state) }).catch(() => {});
            } catch (e) { /* ignore */ }
        }, 400);
    }
    function syncFromServer(done, mode) {
        if (typeof fetch !== 'function') { if (done) done(false); return; }
        syncPending = true;
        clearTimeout(saveTimer);
        fetch('/api/state', { cache: 'no-store' })
            .then(r => (r.status === 200 ? r.json() : null))
            .catch(() => null)
            // static hosts (e.g. GitHub Pages) have no /api — fall back to the
            // bundled data/state.json as a read-only demo snapshot
            .then(remote => remote || fetch('data/state.json', { cache: 'no-store' })
                .then(r => (r.status === 200 ? r.json() : null)).catch(() => null))
            .then(remote => {
                let changed = false;
                if (remote && remote.__seeded) {
                    const base = mode === 'focus' ? ((state && state.__savedAt) || 0) : loadedSavedAt;
                    if (state.__freshSeed || (remote.__savedAt || 0) > base) {
                        state = remote;
                        migrate(state);
                        loadedSavedAt = remote.__savedAt || 0;
                        changed = true;
                    }
                }
                delete state.__freshSeed;
                try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
                syncPending = false;
                scheduleServerSave();   // make sure the server holds the current state
                if (done) done(changed);
            });
    }
    if (typeof window.addEventListener === 'function') {
        // flush the latest state when the tab closes (covers the debounce window)
        window.addEventListener('beforeunload', () => {
            try {
                if (state && navigator.sendBeacon) navigator.sendBeacon('/api/state', JSON.stringify(state));
            } catch (e) { /* ignore */ }
        });
        // a tab returning to the foreground re-pulls the server copy
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            syncFromServer((changed) => {
                if (!changed) return;
                if (window.UI && window.UI.renderHeader) window.UI.renderHeader();
                if (window.Router && window.Router.render) window.Router.render();
                if (window.I18N && window.I18N.apply) window.I18N.apply();
            }, 'focus');
        });
        // cross-tab consistency: adopt newer state saved by another tab
        window.addEventListener('storage', (e) => {
            if (e.key !== KEY || !e.newValue) return;
            try {
                const incoming = JSON.parse(e.newValue);
                if (!incoming.__seeded) return;
                if ((incoming.__savedAt || 0) <= ((state && state.__savedAt) || 0)) return;
                state = incoming;
                loadedSavedAt = incoming.__savedAt || 0;
                if (window.UI && window.UI.renderHeader) window.UI.renderHeader();
                if (window.Router && window.Router.render) window.Router.render();
                if (window.I18N && window.I18N.apply) window.I18N.apply();
            } catch (err) { /* ignore */ }
        });
    }

    function init() {
        state = load();
        if (!state || !state.__seeded) {
            state = window.Seed.build();
            state.__seeded = true;
            state.__freshSeed = true;         // must defer to any existing server-side state
        } else {
            migrate(state);                   // backfill keys added in newer versions
        }
        loadedSavedAt = state.__savedAt || 0;
        persist(true);   // write-through only — booting is not "newer data"
    }

    // non-destructive migration: add datasets / top-level keys introduced after
    // this state was first persisted, without wiping the user's RFXes.
    function migrate(s) {
        const fresh = window.Seed.build();
        s.datasets = Object.assign({}, fresh.datasets, s.datasets || {});
        // static reference data always refreshes from the seed
        ['RFX_CATEGORIES', 'UOM', 'CURRENCIES', 'INCOTERMS', 'QUESTION_TYPES', 'QUESTION_TEMPLATES', 'CATEGORY_ATTRIBUTES', 'ITEM_SUGGESTIONS']
            .forEach(k => { s.datasets[k] = fresh.datasets[k]; });
        if (!Array.isArray(s.users)) s.users = fresh.users;
        if (!Array.isArray(s.suppliers)) s.suppliers = fresh.suppliers;
        if (!Array.isArray(s.rfxs)) s.rfxs = fresh.rfxs;
        if (!Array.isArray(s.notifications)) s.notifications = [];
        if (!s.session) s.session = fresh.session;
        if (!s.session.lang) s.session.lang = 'en';
        if (!s.seq) s.seq = { material: 0, service: 0 };
        s.rfxs.forEach(r => {
            if (!r.responses) r.responses = {};
            if (!r.techEval) r.techEval = {};
            if (!r.awards) r.awards = {};
            if (!Array.isArray(r.negRequests)) r.negRequests = [];
            if (!Array.isArray(r.history)) r.history = [];
        });
    }

    function get() { return state; }

    function set(mutator) {
        // mutator receives the live state; mutate, then we persist + notify
        mutator(state);
        persist();
        emit();
    }

    function reset() {
        state = window.Seed.build();
        state.__seeded = true;
        persist();
        emit();
    }

    function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

    // ---- id helpers ----
    let _seq = Math.floor(performance.now() * 1000) % 100000;
    function uid(prefix) { _seq += 1; return (prefix || 'id') + '_' + _seq.toString(36) + Date.now().toString(36).slice(-4); }

    // ---- convenience selectors ----
    function session() { return state.session; }
    function users() { return state.users; }
    function currentUser() { return state.users.find(u => u.id === state.session.currentUserId) || state.users[0]; }
    function suppliers() { return state.suppliers; }
    function supplierById(id) { return state.suppliers.find(x => x.id === id); }
    function rfxs() { return state.rfxs; }
    function rfxById(id) { return state.rfxs.find(r => r.id === id); }
    function notifications() { return state.notifications; }

    function setUser(id) { set(s => { s.session.currentUserId = id; }); }

    function addNotification(n) {
        set(s => {
            s.notifications.unshift(Object.assign({ id: uid('ntf'), read: false, ts: Date.now() }, n));
        });
    }
    function markAllNotificationsRead() {
        // only the notifications visible to the current user — others keep their unread badge
        const me = currentUser();
        set(s => s.notifications.forEach(n => {
            if (window.Workflow.notifVisible(n, me)) n.read = true;
        }));
    }

    window.Store = {
        init, get, set, reset, subscribe, uid,
        session, users, currentUser, suppliers, supplierById, rfxs, rfxById,
        notifications, setUser, addNotification, markAllNotificationsRead,
        persist, syncFromServer
    };
})();
