/* ============================================================
   views/cart.js — shopping cart → Sourcing module RFX handoff

   Items added from the material master collect here; "Create RFX
   with shopping cart" pushes them to the Sourcing module server
   (POST /api/handoff, CORS-enabled) and opens its RFX form with
   the cart pre-loaded (#/rfx/new?type=material&handoff=<id>).
   ============================================================ */
(function () {
    const esc = (s) => window.UI.esc(s);
    // the Sourcing module runs as a sibling app; override via window.SOURCING_URL if needed
    const SOURCING_URL = window.SOURCING_URL || 'http://127.0.0.1:8124';

    function cartRows() {
        return (window.Store.get().cart || [])
            .map(c => ({ c, m: window.Store.materialById(c.materialId) }))
            .filter(x => x.m);   // drop entries whose material no longer exists
    }

    function render() {
        const root = document.getElementById('view');
        const rows = cartRows();
        const noImg = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9CCC6" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;

        root.innerHTML = `
            <div class="sub-header"><span class="crumb-link" data-act="back">Material Master</span> › Shopping cart</div>
            <div class="page-full">
                <div class="req-head">
                    <div>
                        <div class="req-eyebrow">Sourcing</div>
                        <div class="req-title">Shopping cart</div>
                    </div>
                    <div class="req-head-right">
                        ${rows.length ? `<button class="btn btn-outline" data-act="clear">Clear cart</button>
                        <button class="btn btn-green" data-act="create-rfx">Create RFX with shopping cart</button>` : ''}
                    </div>
                </div>
                ${rows.length ? `
                <div class="muted" style="margin-bottom:14px">${rows.length} item${rows.length > 1 ? 's' : ''} in the cart. Quantities become the item quantities on the RFX lines.</div>
                <div class="inbox-table-wrap"><table class="data-table cart-table">
                    <thead><tr><th></th><th>Item</th><th>SAP ID</th><th>Manufacturer</th><th>UoM</th><th>Quantity</th><th></th></tr></thead>
                    <tbody>${rows.map(({ c, m }) => `
                        <tr>
                            <td style="width:54px"><div class="cart-thumb">${m.image ? `<img src="${m.image}" alt="">` : noImg}</div></td>
                            <td><span class="crumb-link" data-act="open-item" data-id="${m.id}" style="font-weight:600">${esc(m.shortName || m.name)}</span>
                                <div class="muted" style="font-size:12px">${esc(m.unspscLabel || m.category || '')}</div></td>
                            <td>${esc(m.sapId || '—')}</td>
                            <td>${esc(m.manufacturer || '—')}</td>
                            <td>${esc(m.baseUom || '—')}</td>
                            <td><input type="number" min="1" class="form-input cart-qty" data-qty="${m.id}" value="${esc(c.qty || 1)}"></td>
                            <td><button class="btn-view btn-view-danger" data-act="remove" data-id="${m.id}" title="Remove from cart">✕</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table></div>` : `
                <div class="empty-state" style="padding:60px 0">
                    <div style="font-size:34px;margin-bottom:10px">🛒</div>
                    Your cart is empty.<br>
                    <span class="muted">Add items from the Material Master, then create an RFX from here.</span><br><br>
                    <button class="btn btn-black" data-act="back">Browse Material Master</button>
                </div>`}
            </div>`;

        window.UI.bindActions(root, {
            'back': () => window.UI.go('#/master'),
            'open-item': (t) => window.UI.go('#/item/' + t.getAttribute('data-id')),
            'remove': (t) => {
                window.Store.set(s => { s.cart = s.cart.filter(c => c.materialId !== t.getAttribute('data-id')); });
                window.UI.renderHeader();
                render();
            },
            'clear': () => {
                window.Store.set(s => { s.cart = []; });
                window.UI.renderHeader();
                render();
            },
            'create-rfx': () => createRfx()
        });
        root.querySelectorAll('[data-qty]').forEach(inp => inp.addEventListener('change', () => {
            const qty = Math.max(1, Number(inp.value) || 1);
            inp.value = qty;
            window.Store.set(s => {
                const c = s.cart.find(x => x.materialId === inp.getAttribute('data-qty'));
                if (c) c.qty = qty;
            });
        }));
    }

    /* ---- push the cart to the Sourcing module and open its RFX form ---- */
    function handoffPayload(rows) {
        return {
            source: 'dp_pro',
            title: '',
            items: rows.map(({ c, m }) => ({
                sapId: m.sapId || '',
                internalId: m.dmpId || m.id,
                shortName: m.shortName || m.name || '',
                longDesc: m.longDesc || '',
                manufacturer: m.manufacturer || '',
                partNumber: m.mfrPartNo || '',
                uom: m.baseUom || 'EA',
                qty: c.qty || 1,
                plant: (m.plants || [])[0] || '',
                unspsc: m.unspsc || '',
                category: m.unspscLabel || m.category || '',
                attrs: m.attributes || {}
            }))
        };
    }

    function createRfx() {
        const rows = cartRows();
        if (!rows.length) return;
        window.UI.openModal({
            title: 'Create RFX with shopping cart?',
            bodyHtml: `<p><strong>${rows.length}</strong> item${rows.length > 1 ? 's' : ''} will be migrated to the Sourcing module, where the RFX form opens with these lines pre-loaded.</p>
                <p class="muted" style="margin-top:8px">The cart is cleared after a successful migration.</p>`,
            buttons: [
                { label: 'Cancel', onClick: (o) => o.remove() },
                { label: 'Create RFX', cls: 'btn-green', onClick: (o) => {
                    const btns = o.querySelectorAll('.modal-foot .btn');
                    btns.forEach(b => b.disabled = true);
                    fetch(SOURCING_URL + '/api/handoff', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(handoffPayload(rows))
                    })
                        .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
                        .then(res => {
                            if (!res || !res.id) throw new Error('bad response');
                            o.remove();
                            window.Store.set(s => { s.cart = []; });
                            window.UI.renderHeader();
                            // same-tab navigation: if the user came from the Sourcing RFX
                            // form ("Select from Material Master"), their draft is restored
                            // there with these items appended
                            window.location.href = SOURCING_URL + '/#/rfx/new?type=material&handoff=' + encodeURIComponent(res.id);
                        })
                        .catch(() => {
                            btns.forEach(b => b.disabled = false);
                            window.UI.toast({ kind: 'error', title: 'Migration failed',
                                body: 'Could not reach the Sourcing module. Is its server running on ' + SOURCING_URL.replace(/^https?:\/\//, '') + '?' });
                        });
                } }
            ]
        });
    }

    window.Views = window.Views || {};
    window.Views.cart = render;
})();
