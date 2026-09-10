# DMP — Demo (Demand Planning + Sourcing)

Two modules of the DMP (Digital Material Purchasing) prototype, plain HTML/JS/CSS with a small Python server each.

## Modules

| Folder | Module | Port |
|---|---|---|
| `demand_planning/` | Demand Planning (material master, requests, bulk upload, shopping cart) | 8123 |
| `sourcing/` | Sourcing (RFx management, sealed bids, dual-envelope evaluation, negotiations, bid-evaluation tool) | 8124 |

## Run

One command starts both (the Sourcing server also launches Demand Planning):

```bash
python3 sourcing/server.py
```

Then open http://127.0.0.1:8124 (Sourcing) and http://127.0.0.1:8123 (Demand Planning).
The apps link to each other from the burger menu (Modules section); the DP shopping cart can migrate items into a new RFx.

No build step and no dependencies beyond Python 3. Demo state is stored in each module's `data/state.json`.
