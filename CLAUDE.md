# Kiếm Phách

Rhythm action game, 2.5D, ancient Vietnam setting. Solo developer working with AI agents. The user writes in Vietnamese; reply in Vietnamese.

## Stack
- TypeScript + Vite + three.js (WebGL; WebGPU is out of scope)
- pmndrs/postprocessing for the "thong manh" (blind) look: blurred world, black silhouettes, ink ripples from sound
- Web Audio API is the master clock for rhythm timing (AudioContext.currentTime), never requestAnimationFrame or setTimeout
- Blender is the scene editor: export glTF with Custom Properties; read them from object.userData
- Electron + steamworks.js for Steam (PC, Steam Deck); web build for itch.io prototypes

## Core rules
- Hit judgement windows (Tuyệt kỹ / Tốt / Trượt) are tunable constants, never hard-coded in gameplay code.
- Keep modules separate: audio, rhythm, combat, render, assets, input.
- Every tunable value is exposed in a lil-gui debug panel.
- Target 60 fps on Steam Deck; measure before adding post-processing passes.

## Skills
See SKILLS-README.md for the selected skills in .claude/skills/ and why. Document templates are in docs/templates/.
