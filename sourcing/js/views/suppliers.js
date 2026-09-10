/* ============================================================
   views/suppliers.js — supplier directory (customer side)
   ============================================================ */
(function () {
    const U = () => window.UI;

    function suppliers() {
        const ui = U();
        const me = window.Store.currentUser();
        if (!window.Workflow.isCustomer(me)) { ui.go('#/rfx'); return; }
        const view = document.getElementById('view');
        const list = window.Store.suppliers();
        const rfxs = window.Store.rfxs();

        view.innerHTML = `${ui.breadcrumb('Suppliers')}<div class="page-full">
            <div class="req-head">
                <div>
                    <div class="req-eyebrow">Master data</div>
                    <div class="req-title">Suppliers</div>
                </div>
                <div class="req-head-right"><button class="btn btn-green" data-act="add">+ Add supplier</button></div>
            </div>
            <div class="inbox-table-wrap"><table class="data-table inbox-table">
                <thead><tr><th>Name</th><th>Location</th><th>Contact</th><th>Categories</th><th>Invited</th><th>Offers submitted</th><th>Items won</th></tr></thead>
                <tbody>${list.map(sup => {
                    const invited = rfxs.filter(r => r.status !== 'Draft' && r.supplierIds.indexOf(sup.id) !== -1);
                    const submitted = invited.filter(r => { const rp = r.responses[sup.id]; return rp && rp.status === 'submitted'; });
                    const won = rfxs.reduce((a, r) => a + Object.keys(r.awards || {}).filter(k => r.awards[k].supplierId === sup.id).length, 0);
                    return `<tr>
                        <td style="font-weight:700">${ui.esc(sup.name)}</td>
                        <td>${ui.esc(sup.city)}, ${ui.esc(sup.country)}</td>
                        <td>${ui.esc(sup.email)}<div class="muted" style="font-size:12px">${ui.esc(sup.phone || '')}</div></td>
                        <td>${(sup.categories || []).map(c => `<span class="q-type-chip" style="margin:1px 2px 1px 0;display:inline-block">${ui.esc(c)}</span>`).join('')}</td>
                        <td>${invited.length}</td><td>${submitted.length}</td>
                        <td>${won ? `<span class="awarded-chip">${won}</span>` : '—'}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table></div>
        </div>`;

        ui.bindActions(view, {
            'add': () => {
                const dsets = ui.ds();
                ui.openModal({
                    title: 'Add supplier', wide: true,
                    bodyHtml: `<div class="form-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                        ${ui.field({ label: 'Company name', name: 's_name', required: true })}
                        ${ui.field({ label: 'Email', name: 's_email', required: true })}
                        ${ui.field({ label: 'Country', name: 's_country' })}
                        ${ui.field({ label: 'City', name: 's_city' })}
                        ${ui.field({ label: 'Phone', name: 's_phone' })}
                        ${ui.field({ label: 'Category', name: 's_cat', type: 'select', options: dsets.RFX_CATEGORIES })}
                    </div>
                    <div class="muted" style="margin-top:8px">A supplier portal user is created automatically for demo purposes.</div>`,
                    buttons: [
                        { label: 'Cancel', onClick: (o) => o.remove() },
                        { label: 'Add supplier', cls: 'btn-green', onClick: (o) => {
                            const g = (n) => { const el = o.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ''; };
                            if (!g('s_name') || !g('s_email')) {
                                ['s_name', 's_email'].forEach(n => { const el = o.querySelector(`[name="${n}"]`); if (el && !el.value.trim()) el.classList.add('error'); });
                                return;
                            }
                            const id = window.Store.uid('sup');
                            window.Store.set(s => {
                                s.suppliers.push({ id, name: g('s_name'), email: g('s_email'), country: g('s_country'), city: g('s_city'), phone: g('s_phone'), categories: g('s_cat') ? [g('s_cat')] : [] });
                                s.users.push({ id: window.Store.uid('u'), name: g('s_name') + ' user', role: 'SUPPLIER', supplierId: id, email: g('s_email') });
                            });
                            o.remove();
                            ui.toast({ title: 'Supplier added', body: g('s_name') + ' can now be invited to RFXes.' });
                            suppliers();
                        } }
                    ]
                });
            }
        });
    }

    window.Views = window.Views || {};
    window.Views.suppliers = suppliers;
})();
