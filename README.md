# OutreachOps MVP

Mobile-first static web app for grid-based outreach coordination with privacy and safety constraints.

## Run locally

Serve `public/` with any static server.

```bash
python3 -m http.server 8080 --directory public
```

## Required architecture

- Static app in `public/`
- Firebase (Anonymous Auth + Firestore realtime)
- MapLibre + OSM tiles (with attribution)
- No personal or precise location storage; only `grid_id`

## Firestore collections

- `signals`: `created_at`, `source_type`, `category`, `grid_id`, `status`, `weight`
- `resources`: `resource_id`, `resource_type`, `availability_state`, `updated_at`, `capacity_score`
- `outreachLogs`: `created_at`, `mode`, `grid_id`, `action`, `outcome`

## Safety policy highlights

- No pins / precise coordinates / photos / paths on public UI
- No law-enforcement or crackdown workflows
- No tips for sustaining/evading homelessness
- APG/CWS/NRGI model with W=7d, k=10, ε=0.1

## Demo flows

1. Submit request on Request screen -> demand + priority list updates immediately.
2. Edit capacity on Resources tab -> priority order changes immediately.
3. Save outreach log -> KPI metrics update immediately.
