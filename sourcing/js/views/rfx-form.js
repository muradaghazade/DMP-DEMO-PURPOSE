/* ============================================================
   views/rfx-form.js — create / edit an RFX (customer)
   Items arrive three ways: manual form, Excel/CSV template upload,
   or a shopping-cart handoff pushed from the Demand Planning module.
   ============================================================ */
(function () {
    const U = () => window.UI;
    const W = () => window.Workflow;

    let draft = null;        // working copy — committed to the store on save/send
    let editingId = null;    // rfx id when editing an existing draft

    /* ---- draft stash: survives the round-trip to the Demand Planning module
       ("Select from Material Master" → add to cart there → handoff back) ---- */
    const DP_URL = window.DP_URL || 'http://127.0.0.1:8123';
    const STASH_KEY = 'dmp_sourcing_pending_draft';
    function stashDraft() {
        try { localStorage.setItem(STASH_KEY, JSON.stringify({ draft, editingId, ts: Date.now() })); } catch (e) { /* ignore */ }
    }
    function popStash() {
        try {
            const raw = localStorage.getItem(STASH_KEY);
            localStorage.removeItem(STASH_KEY);
            if (!raw) return null;
            const st = JSON.parse(raw);
            // a stash older than an hour is a leftover, not a round-trip
            if (!st.ts || Date.now() - st.ts > 3600000) return null;
            return st;
        } catch (e) { return null; }
    }

    /* ---------------- item field templates ---------------- */
    function blankItem(type) {
        const base = { id: window.Store.uid('it'), shortDesc: '', longDesc: '', uom: '', category: '', notes: '' };
        if (type === 'service') return Object.assign(base, { qty: '' });
        return Object.assign(base, {
            sapId: '', internalId: '', manufacturerName: '', manufacturerPartNo: '',
            demandQty: '', lotSize: '', plant: '', unspsc: '', attrs: {}
        });
    }

    // Excel header aliases → item field (material template mirrors the
    // bid-evaluation template's buyer-side field names and labels)
    const MAT_ALIASES = {
        sapId: ['customer_unique_id', 'sap_id', 'sap id'],
        internalId: ['internal_id', 'internal id'],
        shortDesc: ['short_description', 'short description'],
        longDesc: ['long_description', 'long description'],
        manufacturerName: ['manufacturer_name', 'manufacturer name'],
        manufacturerPartNo: ['manufacturer_part_no', 'manufacturer part number'],
        uom: ['uom_customer', 'uom (buyer)', 'uom'],
        demandQty: ['demand_qty', 'average annual demand', 'quantity', 'qty'],
        lotSize: ['lot_size_customer', 'lot_size_cust', 'lot size (buyer)', 'lot size'],
        plant: ['plant'],
        category: ['category'],
        notes: ['customer_notes', 'customer notes', 'notes']
    };
    const SRV_ALIASES = {
        shortDesc: ['short_description', 'short description', 'service', 'description'],
        longDesc: ['long_description', 'long description', 'scope'],
        qty: ['quantity', 'qty', 'demand_qty'],
        uom: ['uom', 'uom_customer'],
        category: ['category'],
        notes: ['notes', 'customer_notes']
    };

    function templateCsv(type) {
        if (type === 'service') {
            return 'item_index,short_description,long_description,quantity,uom,category,notes\r\n' +
                '1,Sample service line,Describe the scope of work here,10,HR,General Services,\r\n';
        }
        return 'item_index,customer_unique_id,internal_id,short_description,long_description,manufacturer_name,manufacturer_part_no,uom_customer,demand_qty,lot_size_customer,plant,category,customer_notes\r\n' +
            '1,400000123,,BEARING BALL 6312-2Z/C3,Deep groove ball bearing 60x130x31 mm,SKF,6312-2Z/C3,EA,120,1,1700,Mechanical Spare Parts,\r\n';
    }

    function importRows(rows, type) {
        const aliases = type === 'service' ? SRV_ALIASES : MAT_ALIASES;
        rows = (rows || []).filter(r => r && r.some(c => String(c || '').trim() !== ''));
        if (rows.length < 2) throw new Error('The file has no data rows below the header.');
        // header row: the first row matching at least two known column names
        let hIdx = -1, map = null;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
            const cells = rows[i].map(c => String(c || '').trim().toLowerCase());
            const m = {};
            Object.keys(aliases).forEach(f => {
                const ci = cells.findIndex(c => aliases[f].indexOf(c) !== -1);
                if (ci !== -1) m[f] = ci;
            });
            if (Object.keys(m).length >= 2) { hIdx = i; map = m; break; }
        }
        if (hIdx === -1) throw new Error('Could not find a header row. Use the downloadable template.');
        const items = [];
        for (let i = hIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const get = (f) => map[f] === undefined ? '' : String(row[map[f]] || '').trim();
            if (!get('shortDesc') && !get('longDesc')) continue;
            const it = blankItem(type);
            Object.keys(map).forEach(f => { it[f] = get(f); });
            items.push(it);
        }
        if (!items.length) throw new Error('No item rows found below the header.');
        return items;
    }

    /* ---------------- Demand Planning handoff ---------------- */
    function pullHandoff(id) {
        fetch('/api/handoff/' + encodeURIComponent(id))
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null)
            .then(payload => {
                // static host: the cart travels via shared-origin localStorage instead
                if (!payload) {
                    try {
                        const raw = localStorage.getItem('dmp_handoff_' + id);
                        if (raw) { payload = JSON.parse(raw); localStorage.removeItem('dmp_handoff_' + id); }
                    } catch (e) { /* ignore */ }
                }
                if (!payload || !Array.isArray(payload.items) || !payload.items.length) {
                    U().toast({ kind: 'error', title: 'Migration failed', body: 'The Demand Planning cart could not be loaded.' });
                    return;
                }
                payload.items.forEach(src => {
                    const it = blankItem('material');
                    it.sapId = src.sapId || src.materialNumber || '';
                    it.internalId = src.internalId || src.id || '';
                    it.shortDesc = src.shortName || src.shortDesc || src.name || '';
                    it.longDesc = src.longDesc || '';
                    it.manufacturerName = src.manufacturer || src.manufacturerName || '';
                    it.manufacturerPartNo = src.partNumber || src.manufacturerPartNo || '';
                    it.uom = src.uom || src.baseUom || 'EA';
                    it.demandQty = src.qty || src.demandQty || '';
                    it.plant = src.plant || '';
                    // the DP category catalog is mirrored here — adopt the UNSPSC
                    // (and its attribute values) when it exists in our catalog
                    const schema = catSchema(src.unspsc);
                    it.unspsc = schema ? src.unspsc : '';
                    it.category = schema ? schema.label : (src.category || '');
                    it.attrs = (src.attrs && typeof src.attrs === 'object') ? src.attrs : {};
                    draft.items.push(it);
                });
                if (payload.title && !draft.title) draft.title = payload.title;
                U().toast({ title: 'Cart migrated', body: payload.items.length + ' item(s) imported from Demand Planning.' });
                render();
            })
            .catch(() => U().toast({ kind: 'error', title: 'Migration failed', body: 'Could not reach the handoff endpoint.' }));
    }

    /* ---------------- entry ---------------- */
    function rfxForm(id, query) {
        const me = window.Store.currentUser();
        if (!W().isCustomer(me)) { U().go('#/rfx'); return; }
        query = query || {};
        if (id) {
            const src = window.Store.rfxById(id);
            if (!src) { U().go('#/rfx'); return; }
            if (src.status !== 'Draft') { U().go('#/rfx/' + id); return; }
            if (editingId !== id || !draft) draft = JSON.parse(JSON.stringify(src));
            editingId = id;
        } else {
            const type = query.type === 'service' ? 'service' : 'material';
            // returning from the Material Master round-trip: restore the draft
            // the user left behind, so the handoff items get APPENDED to it
            let restored = false;
            if (query.handoff) {
                const st = popStash();
                if (st && st.draft && st.draft.type === type) {
                    draft = st.draft;
                    editingId = st.editingId || null;
                    delete draft.__handoffDone;
                    restored = true;
                }
            }
            if (!restored) {
                if (!draft || editingId !== null || draft.type !== type) {
                    draft = {
                        id: window.Store.uid('rfx'), type,
                        title: '', description: '', category: '', deadline: null,
                        items: [], questions: [], supplierIds: [],
                        responses: {}, techEval: {}, awards: {}, history: []
                    };
                }
                editingId = null;
            }
            if (query.handoff && !draft.__handoffDone) {
                draft.__handoffDone = true;
                pullHandoff(query.handoff);
            }
        }
        render();
    }

    function dlToInput(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    /* ---------------- render ---------------- */
    function render() {
        const ui = U();
        const view = document.getElementById('view');
        const isService = draft.type === 'service';
        const dsets = ui.ds();

        view.innerHTML = `${ui.breadcrumb('RFx management', editingId ? draft.no : 'New RFx')}<div class="page-full form-page">
            <div class="req-head">
                <div>
                    <div class="req-eyebrow">${editingId ? draft.no : 'New RFX'}</div>
                    <div class="req-title">${isService ? 'Service RFX' : 'Material RFX'}</div>
                </div>
                <div class="req-head-right">${ui.typeBadge(draft)}<span class="status-pill st-draft">Draft</span></div>
            </div>

            <div class="panel-card">
                <div class="pc-title">RFX details</div>
                <div class="form-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
                    ${ui.field({ label: 'RFX Title', name: 'f_title', value: draft.title, required: true, span: 2, placeholder: 'e.g. Rotating equipment spares — annual demand' })}
                    <div class="field">
                        <label>Scope Category</label>
                        <div class="scope-cats">${scopeCategories(draft.items).length
                            ? scopeCategories(draft.items).map(s => `<span class="scope-chip">${ui.esc(s.label)} <strong>${s.pct}%</strong></span>`).join('')
                            : '<span class="muted">—</span>'}</div>
                        <div class="hint">Selected automatically from the added items</div>
                    </div>
                    ${ui.field({ label: 'Description', name: 'f_desc', value: draft.description, type: 'textarea', span: 2, placeholder: 'Scope, validity, commercial expectations…' })}
                    ${ui.field({ label: 'Submission deadline', name: 'f_deadline', value: dlToInput(draft.deadline), type: 'date', required: true, hint: 'Suppliers can submit offers until this moment' })}
                </div>
            </div>

            <div class="panel-card">
                <div class="pc-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                    <span>Items (${draft.items.length})</span>
                    <span style="display:flex;gap:8px;flex-wrap:wrap">
                        ${isService ? '' : `<button class="btn btn-outline btn-sm" data-act="pick-master">☰ Select from Material Master</button>`}
                        <button class="btn btn-outline btn-sm" data-act="dl-template">⤓ Download template</button>
                        <button class="btn btn-outline btn-sm" data-act="upload">⤒ Upload Excel template</button>
                        <button class="btn btn-green-outline btn-sm" data-act="add-item">+ Add item</button>
                    </span>
                </div>
                <input type="file" accept=".xlsx,.csv" style="display:none" id="xls-input">
                ${itemsTable()}
            </div>

            <div class="panel-card">
                <div class="pc-title" style="display:flex;justify-content:space-between;align-items:center">
                    <span>Technical questions (${draft.questions.length})</span>
                    <button class="btn btn-green-outline btn-sm" data-act="add-q">+ Add question</button>
                </div>
                <div class="muted" style="margin-bottom:10px">Suppliers must answer these in the technical envelope. Every question allows an optional supplier attachment.</div>
                ${questionsList()}
            </div>

            <div class="panel-card">
                <div class="pc-title">Select suppliers (${draft.supplierIds.length})</div>
                <div class="rfx-search" style="margin-bottom:12px;max-width:380px">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input data-sup-search placeholder="Search suppliers by name, location, or category">
                </div>
                <div id="no-sup-match" class="muted hidden" style="padding:6px 2px">No suppliers match the search.</div>
                ${window.Store.suppliers().map(sup => `
                    <label class="sup-pick ${draft.supplierIds.indexOf(sup.id) !== -1 ? 'selected' : ''}">
                        <input type="checkbox" data-sup="${sup.id}" ${draft.supplierIds.indexOf(sup.id) !== -1 ? 'checked' : ''}>
                        <div><div class="sup-name">${ui.esc(sup.name)}</div>
                        <div class="sup-meta">${ui.esc(sup.city)}, ${ui.esc(sup.country)} · ${ui.esc(sup.email)} · ${(sup.categories || []).map(ui.esc).join(', ')}</div></div>
                    </label>`).join('')}
            </div>

            <div class="form-actions" style="display:flex;gap:10px;justify-content:flex-end;margin:18px 0 40px">
                <button class="btn btn-outline" data-act="back">Cancel</button>
                <button class="btn btn-black" data-act="save">Save draft</button>
                <button class="btn btn-green" data-act="send">Send to suppliers</button>
            </div>
        </div>`;

        bind(view);
    }

    function itemsTable() {
        const ui = U();
        if (!draft.items.length) return '<div class="empty-state">No items yet — add them by form, Excel upload, or select them from the Material Master.</div>';
        const isService = draft.type === 'service';
        const head = isService
            ? '<th>#</th><th>Short Description</th><th>Long Description</th><th>Quantity</th><th>UoM</th><th>Category</th><th></th>'
            : '<th>#</th><th>SAP ID</th><th>Short Description</th><th>Manufacturer</th><th>Part №</th><th>UoM</th><th>Quantity</th><th>Category</th><th>Plant</th><th></th>';
        return `<div class="inbox-table-wrap"><table class="data-table">
            <thead><tr>${head}</tr></thead>
            <tbody>${draft.items.map((it, i) => isService ? `
                <tr><td>${i + 1}</td>
                    <td style="font-weight:600">${ui.esc(it.shortDesc)}</td>
                    <td class="muted">${ui.esc(it.longDesc || '—')}</td>
                    <td>${ui.esc(it.qty)}</td><td>${ui.esc(it.uom)}</td><td>${ui.esc(it.category || '—')}</td>
                    <td style="white-space:nowrap"><button class="btn-view" data-act="edit-item" data-i="${i}">Edit</button>
                        <button class="btn-view btn-view-danger" data-act="del-item" data-i="${i}">✕</button></td></tr>` : `
                <tr><td>${i + 1}</td>
                    <td>${ui.esc(it.sapId || '—')}</td>
                    <td style="font-weight:600">${ui.esc(it.shortDesc)}</td>
                    <td>${ui.esc(it.manufacturerName || '—')}</td>
                    <td>${ui.esc(it.manufacturerPartNo || '—')}</td>
                    <td>${ui.esc(it.uom)}</td><td>${ui.esc(it.demandQty)}</td><td>${ui.esc(it.category || '—')}</td><td>${ui.esc(it.plant || '—')}</td>
                    <td style="white-space:nowrap"><button class="btn-view" data-act="edit-item" data-i="${i}">Edit</button>
                        <button class="btn-view btn-view-danger" data-act="del-item" data-i="${i}">✕</button></td></tr>`).join('')}
            </tbody></table></div>`;
    }

    function questionsList() {
        const ui = U();
        if (!draft.questions.length) return '<div class="empty-state">No questions yet.</div>';
        const typeLabel = (k) => (ui.ds().QUESTION_TYPES.find(t => t.key === k) || {}).label || k;
        return draft.questions.map((q, i) => `
            <div class="q-row">
                <div class="q-row-head">
                    <span class="q-no">Q${i + 1}</span>
                    <span class="q-text">${ui.esc(q.text)}</span>
                    <span style="white-space:nowrap"><button class="btn-view" data-act="edit-q" data-i="${i}">Edit</button>
                        <button class="btn-view btn-view-danger" data-act="del-q" data-i="${i}">✕</button></span>
                </div>
                <div class="q-meta">
                    <span class="q-type-chip">${ui.esc(typeLabel(q.type))}</span>
                    ${q.required ? '<span class="q-req-chip">Required</span>' : '<span class="muted" style="font-size:11px">Optional</span>'}
                    ${q.attachment ? ui.docChip(q.attachment) : ''}
                </div>
            </div>`).join('');
    }

    /* ---------------- category attributes (UNSPSC catalog) ---------------- */
    function catSchema(unspsc) {
        return (U().ds().CATEGORY_ATTRIBUTES || []).find(c => c.unspsc === unspsc) || null;
    }
    // one input per schema attribute — ALL optional in Sourcing, whatever the
    // Demand Planning schema says about mandatory
    function attrFieldsHtml(unspsc, values) {
        const ui = U();
        const schema = catSchema(unspsc);
        if (!schema) return '<div class="muted" style="font-size:12px">Select a category to fill its technical attributes (optional).</div>';
        values = values || {};
        return `<div class="form-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            ${schema.attributes.map(a => {
                const label = a.name + (a.uom ? ' (' + a.uom + ')' : '');
                const val = values[a.name] === undefined ? '' : values[a.name];
                let control;
                if (a.fieldType === 'List') {
                    const opts = String(a.options || '').split(',').map(x => x.trim()).filter(Boolean);
                    control = `<select class="form-select" data-attr="${ui.esc(a.name)}"><option value="">Select…</option>
                        ${opts.map(o => `<option value="${ui.esc(o)}" ${String(val) === o ? 'selected' : ''}>${ui.esc(o)}</option>`).join('')}</select>`;
                } else if (a.fieldType === 'Yes/No') {
                    control = `<select class="form-select" data-attr="${ui.esc(a.name)}"><option value="">Select…</option>
                        <option value="Yes" ${val === 'Yes' ? 'selected' : ''}>Yes</option><option value="No" ${val === 'No' ? 'selected' : ''}>No</option></select>`;
                } else if (a.fieldType === 'Number') {
                    control = `<input class="form-input" type="number" step="any" data-attr="${ui.esc(a.name)}" value="${ui.esc(val)}">`;
                } else if (a.fieldType === 'Date') {
                    control = `<input class="form-input" type="date" data-attr="${ui.esc(a.name)}" value="${ui.esc(val)}">`;
                } else {   // Text / Range
                    control = `<input class="form-input" data-attr="${ui.esc(a.name)}" value="${ui.esc(val)}" ${a.fieldType === 'Range' ? 'placeholder="min – max"' : ''}>`;
                }
                return `<div class="field"><label>${ui.esc(label)}</label>${control}</div>`;
            }).join('')}
        </div>`;
    }
    function attrsLine(it) {
        const e = Object.entries(it.attrs || {}).filter(([, v]) => v !== '' && v !== undefined && v !== null);
        return e.length ? e.map(([k, v]) => k + ': ' + v).join(' · ') : '';
    }

    /* ---------------- scope categories ----------------
       Derived automatically from the added items: each item's category counts
       toward a share; multiple categories show with their percentages. */
    function scopeCategories(items) {
        const counts = {};
        (items || []).forEach(it => {
            const c = (it.category || '').trim() || 'Uncategorised';
            counts[c] = (counts[c] || 0) + 1;
        });
        const total = (items || []).length;
        if (!total) return [];
        const list = Object.keys(counts).map(c => ({ label: c, pct: Math.round(counts[c] / total * 100) }))
            .sort((a, b) => b.pct - a.pct);
        // rounding drift lands on the biggest share so the chips sum to 100
        const drift = 100 - list.reduce((t, s) => t + s.pct, 0);
        if (list.length) list[0].pct += drift;
        return list;
    }
    function scopeCategoryString(items) {
        return scopeCategories(items).map(s => s.label + ' ' + s.pct + '%').join(' · ');
    }

    /* ---------------- item title suggestions (Google-style hints) ----------
       Corpus = items from previously created RFXes (newest first) + the seeded
       suggestion catalog; picking one autofills the whole item form. */
    function itemSuggestions(type) {
        const seedList = (U().ds().ITEM_SUGGESTIONS || []).filter(s => (s.type || 'material') === type);
        const seen = new Set(seedList.map(s => s.shortDesc.toLowerCase()));
        const fromRfxs = [];
        window.Store.rfxs().forEach(r => {
            if (r.type !== type) return;
            (r.items || []).forEach(it => {
                const k = (it.shortDesc || '').toLowerCase();
                if (!k || seen.has(k)) return;
                seen.add(k);
                fromRfxs.push(it);
            });
        });
        return fromRfxs.concat(seedList);
    }

    function bindSuggest(o, isService) {
        const ui = U();
        const inp = o.querySelector('[name="i_shortDesc"]');
        if (!inp) return;
        const field = inp.closest('.field');
        field.style.position = 'relative';
        const box = document.createElement('div');
        box.className = 'suggest-box hidden';
        field.appendChild(box);
        let list = [], hi = -1;
        const close = () => { box.classList.add('hidden'); hi = -1; };
        const renderBox = () => {
            if (!list.length) { close(); return; }
            box.style.top = (inp.offsetTop + inp.offsetHeight + 2) + 'px';
            box.innerHTML = list.map((s, i) => `<div class="suggest-item ${i === hi ? 'active' : ''}" data-i="${i}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span><span class="sg-title">${ui.esc(s.shortDesc)}</span>
                <span class="sg-sub">${ui.esc([s.manufacturerName, s.category].filter(Boolean).join(' · '))}</span></span>
            </div>`).join('');
            box.classList.remove('hidden');
        };
        const search = () => {
            const q = inp.value.trim().toLowerCase();
            if (q.length < 2) { close(); return; }
            const starts = [], contains = [];
            itemSuggestions(isService ? 'service' : 'material').forEach(s => {
                const t = (s.shortDesc || '').toLowerCase();
                const hay = t + ' ' + (s.manufacturerName || '').toLowerCase() + ' ' + (s.category || '').toLowerCase();
                if (t.indexOf(q) === 0) starts.push(s);
                else if (hay.indexOf(q) !== -1) contains.push(s);
            });
            list = starts.concat(contains).slice(0, 8);
            hi = -1;
            renderBox();
        };
        const pick = (s) => {
            close();
            const set = (n, v) => { const el = o.querySelector(`[name="i_${n}"]`); if (el && v !== undefined) el.value = v; };
            ['sapId', 'internalId', 'shortDesc', 'longDesc', 'manufacturerName', 'manufacturerPartNo', 'uom', 'lotSize', 'plant', 'notes'].forEach(k => set(k, s[k]));
            if (isService) {
                set('category', s.category);
            } else {
                const sel = o.querySelector('[name="i_unspsc"]');
                if (sel) {
                    sel.value = s.unspsc || '';
                    const ab = o.querySelector('#attr-box');
                    if (ab) ab.innerHTML = attrFieldsHtml(s.unspsc || '', s.attrs || {});
                }
            }
        };
        inp.addEventListener('input', search);
        inp.addEventListener('keydown', (e) => {
            if (box.classList.contains('hidden')) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, list.length - 1); renderBox(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); renderBox(); }
            else if (e.key === 'Enter') { if (hi >= 0) { e.preventDefault(); pick(list[hi]); } }
            else if (e.key === 'Escape') close();
        });
        // mousedown (not click) so the pick wins the race against the input's blur
        box.addEventListener('mousedown', (e) => {
            const t = e.target.closest('.suggest-item');
            if (t) { e.preventDefault(); pick(list[Number(t.getAttribute('data-i'))]); }
        });
        inp.addEventListener('blur', () => setTimeout(close, 150));
    }

    /* ---------------- item modal ---------------- */
    function itemModal(index) {
        const ui = U();
        const isService = draft.type === 'service';
        const it = index === undefined ? blankItem(draft.type) : JSON.parse(JSON.stringify(draft.items[index]));
        const dsets = ui.ds();
        const f = ui.field;
        const body = isService ? `
            <div class="form-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                ${f({ label: 'Short Description', name: 'i_shortDesc', value: it.shortDesc, required: true, span: 2 })}
                ${f({ label: 'Long Description', name: 'i_longDesc', value: it.longDesc, type: 'textarea', span: 2 })}
                ${f({ label: 'Quantity', name: 'i_qty', value: it.qty, type: 'number', required: true })}
                ${f({ label: 'UoM', name: 'i_uom', value: it.uom, type: 'select', required: true, options: dsets.UOM })}
                ${f({ label: 'Category', name: 'i_category', value: it.category, type: 'select', options: dsets.RFX_CATEGORIES })}
                ${f({ label: 'Notes', name: 'i_notes', value: it.notes })}
            </div>` : `
            <div class="form-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                ${f({ label: 'SAP ID', name: 'i_sapId', value: it.sapId, required: true, hint: 'Preferred identifier — used to match historical purchases' })}
                ${f({ label: 'Internal ID', name: 'i_internalId', value: it.internalId })}
                ${f({ label: 'Short Description', name: 'i_shortDesc', value: it.shortDesc, required: true, span: 2 })}
                ${f({ label: 'Long Description', name: 'i_longDesc', value: it.longDesc, type: 'textarea', span: 2 })}
                ${f({ label: 'Manufacturer Name', name: 'i_manufacturerName', value: it.manufacturerName })}
                ${f({ label: 'Manufacturer Part Number', name: 'i_manufacturerPartNo', value: it.manufacturerPartNo })}
                ${f({ label: 'UoM', name: 'i_uom', value: it.uom, type: 'select', required: true, options: dsets.UOM })}
                ${f({ label: 'Quantity', name: 'i_demandQty', value: it.demandQty, type: 'number', required: true })}
                ${f({ label: 'Lot size', name: 'i_lotSize', value: it.lotSize, type: 'number' })}
                ${f({ label: 'Plant', name: 'i_plant', value: it.plant })}
                ${f({ label: 'Category (UNSPSC)', name: 'i_unspsc', value: it.unspsc, type: 'select',
                    options: (dsets.CATEGORY_ATTRIBUTES || []).map(c => ({ value: c.unspsc, label: c.unspsc + ' — ' + c.label })),
                    hint: 'From the Demand Planning category catalog' })}
                ${f({ label: 'Notes', name: 'i_notes', value: it.notes })}
            </div>
            <div class="rb-title" style="margin:16px 0 8px">Technical attributes <span class="muted" style="font-weight:400;font-size:12px">— all optional</span></div>
            <div id="attr-box">${attrFieldsHtml(it.unspsc, it.attrs)}</div>`;
        ui.openModal({
            title: index === undefined ? 'Add item' : 'Edit item', wide: true, bodyHtml: body,
            buttons: [
                { label: 'Cancel', onClick: (o) => o.remove() },
                { label: 'Save', cls: 'btn-green', onClick: (o) => {
                    const g = (n) => { const el = o.querySelector(`[name="i_${n}"]`); return el ? el.value.trim() : ''; };
                    const need = isService ? ['shortDesc', 'qty', 'uom'] : ['sapId', 'shortDesc', 'uom', 'demandQty'];
                    let ok = true;
                    need.forEach(n => {
                        const el = o.querySelector(`[name="i_${n}"]`);
                        const bad = !g(n);
                        if (el) el.classList.toggle('error', bad);
                        if (bad) ok = false;
                    });
                    if (!ok) return;
                    Object.keys(it).forEach(k => { if (k !== 'id') { const v = g(k); if (o.querySelector(`[name="i_${k}"]`)) it[k] = v; } });
                    if (!isService) {
                        const schema = catSchema(it.unspsc);
                        it.category = schema ? schema.label : '';
                        const attrs = {};
                        o.querySelectorAll('[data-attr]').forEach(el => {
                            if (el.value.trim() !== '') attrs[el.getAttribute('data-attr')] = el.value.trim();
                        });
                        it.attrs = attrs;
                    }
                    if (index === undefined) draft.items.push(it); else draft.items[index] = it;
                    o.remove(); render();
                } }
            ],
            onOpen: (o) => {
                bindSuggest(o, isService);
                const sel = o.querySelector('[name="i_unspsc"]');
                if (sel) sel.addEventListener('change', () => {
                    // keep values already typed for attributes that share a name
                    const cur = {};
                    o.querySelectorAll('[data-attr]').forEach(el => {
                        if (el.value.trim() !== '') cur[el.getAttribute('data-attr')] = el.value.trim();
                    });
                    o.querySelector('#attr-box').innerHTML = attrFieldsHtml(sel.value, cur);
                });
            }
        });
    }

    /* ---------------- question modal ---------------- */
    function questionModal(index) {
        const ui = U();
        const q = index === undefined
            ? { id: window.Store.uid('q'), type: 'yesno', text: '', required: true, attachment: null }
            : JSON.parse(JSON.stringify(draft.questions[index]));
        const dsets = ui.ds();
        const tplHtml = (type) => (dsets.QUESTION_TEMPLATES[type] || []).map(t =>
            `<div class="q-tpl" data-tpl="${ui.esc(t)}">💡 ${ui.esc(t)}</div>`).join('');
        ui.openModal({
            title: index === undefined ? 'Add question' : 'Edit question', wide: true,
            bodyHtml: `
                ${ui.field({ label: 'Question type', name: 'q_type', value: q.type, type: 'select', required: true, options: dsets.QUESTION_TYPES.map(t => ({ value: t.key, label: t.label })) })}
                ${ui.field({ label: 'Question', name: 'q_text', value: q.text, type: 'textarea', required: true, placeholder: 'What do you want the supplier to answer?' })}
                <div class="q-templates"><div class="muted" style="font-size:11px;font-weight:700;margin-bottom:4px">SUGGESTED QUESTIONS — click to use</div>
                    <div id="q-tpl-box">${tplHtml(q.type)}</div></div>
                <label class="checkbox-label" style="display:flex;align-items:center;gap:8px;margin-top:12px">
                    <input type="checkbox" name="q_required" ${q.required ? 'checked' : ''}> Required — supplier cannot submit without answering</label>
                <div style="margin-top:12px">
                    <div style="font-weight:600;font-size:13px;margin-bottom:4px">Reference attachment <span class="muted">(optional — e.g. a spec or drawing the question refers to)</span></div>
                    <div id="q-att-box">${q.attachment ? ui.docChip(q.attachment, 'q-att-del') : ''}</div>
                    <input type="file" name="q_file" style="margin-top:4px">
                </div>`,
            buttons: [
                { label: 'Cancel', onClick: (o) => o.remove() },
                { label: 'Save', cls: 'btn-green', onClick: (o) => {
                    const text = o.querySelector('[name="q_text"]').value.trim();
                    if (!text) { o.querySelector('[name="q_text"]').classList.add('error'); return; }
                    q.type = o.querySelector('[name="q_type"]').value;
                    q.text = text;
                    q.required = o.querySelector('[name="q_required"]').checked;
                    if (index === undefined) draft.questions.push(q); else draft.questions[index] = q;
                    o.remove(); render();
                } }
            ],
            onOpen: (o) => {
                o.querySelector('[name="q_type"]').addEventListener('change', (e) => {
                    o.querySelector('#q-tpl-box').innerHTML = tplHtml(e.target.value);
                });
                o.addEventListener('click', (e) => {
                    const tpl = e.target.closest('[data-tpl]');
                    if (tpl) o.querySelector('[name="q_text"]').value = tpl.getAttribute('data-tpl');
                    const del = e.target.closest('[data-act="q-att-del"]');
                    if (del) { q.attachment = null; o.querySelector('#q-att-box').innerHTML = ''; }
                });
                o.querySelector('[name="q_file"]').addEventListener('change', (e) => {
                    U().readFileAsDoc(e.target.files[0], (doc) => {
                        q.attachment = doc;
                        o.querySelector('#q-att-box').innerHTML = U().docChip(doc, 'q-att-del');
                    });
                });
            }
        });
    }

    /* ---------------- collect + save / send ---------------- */
    function collect(view) {
        const g = (n) => { const el = view.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ''; };
        draft.title = g('f_title');
        draft.description = g('f_desc');
        draft.category = scopeCategoryString(draft.items);   // derived from the items
        const dl = g('f_deadline');
        draft.deadline = dl ? new Date(dl).getTime() : null;
    }

    function validate(view, forSend) {
        collect(view);
        const errs = [];
        const mark = (n, msg) => {
            const el = view.querySelector(`[name="${n}"]`);
            if (el) el.classList.add('error');
            const er = view.querySelector(`[data-err="${n}"]`);
            if (er) er.textContent = msg;
            errs.push(msg);
        };
        view.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => el.classList.remove('error'));
        view.querySelectorAll('.field-error').forEach(el => el.textContent = '');
        if (!draft.title) mark('f_title', 'Title is required.');
        if (!draft.deadline) mark('f_deadline', 'Submission deadline is required.');
        else if (forSend && draft.deadline <= Date.now()) mark('f_deadline', 'Deadline must be in the future.');
        if (forSend) {
            if (!draft.items.length) errs.push('Add at least one item.');
            if (!draft.questions.length) errs.push('Add at least one technical question.');
            if (!draft.supplierIds.length) errs.push('Select at least one supplier.');
        }
        if (errs.length) U().toast({ kind: 'error', title: forSend ? 'Cannot send RFX' : 'Cannot save', body: errs[0] });
        return !errs.length;
    }

    function commit(status) {
        const me = window.Store.currentUser();
        delete draft.__handoffDone;
        window.Store.set(s => {
            let r = editingId ? s.rfxs.find(x => x.id === editingId) : null;
            if (!r) {
                draft.no = W().nextNo(s, draft.type);
                draft.status = 'Draft';
                draft.createdBy = me.id;
                draft.createdTs = Date.now();
                W().log(draft, me, 'created', 'RFX created');
                s.rfxs.unshift(draft);
                r = draft;
            } else {
                Object.assign(r, draft);
            }
            if (status === 'Published') {
                r.status = 'Published';
                r.publishedTs = Date.now();
                r.items.forEach((it, i) => { it.idx = i + 1; });
                r.supplierIds.forEach(supId => {
                    if (!r.responses[supId]) r.responses[supId] = { status: 'invited', answers: {}, quotes: {} };
                });
                W().log(r, me, 'published', 'RFX sent to ' + r.supplierIds.length + ' supplier' + (r.supplierIds.length > 1 ? 's' : ''));
                W().notifyPublish(s, r);
            }
        });
        const saved = draft;
        editingId = null; draft = null;
        return saved;
    }

    /* ---------------- bindings ---------------- */
    function bind(view) {
        const ui = U();
        // supplier checkboxes
        view.querySelectorAll('[data-sup]').forEach(cb => cb.addEventListener('change', () => {
            const id = cb.getAttribute('data-sup');
            if (cb.checked) { if (draft.supplierIds.indexOf(id) === -1) draft.supplierIds.push(id); }
            else draft.supplierIds = draft.supplierIds.filter(x => x !== id);
            cb.closest('.sup-pick').classList.toggle('selected', cb.checked);
            const title = view.querySelectorAll('.panel-card .pc-title')[3];
            if (title) title.textContent = 'Select suppliers (' + draft.supplierIds.length + ')';
        }));
        // supplier search: hide non-matching cards, keep checkbox state intact
        const supSearch = view.querySelector('[data-sup-search]');
        if (supSearch) supSearch.addEventListener('input', () => {
            const q = supSearch.value.trim().toLowerCase();
            let any = false;
            view.querySelectorAll('.sup-pick').forEach(row => {
                const hit = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
                row.classList.toggle('hidden', !hit);
                if (hit) any = true;
            });
            const empty = view.querySelector('#no-sup-match');
            if (empty) empty.classList.toggle('hidden', any);
        });
        // keep basic fields in the draft as the user types (survives re-renders)
        ['f_title', 'f_desc', 'f_deadline'].forEach(n => {
            const el = view.querySelector(`[name="${n}"]`);
            if (el) el.addEventListener('change', () => collect(view));
        });
        view.querySelector('#xls-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const rows = await window.Spreadsheet.parseFile(file);
                const items = importRows(rows, draft.type);
                draft.items = draft.items.concat(items);
                ui.toast({ title: 'Template imported', body: items.length + ' item(s) added from ' + file.name });
                render();
            } catch (err) {
                ui.toast({ kind: 'error', title: 'Import failed', body: err.message || String(err) });
            }
            e.target.value = '';
        });

        ui.bindActions(view, {
            'back': () => { editingId = null; draft = null; ui.go('#/rfx'); },
            'add-item': () => { collect(view); itemModal(); },
            'edit-item': (t) => { collect(view); itemModal(Number(t.getAttribute('data-i'))); },
            'del-item': (t) => { collect(view); draft.items.splice(Number(t.getAttribute('data-i')), 1); render(); },
            'add-q': () => { collect(view); questionModal(); },
            'edit-q': (t) => { collect(view); questionModal(Number(t.getAttribute('data-i'))); },
            'del-q': (t) => { collect(view); draft.questions.splice(Number(t.getAttribute('data-i')), 1); render(); },
            'dl-template': () => {
                const blob = new Blob([templateCsv(draft.type)], { type: 'text/csv' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = draft.type === 'service' ? 'rfx_service_items_template.csv' : 'rfx_shopping_cart_template.csv';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            },
            'upload': () => view.querySelector('#xls-input').click(),
            'pick-master': () => {
                collect(view);
                ui.openModal({
                    title: 'Select items from the Material Master',
                    bodyHtml: `<p>You will be redirected to the <strong>Demand Planning</strong> module. Add the items you need to the shopping cart there, then click <strong>“Create RFX with shopping cart”</strong> — you return here with those items added.</p>
                        <p class="muted" style="margin-top:8px">Your current draft (title, items, questions, suppliers) is preserved.</p>`,
                    buttons: [
                        { label: 'Cancel', onClick: (o) => o.remove() },
                        { label: 'Go to Material Master', cls: 'btn-green', onClick: () => {
                            stashDraft();
                            window.location.href = DP_URL + '/#/master';
                        } }
                    ]
                });
            },
            'save': () => {
                if (!validate(view, false)) return;
                const saved = commit('Draft');
                ui.toast({ title: 'Draft saved', body: saved.no + ' — ' + saved.title });
                ui.go('#/rfx/' + saved.id);
            },
            'send': () => {
                if (!validate(view, true)) return;
                const n = draft.supplierIds.length;
                ui.openModal({
                    title: 'Send RFX to suppliers?',
                    bodyHtml: `<p>The RFX will be sent to <strong>${n}</strong> supplier${n > 1 ? 's' : ''}. They can submit offers until <strong>${W().fmtDate(draft.deadline)}</strong>.</p>
                        <p class="muted" style="margin-top:8px">Offers stay sealed — nobody on the customer side can open them before the deadline.</p>`,
                    buttons: [
                        { label: 'Cancel', onClick: (o) => o.remove() },
                        { label: 'Send to suppliers', cls: 'btn-green', onClick: (o) => {
                            o.remove();
                            const saved = commit('Published');
                            ui.toast({ title: 'RFX sent', body: saved.no + ' is now open for bidding.' });
                            ui.go('#/rfx/' + saved.id);
                        } }
                    ]
                });
            }
        });
    }

    window.Views = window.Views || {};
    window.Views.rfxForm = rfxForm;
})();
