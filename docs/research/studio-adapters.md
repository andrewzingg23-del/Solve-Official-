# Studio capability boundaries

StudioDocument (solve.studio.v1) is the stable interface. Human edits, imports and AI output pass the same bounded validation. Metres are canonical. Geometry has no executable fields.

| Capability | Current adapter | Output |
|---|---|---|
| Editable concept geometry | Three.js / bounded schema | Primitives, dimensions, revision |
| Accessible projection | Pure geometry projection | Same scene with direct controls |
| Rigid-body experiment | Rapier 0.21 | Frames, design change detector, assumptions |
| Quantities | Volume / editable material assumptions | Planning allowance, not a quote |
| Export | JSON / GLB / STL / SVG | Source or derived concept geometry |
| Shared history | Existing kernel_api creation events | Actors, explicit parents, competing heads |
| Owned assistant editing | Existing MCP connector | Delegated World read/write |
| Constraint CAD / structural engineering | Adapter required | Reviewed specialist artifacts |
| Lot surveys / permits / suppliers / financing | Adapter required | Dated jurisdiction/provider evidence |

Implementation references: official Three.js OrbitControls/TransformControls/exporters; official Rapier JavaScript rigid bodies/colliders; installed Next 16.3 documentation. Natural Earth land outlines are public domain, from nvkelso/natural-earth-vector/geojson/ne_110m_land.geojson.

The change detector is noncryptographic. Canonical actor and on-behalf-of records come from immutable kernel events. Recorded client-name attributes are context claims, not verified actor authority.

Future adapters must declare schemas, scope, provider context, effects, budget/timeout, approval, replay/reconciliation and evidence. They cannot grant authority or execute arbitrary model-generated code inside the trusted renderer.

## Current bounded representation

Scenes use metres, dimensions at least 1 mm, and numbers rounded to six decimal places. Up to 64 objects/24 steps fit a total 10 KB UTF-8 document budget. This deliberately leaves room for parents/provenance and JSONB formatting inside the existing 16,000-character kernel attributes constraint. Detailed meshes/CAD assemblies need a governed asset adapter; there is no migration or direct database escape hatch.
