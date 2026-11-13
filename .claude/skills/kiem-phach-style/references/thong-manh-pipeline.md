# Thong manh render pipeline

## Render order (each frame)

1. **World pass**: render `worldScene` (scenery only) through `pmndrs/postprocessing`'s `EffectComposer`, with **one** `EffectPass` holding the custom `ThongManhEffect` plus `LUT3DEffect` (palette) and a noise effect (paper grain).
2. **Actor pass**: render `actorScene` (Phách, enemies, traps, VFX) on top with `renderer.autoClear = false` and `renderer.clearDepth()`. No post-processing, so actors stay crisp.

Both scenes share the camera. Actors that must be occluded by foreground scenery use a cheap depth pre-pass of the foreground layer only (optional; skip unless needed).

## Actor material: silhouette → reveal

A single `ShaderMaterial` per actor atlas. Uniforms:

| Uniform | Meaning |
| --- | --- |
| `uMap` | colour atlas (full art) |
| `uNormal` | normal map for lantern lighting |
| `uReveal` | 0 = pure silhouette, 1 = full art |
| `uRim` | ink rim strength (pulses on the beat) |
| `uInk` | silhouette colour, near black (`#0E0B0A`) |

```glsl
// fragment (core)
vec4 art = texture2D(uMap, vUv);
if (art.a < 0.5) discard;
vec3 n = normalize(texture2D(uNormal, vUv).xyz * 2.0 - 1.0);
float lit = 0.55 + 0.45 * step(0.3, dot(n, normalize(uLightDir))); // 2-step toon
vec3 full = art.rgb * lit;
float rim = smoothstep(0.6, 1.0, 1.0 - abs(n.z)) * uRim;
vec3 sil = mix(uInk, vec3(0.12), rim);              // silhouette keeps a faint ink rim
gl_FragColor = vec4(mix(sil, full, uReveal), 1.0);
```

Driving `uReveal` (all from rhythm events, never from timers):
- default **0.0**
- Tuyệt kỹ on this enemy → **1.0**, then decays to 0 over **0.5 beat** (exponential in beat time)
- Tốt → **0.35**, same decay
- Tâm nhãn active → floor of **0.6** for its duration
- attack telegraph → the weapon part only gets `uReveal = 0.5` plus the red telegraph colour (see palette), so the threat is readable even in silhouette

Phách himself is always full reveal.

## World effect: ThongManhEffect (custom `Effect`)

Inputs: the colour buffer, the depth buffer (`EffectAttribute.DEPTH`), and uniforms:
- `uHear` — screen-space centre (Phách) and radius of the "hearing zone"
- `uRipples[16]` — `vec4(centerX, centerY, startBeat, strength)`
- `uBeatNow` — current beat from `clock.renderSong()`

Per pixel:
1. `hear` = 1 inside the hearing radius, smoothly falling to 0 outside.
2. Ripple rings: for each active ripple, `r = (uBeatNow - start) * RIPPLE_SPEED`; `ring = strength * smoothstep(w, 0, abs(dist - r)) * fade(age)`. Rings *raise* `hear` locally: sound lets him perceive.
3. Outside `hear`: desaturate towards ink and darken; blur using a half-resolution pre-blurred buffer (`KawaseBlurPass` at half res, mixed in). Never blur at full resolution.
4. Ink outline: Sobel on depth, darkened where depth changes sharply.

Spawning ripples (ring buffer of 16, oldest replaced):
- every downbeat, from Phách's feet, low strength
- every Tuyệt kỹ, from the contact point, strong
- every enemy wind-up sound, from that enemy
- lanterns and drums in the scene, on their own beat pattern

## Palette and grain

- `LUT3DEffect` with a 32³ LUT that pulls colours toward the lacquer palette (`references/palette-readability.md`). Bake the LUT in a script (OKLab nearest-colour with soft blending), never by hand.
- Paper grain: `NoiseEffect` or a tiled giấy dó texture, blend MULTIPLY, opacity ≤ 0.08.

## Sound-ink VFX on actors

Parry sparks, slash trails and the "keng" flash are actor-scene sprites, gold on Tuyệt kỹ, ivory on Tốt. They are never in the world pass.
