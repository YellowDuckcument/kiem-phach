# Tâm pháp (active skills)

The **Tâm** gauge fills by +1 per Tuyệt kỹ. When it is full, pressing L activates the equipped skill and empties the gauge. A level allows at most 2 equipped skills.

Proposals, not yet in the GDD (confirm with the user before relying on them):
- gauge size = 16
- with 2 skills equipped, L uses slot 1 and the key `;` (pad RB) uses slot 2

All durations start at the **next bar boundary** after activation and are counted in bars (`beatsPerBar` from the beatmap).

| Skill | Effect | Duration | Cost / rule |
| --- | --- | --- | --- |
| **Thính phong** (faster reflexes) | `clock.setRate(0.75, nextBar)` on all stems; pitch drops (tape slow-down, intended). Windows stay the same in real time, so notes are easier to hit. Back to 1.0 at the end, also on a bar boundary. | 4 bars | Score from notes judged during it ×0.5. Run rank capped at **Kiện**. |
| **Vô niệm** (auto-parry) | The next 8 `strike` and `hold` notes are judged **Tốt** automatically at their exact time. `jump`, `counter` and `finisher` stay manual *(proposal)*. | 8 notes | Auto notes add no combo and can't be Tuyệt kỹ. Rank capped at **Kiện**. |
| **Tâm nhãn** | Enemy silhouettes show full shape and weapon. `jump` warnings and counter openings are telegraphed 1 beat earlier (renderer adds +1 to `telegraphBeats`). | 8 bars | The Tâm gauge fills at half speed for the rest of the level. |
| **Hồi âm** | Every Tuyệt kỹ adds double Khí thế. | 4 bars | Ends at once on any Trượt. |

Implementation: each skill is a small state object with `onActivate`, `onNoteJudged`, `onBar` and `onEnd`. It never touches the audio graph directly except Thính phong, which goes through `SongClock.setRate`.
