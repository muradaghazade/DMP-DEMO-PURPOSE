/* ============================================================
   workflow.js — RFX lifecycle + dual-envelope business rules

   Lifecycle:  Draft → Published(Open) → [deadline passes] Closed →
               technical evaluation (CAM) → per-item awards (PROC) → Awarded

   Sealed bids: nobody on the customer side sees ANY response content
   until the submission deadline has passed.

   Strict dual envelope after opening:
     CAM  — sees technical answers only (never prices), gives each
            submitted supplier a Pass/Fail technical verdict.
     PROC — sees commercial data (quotes) + technical VERDICTS (not the
            raw answers). Awarding unlocks only when every submitted
            supplier has a technical verdict, and only technically
            passed suppliers can win an item.
   ============================================================ */
(function () {

    /* ---------- roles ---------- */
    function isCustomer(user) { return user.role === 'CAM' || user.role === 'PROC'; }
    function isSupplier(user) { return user.role === 'SUPPLIER'; }

    /* ---------- lifecycle ---------- */
    // derived phase — the stored status never flips just because time passed
    function phase(rfx) {
        if (rfx.status === 'Draft') return 'Draft';
        if (rfx.status === 'Awarded') return 'Awarded';
        if (rfx.status === 'Cancelled') return 'Cancelled';
        return Date.now() > rfx.deadline ? 'Closed' : 'Open';
    }
    const PHASE_LABEL = {
        Draft: 'Draft', Open: 'Open for bidding', Closed: 'Bidding closed',
        Awarded: 'Awarded', Cancelled: 'Cancelled'
    };
    const PHASE_CLS = {
        Draft: 'st-draft', Open: 'st-open', Closed: 'st-closed',
        Awarded: 'st-awarded', Cancelled: 'st-cancelled'
    };
    function phaseLabel(rfx) { return PHASE_LABEL[phase(rfx)]; }
    function phaseCls(rfx) { return PHASE_CLS[phase(rfx)]; }

    /* ---------- sealed-bid + envelope visibility ---------- */
    function offersOpen(rfx) { const p = phase(rfx); return p === 'Closed' || p === 'Awarded'; }
    function canSeeTechnical(user) { return user.role === 'CAM'; }
    function canSeeCommercial(user) { return user.role === 'PROC'; }

    /* ---------- responses ---------- */
    function responseOf(rfx, supplierId) { return (rfx.responses || {})[supplierId] || null; }
    function submittedSupplierIds(rfx) {
        return (rfx.supplierIds || []).filter(id => {
            const r = responseOf(rfx, id);
            return r && r.status === 'submitted';
        });
    }
    // the quote a supplier is competing with on a line: the direct quote, or —
    // per the bid-evaluation rules — the alternative offer when the line itself
    // was not priced but a substitute was
    function quoteFor(rfx, supplierId, itemId) {
        const r = responseOf(rfx, supplierId);
        if (!r || r.status !== 'submitted') return null;
        const q = (r.quotes || {})[itemId];
        if (!q) return null;
        const hasDirect = q.unitPrice !== undefined && q.unitPrice !== null && q.unitPrice !== '';
        let base = null;
        if (hasDirect) base = { price: Number(q.unitPrice), currency: q.currency || 'USD', isAlt: false, q };
        else if (q.alt && q.alt.price) base = { price: Number(q.alt.price), currency: q.alt.currency || q.currency || 'USD', isAlt: true, q };
        if (!base) return null;
        // a countered negotiation price overrides the originally quoted one
        const neg = negPrice(rfx, itemId, supplierId);
        if (neg && !isNaN(neg.price)) {
            base.originalPrice = base.price;
            base.price = neg.price;
            base.negotiated = true;
        }
        return base;
    }
    function quotingSuppliers(rfx, itemId) {
        return submittedSupplierIds(rfx).filter(id => quoteFor(rfx, id, itemId));
    }

    /* ---------- price negotiation (requests created in the bid-evaluation tool) ----------
       PROC creates negotiation REQUESTS from the tool's saving-opportunities view;
       each request targets ONE supplier and carries the items with their previous
       price and a target price (defaulting to the best price across suppliers).

       rfx.negRequests = [{ id, supplierId, note, createdByName, createdTs,
           items: [{itemId, prevPrice, currency, target}],
           status: 'pending'|'answered'|'declined',
           responses: { [itemId]: { newPrice } }, responseComment, respondedTs }] */
    function negRequestsFor(rfx, supplierId) {
        return (rfx.negRequests || []).filter(q => q.supplierId === supplierId);
    }
    function pendingNegRequests(rfx, supplierId) {
        return negRequestsFor(rfx, supplierId).filter(q => q.status === 'pending');
    }
    // the supplier's latest answered new price for an item — this becomes their
    // effective price for comparison, awarding and export
    function negPrice(rfx, itemId, supplierId) {
        let out = null;
        (rfx.negRequests || []).forEach(q => {
            if (q.supplierId !== supplierId || q.status !== 'answered') return;
            const r = (q.responses || {})[itemId];
            if (r && r.newPrice !== null && r.newPrice !== undefined && r.newPrice !== '') {
                if (!out || (q.respondedTs || 0) >= (out.ts || 0)) out = { price: Number(r.newPrice), ts: q.respondedTs || 0 };
            }
        });
        return out;
    }
    function notifyNegRequest(s, rfx, supId, itemCount) {
        s.notifications.unshift({
            id: window.Store.uid('ntf'), read: false, ts: Date.now(), forSupplierId: supId,
            title: 'Price negotiation request',
            body: rfx.no + ' — the customer asks for revised prices on ' + itemCount + ' item(s).', rfxId: rfx.id
        });
    }
    function notifyNegResponse(s, rfx, supName, type) {
        s.notifications.unshift({
            id: window.Store.uid('ntf'), read: false, ts: Date.now(), forRole: 'PROC',
            title: type === 'answered' ? 'Revised prices received' : 'Negotiation request declined',
            body: supName + ' · ' + rfx.no, rfxId: rfx.id
        });
    }

    /* ---- outbox: the bid-evaluation tool (a separate page) queues negotiation
       requests in localStorage; any Sourcing tab consumes them into the state.
       Entries: {id, rfxId, note, createdByName,
                 requests: [{supplierId, items:[{itemId, prevPrice, currency, target}]}]} */
    const NEG_OUTBOX_KEY = 'dmp_sourcing_neg_outbox';
    function consumeNegOutbox() {
        let entries = [];
        try {
            const raw = localStorage.getItem(NEG_OUTBOX_KEY);
            if (raw) entries = JSON.parse(raw);
            localStorage.removeItem(NEG_OUTBOX_KEY);
        } catch (e) { return 0; }
        if (!Array.isArray(entries) || !entries.length) return 0;
        let applied = 0;
        window.Store.set(s => {
            entries.forEach(entry => {
                const r = s.rfxs.find(x => x.id === entry.rfxId);
                if (!r) return;
                if (!Array.isArray(r.negRequests)) r.negRequests = [];
                (entry.requests || []).forEach(req => {
                    const outboxId = entry.id + '::' + req.supplierId;
                    if (r.negRequests.some(q => q.outboxId === outboxId)) return;   // already consumed by another tab
                    const items = (req.items || []).filter(it => r.items.some(x => x.id === it.itemId));
                    if (!items.length) return;
                    r.negRequests.push({
                        id: window.Store.uid('neg'), outboxId, supplierId: req.supplierId,
                        note: entry.note || '', createdByName: entry.createdByName || '',
                        createdTs: Date.now(), items, status: 'pending', responses: {}
                    });
                    const sup = s.suppliers.find(x => x.id === req.supplierId);
                    r.history.push({
                        ts: Date.now(), actorUser: entry.createdByName || '', actorRole: 'PROC', action: 'negotiation',
                        text: 'Negotiation request sent to ' + (sup ? sup.name : req.supplierId) + ' — ' + items.length + ' item(s)' + (entry.note ? ' — “' + entry.note + '”' : '')
                    });
                    notifyNegRequest(s, r, req.supplierId, items.length);
                    applied += 1;
                });
            });
        });
        return applied;
    }

    /* ---------- technical evaluation (CAM) ---------- */
    function verdictOf(rfx, supplierId) {
        const e = (rfx.techEval || {})[supplierId];
        return e ? e.verdict : null;   // 'pass' | 'fail' | null
    }
    function techEvalDone(rfx) {
        const subs = submittedSupplierIds(rfx);
        return subs.length > 0 && subs.every(id => verdictOf(rfx, id));
    }

    /* ---------- awarding (PROC) ---------- */
    function canAward(rfx) { return phase(rfx) === 'Closed' && techEvalDone(rfx); }
    function awardOf(rfx, itemId) { return (rfx.awards || {})[itemId] || null; }
    function allItemsAwarded(rfx) {
        // only items at least one passed supplier actually quoted can be awarded
        const awardableItems = (rfx.items || []).filter(it =>
            quotingSuppliers(rfx, it.id).some(id => verdictOf(rfx, id) === 'pass'));
        return awardableItems.length > 0 && awardableItems.every(it => awardOf(rfx, it.id));
    }

    /* ---------- numbering: RFQ-<yyyymmdd>-<5 digits> ---------- */
    function nextNo(s, type) {
        const key = type === 'service' ? 'service' : 'material';
        s.seq[key] = (s.seq[key] || 0) + 1;
        const d = new Date();
        const stamp = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        let tail;
        do {
            tail = String(10000 + Math.floor(Math.random() * 90000));
        } while ((s.rfxs || []).some(r => r.no === 'RFQ-' + stamp + '-' + tail));
        return 'RFQ-' + stamp + '-' + tail;
    }

    /* ---------- history ---------- */
    function log(rfx, user, action, text) {
        rfx.history.push({ ts: Date.now(), actorUser: user.name, actorRole: user.role, action, text });
    }

    /* ---------- notifications ----------
       Addressing: forRole ('CAM'|'PROC'|'CUSTOMER') or forSupplierId. */
    function notifVisible(n, user) {
        if (n.forSupplierId) return user.supplierId === n.forSupplierId;
        if (n.forRole === 'CUSTOMER') return isCustomer(user);
        if (n.forRole) return user.role === n.forRole;
        return true;
    }
    function notifyPublish(s, rfx) {
        rfx.supplierIds.forEach(supId => {
            s.notifications.unshift({
                id: window.Store.uid('ntf'), read: false, ts: Date.now(), forSupplierId: supId,
                title: 'New RFX received', body: rfx.no + ' — ' + rfx.title, rfxId: rfx.id
            });
        });
    }
    function notifySubmission(s, rfx, supplier) {
        s.notifications.unshift({
            id: window.Store.uid('ntf'), read: false, ts: Date.now(), forRole: 'CUSTOMER',
            title: 'Offer submitted', body: supplier.name + ' submitted an offer for ' + rfx.no + '. Contents stay sealed until the deadline.', rfxId: rfx.id
        });
    }
    function notifyAward(s, rfx) {
        rfx.supplierIds.forEach(supId => {
            const won = Object.keys(rfx.awards).filter(itId => rfx.awards[itId].supplierId === supId).length;
            const r = responseOf(rfx, supId);
            if (!r || r.status !== 'submitted') return;
            s.notifications.unshift({
                id: window.Store.uid('ntf'), read: false, ts: Date.now(), forSupplierId: supId,
                title: rfx.no + ' awarded',
                body: won ? ('You have been awarded ' + won + ' item' + (won > 1 ? 's' : '') + '.') : 'The RFX was awarded to other suppliers. Thank you for participating.',
                rfxId: rfx.id
            });
        });
    }

    /* ---------- deadline formatting ---------- */
    function fmtDate(ts) {
        if (!ts) return '—';
        return new Date(ts).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function timeLeft(rfx) {
        const ms = rfx.deadline - Date.now();
        if (ms <= 0) return 'Deadline passed';
        const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
        if (d > 0) return d + 'd ' + h + 'h left';
        const m = Math.floor((ms % 3600000) / 60000);
        return h > 0 ? (h + 'h ' + m + 'm left') : (m + 'm left');
    }

    window.Workflow = {
        isCustomer, isSupplier,
        phase, phaseLabel, phaseCls,
        offersOpen, canSeeTechnical, canSeeCommercial,
        responseOf, submittedSupplierIds, quoteFor, quotingSuppliers,
        verdictOf, techEvalDone, canAward, awardOf, allItemsAwarded,
        nextNo, log, notifVisible, notifyPublish, notifySubmission, notifyAward,
        negRequestsFor, pendingNegRequests, negPrice,
        notifyNegRequest, notifyNegResponse, consumeNegOutbox,
        fmtDate, timeLeft
    };
})();
