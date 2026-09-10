/* ============================================================
   i18n.js — English / Azerbaijani translation layer (Sourcing).
   Views always render English; when AZ is selected every text node
   and placeholder/title attribute is translated via the dictionary
   (exact phrases first, then sub-phrases). Switching back to EN
   simply re-renders the view.
   ============================================================ */
(function () {

    const EXACT = {
        // chrome
        'SOURCING': 'SATINALMA MƏNBƏLƏRİ',
        'Acting as': 'Rol:',
        'Switch user (demo)': 'İstifadəçini dəyiş (demo)',
        'Demo': 'Demo',
        '↻ Reset demo data': '↻ Demo məlumatlarını sıfırla',
        'Notifications': 'Bildirişlər',
        'Mark all read': 'Hamısını oxunmuş et',
        'No notifications': 'Bildiriş yoxdur',
        'Navigation': 'Naviqasiya',
        'Modules': 'Modullar',
        'Demand Planning': 'Tələbat planlaması',
        'Sourcing': 'Satınalma mənbələri',
        'RFX List': 'RFX siyahısı',
        'Suppliers': 'Təchizatçılar',
        'Supplier': 'Təchizatçı',
        'Customer': 'Müştəri',
        // lifecycle
        'Draft': 'Qaralama',
        'Open for bidding': 'Təkliflərə açıq',
        'Bidding closed': 'Təklif qəbulu bitib',
        'Awarded': 'Qalib seçilib',
        'Cancelled': 'Ləğv edilib',
        'Deadline passed': 'Son tarix keçib',
        // list page
        'Create RFX': 'RFX yarat',
        'Material RFX': 'Material RFX',
        'Service RFX': 'Xidmət RFX',
        'All types': 'Bütün tiplər',
        'All statuses': 'Bütün statuslar',
        'Search': 'Axtar',
        'Materials': 'Materiallar',
        'Services': 'Xidmətlər',
        'Items': 'Sətirlər',
        'Deadline': 'Son tarix',
        'Category': 'Kateqoriya',
        'Status': 'Status',
        'Title': 'Başlıq',
        'No RFXes yet.': 'Hələ RFX yoxdur.',
        'New': 'Yeni',
        // form
        'RFX Title': 'RFX başlığı',
        'Description': 'Təsvir',
        'Submission deadline': 'Təqdimat üçün son tarix',
        'RFX Category': 'RFX kateqoriyası',
        'Scope Category': 'Əhatə kateqoriyası',
        'Selected automatically from the added items': 'Əlavə edilmiş sətirlər əsasında avtomatik seçilir',
        'Quantity': 'Miqdar',
        'Add item': 'Sətir əlavə et',
        'Upload Excel template': 'Excel şablonunu yüklə',
        'Download template': 'Şablonu endir',
        'Technical questions': 'Texniki suallar',
        'Add question': 'Sual əlavə et',
        'Question type': 'Sual tipi',
        'File Upload / Attachment': 'Fayl yükləmə / Əlavə',
        'Yes / No': 'Bəli / Xeyr',
        'Short Text': 'Qısa mətn',
        'Long Text / Paragraph': 'Uzun mətn / Paraqraf',
        'Required': 'Məcburi',
        'Optional attachment': 'Könüllü əlavə',
        'Select suppliers': 'Təchizatçıları seç',
        'Save draft': 'Qaralamanı saxla',
        'Send to suppliers': 'Təchizatçılara göndər',
        'Cancel': 'Ləğv et',
        'Save': 'Saxla',
        'Delete': 'Sil',
        'Edit': 'Redaktə et',
        // items
        'SAP ID': 'SAP ID',
        'Internal ID': 'Daxili ID',
        'Short Description': 'Qısa təsvir',
        'Long Description': 'Uzun təsvir',
        'Manufacturer Name': 'İstehsalçı adı',
        'Manufacturer Part Number': 'İstehsalçı hissə nömrəsi',
        'UoM': 'ÖV',
        'Average Annual Demand': 'Orta illik tələbat',
        'Quantity': 'Miqdar',
        'Lot size': 'Partiya ölçüsü',
        'Plant': 'Zavod',
        'Notes': 'Qeydlər',
        // detail / envelopes
        'Technical envelope': 'Texniki zərf',
        'Commercial envelope': 'Kommersiya zərfi',
        'Offers': 'Təkliflər',
        'Bid evaluation': 'Təkliflərin qiymətləndirilməsi',
        'Award': 'Qalib seç',
        'Awards finalized': 'Qaliblər təsdiqləndi',
        'Finalize awards': 'Qalibləri təsdiqlə',
        'Technical verdict': 'Texniki qərar',
        'Pass': 'Keçdi',
        'Fail': 'Keçmədi',
        'Approve': 'Təsdiqlə',
        'Decline': 'Rədd et',
        'A note explaining the decline is mandatory.': 'Rədd səbəbini izah edən qeyd məcburidir.',
        'Pending': 'Gözləyir',
        'Sealed': 'Möhürlü',
        'History': 'Tarixçə',
        'Overview': 'Ümumi baxış',
        'Unit Price': 'Vahid qiymət',
        'Currency': 'Valyuta',
        'Incoterm': 'Inkoterm',
        'Lead time (days)': 'Tədarük müddəti (gün)',
        'MoQ': 'Min. sifariş',
        'On spec': 'Spesifikasiyaya uyğun',
        'Off spec': 'Spesifikasiyadan kənar',
        'Alternative offer': 'Alternativ təklif',
        'Submit offer': 'Təklifi təqdim et',
        'Submitted': 'Təqdim edilib',
        'Not submitted': 'Təqdim edilməyib',
        'In progress': 'Davam edir',
        'Invited': 'Dəvət edilib',
        'My offer': 'Mənim təklifim',
        'Answers': 'Cavablar',
        'Yes': 'Bəli',
        'No': 'Xeyr'
    };

    // longest-first sub-phrase pass for composite strings the exact pass misses
    const KEYS = Object.keys(EXACT).sort((a, b) => b.length - a.length);

    function trPhrase(text) {
        const t = text.trim();
        if (!t) return text;
        if (EXACT[t]) return text.replace(t, EXACT[t]);
        let out = text;
        for (const k of KEYS) {
            if (k.length < 3) continue;
            if (out.indexOf(k) !== -1) out = out.split(k).join(EXACT[k]);
        }
        return out;
    }

    function apply() {
        const s = window.Store.session();
        if ((s.lang || 'en') !== 'az') return;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) => {
                const p = n.parentNode && n.parentNode.nodeName;
                if (p === 'SCRIPT' || p === 'STYLE') return NodeFilter.FILTER_REJECT;
                return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(n => {
            const tr = trPhrase(n.nodeValue);
            if (tr !== n.nodeValue) n.nodeValue = tr;
        });
        document.querySelectorAll('[placeholder], [title]').forEach(el => {
            ['placeholder', 'title'].forEach(a => {
                const v = el.getAttribute(a);
                if (!v) return;
                const tr = trPhrase(v);
                if (tr !== v) el.setAttribute(a, tr);
            });
        });
    }

    function setLang(lang) {
        window.Store.set(s => { s.session.lang = lang; });
        // re-render from the English source, then translate if needed
        window.UI.renderHeader();
        window.Router.render();
        apply();
    }

    function t(text) {
        const s = window.Store.session();
        return (s.lang === 'az') ? trPhrase(text) : text;
    }

    window.I18N = { apply, setLang, t };
})();
