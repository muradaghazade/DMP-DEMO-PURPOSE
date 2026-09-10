/* ============================================================
   ai-remote.js — live AI engine client (e-catalogue pipeline)

   Single-search integration: master search submits the description to the
   e-catalogue classification pipeline through this app's server proxy
   (/api/ai/* in server.py — the API key never reaches the browser), polls
   the job, and maps the result into the same analysis shape the local
   engine produces (window.AI.assembleRemote finishes the outcome against
   the local master). Bulk processing intentionally still uses the local
   engine. Any failure falls back to window.AI.analyze in the caller.
   ============================================================ */
(function () {
    const POLL_MS = 3000;          // pipeline runs ~60s per product; poll gently
    const TIMEOUT_MS = 180000;
    const cache = new Map();       // normalized query → finished analysis (per page load)

    const normQ = (q) => String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const uuid = () => (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'ik_' + Date.now().toString(36) + Math.random().toString(36).slice(2);

    /* ---- map one pipeline result row → parsed fields + meta ---- */
    // Attribute rows arrive in TWO shapes: fresh classifications use lowercase
    // keys (attribute_name, possible_values as array), while rows REUSED from an
    // existing e-catalogue golden record use PascalCase (Attribute_Name,
    // Possible_Values as comma string, values in Extracted_Value). Normalize both.
    // possible values arrive as a real array, a JSON-encoded array string
    // ('["steel", "brass"]'), or a plain comma list — normalize all three
    function normPossible(v) {
        if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
        const s = String(v || '').trim();
        if (!s) return [];
        if (s.charAt(0) === '[') {
            try { const arr = JSON.parse(s); if (Array.isArray(arr)) return arr.map(x => String(x).trim()).filter(Boolean); } catch (e) { /* fall through */ }
        }
        return s.split(',').map(x => x.trim()).filter(Boolean);
    }

    function normAttr(a) {
        if (!a) return null;
        if (a.attribute_name) {
            const nv = (a.normalized_value !== undefined && a.normalized_value !== null && String(a.normalized_value).trim() !== '')
                ? a.normalized_value : a.raw_value;
            return { name: a.attribute_name, id: a.attribute_id || '', type: String(a.attribute_type || ''), unit: a.unit || '',
                possible: normPossible(a.possible_values), value: nv, status: a.status };
        }
        if (a.Attribute_Name) {
            return { name: a.Attribute_Name, id: a.Attribute_ID || '', type: String(a.Attribute_Data_Type || ''), unit: a.Unit || '',
                possible: normPossible(a.Possible_Values !== undefined ? a.Possible_Values : a.possible_values),
                value: a.Extracted_Value, status: 'found' };
        }
        return null;
    }

    // a reference-matched row can carry its found values only in the
    // _Reference_Extracted_Attributes echo — flatten it into value rows
    function referenceValueRows(r) {
        const ref = r._Reference_Extracted_Attributes;
        if (!ref) return [];
        const out = [];
        ['core_attributes', 'extra_attributes'].forEach(k => {
            const grp = ref[k] || {};
            Object.keys(grp).forEach(name => {
                const a = grp[name] || {};
                out.push({ name, id: '', type: String(a.attribute_type || ''), unit: a.unit || '',
                    possible: [], value: (a.normalized_value !== undefined && a.normalized_value !== null && String(a.normalized_value).trim() !== '') ? a.normalized_value : a.raw_value,
                    status: a.status || 'found' });
            });
        });
        return out;
    }

    function mapRow(raw, r) {
        const manufacturer = r.Verified_Manufacturer || r.Manufacturer_Candidate || '';
        const schemaRows = (r.Attributes || []).map(normAttr).filter(Boolean);
        const valRows = (r.core_attributes || []).concat(r.extra_attributes || []).map(normAttr).filter(Boolean)
            .concat(referenceValueRows(r));
        // extracted attribute VALUES (value rows first, schema-carried values as
        // backfill), unit appended when missing
        const vals = {};
        valRows.concat(schemaRows).forEach(a => {
            const st = String(a.status || '').toLowerCase();
            if (st && st !== 'found') return;
            let v = a.value;
            if (v === undefined || v === null || String(v).trim() === '') return;
            if (vals[a.name] !== undefined) return;
            v = String(v).trim();
            if (a.unit && v.toLowerCase().indexOf(String(a.unit).toLowerCase()) === -1) v += ' ' + a.unit;
            vals[a.name] = v;
        });

        const notes = [];
        if (r.Web_Verified) notes.push('Web-verified (' + (r.Web_Sources_Count || 1) + ' source' + ((r.Web_Sources_Count || 1) === 1 ? '' : 's') + ')');
        if (r.Model_Code) notes.push('Model ' + r.Model_Code);
        if (r.Part_Number && !r.Verified_Part_Number) notes.push('Part number from description');

        const parsed = {
            summary: r.English_Translation || r.Web_Product_Name || r.Cleaned_Full_Text || raw,
            name: r.Web_Product_Name || r.English_Translation || '',
            unspsc: r.UNSPSC_Code || '',
            unspscLabel: r.UNSPSC_Title || '',
            category: r.UNSPSC_Title || '',
            materialGroup: '',                 // resolved from the local catalog
            manufacturer,
            mfrPartNo: r.Verified_Part_Number || r.Part_Number || '',
            model: r.Model_Code || '',
            matTypeChoice: manufacturer ? 'OEM' : 'Generic',
            attributes: vals,
            enrichedNotes: notes.length ? notes : undefined
        };

        // attribute schema from the pipeline → a category proposal in the app's
        // format, used when our catalog does not know this UNSPSC yet
        const snake = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        // Mandatory_Attributes mixes 'x:<snake name>' entries with raw ETIM
        // attribute IDs (e.g. 'EF000065') — honor both, plus the plain-name list
        const mandatory = new Set((r.Mandatory_Attributes || []).map(k => String(k).replace(/^x:/, '')));
        (r.Missing_Mandatory_Names || []).forEach(n => mandatory.add(snake(n)));
        const seenAttr = new Set();
        const catAttributes = schemaRows.filter(a => {
            const k = a.name.toLowerCase();
            if (seenAttr.has(k)) return false;
            seenAttr.add(k);
            return true;
        }).map(a => ({
            name: a.name,
            fieldType: a.possible.length ? 'List'
                : /num|int|float|range/.test(a.type) ? 'Number'
                : /bool|logic/.test(a.type) ? 'Yes/No' : 'Text',
            uom: a.unit,
            mandatory: mandatory.has(snake(a.name)) || (!!a.id && mandatory.has(a.id)),
            options: a.possible.join(', ')
        }));

        const conf = r.UNSPSC_Confidence || r.Confidence;
        const meta = {
            categorySuggestion: (r.UNSPSC_Code && catAttributes.length)
                ? { categoryName: r.UNSPSC_Title || '', unspsc: r.UNSPSC_Code, catAttributes }
                : null,
            steps: [
                { label: 'Parsed description', detail: parsed.summary },
                ...(r.Web_Verified ? [{ label: 'Verified on the web', detail: (r.Web_Product_Name || parsed.summary) + ' · ' + (r.Web_Sources_Count || 1) + ' source(s)' }] : []),
                { label: 'Categorised item', detail: r.UNSPSC_Code
                    ? 'UNSPSC ' + r.UNSPSC_Code + ' · ' + (r.UNSPSC_Title || '') + (conf ? ' · ' + conf + '% confidence' : '')
                    : 'No category identified' },
                { label: 'Resolved attributes', detail: catAttributes.length + ' attributes defined by the AI engine' },
                { label: 'Filled attribute values', detail: Object.keys(vals).length + ' value(s) extracted' }
            ]
        };
        return { parsed, meta };
    }

    /* ---- thin proxy-API helpers (shared by single search and bulk upload) ---- */
    async function remoteClassify(products) {
        const resp = await fetch('/api/ai/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': uuid() },
            // full_pipeline explicitly on: we need the enrichment stages (attribute
            // schema + extracted values), not just the S1–S3 categorisation
            body: JSON.stringify({ products, full_pipeline: true })
        });
        if (!resp.ok) throw new Error('AI engine returned ' + resp.status);
        const job = await resp.json();
        if (!job.job_id) throw new Error('AI engine did not return a job id');
        return job;
    }
    async function remoteJob(jobId) {
        const resp = await fetch('/api/ai/jobs/' + encodeURIComponent(jobId));
        if (!resp.ok) throw new Error('AI engine returned ' + resp.status);
        return resp.json();
    }

    /* ---- submit + poll; resolves to a finished analysis ---- */
    async function analyzeAsync(raw, onProgress) {
        // identifier hits, too-generic and value searches stay local and instant
        const quick = window.AI.quickAnalyze(raw);
        if (quick) return quick;

        const key = normQ(raw);
        if (cache.has(key)) return cache.get(key);

        if (onProgress) onProgress('Submitting to the AI engine…');
        const job = await remoteClassify([{ id: 'q1', Original_Description: raw }]);

        const t0 = Date.now();
        while (Date.now() - t0 < TIMEOUT_MS) {
            await new Promise(res => setTimeout(res, POLL_MS));
            const d = await remoteJob(job.job_id);
            if (d.status === 'completed') {
                const row = (d.results || [])[0];
                if (!row || row.Success === false) {
                    throw new Error((row && row.error_message) || 'The AI engine could not classify this description');
                }
                const { parsed, meta } = mapRow(raw, row);
                const analysis = window.AI.assembleRemote(raw, parsed, meta);
                cache.set(key, analysis);
                return analysis;
            }
            if (d.status === 'failed' || d.status === 'cancelled') {
                throw new Error('AI job ' + d.status + (d.error ? ' — ' + d.error : ''));
            }
            if (onProgress) onProgress('AI pipeline running — ' + Math.round((Date.now() - t0) / 1000) + 's…');
        }
        throw new Error('AI engine timed out');
    }

    window.AI.analyzeAsync = analyzeAsync;
    window.AI.mapRemoteRow = mapRow;
    window.AI.remoteClassify = remoteClassify;
    window.AI.remoteJob = remoteJob;
})();
