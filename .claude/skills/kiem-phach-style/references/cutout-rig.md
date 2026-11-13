# Cut-out rigs (rối nước style)

No Spine. Characters are a hierarchy of `THREE.Object3D` "bones", each holding a flat textured quad (`PlaneGeometry`) cut from one atlas per character.

## Structure

```
root (feet pivot, at z = 0)
└─ hips
   ├─ torso
   │  ├─ head
   │  ├─ armUpper.L → armLower.L → hand.L → weapon
   │  └─ armUpper.R → armLower.R → hand.R
   ├─ legUpper.L → legLower.L
   └─ legUpper.R → legLower.R
```

- Each part's pivot sits at its joint (offset the quad inside the bone).
- Draw order: `renderOrder` per part plus a tiny z offset (±0.001) for the back limb, torso and front limb. Never rely on depth sorting between parts.
- Rotation is only around Z (the screen plane). Squash and stretch use scale on the part, never mesh deformation.
- One atlas per character (2048² max, KTX2), with a matching normal-map atlas.

## Rig data

A JSON per character: part names, atlas rects, pivots, parent, base transform, renderOrder. AI image generation produces the full character once. Parts are cut from it and cleaned by hand. The JSON is then authored or edited in the in-game rig viewer (debug page).

Humanoid enemies share **one** skeleton and animation set. Only the atlas and the weapon part change.

## Animation clips (beat-timed)

Clips are keyframes on bones, stored in **beats**, not seconds:

```json
{ "name": "giao-strike", "lengthBeats": 1.5, "impactBeat": 1.0,
  "tracks": { "armUpper.R": [[0, -20], [0.75, -95], [1.0, 40], [1.5, 0]] } }
```

- The player maps clip time to song time so that `impactBeat` lands exactly on the note's beat. The wind-up starts `telegraphBeats` before the note.
- At a BPM change mid-clip, the clip continues in beats. Never re-time it in seconds.
- Easing per key: linear, easeIn, easeOut, or hold (snappy, puppet-like). Prefer hold and easeOut for the rối nước feel.
- Kill (finisher) animations are longer clips (2–4 beats) ending on the phrase's last beat. They are authored per enemy type, 2–3 variants each.

Optional: Theatre.js may be used during development to author keyframes visually. The runtime only reads the exported JSON.
