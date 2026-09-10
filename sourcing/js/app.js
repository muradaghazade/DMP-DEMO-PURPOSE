/* ============================================================
   app.js — bootstrap (Sourcing)
   ============================================================ */
(function () {
    window.Views = window.Views || {};
    function boot() {
        window.Store.init();
        window.Router.start();
        if (window.I18N) window.I18N.apply();   // re-apply persisted language
        // pull the server-side copy of the state (data/state.json) — if it is newer
        // than the local cache (e.g. localStorage was cleared), adopt it and re-render
        window.Store.syncFromServer(function (changed) {
            if (changed) {
                window.UI.renderHeader();
                window.Router.render();
                if (window.I18N) window.I18N.apply();
            }
            // negotiation requests queued by the bid-evaluation tool (localStorage outbox)
            if (window.Workflow.consumeNegOutbox() > 0) {
                window.UI.renderHeader();
                window.Router.render();
            }
        });
        // the bid-evaluation tab writes the outbox while this tab is open — consume live
        window.addEventListener('storage', function (e) {
            if (e.key !== 'dmp_sourcing_neg_outbox' || !e.newValue) return;
            if (window.Workflow.consumeNegOutbox() > 0) {
                window.UI.toast({ title: 'Negotiation requests sent', body: 'Requests from the bid-evaluation tool were delivered to the suppliers.' });
                window.UI.renderHeader();
                window.Router.render();
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
