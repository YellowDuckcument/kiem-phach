# Layers and camera

## Units

- 1 world unit ≈ 1 metre. Phách is about 1.7 units tall.
- `COURSE.walkUnits = 4` (tunable): world X per *walking* beat. Phách stops for each encounter; the enemy waits `COURSE.standoff` ahead, winds up and dashes in on the beat. Timing is read from shrinking cue rings around Phách, not from note spacing on the ground.

## Camera

- `PerspectiveCamera`, vertical FOV ≈ 35°. A narrow FOV keeps distortion low while depth still produces parallax.
- Fixed side view: looks down −Z at the gameplay plane from `z = +14`, `y = 2.2`, tilted down about 4°.
- `camera.position.x = phach.x + LEAD`, with `LEAD ≈ 3` so more space is shown ahead of Phách than behind.
- During a duel (Phách stops), the camera eases in by about 10 % and centres between the two fighters. Use the `camera-systems` skill for easing, and keep framing changes on bar boundaries.
- Camera shake: only from rhythm events (Tuyệt kỹ, Posture broken), through `game-feel`'s trauma model. Shake amplitude must never hide a telegraph.

## Depth layers

| Layer | z range | Content | Rules |
| --- | --- | --- | --- |
| Foreground | +2 … +6 | grass, posts, hanging lanterns | Sparse. Must never cover the band y ∈ [0, 2.5] on screen. Fade to 30 % opacity when an actor is behind it. |
| Gameplay | 0 | Phách, enemies, traps, pickups | The only layer that matters for play. |
| Midground | −2 … −20 | houses, temples, boats, trees | 3D low-poly with the lacquer shader. |
| Far | −20 … −200 | mountains, river, sky cards | Painted 2D planes (cards). No lighting. |

Parallax comes from real depth. Never fake it with scripted speeds.

## Blender scene conventions

Scenes are authored in Blender and exported as glTF with **Include › Custom Properties** enabled. three.js exposes the properties as `object.userData`.

| Custom property | Values | Meaning |
| --- | --- | --- |
| `kp_layer` | `fore` / `mid` / `far` | Assigns render layer and material set |
| `kp_spawn` | enemy kind, e.g. `linh-giao` | Spawn marker. Its X is ignored; the beatmap decides X. Y and z are kept. |
| `kp_light` | `lantern` / `fire` | Swapped at load for a light with flicker synced to the beat |
| `kp_occluder` | `true` | Foreground object that fades when an actor is behind it |

One glTF file per level section. Load the next section 8 bars ahead of time; unload sections 8 bars behind.
