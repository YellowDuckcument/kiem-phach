"""Build a cut-out rig (atlas PNG + rig JSON) from a Gemini parts sheet on a green background.

Usage:  python scripts/art/build_rig.py "D:/3D_App/assets/rig full body main.png" public/art/phach phach

The sheet must hold the 15 humanoid pieces in the layout asked for by prompt P-NV01-B:
  row 1: head, torso, scarf tail, hips
  row 2: upper arm x2, forearm x2, hand (fist), hand (open)
  row 3: thigh x2, shin x2, weapon
Near/far in each pair is decided by brightness (far pieces are drawn darker).
Joint pivots come from the round knob at the top of each limb piece; joints fixed by hand in /rig.html
are saved to <out>/<name>.joints.json and reused here on every rebuild.
Output coordinates are atlas pixels; the game converts them to world units (see src/render/rig/CutoutRig.ts).
"""
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC, OUT_DIR, NAME = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
ATLAS_SCALE = 0.5          # pieces at half the sheet resolution (Phách is ~300 px tall on a 1280x800 screen)
KEY_HARD, KEY_SOFT = 25, 70  # green dominance (g - max(r,b)): above SOFT = background, below HARD = opaque

img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float32)
r, g, b = img[..., 0], img[..., 1], img[..., 2]
dom = g - np.maximum(r, b)
alpha = np.clip((KEY_SOFT - dom) / (KEY_SOFT - KEY_HARD), 0, 1)
# Despill: no channel-green left on the edges.
g2 = np.minimum(g, np.maximum(r, b) + 8)
rgba = np.dstack([r, g2, b, alpha * 255]).astype(np.uint8)

# ---- connected components on a 4x downsampled mask (pure Python BFS is fine at 512x512)
S = 4
H, W = alpha.shape
fg = alpha > 0.5
small = fg[: H // S * S, : W // S * S].reshape(H // S, S, W // S, S).any(axis=(1, 3))
lab = np.zeros(small.shape, np.int32)
comps = []
for y0 in range(small.shape[0]):
    for x0 in range(small.shape[1]):
        if not small[y0, x0] or lab[y0, x0]:
            continue
        n = len(comps) + 1
        q = deque([(y0, x0)])
        lab[y0, x0] = n
        ys, xs = [], []
        while q:
            cy, cx = q.popleft()
            ys.append(cy)
            xs.append(cx)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < small.shape[0] and 0 <= nx < small.shape[1] and small[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    q.append((ny, nx))
        comps.append({"n": n, "area": len(ys), "x0": min(xs) * S, "y0": min(ys) * S,
                      "x1": (max(xs) + 1) * S, "y1": (max(ys) + 1) * S})

comps = [c for c in comps if c["area"] > 200]
if len(comps) != 15:
    sys.exit(f"Expected 15 pieces, found {len(comps)}: {[(c['x0'], c['y0']) for c in comps]}")


def piece_mask(c):
    m = fg[c["y0"]:c["y1"], c["x0"]:c["x1"]].copy()
    lm = np.kron(lab[c["y0"] // S:c["y1"] // S, c["x0"] // S:c["x1"] // S] == c["n"], np.ones((S, S), bool))
    return m & lm[: m.shape[0], : m.shape[1]]


for c in comps:
    m = piece_mask(c)
    c["mask"] = m
    px = img[c["y0"]:c["y1"], c["x0"]:c["x1"]][m]
    c["lum"] = float(px.mean())

# rows by vertical centre, then left to right
cy = lambda c: (c["y0"] + c["y1"]) / 2  # noqa: E731
comps.sort(key=cy)
rows, cur = [], [comps[0]]
for c in comps[1:]:
    if cy(c) - cy(cur[0]) > 300:
        rows.append(cur)
        cur = [c]
    else:
        cur.append(c)
rows.append(cur)
for row in rows:
    row.sort(key=lambda c: c["x0"])
if [len(r_) for r_ in rows] != [4, 6, 5]:
    sys.exit(f"Unexpected layout, row sizes {[len(r_) for r_ in rows]}")


def pair(a, b_):
    """(near, far): far is the darker one."""
    return (a, b_) if a["lum"] >= b_["lum"] else (b_, a)


P = {}
P["head"], P["torso"], P["scarf"], P["hips"] = rows[0]
P["upperArmN"], P["upperArmF"] = pair(rows[1][0], rows[1][1])
P["forearmN"], P["forearmF"] = pair(rows[1][2], rows[1][3])
P["handN"], P["handF"] = rows[1][4], rows[1][5]   # fist first, open hand second
P["thighN"], P["thighF"] = pair(rows[2][0], rows[2][1])
P["shinN"], P["shinF"] = pair(rows[2][2], rows[2][3])
P["weapon"] = rows[2][4]


def band_cx(c, f0, f1):
    """Mean x (sheet px) of opaque pixels in a horizontal band [f0, f1] of the piece height."""
    m = c["mask"]
    h = m.shape[0]
    ys = slice(int(h * f0), max(int(h * f1), int(h * f0) + 1))
    xs = np.nonzero(m[ys])[1]
    return c["x0"] + float(xs.mean())


def knob(c):
    """Centre of the round joint knob at the top of a piece."""
    m = c["mask"]
    top = int(np.nonzero(m.any(axis=1))[0][0])
    row = np.nonzero(m[min(top + 20, m.shape[0] - 1)])[0]
    rad = (row.max() - row.min()) / 2
    return [c["x0"] + float(row.mean()), c["y0"] + top + float(rad)]


def at(c, fx, fy):
    return [c["x0"] + fx * (c["x1"] - c["x0"]), c["y0"] + fy * (c["y1"] - c["y0"])]


def bottom(c, inset):
    return [band_cx(c, 0.9, 1.0), c["y1"] - inset * (c["y1"] - c["y0"])]


hips, torso = P["hips"], P["torso"]
weapon = P["weapon"]
# Joint table: pivot (on the piece) and attach (on the parent piece), sheet px.
J = {
    "hips": dict(parent=None, pivot=[band_cx(hips, 0, 0.2), hips["y0"] + 0.25 * (hips["y1"] - hips["y0"])]),
    "torso": dict(parent="hips", pivot=bottom(torso, 0.12), attach=[band_cx(hips, 0, 0.2), at(hips, 0, 0.12)[1]]),
    "head": dict(parent="torso", pivot=bottom(P["head"], 0.1), attach=knob(torso)),
    "scarf": dict(parent="torso", pivot=knob(P["scarf"]), attach=at(torso, 0.25, 0.22)),
    "upperArmF": dict(parent="torso", pivot=knob(P["upperArmF"]), attach=at(torso, 0.4, 0.33)),
    "forearmF": dict(parent="upperArmF", pivot=knob(P["forearmF"]), attach=[band_cx(P["upperArmF"], 0.45, 0.55), at(P["upperArmF"], 0, 0.5)[1]]),
    "handF": dict(parent="forearmF", pivot=knob(P["handF"]), attach=bottom(P["forearmF"], 0.1)),
    "upperArmN": dict(parent="torso", pivot=knob(P["upperArmN"]), attach=at(torso, 0.5, 0.33)),
    "forearmN": dict(parent="upperArmN", pivot=knob(P["forearmN"]), attach=[band_cx(P["upperArmN"], 0.45, 0.55), at(P["upperArmN"], 0, 0.5)[1]]),
    "handN": dict(parent="forearmN", pivot=knob(P["handN"]), attach=bottom(P["forearmN"], 0.1)),
    "weapon": dict(parent="handN", pivot=at(weapon, 0.08, 0.5), attach=at(P["handN"], 0.45, 0.78)),
    "thighF": dict(parent="hips", pivot=knob(P["thighF"]), attach=at(hips, 0.42, 0.35)),
    "shinF": dict(parent="thighF", pivot=knob(P["shinF"]), attach=bottom(P["thighF"], 0.12)),
    "thighN": dict(parent="hips", pivot=knob(P["thighN"]), attach=at(hips, 0.55, 0.35)),
    "shinN": dict(parent="thighN", pivot=knob(P["shinN"]), attach=bottom(P["thighN"], 0.12)),
}
# Back-to-front draw order.
ORDER = ["handF", "forearmF", "upperArmF", "scarf", "shinF", "thighF", "shinN", "thighN",
         "head", "torso", "hips", "weapon", "handN", "forearmN", "upperArmN"]

# ---- atlas: each piece cut out with only its own pixels, shelf-packed (no shared rectangles)
OUT_DIR.mkdir(parents=True, exist_ok=True)
k = ATLAS_SCALE
pad = 4
cuts = {}
for name in ORDER:
    c = P[name]
    y0, y1, x0, x1 = c["y0"], c["y1"], c["x0"], c["x1"]
    own = c["mask"].copy()
    # grow the hard mask by a few px so soft edges stay, but never into another piece's box
    grown = own.copy()
    for _ in range(3):
        g_ = grown.copy()
        g_[1:] |= grown[:-1]; g_[:-1] |= grown[1:]; g_[:, 1:] |= grown[:, :-1]; g_[:, :-1] |= grown[:, 1:]
        grown = g_
    tile = rgba[y0:y1, x0:x1].copy()
    tile[..., 3] = np.where(grown, tile[..., 3], 0)
    tile[tile[..., 3] == 0, :3] = 0
    im_ = Image.fromarray(tile, "RGBA")
    im_ = im_.resize((max(1, round(im_.width * k)), max(1, round(im_.height * k))), Image.LANCZOS)
    cuts[name] = im_

# shelf packing into a square power-of-two atlas
side = 512
while True:
    x = y = shelf = 0
    places = {}
    ok = True
    for name in sorted(ORDER, key=lambda n: -cuts[n].height):
        w_, h_ = cuts[name].width + 2 * pad, cuts[name].height + 2 * pad
        if x + w_ > side:
            x, y, shelf = 0, y + shelf, 0
        if y + h_ > side or w_ > side:
            ok = False
            break
        places[name] = (x + pad, y + pad)
        x += w_
        shelf = max(shelf, h_)
    if ok:
        break
    side *= 2
atlas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
for name, (px_, py_) in places.items():
    atlas.paste(cuts[name], (px_, py_))
atlas.save(OUT_DIR / f"{NAME}.png", optimize=True)
aw = ah = side

# Hand-placed joints saved by /rig.html (px relative to each piece rect) win over the guesses above.
# Delete <name>.joints.json to go back to the automatic joints (e.g. after a new parts sheet).
joints_file = OUT_DIR / f"{NAME}.joints.json"
manual = json.loads(joints_file.read_text(encoding="utf-8"))["bones"] if joints_file.exists() else {}
if manual:
    print(f"using hand-placed joints from {joints_file}")
rects = {n: [places[n][0] - 1, places[n][1] - 1, cuts[n].width + 2, cuts[n].height + 2] for n in ORDER}

bones = []
for name in ORDER:
    c = P[name]
    j = J[name]
    ox, oy = places[name]
    # piece-local (sheet px) -> atlas px
    to_atlas = lambda p, c=c, ox=ox, oy=oy: [round(ox + (p[0] - c["x0"]) * k, 2), round(oy + (p[1] - c["y0"]) * k, 2)]  # noqa: E731
    parent = P[j["parent"]] if j["parent"] else None
    if parent is not None:
        pox, poy = places[j["parent"]]
        attach = [round(pox + (j["attach"][0] - parent["x0"]) * k, 2), round(poy + (j["attach"][1] - parent["y0"]) * k, 2)]
    else:
        attach = None
    pivot = to_atlas(j["pivot"])
    m = manual.get(name)
    if m:
        r_ = rects[name]
        pivot = [round(r_[0] + m["pivot"][0], 2), round(r_[1] + m["pivot"][1], 2)]
        if m.get("attach") and j["parent"]:
            pr = rects[j["parent"]]
            attach = [round(pr[0] + m["attach"][0], 2), round(pr[1] + m["attach"][1], 2)]
    bones.append({
        "name": name,
        "parent": j["parent"],
        "rect": rects[name],
        "pivot": pivot,
        "attach": attach,
    })
rig = {"image": f"{NAME}.png", "size": [aw, ah], "facing": "right", "heightUnits": 1.7, "bones": bones,
       "source": Path(SRC).name}
(OUT_DIR / f"{NAME}.rig.json").write_text(json.dumps(rig, indent=1), encoding="utf-8")
print(f"wrote {OUT_DIR / NAME}.png ({aw}x{ah}) and {NAME}.rig.json with {len(bones)} bones")
for name in ORDER:
    print(f"  {name:10s} lum={P[name]['lum']:.0f} rect={P[name]['x0']},{P[name]['y0']}")
