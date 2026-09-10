/* ============================================================
   views/rfx-detail.js — RFX detail (customer side + supplier summary)

   Customer, before deadline: offers are SEALED — only submission
   counts are visible.
   Customer, after deadline (strict dual envelope):
     CAM  → Technical envelope tab: answers + attachments, no prices,
            Pass/Fail verdict per supplier.
     PROC → Commercial envelope tab: price comparison, bid-evaluation
            export, per-item awards (unlocked once CAM finished).
   ============================================================ */
(function () {
    const U = () => window.UI;
    const W = () => window.Workflow;

    let activeTab = 'overview';
    let lastRfxId = null;

    function rfxDetail(id) {
        const rfx = window.Store.rfxById(id);
        if (!rfx) { U().go('#/rfx'); return; }
        const me = window.Store.currentUser();
        if (W().isSupplier(me)) { supplierSummary(rfx, me); return; }
        if (lastRfxId !== id) { activeTab = 'overview'; lastRfxId = id; }
        render(rfx, me);
    }

    /* ================= customer ================= */
    function render(rfx, me) {
        const ui = U(), Wf = W();
        const view = document.getElementById('view');
        const ph = Wf.phase(rfx);
        const isCam = me.role === 'CAM';
        const isProc = me.role === 'PROC';
        const open = Wf.offersOpen(rfx);
        const subs = Wf.submittedSupplierIds(rfx);

        const tabs = [{ key: 'overview', label: 'Overview' }];
        if (open) {
            if (isCam) {
                const pending = subs.filter(sid => !Wf.verdictOf(rfx, sid)).length;
                tabs.push({ key: 'tech', label: 'Technical envelope', count: pending });
            }
            if (isProc) tabs.push({ key: 'comm', label: 'Commercial envelope' });
        }
        tabs.push({ key: 'history', label: 'History' });
        if (!tabs.some(t => t.key === activeTab)) activeTab = 'overview';

        view.innerHTML = `${ui.breadcrumb('RFx management', rfx.no)}<div class="page-full">
            <div class="req-head">
                <div>
                    <div class="req-eyebrow">${ui.esc(rfx.no)}</div>
                    <div class="req-title">${ui.esc(rfx.title)}</div>
                </div>
                <div class="req-head-right">
                    ${ui.typeBadge(rfx)} ${ui.phaseBadge(rfx)}
                    ${rfx.status === 'Draft' ? `<button class="btn btn-black btn-sm" data-act="edit">Edit</button>
                        <button class="btn btn-danger-outline btn-sm" data-act="del-draft">Delete</button>` : ''}
                </div>
            </div>

            <div class="rfx-meta-grid">
                <div class="stat-tile"><div class="st-label">Category</div><div class="st-value" style="font-size:15px">${ui.esc(rfx.category || '—')}</div></div>
                <div class="stat-tile"><div class="st-label">Submission deadline</div><div class="st-value" style="font-size:15px">${Wf.fmtDate(rfx.deadline)}</div>
                    <div class="st-sub">${ph === 'Open' ? Wf.timeLeft(rfx) : (ph === 'Draft' ? 'Not sent yet' : 'Deadline passed')}</div></div>
                <div class="stat-tile"><div class="st-label">Items</div><div class="st-value">${rfx.items.length}</div></div>
                <div class="stat-tile"><div class="st-label">Offers received</div>
                    <div class="st-value">${rfx.status === 'Draft' ? '—' : subs.length + ' / ' + rfx.supplierIds.length}</div></div>
            </div>

            ${ph === 'Open' ? `<div class="sealed-note">🔒 Offers are sealed until the submission deadline. ${subs.length} of ${rfx.supplierIds.length} suppliers have submitted.
                <button class="btn btn-outline btn-sm" data-act="expire" style="margin-left:auto" title="Demo helper — moves the deadline to now">⏩ Expire deadline (demo)</button></div>` : ''}
            ${open && !Wf.techEvalDone(rfx) && isProc ? `<div class="sealed-note" style="background:var(--info-bg);border-color:var(--info-border);color:#1c4d80">
                ⚖️ Awarding unlocks after CAM completes the technical evaluation (${subs.filter(sid => Wf.verdictOf(rfx, sid)).length}/${subs.length} verdicts given).</div>` : ''}

            <div class="env-tabs">${tabs.map(t =>
                `<div class="env-tab ${activeTab === t.key ? 'active' : ''}" data-act="tab" data-tab="${t.key}">${ui.esc(t.label)}${t.count ? `<span class="tab-count">${t.count}</span>` : ''}</div>`).join('')}</div>

            <div id="tab-body">${tabBody(rfx, me)}</div>
        </div>`;

        bind(view, rfx, me);
    }

    function tabBody(rfx, me) {
        if (activeTab === 'tech') return techTab(rfx);
        if (activeTab === 'comm') return commTab(rfx);
        if (activeTab === 'history') return `<div class="panel-card"><div class="pc-title">History</div>${U().historyList(rfx)}</div>`;
        return overviewTab(rfx, me);
    }

    /* ---------- overview ---------- */
    function overviewTab(rfx, me) {
        const ui = U(), Wf = W();
        const isService = rfx.type === 'service';
        const typeLabel = (k) => (ui.ds().QUESTION_TYPES.find(t => t.key === k) || {}).label || k;
        const head = isService
            ? '<th>#</th><th>Short Description</th><th>Long Description</th><th>Quantity</th><th>UoM</th><th>Category</th>'
            : '<th>#</th><th>SAP ID</th><th>Short Description</th><th>Manufacturer</th><th>Part №</th><th>UoM</th><th>Quantity</th><th>Plant</th>';
        return `
            ${rfx.description ? `<div class="panel-card"><div class="pc-title">Description</div><div style="white-space:pre-wrap">${ui.esc(rfx.description)}</div></div>` : ''}
            <div class="panel-card"><div class="pc-title">Items (${rfx.items.length})</div>
                ${rfx.items.length ? `<div class="inbox-table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead>
                <tbody>${rfx.items.map((it, i) => isService
                    ? `<tr><td>${i + 1}</td><td style="font-weight:600">${ui.esc(it.shortDesc)}</td><td class="muted">${ui.esc(it.longDesc || '—')}</td><td>${ui.esc(it.qty)}</td><td>${ui.esc(it.uom)}</td><td>${ui.esc(it.category || '—')}</td></tr>`
                    : `<tr><td>${i + 1}</td><td>${ui.esc(it.sapId || '—')}</td><td style="font-weight:600">${ui.esc(it.shortDesc)}${it.attrs && Object.keys(it.attrs).length ? `<div class="muted" style="font-size:11px;font-weight:400;margin-top:2px">${ui.esc(Object.entries(it.attrs).map(([k, v]) => k + ': ' + v).join(' · '))}</div>` : ''}</td><td>${ui.esc(it.manufacturerName || '—')}</td><td>${ui.esc(it.manufacturerPartNo || '—')}</td><td>${ui.esc(it.uom)}</td><td>${ui.esc(it.demandQty)}</td><td>${ui.esc(it.plant || '—')}</td></tr>`).join('')}
                </tbody></table></div>` : '<div class="empty-state">No items.</div>'}
            </div>
            <div class="panel-card"><div class="pc-title">Technical questions (${rfx.questions.length})</div>
                ${rfx.questions.length ? rfx.questions.map((q, i) => `
                    <div class="q-row"><div class="q-row-head"><span class="q-no">Q${i + 1}</span><span class="q-text">${ui.esc(q.text)}</span></div>
                    <div class="q-meta"><span class="q-type-chip">${ui.esc(typeLabel(q.type))}</span>
                    ${q.required ? '<span class="q-req-chip">Required</span>' : ''}
                    ${q.attachment ? ui.docChip(q.attachment) : ''}</div></div>`).join('') : '<div class="empty-state">No questions.</div>'}
            </div>
            <div class="panel-card"><div class="pc-title">Suppliers (${rfx.supplierIds.length})</div>
                ${rfx.supplierIds.length ? rfx.supplierIds.map(sid => {
                    const sup = window.Store.supplierById(sid);
                    const resp = Wf.responseOf(rfx, sid);
                    const st = resp ? resp.status : 'invited';
                    return `<div class="sup-pick" style="cursor:default">
                        <div style="flex:1"><div class="sup-name">${ui.esc(sup.name)}</div>
                        <div class="sup-meta">${ui.esc(sup.city)}, ${ui.esc(sup.country)}</div></div>
                        ${rfx.status !== 'Draft' ? ui.respBadge(st) : ''}
                        ${Wf.offersOpen(rfx) && st === 'submitted' ? ui.verdictBadge(Wf.verdictOf(rfx, sid)) : ''}
                    </div>`;
                }).join('') : '<div class="empty-state">No suppliers selected.</div>'}
            </div>`;
    }

    /* ---------- technical envelope (CAM) ---------- */
    function techTab(rfx) {
        const ui = U(), Wf = W();
        const subs = Wf.submittedSupplierIds(rfx);
        if (!subs.length) return '<div class="empty-state">No submitted offers to evaluate.</div>';
        return `<div class="muted" style="margin-bottom:12px">🔒 Strict dual envelope — commercial data (prices) is not visible to CAM. Approve or decline each supplier technically; PROC can award only approved suppliers. A note is mandatory when declining.</div>` +
            subs.map(sid => {
                const sup = window.Store.supplierById(sid);
                const resp = Wf.responseOf(rfx, sid);
                const ev = rfx.techEval[sid] || { verdict: null, notes: '' };
                return `<div class="ans-block">
                    <div class="ans-head"><span>${ui.esc(sup.name)}</span>${ui.verdictBadge(ev.verdict)}</div>
                    <div class="ans-body">
                        ${rfx.questions.map((q, i) => {
                            const a = (resp.answers || {})[q.id] || {};
                            return `<div class="ans-qa">
                                <div class="ans-q">Q${i + 1}. ${ui.esc(q.text)}</div>
                                <div class="ans-a">${answerHtml(q, a)}</div>
                            </div>`;
                        }).join('')}
                        ${!ev.verdict ? `
                        <div class="verdict-row" style="margin-top:12px">
                            <span style="font-weight:700">Technical verdict:</span>
                            <button class="btn btn-sm btn-green-outline" data-act="verdict" data-sup="${sid}" data-v="pass">✓ Approve</button>
                            <button class="btn btn-sm btn-danger-outline" data-act="verdict" data-sup="${sid}" data-v="fail">✕ Decline</button>
                            <span style="flex:1;min-width:220px">
                                <input class="form-input" style="width:100%" placeholder="Evaluation note — optional on approve, mandatory on decline" data-ev-notes data-sup="${sid}" value="${ui.esc(ev.notes || '')}">
                                <span class="field-error" data-note-err="${sid}" style="display:block;font-size:11px;color:var(--danger);font-weight:600"></span>
                            </span>
                        </div>` : (() => {
                            const by = (window.Store.users().find(u => u.id === ev.evaluatedBy) || {}).name || '';
                            const when = ev.evaluatedTs ? ui.nowLabel(ev.evaluatedTs) : '';
                            const note = ev.notes ? ' — “' + ui.esc(ev.notes) + '”' : '';
                            return ev.verdict === 'pass'
                                ? `<div style="margin-top:12px;padding:9px 12px;border-radius:6px;background:var(--match-bg);color:var(--primary-green);font-weight:600;font-size:13px">✓ This supplier is technically APPROVED${by ? ' by ' + ui.esc(by) : ''}${when ? ' · ' + when : ''}${note}. PROC can award them items. The verdict is final.</div>`
                                : `<div style="margin-top:12px;padding:9px 12px;border-radius:6px;background:var(--danger-bg);color:var(--danger);font-weight:600;font-size:13px">✕ This supplier is technically DECLINED${by ? ' by ' + ui.esc(by) : ''}${when ? ' · ' + when : ''}${note} and cannot be awarded any item. The verdict is final.</div>`;
                        })()}
                    </div>
                </div>`;
            }).join('');
    }
    function answerHtml(q, a) {
        const ui = U();
        let core;
        if (q.type === 'yesno') {
            core = a.value === 'yes' ? '<span class="yes">Yes</span>' : (a.value === 'no' ? '<span class="no">No</span>' : '<span class="muted">Not answered</span>');
        } else if (q.type === 'file') {
            core = a.attachment ? '' : '<span class="muted">No file uploaded</span>';
        } else {
            core = a.value ? ui.esc(a.value) : '<span class="muted">Not answered</span>';
        }
        return core + (a.attachment ? ' ' + ui.docChip(a.attachment) : '');
    }

    /* ---------- commercial envelope (PROC) ---------- */
    function commTab(rfx) {
        const ui = U(), Wf = W();
        const subs = Wf.submittedSupplierIds(rfx);
        if (!subs.length) return '<div class="empty-state">No submitted offers.</div>';
        const canAward = Wf.canAward(rfx);
        const finalized = rfx.status === 'Awarded';

        const header = `<tr><th style="min-width:220px">Item</th>${subs.map(sid => {
            const sup = window.Store.supplierById(sid);
            return `<th style="min-width:170px">${ui.esc(sup.name)}<div style="margin-top:3px">${ui.verdictBadge(Wf.verdictOf(rfx, sid))}</div></th>`;
        }).join('')}</tr>`;

        const rows = rfx.items.map((it, i) => {
            const quotes = subs.map(sid => ({ sid, q: Wf.quoteFor(rfx, sid, it.id) }));
            // lowest comparable price (same currency across all quotes on the line)
            const priced = quotes.filter(x => x.q);
            const curs = [...new Set(priced.map(x => x.q.currency))];
            const best = (curs.length === 1 && priced.length > 1) ? Math.min.apply(null, priced.map(x => x.q.price)) : null;
            const award = Wf.awardOf(rfx, it.id);
            const qty = rfx.type === 'service' ? it.qty : it.demandQty;
            return `<tr>
                <td class="qt-desc">${i + 1}. ${ui.esc(it.shortDesc)}
                    <div class="qt-sub">${rfx.type === 'service' ? '' : ui.esc(it.sapId || '')} · ${ui.esc(qty)} ${ui.esc(it.uom)}</div></td>
                ${quotes.map(({ sid, q }) => {
                    if (!q) return '<td class="no-offer">No offer</td>';
                    const passed = Wf.verdictOf(rfx, sid) === 'pass';
                    const isBest = best !== null && q.price === best;
                    const isAwarded = award && award.supplierId === sid;
                    const negLine = q.negotiated
                        ? `<div class="offer-alt" style="color:#1c4d80">⇄ Negotiated · was ${ui.money(q.originalPrice, q.currency)}</div>` : '';
                    return `<td class="${isBest ? 'best' : ''}">
                        <div style="font-weight:700">${ui.money(q.price, q.currency)}</div>
                        ${negLine}
                        ${q.isAlt ? `<div class="offer-alt">ALT: ${ui.esc(q.q.alt.desc || 'alternative product')}</div>` : ''}
                        <div class="qt-sub">${ui.esc(q.q.incoterm || '')} ${ui.esc(q.q.incotermLocation || '')} · LT ${ui.esc(q.q.leadTime || '—')}d · MoQ ${ui.esc(q.q.moq || '—')}</div>
                        <div class="qt-sub">${q.q.compliance === 'off' ? '<span style="color:var(--danger);font-weight:700">Off spec</span>' : 'On spec'}${q.q.notes ? ' · ' + ui.esc(q.q.notes) : ''}</div>
                        <div style="margin-top:7px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                            ${finalized
                                ? (isAwarded ? '<span class="awarded-chip">✓ Awarded</span>' : '')
                                : `<label class="award-pick" title="${passed ? 'Award this item to the supplier' : 'Supplier was declined in the technical evaluation'}">
                                    <input type="radio" name="aw_${it.id}" data-award data-item="${it.id}" data-sup="${sid}"
                                        ${isAwarded ? 'checked' : ''} ${(!canAward || !passed) ? 'disabled' : ''}> Award</label>`}
                        </div>
                    </td>`;
                }).join('')}
            </tr>`;
        }).join('');

        const awardedCount = Object.keys(rfx.awards || {}).length;
        return `
            <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-bottom:12px">
                <button class="btn btn-black" data-act="bid-eval">⚖ Evaluate your Bids</button>
                ${finalized ? '<span class="status-pill st-awarded">Awards finalized</span>'
                    : `<button class="btn btn-green" data-act="finalize" ${awardedCount ? '' : 'disabled'}>Finalize awards (${awardedCount})</button>`}
            </div>
            <div class="offer-wrap"><table class="offer-table">${header}${rows}</table></div>
            <div class="muted" style="margin-top:10px">Lowest price on a line is highlighted when all offers share one currency. “ALT” marks an alternative product offered instead of the specified item. Price negotiations start from the bid-evaluation tool (Build your award → Potential saving opportunities).</div>
            ${procNegPanel(rfx)}`;
    }

    /* ---------- negotiation requests panel (PROC view) ---------- */
    function procNegPanel(rfx) {
        const ui = U(), Wf = W();
        const reqs = (rfx.negRequests || []).slice().sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0));
        if (!reqs.length) return '';
        const stPill = (q) => q.status === 'pending' ? '<span class="status-pill st-open">Waiting for supplier</span>'
            : (q.status === 'answered' ? '<span class="status-pill st-awarded">New prices received</span>'
                : '<span class="status-pill st-cancelled">Declined</span>');
        return `<div class="panel-card" style="margin-top:18px"><div class="pc-title">Price negotiations (${reqs.length})</div>
            <div class="muted" style="margin-bottom:10px">Requests created from the bid-evaluation tool. Answered prices become the supplier's effective prices above.</div>
            ${reqs.map(q => {
                const sup = window.Store.supplierById(q.supplierId);
                return `<div class="ans-block">
                    <div class="ans-head"><span>${ui.esc(sup ? sup.name : q.supplierId)} · ${q.items.length} item(s)</span>${stPill(q)}</div>
                    <div class="ans-body">
                        <div class="qt-sub" style="margin-bottom:8px">Sent ${ui.nowLabel(q.createdTs)}${q.createdByName ? ' by ' + ui.esc(q.createdByName) : ''}${q.note ? ' — “' + ui.esc(q.note) + '”' : ''}</div>
                        <div class="inbox-table-wrap"><table class="data-table" style="font-size:13px">
                            <thead><tr><th>Item</th><th>Previous price</th><th>Target price</th><th>New price</th></tr></thead>
                            <tbody>${q.items.map(ni => {
                                const it = rfx.items.find(x => x.id === ni.itemId) || {};
                                const resp = (q.responses || {})[ni.itemId];
                                return `<tr>
                                    <td style="font-weight:600">${ui.esc(it.shortDesc || '—')}</td>
                                    <td>${ui.money(ni.prevPrice, ni.currency)}</td>
                                    <td>${ui.money(ni.target, ni.currency)}</td>
                                    <td>${q.status === 'answered' && resp && resp.newPrice !== null && resp.newPrice !== undefined
                                        ? `<strong style="color:${Number(resp.newPrice) < Number(ni.prevPrice) ? 'var(--primary-green)' : 'inherit'}">${ui.money(resp.newPrice, ni.currency)}</strong>`
                                        : (q.status === 'pending' ? '<span class="muted">⏳ waiting</span>' : '<span class="muted">—</span>')}</td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table></div>
                        ${q.status === 'declined' && q.responseComment ? `<div class="qt-sub" style="margin-top:8px;color:var(--danger)"><strong>Declined:</strong> ${ui.esc(q.responseComment)}</div>` : ''}
                        ${q.status === 'answered' && q.responseComment ? `<div class="qt-sub" style="margin-top:8px"><strong>Supplier comment:</strong> ${ui.esc(q.responseComment)}</div>` : ''}
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    }

    /* ---------- bid-evaluation tool integration ----------
       Pushes every submitted offer (with negotiated effective prices) to the
       server handoff store, then opens bid-eval.html — the embedded evaluation
       tool — which rebuilds the quotation workbooks and runs its own pipeline. */
    function bidEvalOpen(rfx) {
        const ui = U(), Wf = W();
        const subs = Wf.submittedSupplierIds(rfx);
        if (!subs.length) { ui.toast({ kind: 'error', title: 'No offers', body: 'There are no submitted offers to evaluate.' }); return; }
        const vendors = subs.map(sid => {
            const sup = window.Store.supplierById(sid);
            const resp = Wf.responseOf(rfx, sid);
            const rows = rfx.items.map((it, i) => {
                const q = (resp.quotes || {})[it.id] || {};
                const alt = q.alt || {};
                const neg = Wf.negPrice(rfx, it.id, sid);
                const eff = (neg && q.unitPrice !== undefined && q.unitPrice !== '') ? neg.price : q.unitPrice;
                return {
                    item_id: it.id,   // Sourcing item id — used by the tool's negotiation buttons, never written to the workbook
                    item_index: i + 1, customer_unique_id: it.sapId || '', internal_id: it.internalId || '',
                    short_description: it.shortDesc || '', long_description: it.longDesc || '',
                    manufacturer_name: it.manufacturerName || '', manufacturer_part_no: it.manufacturerPartNo || '',
                    uom_customer: it.uom || 'EA', demand_qty: (rfx.type === 'service' ? it.qty : it.demandQty) || '',
                    customer_notes: it.notes || '', category: it.category || '', plant: it.plant || '',
                    lot_size_customer: it.lotSize || '',
                    unit_price: (eff === undefined || eff === null || eff === '') ? null : Number(eff),
                    quoted_currency: q.currency || '', incoterm: q.incoterm || '', incoterm_location: q.incotermLocation || '',
                    lead_time: q.leadTime || '', supplier_moq: q.moq || '', lot_size_supplier: q.lotSize || '',
                    spn: q.spn || '', smn: q.smn || '', smpn: q.smpn || '',
                    fully_compliance: q.compliance === 'off' ? 'OFF' : 'YES',
                    supplier_notes: q.notes || '', uom_supplier: q.uom || '',
                    alternative_offer: alt.desc || '', alternative_offer_price: alt.price || '',
                    alternative_currency: alt.currency || '', alternative_uom: alt.uom || ''
                };
            });
            return { name: sup.name, supplierId: sid, rows };
        });
        fetch('/api/handoff', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'sourcing_bid_eval', rfxId: rfx.id, rfxNo: rfx.no, title: rfx.title, createdByName: window.Store.currentUser().name, vendors })
        })
            .then(r => (r.ok ? r.json() : null))
            .then(res => {
                if (!res || !res.id) throw new Error('bad response');
                window.open('bid-eval.html?handoff=' + encodeURIComponent(res.id), '_blank');
                ui.toast({ title: 'Bid evaluation opened', body: subs.length + ' supplier offer(s) sent to the evaluation tool.' });
            })
            .catch(() => ui.toast({ kind: 'error', title: 'Bid evaluation failed', body: 'Could not push the offers to the tool.' }));
    }

    /* ---------- bid-evaluation export (legacy CSV fallback) ---------- */
    function bidEvalModal(rfx) {
        const ui = U(), Wf = W();
        const subs = Wf.submittedSupplierIds(rfx);
        ui.openModal({
            title: 'Bid evaluation', wide: true,
            bodyHtml: `<p>Export each supplier's quotation in the bid-evaluation template format, then load the files into the bid-evaluation tool to compare scenarios and pick winners. Awarding here stays available either way.</p>
                <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
                    ${subs.map(sid => {
                        const sup = window.Store.supplierById(sid);
                        return `<div class="sup-pick" style="cursor:default"><div style="flex:1"><div class="sup-name">${ui.esc(sup.name)}</div></div>
                            <button class="btn btn-outline btn-sm" data-export="${sid}">⤓ Download quotation file</button></div>`;
                    }).join('')}
                </div>`,
            buttons: [{ label: 'Close', onClick: (o) => o.remove() }],
            onOpen: (o) => o.addEventListener('click', (e) => {
                const b = e.target.closest('[data-export]');
                if (!b) return;
                exportSupplierCsv(rfx, b.getAttribute('data-export'));
            })
        });
    }
    function exportSupplierCsv(rfx, sid) {
        const Wf = W();
        const sup = window.Store.supplierById(sid);
        const resp = Wf.responseOf(rfx, sid);
        const cols = ['item_index', 'customer_unique_id', 'internal_id', 'short_description', 'long_description',
            'manufacturer_name', 'manufacturer_part_no', 'uom_customer', 'demand_qty', 'customer_notes', 'category', 'plant', 'lot_size_customer',
            'unit_price', 'quoted_currency', 'incoterm', 'incoterm_location', 'lead_time', 'supplier_moq', 'lot_size_supplier',
            'spn', 'smn', 'smpn', 'fully_compliance', 'supplier_notes', 'uom_supplier',
            'alternative_offer', 'alternative_offer_price', 'alternative_currency', 'alternative_uom', 'vendor_name'];
        const csvCell = (v) => {
            v = (v === undefined || v === null) ? '' : String(v);
            return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        const lines = [cols.join(',')];
        rfx.items.forEach((it, i) => {
            const q = (resp.quotes || {})[it.id] || {};
            const alt = q.alt || {};
            // a negotiated price replaces the originally quoted one in the export
            const neg = Wf.negPrice(rfx, it.id, sid);
            const effPrice = (neg && q.unitPrice !== undefined && q.unitPrice !== '') ? neg.price : q.unitPrice;
            lines.push([
                i + 1, it.sapId || '', it.internalId || '', it.shortDesc || '', it.longDesc || '',
                it.manufacturerName || '', it.manufacturerPartNo || '', it.uom || '', (rfx.type === 'service' ? it.qty : it.demandQty) || '',
                it.notes || '', it.category || '', it.plant || '', it.lotSize || '',
                effPrice !== undefined ? effPrice : '', q.currency || '', q.incoterm || '', q.incotermLocation || '',
                q.leadTime || '', q.moq || '', q.lotSize || '', q.spn || '', q.smn || '', q.smpn || '',
                q.compliance === 'off' ? 'Off' : (q.unitPrice !== undefined && q.unitPrice !== '' ? 'On' : ''),
                q.notes || '', q.uom || '',
                alt.desc || '', alt.price || '', alt.currency || '', alt.uom || '', sup.name
            ].map(csvCell).join(','));
        });
        const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = rfx.no + '_' + sup.name.replace(/[^A-Za-z0-9]+/g, '_') + '_quotation.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }

    /* ---------- supplier summary (post-deadline / after submitting) ---------- */
    function supplierSummary(rfx, me) {
        const ui = U(), Wf = W();
        const view = document.getElementById('view');
        const resp = Wf.responseOf(rfx, me.supplierId);
        const ph = Wf.phase(rfx);
        const wonItems = rfx.status === 'Awarded'
            ? rfx.items.filter(it => (rfx.awards[it.id] || {}).supplierId === me.supplierId) : [];
        view.innerHTML = `${ui.breadcrumb('RFx management', rfx.no)}<div class="page-full">
            <div class="req-head">
                <div><div class="req-eyebrow">${ui.esc(rfx.no)}</div><div class="req-title">${ui.esc(rfx.title)}</div></div>
                <div class="req-head-right">${ui.typeBadge(rfx)} ${ui.phaseBadge(rfx)}
                    ${ph === 'Open' ? `<button class="btn btn-green btn-sm" data-act="respond">${resp && resp.status === 'submitted' ? 'Edit offer' : 'Submit offer'}</button>` : ''}</div>
            </div>
            <div class="rfx-meta-grid">
                <div class="stat-tile"><div class="st-label">Deadline</div><div class="st-value" style="font-size:15px">${Wf.fmtDate(rfx.deadline)}</div>
                    <div class="st-sub">${ph === 'Open' ? Wf.timeLeft(rfx) : 'Deadline passed'}</div></div>
                <div class="stat-tile"><div class="st-label">My offer</div><div class="st-value" style="font-size:15px">${resp && resp.status === 'submitted' ? 'Submitted' : 'Not submitted'}</div></div>
                ${rfx.status === 'Awarded' ? `<div class="stat-tile"><div class="st-label">Result</div>
                    <div class="st-value" style="font-size:15px">${wonItems.length ? 'Won ' + wonItems.length + ' item' + (wonItems.length > 1 ? 's' : '') : 'Not awarded'}</div></div>` : ''}
            </div>
            ${supplierNegPanel(rfx, me)}
            ${rfx.status === 'Awarded' && wonItems.length ? `<div class="panel-card"><div class="pc-title">Awarded items</div>
                <div class="inbox-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>UoM</th><th>My price</th></tr></thead>
                <tbody>${wonItems.map((it, i) => {
                    const q = Wf.quoteFor(rfx, me.supplierId, it.id);
                    return `<tr><td>${i + 1}</td><td style="font-weight:600">${ui.esc(it.shortDesc)}</td>
                        <td>${ui.esc(rfx.type === 'service' ? it.qty : it.demandQty)}</td><td>${ui.esc(it.uom)}</td>
                        <td>${q ? ui.money(q.price, q.currency) : '—'}</td></tr>`;
                }).join('')}</tbody></table></div></div>` : ''}
            ${rfx.status === 'Awarded' && !wonItems.length && resp && resp.status === 'submitted' ? `<div class="sealed-note">This RFX was awarded to other suppliers. Thank you for participating.</div>` : ''}
            ${ph !== 'Open' && (!resp || resp.status !== 'submitted') ? `<div class="sealed-note">The deadline has passed without a submitted offer.</div>` : ''}
            ${ph === 'Closed' && resp && resp.status === 'submitted' ? `<div class="sealed-note" style="background:var(--info-bg);border-color:var(--info-border);color:#1c4d80">⏳ Bidding is closed. The customer is evaluating the offers.</div>` : ''}
        </div>`;
        ui.bindActions(view, {
            'back': () => ui.go('#/rfx'),
            'respond': () => ui.go('#/rfx/' + rfx.id + '/respond'),
            'neg-answer': (t) => supplierNegRespond(rfx.id, t.getAttribute('data-req'), me, 'answered', view),
            'neg-decline': (t) => supplierNegRespond(rfx.id, t.getAttribute('data-req'), me, 'declined', view)
        });
    }

    /* ---- supplier's negotiation panel: the customer's requests, each with
       previous price + target price per item. The supplier answers a request
       with new prices (comment optional) or declines it (comment mandatory). ---- */
    function supplierNegPanel(rfx, me) {
        const ui = U(), Wf = W();
        const reqs = Wf.negRequestsFor(rfx, me.supplierId).slice().sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0));
        if (!reqs.length) return '';
        return `<div class="panel-card"><div class="pc-title">Price negotiation requests (${reqs.length})</div>
            <div class="muted" style="margin-bottom:10px">The customer asks for revised prices on the items below. The target price is what they aim for — submit your new prices (comment optional) or decline the request (comment mandatory).</div>
            ${reqs.map(q => {
                const pending = q.status === 'pending';
                return `<div class="ans-block">
                    <div class="ans-head"><span>Request of ${ui.nowLabel(q.createdTs)} · ${q.items.length} item(s)</span>
                        ${pending ? '<span class="status-pill st-open">Awaiting your answer</span>'
                            : (q.status === 'answered' ? '<span class="status-pill st-awarded">Answered</span>' : '<span class="status-pill st-cancelled">Declined</span>')}</div>
                    <div class="ans-body">
                        ${q.note ? `<div class="qt-sub" style="margin-bottom:8px"><strong>Customer note:</strong> ${ui.esc(q.note)}</div>` : ''}
                        <div class="inbox-table-wrap"><table class="data-table" style="font-size:13px">
                            <thead><tr><th>Item</th><th>My previous price</th><th>Customer target</th><th>My new price</th></tr></thead>
                            <tbody>${q.items.map(ni => {
                                const it = rfx.items.find(x => x.id === ni.itemId) || {};
                                const resp = (q.responses || {})[ni.itemId];
                                return `<tr>
                                    <td style="font-weight:600">${ui.esc(it.shortDesc || '—')}</td>
                                    <td>${ui.money(ni.prevPrice, ni.currency)}</td>
                                    <td style="color:var(--primary-green);font-weight:700">${ui.money(ni.target, ni.currency)}</td>
                                    <td>${pending
                                        ? `<input class="form-input" type="number" step="any" min="0" style="width:120px" data-neg-price="${q.id}::${ni.itemId}" value="${ui.esc(ni.prevPrice)}">`
                                        : (resp && resp.newPrice !== null && resp.newPrice !== undefined ? ui.money(resp.newPrice, ni.currency) : '—')}</td>
                                </tr>`;
                            }).join('')}</tbody>
                        </table></div>
                        ${pending ? `
                        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start">
                            <span style="flex:1;min-width:240px">
                                <input class="form-input" style="width:100%" placeholder="Comment — optional with new prices, mandatory when declining" data-neg-comment="${q.id}">
                                <span class="field-error" data-neg-err="${q.id}" style="display:block;font-size:11px"></span>
                            </span>
                            <button class="btn btn-sm btn-green" data-act="neg-answer" data-req="${q.id}">Submit new prices</button>
                            <button class="btn btn-sm btn-danger-outline" data-act="neg-decline" data-req="${q.id}">Decline request</button>
                        </div>` : (q.responseComment ? `<div class="qt-sub" style="margin-top:8px"><strong>My comment:</strong> ${ui.esc(q.responseComment)}</div>` : '')}
                    </div>
                </div>`;
            }).join('')}
        </div>`;
    }

    function supplierNegRespond(rfxId, reqId, me, type, view) {
        const ui = U(), Wf = W();
        const rfx = window.Store.rfxById(rfxId);
        const req = (rfx.negRequests || []).find(q => q.id === reqId);
        if (!req || req.status !== 'pending') { ui.toast({ title: 'Already answered', body: 'This negotiation request is already closed.' }); return; }
        const commentInp = view.querySelector(`[data-neg-comment="${reqId}"]`);
        const comment = commentInp ? commentInp.value.trim() : '';
        if (type === 'declined' && !comment) {
            commentInp.classList.add('error');
            view.querySelector(`[data-neg-err="${reqId}"]`).textContent = 'A comment is mandatory when declining a negotiation request.';
            return;
        }
        const responses = {};
        if (type === 'answered') {
            let bad = false;
            req.items.forEach(ni => {
                const inp = view.querySelector(`[data-neg-price="${reqId}::${ni.itemId}"]`);
                const v = inp ? Number(inp.value) : NaN;
                if (!inp || inp.value === '' || isNaN(v) || v <= 0) { if (inp) inp.classList.add('error'); bad = true; return; }
                responses[ni.itemId] = { newPrice: v };
            });
            if (bad) {
                view.querySelector(`[data-neg-err="${reqId}"]`).textContent = 'Enter a valid new price for every item (keep the previous price where you cannot improve).';
                return;
            }
        }
        window.Store.set(s => {
            const r = s.rfxs.find(x => x.id === rfxId);
            const q = r.negRequests.find(x => x.id === reqId);
            q.status = type;
            q.responseComment = comment;
            q.respondedTs = Date.now();
            if (type === 'answered') q.responses = responses;
            const sup = s.suppliers.find(x => x.id === me.supplierId);
            const improved = type === 'answered'
                ? q.items.filter(ni => Number((responses[ni.itemId] || {}).newPrice) < Number(ni.prevPrice)).length : 0;
            Wf.log(r, me, 'negotiation', sup.name + (type === 'answered'
                ? ' answered the negotiation request — new prices on ' + improved + ' of ' + q.items.length + ' item(s)' + (comment ? ' — \u201C' + comment + '\u201D' : '')
                : ' declined the negotiation request — \u201C' + comment + '\u201D'));
            Wf.notifyNegResponse(s, r, sup.name, type);
        });
        ui.toast(type === 'answered'
            ? { title: 'New prices sent', body: 'Your revised prices were sent to the customer.' }
            : { kind: 'error', title: 'Request declined', body: 'The customer was informed that you keep your original prices.' });
        supplierSummary(window.Store.rfxById(rfxId), me);
    }

    /* ---------- bindings ---------- */
    function bind(view, rfx, me) {
        const ui = U(), Wf = W();
        // evaluation notes persist on change without a full re-render
        view.querySelectorAll('[data-ev-notes]').forEach(inp => inp.addEventListener('input', () => {
            inp.classList.remove('error');
            const err = view.querySelector(`[data-note-err="${inp.getAttribute('data-sup')}"]`);
            if (err) err.textContent = '';
        }));
        view.querySelectorAll('[data-ev-notes]').forEach(inp => inp.addEventListener('change', () => {
            window.Store.set(s => {
                const r = s.rfxs.find(x => x.id === rfx.id);
                const sid = inp.getAttribute('data-sup');
                if (!r.techEval[sid]) r.techEval[sid] = { verdict: null, notes: '' };
                r.techEval[sid].notes = inp.value;
            });
        }));
        view.querySelectorAll('[data-award]').forEach(radio => radio.addEventListener('change', () => {
            if (!radio.checked) return;
            window.Store.set(s => {
                const r = s.rfxs.find(x => x.id === rfx.id);
                r.awards[radio.getAttribute('data-item')] = { supplierId: radio.getAttribute('data-sup'), awardedBy: me.id, ts: Date.now() };
            });
            render(window.Store.rfxById(rfx.id), me);
        }));

        ui.bindActions(view, {
            'back': () => ui.go('#/rfx'),
            'edit': () => ui.go('#/rfx/' + rfx.id + '/edit'),
            'del-draft': () => ui.openModal({
                title: 'Delete draft?',
                bodyHtml: `<p>Draft <strong>${ui.esc(rfx.no)}</strong> will be permanently deleted.</p>`,
                buttons: [
                    { label: 'Cancel', onClick: (o) => o.remove() },
                    { label: 'Delete', cls: 'btn-danger-outline', onClick: (o) => {
                        o.remove();
                        window.Store.set(s => { s.rfxs = s.rfxs.filter(x => x.id !== rfx.id); });
                        ui.toast({ title: 'Draft deleted', body: rfx.no });
                        ui.go('#/rfx');
                    } }
                ]
            }),
            'tab': (t) => { activeTab = t.getAttribute('data-tab'); render(window.Store.rfxById(rfx.id), me); },
            'expire': () => {
                window.Store.set(s => { s.rfxs.find(x => x.id === rfx.id).deadline = Date.now() - 60000; });
                ui.toast({ title: 'Deadline expired (demo)', body: 'Offers are now open for evaluation.' });
                render(window.Store.rfxById(rfx.id), me);
            },
            'verdict': (t) => {
                const sid = t.getAttribute('data-sup');
                const v = t.getAttribute('data-v');
                // a verdict is given exactly once — never overwritten by re-clicks
                if (Wf.verdictOf(window.Store.rfxById(rfx.id), sid)) {
                    ui.toast({ title: 'Already evaluated', body: 'This supplier already has a final technical verdict.' });
                    return;
                }
                const noteInp = view.querySelector(`[data-ev-notes][data-sup="${sid}"]`);
                const note = noteInp ? noteInp.value.trim() : '';
                // declining without an explanation is not allowed
                if (v === 'fail' && !note) {
                    if (noteInp) { noteInp.classList.add('error'); noteInp.focus(); }
                    const err = view.querySelector(`[data-note-err="${sid}"]`);
                    if (err) err.textContent = 'A note explaining the decline is mandatory.';
                    return;
                }
                window.Store.set(s => {
                    const r = s.rfxs.find(x => x.id === rfx.id);
                    if (!r.techEval[sid]) r.techEval[sid] = { verdict: null, notes: '' };
                    r.techEval[sid].verdict = v;
                    r.techEval[sid].notes = note;
                    r.techEval[sid].evaluatedBy = me.id;
                    r.techEval[sid].evaluatedTs = Date.now();
                    const sup = s.suppliers.find(x => x.id === sid);
                    Wf.log(r, me, 'verdict', sup.name + ' technically ' + (v === 'pass' ? 'approved' : 'declined') + (note ? ' — “' + note + '”' : ''));
                });
                const supName = (window.Store.supplierById(sid) || {}).name || 'Supplier';
                if (v === 'pass') {
                    ui.toast({ title: 'Supplier approved', body: supName + ' passed the technical evaluation and can be awarded items.' });
                } else {
                    ui.toast({ kind: 'error', title: 'Supplier declined', body: supName + ' is technically declined and cannot be awarded any item.' });
                }
                render(window.Store.rfxById(rfx.id), me);
            },
            'bid-eval': () => bidEvalOpen(window.Store.rfxById(rfx.id)),
            'finalize': () => {
                const r = window.Store.rfxById(rfx.id);
                const count = Object.keys(r.awards || {}).length;
                const unawarded = r.items.length - count;
                ui.openModal({
                    title: 'Finalize awards?',
                    bodyHtml: `<p><strong>${count}</strong> of ${r.items.length} items have a selected winner.${unawarded ? ' The remaining ' + unawarded + ' item(s) will stay unawarded.' : ''}</p>
                        <p class="muted" style="margin-top:8px">Suppliers will be notified of the results. This cannot be undone.</p>`,
                    buttons: [
                        { label: 'Cancel', onClick: (o) => o.remove() },
                        { label: 'Finalize awards', cls: 'btn-green', onClick: (o) => {
                            o.remove();
                            window.Store.set(s => {
                                const rr = s.rfxs.find(x => x.id === rfx.id);
                                rr.status = 'Awarded';
                                rr.awardFinalizedTs = Date.now();
                                Wf.log(rr, me, 'awarded', 'Awards finalized — ' + Object.keys(rr.awards).length + ' item(s) awarded');
                                Wf.notifyAward(s, rr);
                            });
                            ui.toast({ title: 'Awards finalized', body: rfx.no + ' is now awarded.' });
                            render(window.Store.rfxById(rfx.id), me);
                        } }
                    ]
                });
            }
        });
    }

    window.Views = window.Views || {};
    window.Views.rfxDetail = rfxDetail;
})();
