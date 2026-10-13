"""
Builds the exercise illustrations shown on exercise cards and in the form guide.

Source: RepDB free-tier exercise dataset (https://github.com/RepDB/exercise-dataset), flat-style
images, free for in-app use with attribution (see assets/exercises/LICENSE.md). Most exercises have a
start and a peak pose; holds and cardio have a single "main" pose.

For each mapped exercise this script:
  1. downloads the pose images (cached in scripts/.cache/repdb, gitignored),
  2. recolours them with plain pixel maths (no generative tools: the licence forbids them):
     light-blue background and floor shadows -> transparent, figure -> light greys for the dark UI,
  3. crops both poses to the same box (same scale) and places them side by side,
  4. writes assets/exercises/<exercise-id>.png and src/generated/exerciseImages.ts.

Licence terms to respect: in-app use only (never publish the images as a dataset), keep the
"Exercise data by RepDB (repdb.co)" credit visible, and never feed the images to generative AI.

Usage:  python scripts/build-exercise-images.py   (needs Pillow, numpy, scipy)
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "repdb"
OUT = ROOT / "assets" / "exercises"
TS_OUT = ROOT / "src" / "generated" / "exerciseImages.ts"
BASE_URL = "https://raw.githubusercontent.com/RepDB/exercise-dataset/main/images/flat"

# DEFAULT_EXERCISES id -> RepDB id. None = no suitable illustration in the source set.
# "approx" marks a close-but-not-identical variation.
MAPPING: dict[str, tuple[str | None, str]] = {
    "00000000-0000-4000-8000-000000000001": ("bench-press", "Bench Press (Barbell)"),
    "00000000-0000-4000-8000-000000000002": ("incline-db-press", "Incline Bench Press (Dumbbell)"),
    "00000000-0000-4000-8000-000000000003": ("cable-fly", "Chest Fly (Cable)"),
    "00000000-0000-4000-8000-000000000004": ("push-up", "Push Up"),
    "00000000-0000-4000-8000-000000000005": ("deadlift", "Deadlift (Barbell)"),
    "00000000-0000-4000-8000-000000000006": ("barbell-row", "Bent Over Row (Barbell)"),
    "00000000-0000-4000-8000-000000000007": ("lat-pulldown", "Lat Pulldown (Cable)"),
    "00000000-0000-4000-8000-000000000008": ("pull-up", "Pull Up"),
    "00000000-0000-4000-8000-000000000009": ("ohp", "Overhead Press (Barbell)"),
    "00000000-0000-4000-8000-000000000010": ("lateral-raise", "Lateral Raise (Dumbbell)"),
    "00000000-0000-4000-8000-000000000011": ("bicep-curl", "Bicep Curl (Dumbbell)"),
    "00000000-0000-4000-8000-000000000012": ("hammer-curl", "Hammer Curl (Dumbbell)"),
    "00000000-0000-4000-8000-000000000013": ("tricep-pushdown", "Triceps Pushdown (Straight Bar)"),
    "00000000-0000-4000-8000-000000000014": ("skull-crusher", "Skull Crusher (EZ Bar)"),
    "00000000-0000-4000-8000-000000000015": ("squat", "Squat (Barbell)"),
    "00000000-0000-4000-8000-000000000016": ("leg-press", "Leg Press (Machine)"),
    "00000000-0000-4000-8000-000000000017": ("leg-extension", "Leg Extension (Machine)"),
    "00000000-0000-4000-8000-000000000018": ("romanian-deadlift", "Romanian Deadlift (Barbell)"),
    "00000000-0000-4000-8000-000000000019": ("leg-curl", "Lying Leg Curl (Machine)"),
    "00000000-0000-4000-8000-000000000020": ("hip-thrust", "Hip Thrust (Barbell)"),
    "00000000-0000-4000-8000-000000000021": ("standing-calf-raise", "Standing Calf Raise (Machine)"),
    "00000000-0000-4000-8000-000000000022": ("plank", "Plank"),
    "00000000-0000-4000-8000-000000000023": ("hanging-leg-raise", "Hanging Leg Raise"),
    "00000000-0000-4000-8000-000000000024": ("running", "Running"),
    "00000000-0000-4000-8000-000000000025": ("stationary-bike", "Cycling [approx: stationary bike]"),
    "00000000-0000-4000-8000-000000000026": ("rowing-machine", "Rowing (Machine)"),
    "00000000-0000-4000-8000-000000000027": ("seated-cable-row", "Seated Row (Cable)"),
    "00000000-0000-4000-8000-000000000028": ("cable-curl", "Bicep Curl (Cable)"),
    "00000000-0000-4000-8000-000000000029": ("cable-hammer-curl", "Hammer Curl (Cable Rope)"),
    "00000000-0000-4000-8000-000000000030": ("zottman-curl", "Zottman Curl (Dumbbell)"),
    "00000000-0000-4000-8000-000000000031": ("dumbbell-wrist-curl", "Wrist Curl (Dumbbell)"),
    "00000000-0000-4000-8000-000000000032": ("db-reverse-wrist-curl", "Reverse Wrist Curl (Dumbbell)"),
    "00000000-0000-4000-8000-000000000033": (None, "Wrist Rotation (Dumbbell)"),
    "00000000-0000-4000-8000-000000000034": ("incline-bench-press", "Incline Bench Press (Barbell)"),
    "00000000-0000-4000-8000-000000000035": ("db-fly", "Chest Fly (Dumbbell)"),
    "00000000-0000-4000-8000-000000000036": ("incline-dumbbell-fly", "Incline Chest Fly (Dumbbell)"),
    "00000000-0000-4000-8000-000000000037": ("pec-deck", "Pec Deck (Machine)"),
    "00000000-0000-4000-8000-000000000038": ("cable-lateral-raise", "Lateral Raise (Cable)"),
    "00000000-0000-4000-8000-000000000039": ("band-pull-apart", "Band Pull-Apart"),
    "00000000-0000-4000-8000-000000000040": ("rear-delt-fly", "Rear Delt Fly (Dumbbell)"),
    "00000000-0000-4000-8000-000000000041": ("dumbbell-shoulder-press", "Shoulder Press (Dumbbell)"),
    "00000000-0000-4000-8000-000000000042": ("machine-shoulder-press", "Shoulder Press (Machine)"),
    "00000000-0000-4000-8000-000000000043": ("tricep-pushdown", "Triceps Pushdown (Rope) [approx: straight bar]"),
    "00000000-0000-4000-8000-000000000044": ("dips", "Dip"),
    "00000000-0000-4000-8000-000000000045": ("battle-ropes", "Battle Rope"),
    "00000000-0000-4000-8000-000000000046": ("cable-chest-press", "Decline Chest Press (Cable) [approx: standing cable press]"),
}

POSES = (("start", "peak"), ("main",))
PANEL_HEIGHT = 320
GAP = 28
PAD = 12
BG_DIST = 30.0  # colour distance from the background colour that still counts as background
MIN_HOLE = 150  # enclosed background patches (e.g. between the legs) at least this big go transparent
GREY_LO, GREY_HI = 90, 245  # figure tones: light greys that read on the dark `elevated` panel


def fetch(slug: str, pose: str) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{slug}-{pose}.webp"
    if not path.exists():
        try:
            with urllib.request.urlopen(f"{BASE_URL}/{slug}-{pose}.webp", timeout=30) as resp:
                data = resp.read()
        except urllib.error.HTTPError as err:
            if err.code == 404:
                return None
            raise
        if data[8:12] != b"WEBP":
            raise ValueError(f"{slug}-{pose}: not a WebP")
        path.write_bytes(data)
    return path


def recolour(path: Path) -> np.ndarray:
    """Flat colour art on a light-blue background -> greyscale + alpha (H x W x 2, float)."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(float)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))

    # Floor shadows have the background's hue, only darker. Saturated blue clothing does not match.
    norm = rgb / np.maximum(np.linalg.norm(rgb, axis=-1, keepdims=True), 1)
    cos = norm @ (bg / np.linalg.norm(bg))
    ratio = rgb.sum(-1) / bg.sum()
    shadow = (cos > 0.997) & (ratio > 0.72) & (ratio < 1.05)

    # Background = everything bg-coloured or shadow that touches the border...
    labels, _ = ndimage.label((dist < BG_DIST) | shadow)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    bgmask = np.isin(labels, edge[edge > 0])
    # ...plus enclosed bg-coloured gaps that are too big to be a highlight.
    holes, n = ndimage.label((dist < BG_DIST) & ~bgmask)
    if n:
        sizes = ndimage.sum(np.ones_like(dist), holes, index=np.arange(1, n + 1))
        bgmask |= np.isin(holes, np.flatnonzero(sizes >= MIN_HOLE) + 1)

    # Anti-aliased edge: the ring just outside the background fades in with colour distance.
    ring = ndimage.binary_dilation(bgmask, iterations=2) & ~bgmask
    alpha = np.full(dist.shape, 255.0)
    alpha[bgmask] = 0
    alpha[ring] = np.clip((dist[ring] - BG_DIST * 0.5) / (BG_DIST * 1.5) * 255, 0, 255)

    lum = rgb @ np.array([0.299, 0.587, 0.114])
    figure = lum[~bgmask]
    lo, hi = np.percentile(figure, 1), np.percentile(figure, 99.5)
    grey = np.clip(GREY_LO + (lum - lo) / max(hi - lo, 1) * (GREY_HI - GREY_LO), GREY_LO, GREY_HI)
    return np.dstack([grey, alpha])


def compose(poses: list[np.ndarray]) -> Image.Image:
    """Crop every pose to one shared box (keeps scale between start/peak) and lay them out side by side."""
    union = np.zeros(poses[0].shape[:2], bool)
    for p in poses:
        union |= p[..., 1] > 24
    rows, cols = np.flatnonzero(union.any(1)), np.flatnonzero(union.any(0))
    box = (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)
    panels = []
    for p in poses:
        img = Image.fromarray(p.astype(np.uint8), "LA").crop(box)
        scale = PANEL_HEIGHT / img.height
        panels.append(img.resize((max(1, round(img.width * scale)), PANEL_HEIGHT), Image.LANCZOS))
    width = PAD * 2 + sum(p.width for p in panels) + GAP * (len(panels) - 1)
    canvas = Image.new("LA", (width, PANEL_HEIGHT + PAD * 2), (0, 0))
    x = PAD
    for p in panels:
        canvas.paste(p, (x, PAD))
        x += p.width + GAP
    return canvas


def load_poses(slug: str) -> list[np.ndarray]:
    for names in POSES:
        paths = [fetch(slug, n) for n in names]
        if all(paths):
            return [recolour(p) for p in paths]
    raise FileNotFoundError(f"{slug}: no start/peak or main image")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()  # drop images of exercises that lost their mapping
    entries: dict[str, dict] = {}
    for exercise_id, (slug, label) in MAPPING.items():
        if slug is None:
            print(f"  -  {label}: no illustration available")
            continue
        image = compose(load_poses(slug))
        target = OUT / f"{exercise_id}.png"
        image.save(target, optimize=True)
        entries[exercise_id] = {"aspect": round(image.width / image.height, 4), "source": slug}
        print(f"  ok {label}: {image.width}x{image.height}, {target.stat().st_size // 1024} KB")

    TS_OUT.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "// GENERATED by scripts/build-exercise-images.py. Do not edit by hand.",
        "// Illustrations adapted from RepDB (https://repdb.co), free tier: in-app use with attribution.",
        "",
        "export interface ExerciseImage {",
        "  source: number;",
        "  /** width / height */",
        "  aspect: number;",
        "}",
        "",
        "export const EXERCISE_IMAGES: Readonly<Record<string, ExerciseImage>> = {",
    ]
    for exercise_id, meta in entries.items():
        lines.append(
            f"  '{exercise_id}': {{ source: require('../../assets/exercises/{exercise_id}.png'), aspect: {meta['aspect']} }},"
        )
    lines += ["};", "", "export const getExerciseImage = (exerciseId: string): ExerciseImage | null =>",
              "  EXERCISE_IMAGES[exerciseId] ?? null;", ""]
    TS_OUT.write_text("\n".join(lines), encoding="utf-8")
    (OUT / "sources.json").write_text(json.dumps(entries, indent=2), encoding="utf-8")
    print(f"\n{len(entries)}/{len(MAPPING)} exercises illustrated -> {TS_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
