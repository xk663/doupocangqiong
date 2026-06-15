# Canvas Map Redesign Spec

## Goal
Replace the inline SVG map in index.html's buildWorldMap() with a Canvas 2D-based interactive map engine. All 斗破苍穹 canon locations must be included.

## Architecture
- **MapEngine**: Canvas rendering core, owns Viewport + Renderer
- **Viewport**: translate/scale transforms, world→screen coordinate mapping
- **Renderer**: 9-layer rendering pipeline (background→grid→terrain→regions→borders→labels→markers→effects→edges)
- **Interaction**: click/hover detection via point-in-polygon, delegates to existing openRegionDetail/openSubLocationDetail
- **Labels**: collision-aware label placement
- **Controls**: search, zoom buttons, compass, scale bar, spiritual energy toggle

## Files
- `assets/js/map-engine.js` — Viewport + Renderer + Interaction core
- `assets/js/map-data.js` — All region polygons, sub-locations, terrain features
- `assets/js/map-labels.js` — Label layout engine
- `assets/js/map-controls.js` — UI controls (search, zoom, compass, scale)

## Data Coverage
7 major regions, 12+ 中州 factions, 10 黑角域 factions, 7 远古 races, 4 兽域 beast clans, 7秘境, 100+ sub-locations total. All names from 斗破苍穹 canon only.

## Interaction
- Mouse wheel zoom (centered on cursor)
- Drag to pan
- Click region → openRegionDetail(id)
- Click sub-location dot → openSubLocationDetail(regionId, index)
- Hover region → glow border + tooltip
- Search → fly-to animation
- Compass → reset north
- Scale bar → dynamic update
