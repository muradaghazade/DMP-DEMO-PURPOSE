/* ============================================================
   seed.js — reference datasets + initial demo sourcing data
   ============================================================ */
(function () {
    const DAY = 24 * 60 * 60 * 1000;

    /* ---- reference datasets ---- */
    const RFX_CATEGORIES = [
        'Mechanical Spare Parts', 'Electrical Equipment', 'Instrumentation & Control',
        'Pipes, Valves & Fittings', 'Safety & PPE', 'IT & Telecom',
        'Chemicals & Lubricants', 'Construction Materials',
        'Maintenance Services', 'Logistics Services', 'Engineering Services', 'General Services'
    ];
    const UOM = ['EA', 'PC', 'SET', 'KG', 'L', 'M', 'M2', 'M3', 'BOX', 'PACK', 'ROLL', 'HR', 'DAY', 'MONTH'];
    const CURRENCIES = ['USD', 'EUR', 'AZN', 'GBP', 'TRY', 'CNY'];
    const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

    const QUESTION_TYPES = [
        { key: 'file', label: 'File Upload / Attachment' },
        { key: 'yesno', label: 'Yes / No' },
        { key: 'short', label: 'Short Text' },
        { key: 'long', label: 'Long Text / Paragraph' }
    ];
    // pre-loaded example questions, offered when creating a question of that type
    const QUESTION_TEMPLATES = {
        file: [
            'Upload your ISO 9001 certification.',
            'Provide your latest Audited Financial Statements.',
            'Attach the product technical drawings (.CAD or .PDF).'
        ],
        yesno: [
            'Do you comply with the minimum 2-year warranty requirement?',
            'Have you had any major safety violations in the last 3 years?',
            'Can you meet our mandatory delivery deadline of October 1st?'
        ],
        short: [
            'What is the primary country of manufacture for this item?',
            'State the name and title of the dedicated Project Manager for this account.',
            'What is the lead time (in weeks) for raw material acquisition?'
        ],
        long: [
            'Describe your quality assurance and testing process before items leave the factory.',
            'Explain your business continuity plan in the event of a tier-1 supply chain disruption.',
            'Detail your experience with similar projects in the renewable energy sector.'
        ]
    };

    /* ---- item category catalog (UNSPSC) — mirrored from the Demand Planning
       module's category list; attribute schemas identical, but in Sourcing every
       attribute is OPTIONAL on the item form ---- */
    const CATEGORY_ATTRIBUTES = [
        {
            "unspsc": "31171504",
            "label": "Ball bearings",
            "attributes": [
                {
                    "name": "Bearing type",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Row count",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Single row, Double row"
                },
                {
                    "name": "Bore diameter",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Outside diameter",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Width",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Seal/shield type",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Internal clearance",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "CN, C2, C3, C4"
                },
                {
                    "name": "Cage material",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "26121603",
            "label": "Control cable",
            "attributes": [
                {
                    "name": "Length",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Material core",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Steel, Other"
                },
                {
                    "name": "Max. push load",
                    "fieldType": "Number",
                    "uom": "KG",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. tensile force",
                    "fieldType": "Number",
                    "uom": "KG",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Min. radius",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Min. stroke",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Thread connection",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Internal thread flare (UNF), External thread flare (UNF), Other"
                },
                {
                    "name": "Thread size",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "1/4 inch, 5/16 inch, Other"
                }
            ]
        },
        {
            "unspsc": "40141607",
            "label": "Gate valves",
            "attributes": [
                {
                    "name": "Nominal size",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Pressure rating",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Body material",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "End connection",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Flanged, Threaded, Butt-weld"
                },
                {
                    "name": "Operation",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Bonnet type",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Stem type",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Standard",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "39121602",
            "label": "Magnetic circuit breakers",
            "attributes": [
                {
                    "name": "Adjustment range undelayed short-circuit release",
                    "fieldType": "Range",
                    "uom": "A",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Degree of protection (IP)",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Depth",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Device construction",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Complete device in housing, Built-in device fixed built-in technique, Built-in device plug-in technique, Built-in device slide-in technique (withdrawable), Other"
                },
                {
                    "name": "Height",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Number of poles",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Overload release current setting",
                    "fieldType": "Range",
                    "uom": "A",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Phase failure sensitive",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Power loss",
                    "fieldType": "Number",
                    "uom": "W",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated operating voltage",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated operation power at AC-3, 230 V",
                    "fieldType": "Number",
                    "uom": "kW",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated operation power at AC-3, 400 V",
                    "fieldType": "Number",
                    "uom": "kW",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated permanent current Iu",
                    "fieldType": "Number",
                    "uom": "A",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated short-circuit breaking capacity Icu at 400 V, AC",
                    "fieldType": "Number",
                    "uom": "kA",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Switch off technique",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Electronic, Thermomagnetic, Magnetic"
                },
                {
                    "name": "Type of control element",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Turn button, Push button, Rocker lever, Key, Other"
                },
                {
                    "name": "Type of electrical connection of main circuit",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Flat plug-in connection, Spring clamp connection, PCB connection, Frame clamp, Backside screw connection, Screw connection, Screw-/spring clamp connection, Tunnel terminal, Other"
                },
                {
                    "name": "Width",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "With integrated auxiliary switch",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "With integrated under voltage release",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "With thermal overload protection",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "39121603",
            "label": "Miniature circuit breakers",
            "attributes": [
                {
                    "name": "Additional equipment possible",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Ambient temperature during operating",
                    "fieldType": "Range",
                    "uom": "°C",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Built-in depth",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Concurrently switching neutral conductor",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Connectable conductor cross section multi-wired",
                    "fieldType": "Range",
                    "uom": "mm²",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Connectable conductor cross section solid-core",
                    "fieldType": "Range",
                    "uom": "mm²",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Current limiting class",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Degree of protection (IP)",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Explosion-proof",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flush-mounted installation",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Frequency",
                    "fieldType": "Range",
                    "uom": "Hz",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Number of poles (total)",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Number of protected poles",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Overvoltage category",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Pollution degree",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Power loss",
                    "fieldType": "Number",
                    "uom": "W",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated current",
                    "fieldType": "Number",
                    "uom": "A",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Rated impulse withstand voltage Uimp",
                    "fieldType": "Number",
                    "uom": "kV",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated insulation voltage Ui",
                    "fieldType": "Number",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated short-circuit breaking capacity Icn according to EN 60898 at 230 V",
                    "fieldType": "Number",
                    "uom": "kA",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated short-circuit breaking capacity Icn according to EN 60898 at 400 V",
                    "fieldType": "Number",
                    "uom": "kA",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated short-circuit breaking capacity Icu according to IEC 60947-2 at 230 V",
                    "fieldType": "Number",
                    "uom": "kA",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated short-circuit breaking capacity Icu according to IEC 60947-2 at 400 V",
                    "fieldType": "Number",
                    "uom": "kA",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated voltage",
                    "fieldType": "Number",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Release characteristic",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "A, B, C, Cs, D, E, F, G, K, KM, MA, S, Z, Other"
                },
                {
                    "name": "Voltage type",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "AC, DC, AC/DC, Other"
                },
                {
                    "name": "Width in number of modular spacings",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "26121636",
            "label": "Patch cords",
            "attributes": [
                {
                    "name": "Category",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": true,
                    "options": "CAT5e, CAT6, CAT6a, CAT7"
                },
                {
                    "name": "Shielding",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "UTP, FTP, SFTP"
                },
                {
                    "name": "Length",
                    "fieldType": "Number",
                    "uom": "M",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Conductor",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Insulation",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Connector type",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Conductor gauge",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Jacket colour",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "39121004",
            "label": "Power supply units",
            "attributes": [
                {
                    "name": "1st secondary output voltage AC",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "1st secondary output voltage DC",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "2nd secondary output voltage AC",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "2nd secondary output voltage DC",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "3rd secondary output voltage AC",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "3rd secondary output voltage DC",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Built-in height",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Degree of protection (IP)",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Degree of protection (NEMA)",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "1, 2, 3, 3R, 4, 4X, 6, 6P, 12, 13, Other"
                },
                {
                    "name": "Depth",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Direct mounting possible",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Height",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. output current 1",
                    "fieldType": "Number",
                    "uom": "A",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Max. output current 2",
                    "fieldType": "Number",
                    "uom": "A",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. output current 3",
                    "fieldType": "Number",
                    "uom": "A",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Output voltage stabilized",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Performance level according to EN ISO 13849-1",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Level a, Level b, Level c, Level d, Level e"
                },
                {
                    "name": "Power consumption",
                    "fieldType": "Number",
                    "uom": "VA",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Power output",
                    "fieldType": "Number",
                    "uom": "W",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated supply voltage AC 50 Hz",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated supply voltage AC 60 Hz",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated supply voltage DC",
                    "fieldType": "Range",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "SIL according to IEC 61508",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "1, 2, 3, 4"
                },
                {
                    "name": "Secondary voltage adjustable",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Short-circuit-proof",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Stabilized",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Suitable for distribution board",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Suitable for rail mounting",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Suitable for safety functions",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Suitable for wall mounting",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Type of electric connection",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": true,
                    "options": "Insulation piercing connection, Spring clamp connection, Flat plug-in connection, Clip connection, Soldering flag connection, PCB connection, Insulation displacement connection, Screw-/spring clamp connection, Screw connection, Welding connection, Plug-in connection, Wrapped connection, Other"
                },
                {
                    "name": "Voltage type (supply voltage)",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "AC, DC, AC/DC"
                },
                {
                    "name": "Width",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "26121810",
            "label": "Single core 600 volt class a automotive cable",
            "attributes": [
                {
                    "name": "AWG size",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Circuit integrity according to IEC 60331-1",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "30 min, 60 min, 90 min, 120 min"
                },
                {
                    "name": "Circuit integrity according to IEC 60331-25",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "30 min, 60 min, 90 min, 120 min"
                },
                {
                    "name": "Conductor category",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Class 1 = solid, Class 2 = stranded, Class 5 = flexible, Class 6 = very flexible"
                },
                {
                    "name": "Conductor material",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Aluminium, Copper, Other"
                },
                {
                    "name": "Conductor surface",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Bare, Silver-plated, Tinned, Other"
                },
                {
                    "name": "Core colour",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Beige, Black, Blue, Brown, Colourless, Green, Green/yellow, Grey, Orange, Pink, Purple, Red, Turquoise, White, Yellow, Other"
                },
                {
                    "name": "Core identification",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Colour, Numbers, Colours and numbers, Other"
                },
                {
                    "name": "Diameter conductor",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flame retardant according to IEC 60332-1-2",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flame retardant according to IEC 60332-3-21 (Cat A F/R)",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flame retardant according to IEC 60332-3-22 (Cat A)",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flame retardant according to IEC 60332-3-23 (Cat B)",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flame retardant according to IEC 60332-3-24 (Cat C)",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flame retardant according to IEC 60332-3-25 (Cat D)",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Halogen free according to EN IEC 60754-1",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Halogen free according to EN IEC 60754-2",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Halogen free according to EN IEC 60754-3",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Identification/coding colour core",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Beige, Blue, Brown, Yellow, Grey, Green, Purple, Orange, Pink, Red, Black, Turquoise, White, Other"
                },
                {
                    "name": "Low smoke according to EN IEC 61034-2",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Low temperature resistant according to EN 60811-504+505+506",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Material core insulation",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. permitted conductor temperature",
                    "fieldType": "Number",
                    "uom": "°C",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Nominal cross section conductor",
                    "fieldType": "Number",
                    "uom": "mm²",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Nominal voltage U",
                    "fieldType": "Number",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Nominal voltage U0",
                    "fieldType": "Number",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Oil resistant according to EN IEC 60811-404",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Outer diameter approximate",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Permitted wire outer temperature after assembling without vibration",
                    "fieldType": "Range",
                    "uom": "°C",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Permitted wire outer temperature during assembling/handling",
                    "fieldType": "Range",
                    "uom": "°C",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Reaction-to-fire according to EN 13501-6: Acidity",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "a1, a2, a3"
                },
                {
                    "name": "Reaction-to-fire according to EN 13501-6: Class",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Aca, B1ca, B2ca, Cca, Dca, Eca, Fca"
                },
                {
                    "name": "Reaction-to-fire according to EN 13501-6: Flaming droplets/particles",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "d0, d1, d2"
                },
                {
                    "name": "Reaction-to-fire according to EN 13501-6: Smoke production",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "s1, s1a, s1b, s2, s3"
                },
                {
                    "name": "Weight",
                    "fieldType": "Number",
                    "uom": "kg/km",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "40141605",
            "label": "Solenoid valves",
            "attributes": [
                {
                    "name": "Connection 1",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Connection 2",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Connection voltage",
                    "fieldType": "Number",
                    "uom": "V",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Deactivated when open",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Degree of protection (IP)",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Duty cycle",
                    "fieldType": "Number",
                    "uom": "ms",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Electrical connection",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "2-pole pin connector, Plug EN 175301-803 type A, Plug EN 175301-803 type B, Plug EN 175301-803 type C, Other"
                },
                {
                    "name": "Emergency manual operation",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Push button, Other"
                },
                {
                    "name": "Explosion safety",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Ex-Zone 0, Ex-Zone 1, Ex-Zone 2, Ex-Zone 20, Ex-Zone 21, Ex-Zone 22"
                },
                {
                    "name": "Flange compression class",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "PN 2.5, PN 6, PN 10, PN 16, PN 25, PN 40, PN 63, PN 100, PN 160, PN 250, PN 320, Other"
                },
                {
                    "name": "Freeflow",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Frequency input voltage",
                    "fieldType": "Range",
                    "uom": "Hz",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Height",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Housing material",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Aluminium, Brass, Bronze, Cast iron, Copper, Plastic, Stainless steel, Steel, Other"
                },
                {
                    "name": "Indirect effect",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Kvs value",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Length of connection 1",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Length of connection 2",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Material quality",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Material sealing",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. ambient temperature",
                    "fieldType": "Number",
                    "uom": "°C",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. differential pressure air/gases",
                    "fieldType": "Number",
                    "uom": "bar",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. differential pressure light oil",
                    "fieldType": "Number",
                    "uom": "bar",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. differential pressure steam",
                    "fieldType": "Number",
                    "uom": "bar",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. differential pressure water/liquids",
                    "fieldType": "Number",
                    "uom": "bar",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. pressure difference for AC model",
                    "fieldType": "Number",
                    "uom": "bar",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. pressure difference for DC model",
                    "fieldType": "Number",
                    "uom": "bar",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Max. viscosity",
                    "fieldType": "Number",
                    "uom": "cSt",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Medium temperature (continuous)",
                    "fieldType": "Range",
                    "uom": "°C",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Min. pressure difference",
                    "fieldType": "Number",
                    "uom": "bar",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Model",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Right-angled, Straight, Other"
                },
                {
                    "name": "Nominal diameter",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Outer pipe diameter connection 1",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Outer pipe diameter connection 2",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Surface protection",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Untreated, Chromium-plated, Coated, Nickel-plated, Primer, Other"
                },
                {
                    "name": "Switch-on duration",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Thermal disinfection",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Valve bore",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Voltage type",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": true,
                    "options": "AC, AC/DC, DC"
                },
                {
                    "name": "With sieve",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Working length connection 1",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Working length connection 2",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "31171516",
            "label": "Tapered bearings",
            "attributes": [
                {
                    "name": "Inner diameter",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Length",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Load bearing capacity",
                    "fieldType": "Number",
                    "uom": "kN",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Material",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "Acrylonitrile butadiene styrene (ABS), Aluminium, Brass, Bronze, Cast iron, CR (neoprene), Ethylene-propylene diene monomer rubber (EPDM), Fluorelastomer rubber (FPM/FKM), NBR (nitrile rubber), Polyamide (PA), Polybutylene (PB), Polyethylene (PE), Polypropylene (PP), Polytetrafluoroethylene (PTFE), Polyvinyl chloride (PVC), Polyvinylidene fluoride (PVDF), Stainless steel, Steel, Other"
                },
                {
                    "name": "Max. number of revolutions",
                    "fieldType": "Number",
                    "uom": "1/min",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Model",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": true,
                    "options": "Plain bearing, Tapered roller bearing, Ball bearing, Cylindrical roller bearing, Needle roller bearing, Spherical roller bearing, Other"
                },
                {
                    "name": "Outer diameter",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Suitable for shaft diameter",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "26111801",
            "label": "V belts",
            "attributes": [
                {
                    "name": "Belt profile/section",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Belt type",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Belt properties",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Top width",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Wrapped cover",
                    "fieldType": "Yes/No",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Construction",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Effective length (Lw/Lp",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Inner length (Li",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Outer length (La",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Belt body material",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Tensile cord material",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Sub-brand",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Product net weight",
                    "fieldType": "Number",
                    "uom": "KG",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "23271807",
            "label": "Welding electrodes",
            "attributes": [
                {
                    "name": "Electrode diameter",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Electrode length",
                    "fieldType": "Number",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "AWS classification",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": true,
                    "options": ""
                },
                {
                    "name": "Coating",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Current type",
                    "fieldType": "List",
                    "uom": "",
                    "mandatory": false,
                    "options": "DC+, DC-, AC, AC/DC"
                },
                {
                    "name": "Packaging",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Alloy composition",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Welding position",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                }
            ]
        },
        {
            "unspsc": "39121409",
            "label": "Wire connectors",
            "attributes": [
                {
                    "name": "Rated voltage",
                    "fieldType": "Number",
                    "uom": "V",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Rated current",
                    "fieldType": "Number",
                    "uom": "A",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Number of connection points",
                    "fieldType": "Number",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Conductor cross-section range",
                    "fieldType": "Range",
                    "uom": "mm²",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Compatible conductor type",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Connection technology",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Operating temperature range",
                    "fieldType": "Range",
                    "uom": "°C",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Housing material",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Flammability rating",
                    "fieldType": "Text",
                    "uom": "",
                    "mandatory": false,
                    "options": ""
                },
                {
                    "name": "Required wire strip length",
                    "fieldType": "Range",
                    "uom": "MM",
                    "mandatory": false,
                    "options": ""
                }
            ]
        }
    ];

    /* ---- item title suggestions (Google-style hints on the item form) ----
       Merged at runtime with items from previously created RFXes; picking a
       suggestion autofills the whole item form. ---- */
    const ITEM_SUGGESTIONS = [
        { type: 'material', sapId: '400002001', shortDesc: 'BEARING,BALL DGBB 6205-2RS1/C3', longDesc: 'Deep groove ball bearing, 25x52x15 mm, contact seals both sides, C3 clearance', manufacturerName: 'SKF', manufacturerPartNo: '6205-2RS1/C3', uom: 'EA', unspsc: '31171504', category: 'Ball bearings', attrs: { 'Bearing type': 'Deep groove', 'Row count': 'Single row', 'Bore diameter': '25', 'Outside diameter': '52', 'Width': '15', 'Internal clearance': 'C3' } },
        { type: 'material', sapId: '400002002', shortDesc: 'BEARING,BALL DGBB 6309-2Z/C3', longDesc: 'Deep groove ball bearing, 45x100x25 mm, shielded both sides, C3 clearance', manufacturerName: 'SKF', manufacturerPartNo: '6309-2Z/C3', uom: 'EA', unspsc: '31171504', category: 'Ball bearings', attrs: { 'Bearing type': 'Deep groove', 'Row count': 'Single row', 'Bore diameter': '45', 'Outside diameter': '100', 'Width': '25', 'Internal clearance': 'C3' } },
        { type: 'material', sapId: '400002003', shortDesc: 'BEARING,TAPERED 30206 J2/Q', longDesc: 'Tapered roller bearing, 30x62x17.25 mm, metric single row', manufacturerName: 'Timken', manufacturerPartNo: '30206', uom: 'EA', unspsc: '31171516', category: 'Tapered bearings' },
        { type: 'material', sapId: '400002004', shortDesc: 'VALVE,GATE CS 4IN CL300 RF', longDesc: 'Gate valve, carbon steel A216 WCB, 4 inch, class 300, flanged RF, API 600', manufacturerName: 'Cameron', manufacturerPartNo: 'GV-4-300-WCB', uom: 'EA', unspsc: '40141607', category: 'Gate valves', attrs: { 'Nominal size': '4 inch', 'Pressure rating': 'Class 300', 'Body material': 'A216 WCB', 'End connection': 'Flanged' } },
        { type: 'material', sapId: '400002005', shortDesc: 'VALVE,SOLENOID 2/2 1/2IN 24VDC', longDesc: 'Solenoid valve 2/2-way NC, 1/2 inch BSP, brass body, NBR seals, 24 V DC coil, IP65', manufacturerName: 'Bürkert', manufacturerPartNo: '6213-EV-13', uom: 'EA', unspsc: '40141605', category: 'Solenoid valves' },
        { type: 'material', sapId: '400002006', shortDesc: 'BELT,V WEDGE SPB2240', longDesc: 'Wedge V-belt, profile SPB, pitch length 2240 mm, wrapped, antistatic', manufacturerName: 'Gates', manufacturerPartNo: 'SPB2240', uom: 'EA', unspsc: '26111801', category: 'V belts', attrs: { 'Belt profile/section': 'SPB', 'Effective length (Lw/Lp)': '2240', 'Wrapped cover': 'Yes' } },
        { type: 'material', sapId: '400002007', shortDesc: 'BELT,V CLASSICAL B71', longDesc: 'Classical V-belt, profile B, inner length 71 inch, wrapped construction', manufacturerName: 'Optibelt', manufacturerPartNo: 'VB-B71', uom: 'EA', unspsc: '26111801', category: 'V belts' },
        { type: 'material', sapId: '400002008', shortDesc: 'ELECTRODE,WELDING E7018 3.2MM', longDesc: 'Covered welding electrode AWS E7018, diameter 3.2 mm, length 350 mm, low-hydrogen', manufacturerName: 'ESAB', manufacturerPartNo: 'OK 48.00 3.2', uom: 'KG', unspsc: '23271807', category: 'Welding electrodes', attrs: { 'Electrode diameter': '3.2', 'AWS classification': 'E7018', 'Current type': 'AC/DC' } },
        { type: 'material', sapId: '400002009', shortDesc: 'PATCH CORD CAT6 UTP 3M GREY', longDesc: 'Ethernet patch cord, category 6, UTP, 3 m, LSZH jacket, grey', manufacturerName: 'Panduit', manufacturerPartNo: 'UTP6-3M-GY', uom: 'EA', unspsc: '26121636', category: 'Patch cords', attrs: { 'Category': 'CAT6', 'Shielding': 'UTP', 'Length': '3' } },
        { type: 'material', sapId: '400002010', shortDesc: 'BREAKER,MINIATURE 2P C10', longDesc: 'Miniature circuit breaker, 2-pole, 10 A, C curve, 10 kA, DIN rail mount', manufacturerName: 'Schneider Electric', manufacturerPartNo: 'A9F74210', uom: 'EA', unspsc: '39121603', category: 'Miniature circuit breakers' },
        { type: 'material', sapId: '400002011', shortDesc: 'BREAKER,MINIATURE 3P C32', longDesc: 'Miniature circuit breaker, 3-pole, 32 A, C curve, 10 kA, DIN rail mount', manufacturerName: 'ABB', manufacturerPartNo: 'S203-C32', uom: 'EA', unspsc: '39121603', category: 'Miniature circuit breakers' },
        { type: 'material', sapId: '400002012', shortDesc: 'PSU,DIN RAIL 24VDC 10A', longDesc: 'Switch-mode power supply, DIN rail, input 100–240 V AC, output 24 V DC 10 A', manufacturerName: 'Phoenix Contact', manufacturerPartNo: 'QUINT4-PS/1AC/24DC/10', uom: 'EA', unspsc: '39121004', category: 'Power supply units' },
        { type: 'material', sapId: '400002013', shortDesc: 'CABLE,CONTROL 12X1.5MM2', longDesc: 'Flexible control cable, 12 cores x 1.5 mm², PVC insulated, 300/500 V', manufacturerName: 'Prysmian', manufacturerPartNo: 'YSLY-JZ 12x1.5', uom: 'M', unspsc: '26121603', category: 'Control cable' },
        { type: 'material', sapId: '400002014', shortDesc: 'CONNECTOR,WIRE SPRING 4MM2', longDesc: 'Spring clamp wire connector, 4 mm², rail mount, grey', manufacturerName: 'WAGO', manufacturerPartNo: '2004-1201', uom: 'EA', unspsc: '39121409', category: 'Wire connectors' },
        { type: 'material', sapId: '400002015', shortDesc: 'GREASE,BEARING LITHIUM EP2 18KG', longDesc: 'Lithium complex bearing grease NLGI 2, EP additives, -20…+140 °C, 18 kg pail', manufacturerName: 'Shell', manufacturerPartNo: 'Gadus S2 V220 2', uom: 'KG', category: 'Chemicals & Lubricants' },
        { type: 'material', sapId: '400002016', shortDesc: 'OIL,GEAR ISO VG220 209L', longDesc: 'Industrial gear oil ISO VG 220, mineral, EP, 209 L drum', manufacturerName: 'Mobil', manufacturerPartNo: 'Mobilgear 600 XP 220', uom: 'L', category: 'Chemicals & Lubricants' },
        { type: 'material', sapId: '400002017', shortDesc: 'GASKET,SPW 4IN CL150 SS316/GR', longDesc: 'Spiral wound gasket, 4 inch class 150, SS316 winding with graphite filler, ASME B16.20', manufacturerName: 'Flexitallic', manufacturerPartNo: 'CGI-4-150', uom: 'EA', category: 'Pipes, Valves & Fittings' },
        { type: 'material', sapId: '400002018', shortDesc: 'SEAL,MECHANICAL PUMP 55MM', longDesc: 'Cartridge mechanical seal for centrifugal pump, shaft 55 mm, SiC/SiC faces, Viton elastomers', manufacturerName: 'John Crane', manufacturerPartNo: 'T5610Q-55', uom: 'EA', category: 'Mechanical Spare Parts' },
        { type: 'service', shortDesc: 'Preventive maintenance of LV switchgear panels', longDesc: 'Annual preventive maintenance of low-voltage switchgear: cleaning, torque checks, IR scan, function tests with report', uom: 'EA', category: 'Maintenance Services' },
        { type: 'service', shortDesc: 'Overhaul of centrifugal pump', longDesc: 'Workshop overhaul of centrifugal pump: disassembly, wear parts replacement, balancing, testing with report', uom: 'EA', category: 'Maintenance Services' },
        { type: 'service', shortDesc: 'Calibration of pressure transmitters', longDesc: 'On-site calibration of pressure transmitters against certified reference, with calibration certificates', uom: 'EA', category: 'Instrumentation & Control' },
        { type: 'service', shortDesc: 'HVAC quarterly maintenance', longDesc: 'Quarterly maintenance of HVAC units: filters, coils, refrigerant check, controls test', uom: 'EA', category: 'Maintenance Services' },
        { type: 'service', shortDesc: 'Crane annual inspection and certification', longDesc: 'Statutory annual inspection and load test of overhead cranes with certification', uom: 'EA', category: 'Engineering Services' },
        { type: 'service', shortDesc: 'Thermography survey of electrical rooms', longDesc: 'Infrared thermographic survey of switchrooms and MCCs with defect classification report', uom: 'DAY', category: 'Maintenance Services' }
    ];

    /* ---- users: customer roles (CAM / PROC) + supplier accounts ---- */
    const USERS = [
        { id: 'u_cam', name: 'Aysel Karimova', role: 'CAM', email: 'aysel.karimova@dmp.az', company: 'SOCAR' },
        { id: 'u_proc', name: 'John Simpson', role: 'PROC', email: 'john.simpson@dmp.az', company: 'SOCAR' },
        { id: 'u_sup1', name: 'Rashad Aliyev', role: 'SUPPLIER', supplierId: 'sup1', email: 'r.aliyev@bakuindustrial.az' },
        { id: 'u_sup2', name: 'Leyla Hasanova', role: 'SUPPLIER', supplierId: 'sup2', email: 'l.hasanova@caspiantech.az' },
        { id: 'u_sup3', name: 'Marco Rossi', role: 'SUPPLIER', supplierId: 'sup3', email: 'm.rossi@globalmro.ae' }
    ];

    const SUPPLIERS = [
        { id: 'sup1', name: 'Baku Industrial Supplies LLC', country: 'Azerbaijan', city: 'Baku', email: 'sales@bakuindustrial.az', phone: '+994 12 555 01 20', categories: ['Mechanical Spare Parts', 'Pipes, Valves & Fittings'] },
        { id: 'sup2', name: 'Caspian Tech Services', country: 'Azerbaijan', city: 'Baku', email: 'office@caspiantech.az', phone: '+994 12 404 77 40', categories: ['Electrical Equipment', 'Maintenance Services', 'Instrumentation & Control'] },
        { id: 'sup3', name: 'Global MRO Trading FZE', country: 'UAE', city: 'Dubai', email: 'quotes@globalmro.ae', phone: '+971 4 887 21 05', categories: ['Mechanical Spare Parts', 'Electrical Equipment', 'Chemicals & Lubricants'] }
    ];

    /* ---- demo RFX 1: materials, deadline passed, 3 offers in — ready to evaluate ---- */
    function rfxMaterialClosed(now) {
        const items = [
            { id: 'it_a1', idx: 1, sapId: '400000123', internalId: 'AZN-8821', shortDesc: 'BEARING,BALL DGBB 6312-2Z/C3', longDesc: 'Deep groove ball bearing, 60x130x31 mm, shielded both sides, C3 clearance, SKF 6312-2Z/C3 or equivalent', manufacturerName: 'SKF', manufacturerPartNo: '6312-2Z/C3', uom: 'EA', demandQty: 120, lotSize: 1, plant: '1700', category: 'Mechanical Spare Parts', notes: '' },
            { id: 'it_a2', idx: 2, sapId: '400000456', internalId: 'AZN-8822', shortDesc: 'VALVE,GATE CS 6IN CL150 RF', longDesc: 'Gate valve, carbon steel A216 WCB, 6 inch, class 150, flanged RF, API 600, hand wheel operated', manufacturerName: 'Cameron', manufacturerPartNo: 'GV-6-150-WCB', uom: 'EA', demandQty: 24, lotSize: 1, plant: '1700', category: 'Pipes, Valves & Fittings', notes: 'NACE MR0175 compliance required' },
            { id: 'it_a3', idx: 3, sapId: '400000789', internalId: 'AZN-8823', shortDesc: 'BELT,V WEDGE SPC2500', longDesc: 'Wedge V-belt, profile SPC, pitch length 2500 mm, wrapped, antistatic, SKF PHG SPC2500 or equivalent', manufacturerName: 'SKF', manufacturerPartNo: 'PHG SPC2500', uom: 'EA', demandQty: 300, lotSize: 10, plant: '1800', category: 'Mechanical Spare Parts', notes: '' },
            { id: 'it_a4', idx: 4, sapId: '400000912', internalId: 'AZN-8824', shortDesc: 'GASKET,SPW 6IN CL150 SS316/GR', longDesc: 'Spiral wound gasket, 6 inch class 150, SS316 winding with graphite filler, CS outer ring, ASME B16.20', manufacturerName: 'Flexitallic', manufacturerPartNo: 'CGI-6-150', uom: 'EA', demandQty: 500, lotSize: 25, plant: '1700', category: 'Pipes, Valves & Fittings', notes: '' }
        ];
        const questions = [
            { id: 'q_a1', type: 'yesno', text: 'Do you comply with the minimum 2-year warranty requirement?', required: true, attachment: null },
            { id: 'q_a2', type: 'file', text: 'Upload your ISO 9001 certification.', required: true, attachment: null },
            { id: 'q_a3', type: 'short', text: 'What is the primary country of manufacture for this item?', required: true, attachment: null },
            { id: 'q_a4', type: 'long', text: 'Describe your quality assurance and testing process before items leave the factory.', required: false, attachment: null }
        ];
        const doc = (name) => ({ name, size: 48213, data: 'data:application/pdf;base64,JVBERi0xLjQKJcTl' });
        const resp = (answers, quotes) => ({ status: 'submitted', submittedTs: now - 2 * DAY, answers, quotes });
        return {
            id: 'rfx_a', no: 'RFQ-20260830-61139', type: 'material',
            title: 'Rotating equipment spares — H.Aliyev refinery annual demand',
            description: 'Annual frame quotation for bearings, valves, belts and gaskets consumed by the maintenance department. Prices should be valid for 12 months from award.',
            category: 'Mechanical Spare Parts',
            deadline: now - 1 * DAY,
            status: 'Published',
            createdBy: 'u_proc', createdTs: now - 9 * DAY, publishedTs: now - 8 * DAY,
            items, questions,
            supplierIds: ['sup1', 'sup2', 'sup3'],
            responses: {
                sup1: resp(
                    { q_a1: { value: 'yes' }, q_a2: { value: '', attachment: doc('ISO9001_BakuIndustrial.pdf') }, q_a3: { value: 'Sweden / Germany' }, q_a4: { value: 'Incoming inspection of every batch against mill certificates; dimensional checks on 10% AQL sampling; all rotating parts are balance-tested before dispatch.' } },
                    {
                        it_a1: { unitPrice: 38.50, currency: 'USD', incoterm: 'DAP', incotermLocation: 'Baku', leadTime: 45, moq: 10, lotSize: 1, spn: 'BIS-6312', smn: 'SKF', smpn: '6312-2Z/C3', compliance: 'on', uom: 'EA', notes: '' },
                        it_a2: { unitPrice: 812.00, currency: 'USD', incoterm: 'DAP', incotermLocation: 'Baku', leadTime: 90, moq: 4, lotSize: 1, spn: 'BIS-GV6150', smn: 'Cameron', smpn: 'GV-6-150-WCB', compliance: 'on', uom: 'EA', notes: 'NACE certificates included' },
                        it_a3: { unitPrice: 21.90, currency: 'USD', incoterm: 'DAP', incotermLocation: 'Baku', leadTime: 30, moq: 50, lotSize: 10, spn: 'BIS-SPC2500', smn: 'SKF', smpn: 'PHG SPC2500', compliance: 'on', uom: 'EA', notes: '' },
                        it_a4: { unitPrice: 6.40, currency: 'USD', incoterm: 'DAP', incotermLocation: 'Baku', leadTime: 25, moq: 100, lotSize: 25, spn: 'BIS-SPW6', smn: 'Flexitallic', smpn: 'CGI-6-150', compliance: 'on', uom: 'EA', notes: '' }
                    }),
                sup2: resp(
                    { q_a1: { value: 'yes' }, q_a2: { value: '', attachment: doc('CaspianTech_ISO9001_2026.pdf') }, q_a3: { value: 'China (licensed production)' }, q_a4: { value: 'Factory QC per ISO 2859-1; witness testing available on request. Valves are hydro-tested per API 598 with stamped reports.' } },
                    {
                        it_a1: { unitPrice: 33.10, currency: 'USD', incoterm: 'CIF', incotermLocation: 'Baku', leadTime: 60, moq: 20, lotSize: 1, spn: 'CT-100231', smn: 'ZWZ', smpn: '6312-2Z', compliance: 'off', uom: 'EA', notes: 'Equivalent brand offered', alt: { desc: 'ZWZ 6312-2Z/C3 equivalent bearing', price: 33.10, currency: 'USD', uom: 'EA' } },
                        it_a2: { unitPrice: 745.00, currency: 'USD', incoterm: 'CIF', incotermLocation: 'Baku', leadTime: 110, moq: 2, lotSize: 1, spn: 'CT-GV0615', smn: 'Neway', smpn: 'G6C15R', compliance: 'on', uom: 'EA', notes: '' },
                        it_a3: { unitPrice: 19.75, currency: 'USD', incoterm: 'CIF', incotermLocation: 'Baku', leadTime: 40, moq: 100, lotSize: 10, spn: 'CT-VB2500', smn: 'Optibelt', smpn: 'SPC 2500', compliance: 'on', uom: 'EA', notes: '' },
                        it_a4: { unitPrice: 5.85, currency: 'USD', incoterm: 'CIF', incotermLocation: 'Baku', leadTime: 35, moq: 200, lotSize: 25, spn: 'CT-SW6150', smn: 'Klinger', smpn: 'SWG-6-150', compliance: 'on', uom: 'EA', notes: '' }
                    }),
                sup3: resp(
                    { q_a1: { value: 'no' }, q_a2: { value: '', attachment: doc('GlobalMRO_ISO_Bundle.pdf') }, q_a3: { value: 'Various — EU and UAE stock' }, q_a4: { value: 'We are a stockist; all goods ship with original manufacturer certificates. No additional in-house testing.' } },
                    {
                        it_a1: { unitPrice: 41.20, currency: 'USD', incoterm: 'FCA', incotermLocation: 'Jebel Ali', leadTime: 15, moq: 1, lotSize: 1, spn: 'GM-88121', smn: 'SKF', smpn: '6312-2Z/C3', compliance: 'on', uom: 'EA', notes: 'Ex-stock Dubai' },
                        it_a3: { unitPrice: 24.60, currency: 'USD', incoterm: 'FCA', incotermLocation: 'Jebel Ali', leadTime: 10, moq: 20, lotSize: 10, spn: 'GM-99732', smn: 'Gates', smpn: 'SPC2500', compliance: 'on', uom: 'EA', notes: '' },
                        it_a4: { unitPrice: 7.10, currency: 'USD', incoterm: 'FCA', incotermLocation: 'Jebel Ali', leadTime: 12, moq: 50, lotSize: 25, spn: 'GM-45510', smn: 'Flexitallic', smpn: 'CGI-6-150', compliance: 'on', uom: 'EA', notes: '' }
                    })
            },
            techEval: {},
            awards: {},
            history: [
                { ts: now - 9 * DAY, actorUser: 'John Simpson', actorRole: 'PROC', action: 'created', text: 'RFX created' },
                { ts: now - 8 * DAY, actorUser: 'John Simpson', actorRole: 'PROC', action: 'published', text: 'RFX sent to 3 suppliers' },
                { ts: now - 4 * DAY, actorUser: 'Rashad Aliyev', actorRole: 'SUPPLIER', action: 'submitted', text: 'Baku Industrial Supplies LLC submitted an offer' },
                { ts: now - 3 * DAY, actorUser: 'Leyla Hasanova', actorRole: 'SUPPLIER', action: 'submitted', text: 'Caspian Tech Services submitted an offer' },
                { ts: now - 2 * DAY, actorUser: 'Marco Rossi', actorRole: 'SUPPLIER', action: 'submitted', text: 'Global MRO Trading FZE submitted an offer' }
            ]
        };
    }

    /* ---- demo RFX 2: services, published, deadline still open — suppliers can answer ---- */
    function rfxServiceOpen(now) {
        return {
            id: 'rfx_b', no: 'RFQ-20260905-73368', type: 'service',
            title: 'Preventive maintenance of HV switchgear — 2027 contract',
            description: 'Annual preventive maintenance and testing of 6/35 kV switchgear across two plants, including thermographic survey and protection relay testing.',
            category: 'Maintenance Services',
            deadline: now + 5 * DAY,
            status: 'Published',
            createdBy: 'u_cam', createdTs: now - 3 * DAY, publishedTs: now - 2 * DAY,
            items: [
                { id: 'it_b1', idx: 1, shortDesc: 'PM of 6kV switchgear cubicles', longDesc: 'Preventive maintenance of 48 cubicles: cleaning, torque checks, contact resistance measurement, insulation testing', qty: 48, uom: 'EA', category: 'Maintenance Services', notes: 'Shutdown windows agreed monthly' },
                { id: 'it_b2', idx: 2, shortDesc: 'Protection relay secondary injection test', longDesc: 'Secondary injection testing of feeder and transformer protection relays with test reports', qty: 96, uom: 'EA', category: 'Maintenance Services', notes: '' },
                { id: 'it_b3', idx: 3, shortDesc: 'Thermographic survey', longDesc: 'Quarterly infrared thermographic survey of switchrooms with report and defect classification', qty: 4, uom: 'DAY', category: 'Maintenance Services', notes: '' }
            ],
            questions: [
                { id: 'q_b1', type: 'file', text: 'Provide your latest Audited Financial Statements.', required: true, attachment: null },
                { id: 'q_b2', type: 'yesno', text: 'Do your field engineers hold valid HV switching authorisation?', required: true, attachment: null },
                { id: 'q_b3', type: 'long', text: 'Detail your experience with similar switchgear maintenance contracts in the last 5 years.', required: true, attachment: null }
            ],
            supplierIds: ['sup2', 'sup3'],
            responses: { sup2: { status: 'draft', answers: {}, quotes: {} } },
            techEval: {},
            awards: {},
            history: [
                { ts: now - 3 * DAY, actorUser: 'Aysel Karimova', actorRole: 'CAM', action: 'created', text: 'RFX created' },
                { ts: now - 2 * DAY, actorUser: 'Aysel Karimova', actorRole: 'CAM', action: 'published', text: 'RFX sent to 2 suppliers' }
            ]
        };
    }

    function build() {
        const now = Date.now();
        return {
            datasets: { RFX_CATEGORIES, UOM, CURRENCIES, INCOTERMS, QUESTION_TYPES, QUESTION_TEMPLATES, CATEGORY_ATTRIBUTES, ITEM_SUGGESTIONS },
            users: JSON.parse(JSON.stringify(USERS)),
            suppliers: JSON.parse(JSON.stringify(SUPPLIERS)),
            rfxs: [rfxMaterialClosed(now), rfxServiceOpen(now)],
            notifications: [],
            session: { currentUserId: 'u_proc', lang: 'en' },
            seq: { material: 1, service: 1 }
        };
    }

    window.Seed = { build };
})();
