/* ============================================================
   components.js — shared render helpers & chrome (Sourcing)
   ============================================================ */
(function () {

    // module cross-links: absolute localhost ports when running under the dev
    // python servers, relative sibling folders on a static host (GitHub Pages)
    window.DP_URL = window.DP_URL || (location.port === '8124' ? 'http://127.0.0.1:8123' : '../demand_planning');

    /* ---------- tiny utils ---------- */
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function go(hash) { window.location.hash = hash; }
    function nowLabel(ts) {
        const d = new Date(ts);
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    // delegate helper: attach one handler, match by [data-act].
    // Replaces any handler previously attached by bindActions on this root.
    function bindActions(root, map) {
        if (root.__actHandler) root.removeEventListener('click', root.__actHandler);
        const handler = e => {
            const t = e.target.closest('[data-act]');
            if (!t || !root.contains(t)) return;
            const fn = map[t.getAttribute('data-act')];
            if (fn) fn(t, e);
        };
        root.__actHandler = handler;
        root.addEventListener('click', handler);
    }

    function ds() { return window.Store.get().datasets; }

    function money(v, cur) {
        if (v === undefined || v === null || v === '' || isNaN(Number(v))) return '—';
        return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (cur || '');
    }

    /* ---------- file → stored document ---------- */
    const MAX_DOC = 2 * 1024 * 1024;
    function readFileAsDoc(file, cb) {
        if (!file) return;
        if (file.size > MAX_DOC) {
            toast({ kind: 'error', title: 'File too large', body: 'Attachments are limited to 2 MB in the demo.' });
            return;
        }
        const fr = new FileReader();
        fr.onload = () => cb({ name: file.name, size: file.size, data: fr.result });
        fr.readAsDataURL(file);
    }
    function docKB(size) { return (size / 1024).toFixed(1) + ' KB'; }
    const CLIP = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
    function docChip(doc, delAct) {
        if (!doc) return '';
        return `<span class="doc-chip">${CLIP}<a href="${doc.data}" download="${esc(doc.name)}" title="Download">${esc(doc.name)}</a>
            <span class="muted">(${docKB(doc.size || 0)})</span>
            ${delAct ? `<button type="button" class="chip-del" data-act="${esc(delAct)}" title="Remove">✕</button>` : ''}</span>`;
    }

    /* ---------- toast ---------- */
    function toast(opts) {
        if (typeof opts === 'string') opts = { body: opts };
        const root = document.getElementById('toast-root');
        const el = document.createElement('div');
        el.className = 'toast ' + (opts.kind || '');
        el.innerHTML = (opts.title ? `<div class="toast-title">${esc(opts.title)}</div>` : '') +
            `<div>${esc(opts.body)}</div>`;
        root.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, opts.duration || 4200);
    }

    /* ---------- modal ---------- */
    function openModal(opts) {
        const root = document.getElementById('modal-root');
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal${opts.wide ? ' modal-wide' : ''}">
                <div class="modal-head">${esc(opts.title || '')}</div>
                <div class="modal-body">${opts.bodyHtml || ''}</div>
                <div class="modal-foot" id="modal-foot"></div>
            </div>`;
        root.appendChild(overlay);
        const foot = overlay.querySelector('#modal-foot');
        (opts.buttons || []).forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'btn ' + (b.cls || 'btn-outline');
            btn.textContent = b.label;
            btn.onclick = () => { if (b.onClick) b.onClick(overlay); };
            foot.appendChild(btn);
        });
        overlay.addEventListener('click', e => { if (e.target === overlay && opts.dismissable !== false) close(); });
        function close() { overlay.remove(); }
        if (opts.onOpen) opts.onOpen(overlay);
        return { overlay, close };
    }
    function closeModals() { document.getElementById('modal-root').innerHTML = ''; }

    /* ---------- badges ---------- */
    function phaseBadge(rfx) {
        return `<span class="status-pill ${window.Workflow.phaseCls(rfx)}">${esc(window.Workflow.phaseLabel(rfx))}</span>`;
    }
    function typeBadge(rfx) {
        return `<span class="type-pill ${rfx.type === 'service' ? 'tp-service' : 'tp-material'}">${rfx.type === 'service' ? 'Service' : 'Material'}</span>`;
    }
    function respBadge(status) {
        const map = { submitted: ['Submitted', 'st-awarded'], draft: ['In progress', 'st-open'], invited: ['Invited', 'st-draft'] };
        const m = map[status] || map.invited;
        return `<span class="status-pill ${m[1]}">${m[0]}</span>`;
    }
    function verdictBadge(v) {
        if (v === 'pass') return '<span class="status-pill st-awarded">Approved</span>';
        if (v === 'fail') return '<span class="status-pill st-cancelled">Declined</span>';
        return '<span class="status-pill st-draft">Pending</span>';
    }

    /* ---------- "how many RFXes need this user" counters ---------- */
    function actionCount(user) {
        const W = window.Workflow;
        const rfxs = window.Store.rfxs();
        if (W.isSupplier(user)) {
            const openInvites = rfxs.filter(r => r.status === 'Published' && W.phase(r) === 'Open' &&
                r.supplierIds.indexOf(user.supplierId) !== -1 &&
                (!(r.responses[user.supplierId]) || r.responses[user.supplierId].status !== 'submitted')).length;
            const pendingNegs = rfxs.filter(r => r.status === 'Published' &&
                W.pendingNegRequests(r, user.supplierId).length > 0).length;
            return openInvites + pendingNegs;
        }
        if (user.role === 'CAM') {
            return rfxs.filter(r => W.phase(r) === 'Closed' &&
                W.submittedSupplierIds(r).some(id => !W.verdictOf(r, id))).length;
        }
        if (user.role === 'PROC') {
            return rfxs.filter(r => W.phase(r) === 'Closed' && W.techEvalDone(r) && !W.allItemsAwarded(r)).length;
        }
        return 0;
    }

    /* ---------- header ---------- */
    function visibleNotifications() {
        const me = window.Store.currentUser();
        return window.Store.notifications().filter(n => window.Workflow.notifVisible(n, me));
    }
    function userSubtitle(u) {
        if (u.role === 'SUPPLIER') {
            const sup = window.Store.supplierById(u.supplierId);
            return sup ? sup.name : 'Supplier';
        }
        return u.company + ' · ' + (u.role === 'CAM' ? 'Technical (CAM)' : 'Procurement (PROC)');
    }
    function renderHeader() {
        const s = window.Store.session();
        const me = window.Store.currentUser();
        const unread = visibleNotifications().filter(n => !n.read).length;
        const users = window.Store.users();
        const customers = users.filter(u => window.Workflow.isCustomer(u));
        const supplierUsers = users.filter(u => window.Workflow.isSupplier(u));
        const userRow = (u) => {
            const c = actionCount(u);
            return `<div class="role-menu-item ${u.id === me.id ? 'active' : ''}" data-act="user-pick" data-user="${esc(u.id)}">
                <span>${esc(u.name)}<span class="user-sub">${esc(userSubtitle(u))}</span></span>${c ? `<span class="badge">${c}</span>` : ''}</div>`;
        };

        const header = document.getElementById('app-header');
        header.innerHTML = `
            <div class="header-left">
                <button class="menu-toggle" data-act="nav-drawer" title="Menu">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <div class="logo-area" data-act="home">
                    <img class="logo-img" src="img/logo.svg" alt="dmp — Digital Material Purchasing">
                    <div class="divider"></div>
                    <div class="app-title">SOURCING</div>
                </div>
            </div>
            <div class="header-right">
                <div class="lang-switcher">
                    <button class="lang-switch-btn" data-act="lang-toggle" title="Language / Dil">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        <span class="lang-label">${(s.lang || 'en').toUpperCase()}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="lang-menu" id="lang-menu">
                        <div class="lang-menu-item ${(s.lang || 'en') === 'en' ? 'active' : ''}" data-act="lang-pick" data-lang="en"><span>EN</span><span class="lang-name">English</span></div>
                        <div class="lang-menu-item ${s.lang === 'az' ? 'active' : ''}" data-act="lang-pick" data-lang="az"><span>AZ</span><span class="lang-name">Azərbaycan dili</span></div>
                    </div>
                </div>
                <div class="role-switcher">
                    <button class="role-switcher-btn" data-act="user-toggle">
                        <span class="role-dot"></span>
                        <span>Acting as <span class="role-label">${esc(me.name)}</span></span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="role-menu" id="role-menu">
                        <div class="role-menu-head">Customer</div>
                        ${customers.map(userRow).join('')}
                        <div class="role-menu-head" style="border-top:1px solid var(--border-soft)">Suppliers</div>
                        ${supplierUsers.map(userRow).join('')}
                        <div class="role-menu-head" style="border-top:1px solid var(--border-soft);border-bottom:none">Demo</div>
                        <div class="role-menu-item" data-act="reset-demo"><span>↻ Reset demo data</span></div>
                    </div>
                </div>
                <button class="icon-btn" data-act="notif">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    <span>Notifications</span>
                    ${unread ? `<span class="count-badge">${unread}</span>` : ''}
                </button>
                <div class="user-profile">
                    <div class="user-avatar"></div>
                    <div class="user-info">
                        <div class="user-name">${esc(me.name)}</div>
                        <div class="user-company">${esc(userSubtitle(me))}</div>
                    </div>
                </div>
            </div>`;

        bindActions(header, {
            // the dmp logo leads to the platform landing page (static/Pages build);
            // under the dev server there is no landing, so it stays the module home
            'home': () => { if (location.port === '8124') go('#/rfx'); else window.location.href = '../'; },
            'nav-drawer': () => openNavDrawer(),
            'user-toggle': () => document.getElementById('role-menu').classList.toggle('open'),
            'user-pick': (t) => {
                document.getElementById('role-menu').classList.remove('open');
                window.Store.setUser(t.getAttribute('data-user'));
                // views are user-specific — re-render in place
                window.Router.render();
                if (window.I18N) window.I18N.apply();
            },
            'notif': () => toggleNotifPanel(),
            'lang-toggle': () => document.getElementById('lang-menu').classList.toggle('open'),
            'lang-pick': (t) => {
                document.getElementById('lang-menu').classList.remove('open');
                if (window.I18N) window.I18N.setLang(t.getAttribute('data-lang'));
            },
            'reset-demo': () => {
                document.getElementById('role-menu').classList.remove('open');
                window.Store.reset();
                toast({ title: 'Demo reset', body: 'All RFXes cleared and demo data re-seeded.' });
                go('#/rfx');
                window.Router.render();
            }
        });
        if (!document.__menuCloseBound) {
            document.__menuCloseBound = true;
            document.addEventListener('click', outsideClose);
        }
    }
    function outsideClose(e) {
        if (!e.target.closest('.role-switcher')) { const m = document.getElementById('role-menu'); if (m) m.classList.remove('open'); }
        if (!e.target.closest('.lang-switcher')) { const lm = document.getElementById('lang-menu'); if (lm) lm.classList.remove('open'); }
        if (!e.target.closest('.notif-panel') && !e.target.closest('[data-act="notif"]')) { const p = document.getElementById('notif-panel'); if (p) p.classList.remove('open'); }
    }

    function toggleNotifPanel() {
        const panel = document.getElementById('notif-panel');
        const open = panel.classList.contains('open');
        if (open) { panel.classList.remove('open'); return; }
        const notifs = visibleNotifications();
        panel.innerHTML = `
            <div class="notif-head"><span>Notifications</span>
                <button class="btn-link" data-act="mark-read">Mark all read</button></div>
            ${notifs.length ? notifs.map(n => `
                <div class="notif-item ${n.read ? '' : 'unread'}" ${n.rfxId ? `data-act="open-rfx" data-rfx="${esc(n.rfxId)}" style="cursor:pointer"` : ''}>
                    <span class="n-dot" style="${n.read ? 'background:#ccc' : ''}"></span>
                    <div><div style="font-weight:600">${esc(n.title || '')}</div>
                    <div>${esc(n.body || '')}</div>
                    <div class="n-time">${nowLabel(n.ts)}</div></div>
                </div>`).join('') : `<div class="empty-state">No notifications</div>`}`;
        panel.classList.add('open');
        bindActions(panel, {
            'mark-read': () => { window.Store.markAllNotificationsRead(); toggleNotifPanel(); toggleNotifPanel(); },
            'open-rfx': (t) => { panel.classList.remove('open'); go('#/rfx/' + t.getAttribute('data-rfx')); }
        });
        setTimeout(() => document.addEventListener('click', outsideClose, { once: true }), 0);
    }

    /* ---------- navigation drawer ---------- */
    function openNavDrawer() {
        const root = document.getElementById('drawer-root');
        if (!root) return;
        const me = window.Store.currentUser();
        const isCust = window.Workflow.isCustomer(me);
        const ic = {
            list: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
            users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
            plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
        };
        const link = (hash, icon, label) => `<div class="drawer-link" data-go="${hash}">${icon}<span>${esc(label)}</span></div>`;
        const extLink = (url, icon, label) => `<div class="drawer-link" data-href="${esc(url)}">${icon}<span>${esc(label)}</span></div>`;
        const DP_URL = window.DP_URL || 'http://127.0.0.1:8123';
        const ic2 = {
            chart: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
            bag: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`
        };
        root.innerHTML = `
            <div class="drawer-backdrop" data-close="1"></div>
            <aside class="nav-drawer">
                <div class="drawer-head">
                    <img class="logo-img" src="img/logo.svg" alt="dmp">
                    <button class="drawer-close" data-close="1">✕</button>
                </div>
                <div class="drawer-section">Navigation</div>
                ${link('#/rfx', ic.list, 'RFX List')}
                ${isCust ? link('#/rfx/new', ic.plus, 'Create RFX') : ''}
                ${isCust ? link('#/suppliers', ic.users, 'Suppliers') : ''}
                ${isCust ? `
                <div class="drawer-section">Modules</div>
                ${extLink(DP_URL, ic2.chart, 'Demand Planning')}
                <div class="drawer-link drawer-link-active">${ic2.bag}<span>Sourcing</span></div>` : ''}
                <div class="drawer-foot">Acting as <strong>${esc(me.role)}</strong> · ${esc(me.name)}</div>
            </aside>`;
        const close = () => { root.innerHTML = ''; };
        root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
        root.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => {
            const h = el.getAttribute('data-go');
            close();
            if (window.location.hash === h) window.Router.render(); else go(h);
        }));
        root.querySelectorAll('[data-href]').forEach(el => el.addEventListener('click', () => {
            window.location.href = el.getAttribute('data-href');
        }));
    }

    /* ---------- form field builder ---------- */
    function field(opts) {
        // opts: {label, name, value, type:'text|number|date|textarea|select', options, required, readonly, hint, span, error, placeholder}
        const req = opts.required ? '<span class="req">*</span>' : '';
        const spanCls = opts.span ? ('col-span-' + opts.span) : '';
        const cls = (opts.error ? 'error ' : '');
        const ro = opts.readonly ? 'readonly' : '';
        const name = opts.name;
        let control = '';
        if (opts.type === 'textarea') {
            control = `<textarea class="form-textarea ${cls}" name="${name}" ${ro} placeholder="${esc(opts.placeholder || '')}">${esc(opts.value || '')}</textarea>`;
        } else if (opts.type === 'select') {
            const opts2 = (opts.options || []).map(o => {
                let val, lab;
                if (typeof o === 'string') { val = o; lab = o; }
                else { val = o.value; lab = o.label; }
                return `<option value="${esc(val)}" ${String(opts.value) === String(val) ? 'selected' : ''}>${esc(lab)}</option>`;
            }).join('');
            control = `<select class="form-select ${cls}" name="${name}" ${opts.disabled ? 'disabled' : ''}>
                <option value="">${esc(opts.placeholder || 'Select…')}</option>${opts2}</select>`;
        } else {
            const t = opts.type === 'number' ? 'number' : (opts.type === 'date' ? 'datetime-local' : 'text');
            control = `<input class="form-input ${cls}" type="${t}" name="${name}" value="${esc(opts.value === undefined || opts.value === null ? '' : opts.value)}" ${ro} placeholder="${esc(opts.placeholder || '')}"${opts.step ? ` step="${opts.step}"` : ''}>`;
        }
        return `<div class="field ${spanCls}">
            <label class="${opts.required ? 'req-label' : ''}">${esc(opts.label)}${req}</label>
            ${control}
            ${opts.hint ? `<div class="hint">${esc(opts.hint)}</div>` : ''}
            <div class="field-error" data-err="${name}">${opts.error ? esc(opts.error) : ''}</div>
        </div>`;
    }

    /* ---------- breadcrumb band ---------- */
    function breadcrumb() {
        const parts = Array.prototype.slice.call(arguments);
        return `<div class="crumb-band">
            <a class="crumb-muted" href="#/rfx">Sourcing module</a>
            ${parts.map((p, i) => `<span class="crumb-sep">›</span><span class="${i === parts.length - 1 ? 'crumb-cur' : 'crumb-muted'}">${esc(p)}</span>`).join('')}
        </div>`;
    }

    /* ---------- history timeline ---------- */
    function historyList(rfx) {
        if (!rfx.history || !rfx.history.length) return '<div class="muted">No activity yet.</div>';
        return `<div class="history-list">${rfx.history.slice().reverse().map(h => {
            const color = h.action === 'awarded' ? 'var(--primary-green)' : (h.action === 'submitted' ? '#888' : 'var(--info-border)');
            return `<div class="history-item"><span class="h-dot" style="background:${color}"></span>
                <div class="h-body"><strong>${esc(h.actorRole || '')}</strong> — ${esc(h.text)}
                <div class="h-meta">${esc(h.actorUser || '')} · ${nowLabel(h.ts)}</div></div></div>`;
        }).join('')}</div>`;
    }

    window.UI = {
        esc, go, nowLabel, bindActions, ds, money,
        readFileAsDoc, docKB, docChip,
        toast, openModal, closeModals,
        phaseBadge, typeBadge, respBadge, verdictBadge, actionCount,
        renderHeader, historyList, field, breadcrumb
    };
})();
