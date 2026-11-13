# Palette and readability

## Lacquer (sơn mài) palette

Hex values are a starting proposal. The roles come from the GDD; tune the values with the art bible.

| Role | Name | Hex |
| --- | --- | --- |
| Background, silhouettes | Đen sơn then | `#14100E` |
| Enemy attacks, danger, Phách's accents | Đỏ son | `#B3261E` |
| Tuyệt kỹ, rewards, Tâm gauge | Vàng ánh kim | `#D4A437` |
| Normal notes, UI text, Tốt feedback | Trắng ngà (giấy dó) | `#EFE6D2` |
| Yêu ma (spirits, demons) | Xanh chàm | `#2B3A67` |
| Yêu ma accents | Tím than | `#3B2A3F` |

## Fixed meanings — never use these decoratively in the gameplay band

- **Đỏ son** = an enemy attack is coming or hitting. The weapon glows đỏ son during the wind-up.
- **"Nguy" in đỏ son above an enemy** + off-key gong sound = unblockable, press Jump.
- **Vàng** = perfect (Tuyệt kỹ), counter opening (gold sword icon), rewards.
- **Trắng ngà** = ordinary attack flash, Tốt feedback.
- **Chàm / tím than** = supernatural enemies only.

## Readability checks (run before merging any visual change)

1. **Grayscale test**: render a level section in grayscale. Every telegraph must still be visible through shape and motion, not only colour (colour-blind safety).
2. **Full-blur test**: force `hear = 0` everywhere. Every attack must still be readable from actors and telegraphs alone.
3. **Telegraph timing**: in the debug overlay, each attack's visual cue starts ≥ 1 beat before the note. Cue audio and visual must start on the same beat.
4. **Foreground test**: no foreground object covers the gameplay band at any camera position in the level.
5. **Steam Deck test**: at 1280×800, UI text ≥ 18 px and the "Nguy" glyph ≥ 28 px tall.
