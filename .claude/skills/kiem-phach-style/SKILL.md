---
name: kiem-phach-style
description: Visual rules of Kiếm Phách — 2.5D side-scrolling layout in three.js, camera and depth layers, cut-out (rối nước style) character rigs, the "thong manh" blind-vision look (black silhouettes, reveal on perfect parry, ink sound ripples), lacquer (sơn mài) palette, readability and the Steam Deck performance budget. Use for any rendering, shader, post-processing, character, animation, scene or art-pipeline work in this project.
---

# Kiếm Phách — 2.5D look and "thong manh" vision

The player sees the world through Phách, a swordsman with thong manh blindness: the eyes look normal but see only dark moving shapes. He fights by ear. The visual system must make this look beautiful **and** keep every attack readable.

## Non-negotiable rules

1. **Gameplay lives on one plane.** Phách and all enemies stand at `z = 0`. Depth is for scenery only. See `references/layers-camera.md`.
2. **Movement is driven by the song clock**, never by velocity: `phach.position.x = course.xAt(beatAt(clock.renderSong()))`. Phách walks between encounters and stands still during them; enemies dash in on the beat (see `src/combat/Course.ts`, `src/render/Stage.ts`). Use `kiem-phach-rhythm` for the clock.
3. **Actors are never post-processed into mush.** The world goes through the thong manh post chain; actors are drawn afterwards with their own materials (`references/thong-manh-pipeline.md`). An attack must stay readable even when the world is fully blurred.
4. **Every enemy is drawn in full once.** Silhouette, half-reveal and full reveal are one material with a `uReveal` uniform. Never author separate "shadow" art.
5. **Every attack telegraphs at least 1 beat ahead, in sound *and* image** (`telegraphBeats` from the beatmap). If a visual effect hides a telegraph, the effect is wrong.
6. **Colour has fixed meanings** (`references/palette-readability.md`). Do not use those hues decoratively.
7. **Characters are cut-out rigs** (rối nước style): flat textured parts on a bone hierarchy written in plain three.js. No Spine. See `references/cutout-rig.md`.
8. **Animation timing is in beats.** A wind-up lasts `telegraphBeats` beats at the current BPM. The impact frame lands exactly on the note time.
9. **Budget: 60 fps on Steam Deck (1280×800).** Check `references/performance-budget.md` before adding a pass, a light or a full-screen effect.

## Reference files

- `references/layers-camera.md` — camera, depth layers, parallax, Blender scene conventions
- `references/thong-manh-pipeline.md` — render order, actor material (`uReveal`), ink ripples, world post chain, GLSL snippets
- `references/cutout-rig.md` — bone hierarchy of flat parts, atlases, beat-timed animation clips
- `references/palette-readability.md` — lacquer palette, colour meanings, readability checks
- `references/performance-budget.md` — Steam Deck limits and how to measure

For general three.js API questions, use the `threejs-*` skills. For screen shake and hit-stop, use `game-feel`, but trigger them from rhythm events.
