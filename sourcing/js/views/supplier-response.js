/* ============================================================
   views/supplier-response.js — supplier answers the technical
   questions, prices the items and submits the offer.
   Editable until the submission deadline (resubmission allowed).
   ============================================================ */
(function () {
    const U = () => window.UI;
    const W = () => window.Workflow;

    let work = null;       // local working copy of the response
    let workKey = null;    // rfxId::supplierId the copy belongs to

    function supplierResponse(id) {
        const ui = U(), Wf = W();
        const rfx = window.Store.rfxById(id);
        const me = window.Store.currentUser();
        if (!rfx || !Wf.isSupplier(me) || rfx.supplierIds.indexOf(me.supplierId) === -1) { ui.go('#/rfx'); return; }
        if (Wf.phase(rfx) !== 'Open') { ui.go('#/rfx/' + id); return; }
        const key = id + '::' + me.supplierId;
        if (workKey !== key || !work) {
            const stored = Wf.responseOf(rfx, me.supplierId) || { status: 'invited', answers: {}, quotes: {} };
            work = JSON.parse(JSON.stringify(stored));
            if (!work.answers) work.answers = {};
            if (!work.quotes) work.quotes = {};
            workKey = key;
        }
        render(rfx, me);
    }

    function render(rfx, me) {
        const ui = U(), Wf = W();
        const view = document.getElementById('view');
        const submitted = work.status === 'submitted';
        view.innerHTML = `${ui.breadcrumb('RFx management', rfx.no)}<div class="page-full form-page">
            <div class="req-head">
                <div>
                    <div class="req-eyebrow">${ui.esc(rfx.no)} · ${ui.esc(window.Store.supplierById(me.supplierId).name)}</div>
                    <div class="req-title">${ui.esc(rfx.title)}</div>
                </div>
                <div class="req-head-right">${ui.typeBadge(rfx)} ${ui.respBadge(work.status)}</div>
            </div>
            <div class="rfx-meta-grid">
                <div class="stat-tile"><div class="st-label">Category</div><div class="st-value" style="font-size:15px">${ui.esc(rfx.category || '—')}</div></div>
                <div class="stat-tile"><div class="st-label">Submission deadline</div><div class="st-value" style="font-size:15px">${Wf.fmtDate(rfx.deadline)}</div>
                    <div class="st-sub" style="color:var(--danger);font-weight:700">${Wf.timeLeft(rfx)}</div></div>
                <div class="stat-tile"><div class="st-label">Items to quote</div><div class="st-value">${rfx.items.length}</div></div>
            </div>
            ${rfx.description ? `<div class="panel-card"><div class="pc-title">Description</div><div style="white-space:pre-wrap">${ui.esc(rfx.description)}</div></div>` : ''}
            ${submitted ? `<div class="sealed-note" style="background:var(--match-bg);border-color:var(--primary-green);color:var(--primary-green)">✓ Offer submitted. You can still edit and resubmit until the deadline.</div>` : ''}

            <div class="panel-card">
                <div class="pc-title">Technical questions</div>
                <div class="muted" style="margin-bottom:12px">Answers go to the customer's technical envelope. Every question accepts an optional attachment.</div>
                ${rfx.questions.map((q, i) => questionRow(q, i)).join('')}
            </div>

            <div class="panel-card">
                <div class="pc-title">Commercial offer — item prices</div>
                <div class="muted" style="margin-bottom:12px">Leave the price empty for lines you do not offer. An alternative offer lets you propose a substitute product for a line.</div>
                ${rfx.items.map((it, i) => itemBlock(rfx, it, i)).join('')}
            </div>

            <div class="form-actions" style="display:flex;gap:10px;justify-content:flex-end;margin:18px 0 40px">
                <button class="btn btn-outline" data-act="back">Cancel</button>
                <button class="btn btn-black" data-act="save">Save draft</button>
                <button class="btn btn-green" data-act="submit">${submitted ? 'Resubmit offer' : 'Submit offer'}</button>
            </div>
        </div>`;
        bind(view, rfx, me);
    }

    /* ---------- questions ---------- */
    function questionRow(q, i) {
        const ui = U();
        const a = work.answers[q.id] || {};
        let control = '';
        if (q.type === 'yesno') {
            control = `<div class="radio-row" style="margin-top:6px">
                <label><input type="radio" name="qa_${q.id}" value="yes" data-ans="${q.id}" ${a.value === 'yes' ? 'checked' : ''}> Yes</label>
                <label><input type="radio" name="qa_${q.id}" value="no" data-ans="${q.id}" ${a.value === 'no' ? 'checked' : ''}> No</label>
            </div>`;
        } else if (q.type === 'short') {
            control = `<input class="form-input" style="margin-top:6px" data-ans="${q.id}" value="${ui.esc(a.value || '')}" placeholder="Your answer…">`;
        } else if (q.type === 'long') {
            control = `<textarea class="form-textarea" style="margin-top:6px" data-ans="${q.id}" placeholder="Your answer…">${ui.esc(a.value || '')}</textarea>`;
        } else if (q.type === 'file') {
            control = `<div class="muted" style="margin-top:6px;font-size:12px">Upload the requested file below.</div>`;
        }
        return `<div class="q-row">
            <div class="q-row-head"><span class="q-no">Q${i + 1}</span>
                <div style="flex:1">
                    <div class="q-text">${ui.esc(q.text)} ${q.required ? '<span class="q-req-chip">*</span>' : ''}</div>
                    ${q.attachment ? `<div style="margin-top:4px">Reference: ${ui.docChip(q.attachment)}</div>` : ''}
                    ${control}
                    <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span class="muted" style="font-size:11px;font-weight:700">${q.type === 'file' ? 'FILE' : 'ATTACHMENT (OPTIONAL)'}</span>
                        <span data-att-box="${q.id}">${a.attachment ? ui.docChip(a.attachment, 'att-del::' + q.id) : ''}</span>
                        <input type="file" data-att="${q.id}" style="font-size:12px">
                    </div>
                </div>
            </div>
        </div>`;
    }

    /* ---------- item quote blocks ---------- */
    function itemBlock(rfx, it, i) {
        const ui = U();
        const isService = rfx.type === 'service';
        const q = work.quotes[it.id] || {};
        const dsets = ui.ds();
        const inp = (f, opts) => {
            opts = opts || {};
            return `<div class="field"><label class="${opts.req ? 'req-label' : ''}">${ui.esc(opts.label)}${opts.req ? '<span class="req">*</span>' : ''}</label>
                ${opts.select
                    ? `<select class="form-select" data-qf="${it.id}::${f}"><option value="">Select…</option>${opts.select.map(o => `<option value="${ui.esc(o)}" ${String(q[f] || opts.def || '') === o ? 'selected' : ''}>${ui.esc(o)}</option>`).join('')}</select>`
                    : `<input class="form-input" type="${opts.num ? 'number' : 'text'}"${opts.num ? ' step="any"' : ''} data-qf="${it.id}::${f}" value="${ui.esc(q[f] === undefined ? '' : q[f])}" placeholder="${ui.esc(opts.ph || '')}">`}
            </div>`;
        };
        const qty = isService ? it.qty : it.demandQty;
        const alt = q.alt || null;
        const commercial = isService ? `
            <div class="form-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
                ${inp('unitPrice', { label: 'Unit Price', num: true, req: true })}
                ${inp('currency', { label: 'Currency', select: dsets.CURRENCIES, def: 'USD' })}
                ${inp('leadTime', { label: 'Lead time (days)', num: true })}
                ${inp('notes', { label: 'Notes' })}
            </div>` : `
            <div class="form-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
                ${inp('unitPrice', { label: 'Unit Price', num: true, req: true })}
                ${inp('currency', { label: 'Currency', select: dsets.CURRENCIES, def: 'USD' })}
                ${inp('incoterm', { label: 'Incoterm', select: dsets.INCOTERMS })}
                ${inp('incotermLocation', { label: 'Incoterm Location' })}
                ${inp('leadTime', { label: 'Lead time (days)', num: true })}
                ${inp('moq', { label: 'MoQ', num: true })}
                ${inp('lotSize', { label: 'Lot size', num: true })}
                ${inp('uom', { label: 'UoM', select: dsets.UOM, def: it.uom })}
                ${inp('spn', { label: 'Supplier Part Number' })}
                ${inp('smn', { label: 'Manufacturer' })}
                ${inp('smpn', { label: 'Manufacturer Part Number' })}
                <div class="field"><label>On/Off Spec</label>
                    <select class="form-select" data-qf="${it.id}::compliance">
                        <option value="on" ${q.compliance !== 'off' ? 'selected' : ''}>On spec — fully compliant</option>
                        <option value="off" ${q.compliance === 'off' ? 'selected' : ''}>Off spec — deviations apply</option>
                    </select></div>
                ${inp('notes', { label: 'Notes' })}
            </div>
            <div style="margin-top:8px">
                <span class="alt-toggle" data-alt-toggle="${it.id}">${alt ? '− Remove alternative offer' : '+ Offer an alternative product'}</span>
                ${alt ? `<div class="alt-box"><div class="form-grid" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px">
                    <div class="field"><label>Alternative Offer (substitute product)</label>
                        <input class="form-input" data-altf="${it.id}::desc" value="${ui.esc(alt.desc || '')}" placeholder="Describe the substitute product"></div>
                    <div class="field"><label>Alt. Price</label>
                        <input class="form-input" type="number" step="any" data-altf="${it.id}::price" value="${ui.esc(alt.price === undefined ? '' : alt.price)}"></div>
                    <div class="field"><label>Alt. Currency</label>
                        <select class="form-select" data-altf="${it.id}::currency"><option value="">Same</option>${dsets.CURRENCIES.map(c => `<option value="${c}" ${alt.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
                    <div class="field"><label>Alt. UoM</label>
                        <select class="form-select" data-altf="${it.id}::uom"><option value="">Same</option>${dsets.UOM.map(u => `<option value="${u}" ${alt.uom === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
                </div></div>` : ''}
            </div>`;
        return `<div class="ans-block">
            <div class="ans-head"><span>${i + 1}. ${ui.esc(it.shortDesc)}</span>
                <span class="muted" style="font-weight:400;font-size:12px">${isService ? '' : ui.esc(it.sapId || '') + ' · '}${ui.esc(qty)} ${ui.esc(it.uom)}${it.manufacturerName ? ' · ' + ui.esc(it.manufacturerName) + ' ' + ui.esc(it.manufacturerPartNo || '') : ''}</span></div>
            <div class="ans-body">
                ${it.longDesc ? `<div class="muted" style="margin-bottom:8px;font-size:12px">${ui.esc(it.longDesc)}</div>` : ''}
                ${it.attrs && Object.keys(it.attrs).length ? `<div class="muted" style="margin-bottom:8px;font-size:12px"><strong>Specs:</strong> ${ui.esc(Object.entries(it.attrs).map(([k, v]) => k + ': ' + v).join(' · '))}</div>` : ''}
                ${it.notes ? `<div class="muted" style="margin-bottom:8px;font-size:12px">Customer note: ${ui.esc(it.notes)}</div>` : ''}
                ${commercial}
            </div>
        </div>`;
    }

    /* ---------- bindings ---------- */
    function bind(view, rfx, me) {
        const ui = U(), Wf = W();

        view.addEventListener('change', (e) => {
            const t = e.target;
            if (t.hasAttribute('data-ans')) {
                const qid = t.getAttribute('data-ans');
                if (!work.answers[qid]) work.answers[qid] = {};
                work.answers[qid].value = t.value;
            } else if (t.hasAttribute('data-qf')) {
                const [itId, f] = t.getAttribute('data-qf').split('::');
                if (!work.quotes[itId]) work.quotes[itId] = {};
                work.quotes[itId][f] = t.value;
                // a priced line defaults to USD + on-spec unless the supplier says otherwise
                if (f === 'unitPrice' && t.value && !work.quotes[itId].currency) work.quotes[itId].currency = 'USD';
            } else if (t.hasAttribute('data-altf')) {
                const [itId, f] = t.getAttribute('data-altf').split('::');
                if (!work.quotes[itId]) work.quotes[itId] = {};
                if (!work.quotes[itId].alt) work.quotes[itId].alt = {};
                work.quotes[itId].alt[f] = t.value;
            } else if (t.hasAttribute('data-att')) {
                const qid = t.getAttribute('data-att');
                ui.readFileAsDoc(t.files[0], (doc) => {
                    if (!work.answers[qid]) work.answers[qid] = {};
                    work.answers[qid].attachment = doc;
                    const box = view.querySelector(`[data-att-box="${qid}"]`);
                    if (box) box.innerHTML = ui.docChip(doc, 'att-del::' + qid);
                });
                t.value = '';
            }
        });

        view.addEventListener('click', (e) => {
            const del = e.target.closest('[data-act^="att-del::"]');
            if (del) {
                const qid = del.getAttribute('data-act').split('::')[1];
                if (work.answers[qid]) delete work.answers[qid].attachment;
                const box = view.querySelector(`[data-att-box="${qid}"]`);
                if (box) box.innerHTML = '';
                return;
            }
            const altT = e.target.closest('[data-alt-toggle]');
            if (altT) {
                const itId = altT.getAttribute('data-alt-toggle');
                if (!work.quotes[itId]) work.quotes[itId] = {};
                work.quotes[itId].alt = work.quotes[itId].alt ? null : {};
                if (!work.quotes[itId].alt) delete work.quotes[itId].alt;
                render(rfx, me);
                return;
            }
        });

        function persist(status, thenMsg) {
            work.status = status;
            if (status === 'submitted') work.submittedTs = Date.now();
            // prune empty quote objects so "no offer" lines stay truly empty
            Object.keys(work.quotes).forEach(itId => {
                const q = work.quotes[itId];
                const hasData = Object.keys(q).some(k => q[k] !== '' && q[k] !== undefined && q[k] !== null &&
                    !(k === 'compliance' && q.unitPrice === undefined) && !(k === 'alt' && !q.alt));
                if (!hasData) delete work.quotes[itId];
            });
            const snapshot = JSON.parse(JSON.stringify(work));
            window.Store.set(s => {
                const r = s.rfxs.find(x => x.id === rfx.id);
                r.responses[me.supplierId] = snapshot;
                if (status === 'submitted') {
                    const sup = s.suppliers.find(x => x.id === me.supplierId);
                    Wf.log(r, me, 'submitted', sup.name + ' submitted an offer');
                    Wf.notifySubmission(s, r, sup);
                }
            });
            ui.toast(thenMsg);
        }

        ui.bindActions(view, {
            'back': () => { work = null; workKey = null; ui.go('#/rfx'); },
            'save': () => {
                persist(work.status === 'submitted' ? 'submitted' : 'draft', { title: 'Draft saved', body: 'Your offer draft for ' + rfx.no + ' was saved.' });
                render(window.Store.rfxById(rfx.id), me);
            },
            'submit': () => {
                // required questions must be answered (a file question needs its file)
                const missing = rfx.questions.filter(q => {
                    if (!q.required) return false;
                    const a = work.answers[q.id] || {};
                    if (q.type === 'file') return !a.attachment;
                    return !a.value;
                });
                if (missing.length) {
                    ui.toast({ kind: 'error', title: 'Cannot submit', body: 'Answer all required questions first (' + missing.length + ' missing).' });
                    return;
                }
                const priced = rfx.items.filter(it => {
                    const q = work.quotes[it.id];
                    return q && q.unitPrice !== '' && q.unitPrice !== undefined && q.unitPrice !== null;
                });
                if (!priced.length) {
                    ui.toast({ kind: 'error', title: 'Cannot submit', body: 'Price at least one item.' });
                    return;
                }
                const n = rfx.items.length - priced.length;
                ui.openModal({
                    title: 'Submit offer?',
                    bodyHtml: `<p>You are quoting <strong>${priced.length}</strong> of ${rfx.items.length} items.${n ? ' ' + n + ' line(s) will be marked as not offered.' : ''}</p>
                        <p class="muted" style="margin-top:8px">You can edit and resubmit until ${Wf.fmtDate(rfx.deadline)}.</p>`,
                    buttons: [
                        { label: 'Cancel', onClick: (o) => o.remove() },
                        { label: 'Submit offer', cls: 'btn-green', onClick: (o) => {
                            o.remove();
                            persist('submitted', { title: 'Offer submitted', body: rfx.no + ' — thank you. The customer opens offers after the deadline.' });
                            ui.go('#/rfx/' + rfx.id);
                        } }
                    ]
                });
            }
        });
    }

    window.Views = window.Views || {};
    window.Views.supplierResponse = supplierResponse;
})();
