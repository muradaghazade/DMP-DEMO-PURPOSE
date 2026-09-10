/* ============================================================
   views/rfx-list.js — RFx management list (customer & supplier)
   dmp platform look: breadcrumb band, filter sidebar, search,
   spaced row bands with status dots, pagination.
   ============================================================ */
(function () {
    const U = () => window.UI;
    const W = () => window.Workflow;

    const PHASES = ['Draft', 'Open', 'Closed', 'Awarded', 'Cancelled'];
    const PHASE_LABEL = { Draft: 'Draft', Open: 'Open for bidding', Closed: 'Bidding closed', Awarded: 'Awarded', Cancelled: 'Cancelled' };
    const PHASE_DOT = { Draft: 'dot-draft', Open: 'dot-open', Closed: 'dot-closed', Awarded: 'dot-awarded', Cancelled: 'dot-cancelled' };

    const filters = { q: '', owner: '', supplier: '', from: '', to: '', statuses: [], types: [], collapsed: false };
    const pager = { page: 1, size: 10 };

    function statusCell(rfx) {
        const p = W().phase(rfx);
        return `<span class="st-row"><span class="st-dot ${PHASE_DOT[p]}"></span>${PHASE_LABEL[p]}</span>`;
    }
    function ownerName(rfx) {
        const u = window.Store.users().find(x => x.id === rfx.createdBy);
        return u ? u.name : '—';
    }
    function fmtDay(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }

    function applyFilters(list) {
        const Wf = W();
        return list.filter(r => {
            if (filters.owner && r.createdBy !== filters.owner) return false;
            if (filters.supplier && (r.supplierIds || []).indexOf(filters.supplier) === -1) return false;
            if (filters.statuses.length && filters.statuses.indexOf(Wf.phase(r)) === -1) return false;
            if (filters.types.length && filters.types.indexOf(r.type) === -1) return false;
            if (filters.from && r.deadline && r.deadline < new Date(filters.from + 'T00:00').getTime()) return false;
            if (filters.to && r.deadline && r.deadline > new Date(filters.to + 'T23:59').getTime()) return false;
            if (filters.q) {
                const q = filters.q.toLowerCase();
                const hay = (r.no + ' ' + r.title + ' ' + (r.description || '') + ' ' + ownerName(r)).toLowerCase();
                if (hay.indexOf(q) === -1) return false;
            }
            return true;
        });
    }

    /* ---------- filter sidebar ---------- */
    function filterCard(opts) {
        const ui = U();
        opts = opts || {};
        if (filters.collapsed) {
            return `<aside class="filter-card collapsed"><button class="fc-collapse" data-act="fc-toggle" title="Expand filters">»</button></aside>`;
        }
        return `<aside class="filter-card">
            <button class="fc-collapse" data-act="fc-toggle" title="Collapse filters">«</button>
            <div class="fc-body">
                ${opts.noOwner ? '' : `
                <div class="fc-label">RFx owner</div>
                <select class="form-select" data-flt="owner">
                    <option value="">Select RFx owner</option>
                    ${window.Store.users().filter(u => W().isCustomer(u)).map(u =>
                        `<option value="${u.id}" ${filters.owner === u.id ? 'selected' : ''}>${ui.esc(u.name)}</option>`).join('')}
                </select>`}
                ${opts.noSupplier ? '' : `
                <div class="fc-label">RFx Supplier</div>
                <select class="form-select" data-flt="supplier">
                    <option value="">Select...</option>
                    ${window.Store.suppliers().map(s =>
                        `<option value="${s.id}" ${filters.supplier === s.id ? 'selected' : ''}>${ui.esc(s.name)}</option>`).join('')}
                </select>`}
                <div class="fc-label">RFx type</div>
                ${[['material', 'Material'], ['service', 'Service']].map(t => `
                    <label class="fc-check"><input type="checkbox" data-flt-type="${t[0]}" ${filters.types.indexOf(t[0]) !== -1 ? 'checked' : ''}> ${t[1]}</label>`).join('')}
                <div class="fc-label">Deadline range</div>
                <div class="fc-date-row"><input type="date" class="form-input" data-flt="from" value="${ui.esc(filters.from)}" placeholder="YYYY-MM-DD"></div>
                <div class="fc-date-row"><input type="date" class="form-input" data-flt="to" value="${ui.esc(filters.to)}" placeholder="YYYY-MM-DD"></div>
                <div class="fc-label">Status</div>
                ${(opts.phases || PHASES).map(p => `
                    <label class="fc-check"><input type="checkbox" data-flt-st="${p}" ${filters.statuses.indexOf(p) !== -1 ? 'checked' : ''}> ${PHASE_LABEL[p]}</label>`).join('')}
            </div>
            <div class="fc-clear" data-act="fc-clear">Clear All Filters</div>
        </aside>`;
    }

    /* ---------- pagination ---------- */
    function pagerHtml(total) {
        const pages = Math.max(1, Math.ceil(total / pager.size));
        if (pager.page > pages) pager.page = pages;
        const nums = [];
        for (let i = 1; i <= pages; i++) nums.push(`<button class="pg-num ${i === pager.page ? 'active' : ''}" data-pg="${i}">${i}</button>`);
        return `<div class="rfx-pager">
            <button class="pg-btn" data-act="pg-prev" ${pager.page <= 1 ? 'disabled' : ''}>‹</button>
            ${nums.join('')}
            <button class="pg-btn" data-act="pg-next" ${pager.page >= pages ? 'disabled' : ''}>›</button>
            <span class="pg-show">Show
                <select data-act-size>
                    ${[10, 25, 50].map(n => `<option value="${n}" ${pager.size === n ? 'selected' : ''}>${n} rows</option>`).join('')}
                </select></span>
        </div>`;
    }
    function pageSlice(list) {
        const start = (pager.page - 1) * pager.size;
        return list.slice(start, start + pager.size);
    }

    /* ---------- entry ---------- */
    function rfxList() {
        const me = window.Store.currentUser();
        if (W().isSupplier(me)) return supplierList(me);
        return customerList(me);
    }

    /* ---------------- customer ---------------- */
    function customerList(me) {
        const ui = U(), Wf = W();
        const view = document.getElementById('view');
        const all = window.Store.rfxs().slice().sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0));
        const list = applyFilters(all);
        const rows = pageSlice(list);

        view.innerHTML = `
            ${ui.breadcrumb('RFx management')}
            <div class="rfx-layout">
                ${filterCard({})}
                <div class="rfx-main">
                    <div class="rfx-toolbar">
                        <div class="rfx-search">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input placeholder="Search RFx by number, title, or owner" data-flt="q" value="${ui.esc(filters.q)}">
                        </div>
                        <button class="btn-create" data-act="create">+ Create RFx</button>
                    </div>
                    ${list.length ? `<table class="rfx-table">
                        <thead><tr><th>No</th><th>RFx Number</th><th>Status</th><th>Title/Description</th><th>RFx Owner</th><th>Submission Deadline</th></tr></thead>
                        <tbody>${rows.map((r, i) => `
                            <tr data-act="open" data-id="${r.id}">
                                <td class="rt-no">${(pager.page - 1) * pager.size + i + 1}</td>
                                <td class="rt-num">${ui.esc(r.no)}<div class="rt-sub">${r.type === 'service' ? 'Service' : 'Material'}${r.status !== 'Draft' ? ' · ' + Wf.submittedSupplierIds(r).length + '/' + r.supplierIds.length + ' offers' : ''}</div></td>
                                <td>${statusCell(r)}</td>
                                <td><div class="rt-title">${ui.esc(r.title)}</div>${r.description ? `<div class="rt-sub">${ui.esc(r.description.length > 90 ? r.description.slice(0, 90) + '…' : r.description)}</div>` : ''}</td>
                                <td>${ui.esc(ownerName(r))}</td>
                                <td>${fmtDay(r.deadline)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    ${pagerHtml(list.length)}` : `<div class="empty-state">No RFx matches the current filters.</div>`}
                </div>
            </div>`;

        bindCommon(view, () => window.Views.rfxList());
        ui.bindActions(view, Object.assign(commonActions(view), {
            'open': (t) => ui.go('#/rfx/' + t.getAttribute('data-id')),
            'create': () => createModal()
        }));
    }

    function createModal() {
        const ui = U();
        ui.openModal({
            title: 'Create RFx',
            bodyHtml: `<div style="display:flex;flex-direction:column;gap:10px">
                <div class="sup-pick" data-new="material"><div><div class="sup-name">Material RFx</div>
                    <div class="sup-meta">Items entered by form, uploaded from the shopping-cart Excel template, or migrated from Demand Planning</div></div></div>
                <div class="sup-pick" data-new="service"><div><div class="sup-name">Service RFx</div>
                    <div class="sup-meta">Service lines entered by form or uploaded from the Excel template</div></div></div>
            </div>`,
            buttons: [{ label: 'Cancel', onClick: (o) => o.remove() }],
            onOpen: (o) => o.querySelectorAll('[data-new]').forEach(el => el.addEventListener('click', () => {
                o.remove();
                ui.go('#/rfx/new?type=' + el.getAttribute('data-new'));
            }))
        });
    }

    /* ---------------- supplier ---------------- */
    function supplierList(me) {
        const ui = U(), Wf = W();
        const view = document.getElementById('view');
        const all = window.Store.rfxs()
            .filter(r => r.status !== 'Draft' && r.supplierIds.indexOf(me.supplierId) !== -1)
            .sort((a, b) => (b.publishedTs || 0) - (a.publishedTs || 0));
        const list = applyFilters(all);
        const rows = pageSlice(list);

        view.innerHTML = `
            ${ui.breadcrumb('RFx management')}
            <div class="rfx-layout">
                ${filterCard({ noOwner: true, noSupplier: true, phases: ['Open', 'Closed', 'Awarded'] })}
                <div class="rfx-main">
                    <div class="rfx-toolbar">
                        <div class="rfx-search">
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input placeholder="Search RFx by number or title" data-flt="q" value="${ui.esc(filters.q)}">
                        </div>
                    </div>
                    ${list.length ? `<table class="rfx-table">
                        <thead><tr><th>No</th><th>RFx Number</th><th>Status</th><th>Title/Description</th><th>Submission Deadline</th><th>My offer</th></tr></thead>
                        <tbody>${rows.map((r, i) => {
                            const resp = Wf.responseOf(r, me.supplierId);
                            const st = resp ? resp.status : 'invited';
                            const won = r.status === 'Awarded' ? Object.keys(r.awards || {}).filter(k => r.awards[k].supplierId === me.supplierId).length : 0;
                            return `<tr data-act="open" data-id="${r.id}">
                                <td class="rt-no">${(pager.page - 1) * pager.size + i + 1}</td>
                                <td class="rt-num">${ui.esc(r.no)}<div class="rt-sub">${r.type === 'service' ? 'Service' : 'Material'} · ${(r.items || []).length} items</div></td>
                                <td>${statusCell(r)}</td>
                                <td><div class="rt-title">${ui.esc(r.title)}</div>${r.description ? `<div class="rt-sub">${ui.esc(r.description.length > 90 ? r.description.slice(0, 90) + '…' : r.description)}</div>` : ''}</td>
                                <td>${fmtDay(r.deadline)}<div class="rt-sub">${Wf.phase(r) === 'Open' ? Wf.timeLeft(r) : ''}</div></td>
                                <td>${ui.respBadge(st)}${Wf.pendingNegRequests(r, me.supplierId).length ? `<div style="margin-top:4px"><span class="awarded-chip" style="background:var(--warn-text)">⇄ Negotiation</span></div>` : ''}${won ? `<div style="margin-top:4px"><span class="awarded-chip">Won ${won} item${won > 1 ? 's' : ''}</span></div>` : ''}</td>
                            </tr>`;
                        }).join('')}</tbody>
                    </table>
                    ${pagerHtml(list.length)}` : `<div class="empty-state">No RFx yet — you will see new requests here when a customer invites you.</div>`}
                </div>
            </div>`;

        bindCommon(view, () => window.Views.rfxList());
        ui.bindActions(view, Object.assign(commonActions(view), {
            'open': (t) => {
                const r = window.Store.rfxById(t.getAttribute('data-id'));
                ui.go(Wf.phase(r) === 'Open' ? ('#/rfx/' + r.id + '/respond') : ('#/rfx/' + r.id));
            }
        }));
    }

    /* ---------- shared filter/pager bindings ---------- */
    function bindCommon(view, rerender) {
        view.querySelectorAll('[data-flt]').forEach(el => {
            const f = el.getAttribute('data-flt');
            el.addEventListener(el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input', () => {
                filters[f] = el.value;
                pager.page = 1;
                rerender();
                if (f === 'q') {
                    const nf = view.querySelector('[data-flt="q"]');
                    if (nf) { nf.focus(); nf.setSelectionRange(nf.value.length, nf.value.length); }
                }
            });
        });
        view.querySelectorAll('[data-flt-type]').forEach(cb => cb.addEventListener('change', () => {
            const t = cb.getAttribute('data-flt-type');
            if (cb.checked) { if (filters.types.indexOf(t) === -1) filters.types.push(t); }
            else filters.types = filters.types.filter(x => x !== t);
            pager.page = 1;
            rerender();
        }));
        view.querySelectorAll('[data-flt-st]').forEach(cb => cb.addEventListener('change', () => {
            const p = cb.getAttribute('data-flt-st');
            if (cb.checked) { if (filters.statuses.indexOf(p) === -1) filters.statuses.push(p); }
            else filters.statuses = filters.statuses.filter(x => x !== p);
            pager.page = 1;
            rerender();
        }));
        view.querySelectorAll('[data-pg]').forEach(b => b.addEventListener('click', () => {
            pager.page = Number(b.getAttribute('data-pg'));
            rerender();
        }));
        const size = view.querySelector('[data-act-size]');
        if (size) size.addEventListener('change', () => { pager.size = Number(size.value); pager.page = 1; rerender(); });
    }
    function commonActions(view) {
        return {
            'fc-toggle': () => { filters.collapsed = !filters.collapsed; window.Views.rfxList(); },
            'fc-clear': () => {
                filters.q = ''; filters.owner = ''; filters.supplier = ''; filters.from = ''; filters.to = ''; filters.statuses = []; filters.types = [];
                pager.page = 1;
                window.Views.rfxList();
            },
            'pg-prev': () => { if (pager.page > 1) { pager.page -= 1; window.Views.rfxList(); } },
            'pg-next': () => { pager.page += 1; window.Views.rfxList(); }
        };
    }

    window.Views = window.Views || {};
    window.Views.rfxList = rfxList;
})();
