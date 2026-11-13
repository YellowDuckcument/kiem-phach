# Performance budget (Steam Deck, 1280×800, 60 fps)

These are starting targets. Measure on real hardware; adjust only with data.

| Item | Budget |
| --- | --- |
| Frame time | ≤ 14 ms average, no spikes > 20 ms during a song |
| Draw calls | ≤ 250 (world + actors) |
| Full-screen passes | 1 `EffectPass` for the world (effects merged) + 1 half-res blur |
| Dynamic lights | ≤ 4 point lights; lanterns beyond that are baked or emissive |
| Shadows | 1 directional shadow map, 1024², gameplay band only; or none, with blob shadows under actors |
| Textures | KTX2 (via `glTF Transform`), atlases ≤ 2048² |
| Triangles on screen | ≤ 150k |
| Pixel ratio | `min(devicePixelRatio, 1)` on Deck; a quality setting may raise it on PC |

## Rules

- Instance repeated scenery (`InstancedMesh`): grass, posts, roof tiles.
- Compile all shaders during the level-load screen (`renderer.compile`) so no shader compiles mid-song: a hitch mid-song is a missed note.
- No allocation in the frame loop (reuse vectors, arrays, event objects): garbage-collection pauses cause timing hitches.
- Load and unload level sections 8 bars ahead of and behind the player, never on a beat with a note.
- Profile with the in-game overlay (fps, draw calls, triangles via `renderer.info`) and Chrome DevTools Performance inside Electron.

Use `threejs-errors-performance` and `performance-optimization` skills for general techniques.
