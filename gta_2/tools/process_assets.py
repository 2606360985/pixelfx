"""
Asset processing & realistic sprite/vehicle/prop synthesis pipeline for gta_2 (Kowloon Noir).
Converts AI-generated photorealistic scenes, CGs, and chroma-green portraits into
clean HD transparent PNGs, and builds photo-headed character sprites + 4x supersampled
metallic/shaded vehicles & props.
"""

from __future__ import annotations

import math
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ARTIFACTS = Path(r"C:\Users\ESI186\.gemini\antigravity\brain\70c36f5b-fc05-4011-aef9-338e0e3b547f")

RAW_SCENES = {
    "temple-nightmarket": "scene_temple_nightmarket_1795672931307.jpg",
    "kowloon-cbd": "scene_kowloon_cbd_1795672931315.jpg",
    "kwai-wharf": "scene_kwai_wharf_1795672934996.jpg",
}

RAW_CGS = {
    "prologue": "cg_prologue_1795672937799.jpg",
    "finale": "cg_finale_1795672937363.jpg",
}

RAW_PORTRAITS = {
    "chen": ("portrait_chen_1795672951066.jpg", False),
    "lin": ("portrait_lin_1795672952320.jpg", False),
    "zhou": ("portrait_zhou_1795672953324.jpg", False),
    "shen": ("portrait_shen_flatgreen_1795672991318.jpg", False),
    "kun": ("portrait_kun_1795672956354.jpg", False),
}


def ensure_dirs() -> None:
    for sub in ("scenes", "cg", "portraits", "sprites", "vehicles", "props"):
        (ASSETS / sub).mkdir(parents=True, exist_ok=True)


def rgb_to_hue_sat_val(r: int, g: int, b: int) -> tuple[float, float, float]:
    mx = max(r, g, b)
    mn = min(r, g, b)
    df = mx - mn
    if mx == 0:
        return 0.0, 0.0, 0.0
    s = df / mx
    v = mx / 255.0
    if df == 0:
        h = 0.0
    elif mx == r:
        h = (60.0 * ((g - b) / df)) % 360.0
    elif mx == g:
        h = 60.0 * ((b - r) / df) + 120.0
    else:
        h = 60.0 * ((r - g) / df) + 240.0
    return h, s, v


def is_green_bg(r: int, g: int, b: int) -> bool:
    if g < 36:
        return False
    # Fast dominance check + HSV green hue range (handles studio dark-green vignettes & #00FF00)
    if g > r * 1.16 and g > b * 1.12 and (g - max(r, b)) >= 10:
        return True
    h, s, v = rgb_to_hue_sat_val(r, g, b)
    return 72.0 <= h <= 165.0 and s >= 0.22 and v >= 0.14 and g >= max(r, b)


def key_chroma_portrait(src_path: Path, target_h: int = 580) -> Image.Image:
    im = Image.open(src_path).convert("RGBA")
    # Downscale slightly first if huge so flood-fill is instant and crisp
    if im.height > 1100:
        scale = 960 / im.height
        im = im.resize((round(im.width * scale), 960), Image.Resampling.LANCZOS)

    w, h = im.size
    px = im.load()

    visited = bytearray(w * h)
    bg_mask = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, _ = px[x, y]
        if is_green_bg(r, g, b):
            visited[idx] = 1
            bg_mask[idx] = 1
            q.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while q:
        cx, cy = q.popleft()
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx]:
                    r, g, b, _ = px[nx, ny]
                    if is_green_bg(r, g, b):
                        visited[idx] = 1
                        bg_mask[idx] = 1
                        q.append((nx, ny))

    # Apply transparency + 2-ring fringe feathering + green-spill suppression
    dist_map = bytearray(w * h)
    edge_q: deque[tuple[int, int]] = deque()
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if bg_mask[idx]:
                px[x, y] = (0, 0, 0, 0)
            else:
                # Check 4-neighbor for bg
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and bg_mask[ny * w + nx]:
                        dist_map[idx] = 1
                        edge_q.append((x, y))
                        break

    # Second ring for gentle despill
    for _ in range(len(edge_q)):
        cx, cy = edge_q.popleft()
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not bg_mask[idx] and dist_map[idx] == 0:
                    dist_map[idx] = 2

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if bg_mask[idx]:
                continue
            r, g, b, a = px[x, y]
            ring = dist_map[idx]
            hue, sat, _ = rgb_to_hue_sat_val(r, g, b)
            greenish = (72.0 <= hue <= 165.0 and sat > 0.16 and g > max(r, b))
            if ring == 1:
                excess = max(0, g - max(r, b))
                new_a = max(0, min(255, int(255 - excess * 4.2))) if greenish else 220
                new_g = min(g, int(max(r, b) * 0.94 + 3)) if greenish else g
                px[x, y] = (r, new_g, b, new_a)
            elif ring == 2 and greenish:
                new_g = min(g, int(max(r, b) * 0.97 + 4))
                px[x, y] = (r, new_g, b, a)
            elif greenish and g - max(r, b) > 18:
                # Suppress slight green rim spill anywhere on clothing/hair
                new_g = min(g, int(max(r, b) * 1.02 + 2))
                px[x, y] = (r, new_g, b, a)

    # Tight crop non-transparent bounds and resize to target_h
    bbox = im.getbbox()
    if not bbox:
        raise RuntimeError(f"Chroma key produced empty image for {src_path}")
    im = im.crop(bbox)
    out_w = max(1, round(im.width * (target_h / im.height)))
    return im.resize((out_w, target_h), Image.Resampling.LANCZOS)


def make_avatar(portrait: Image.Image, accent_rgb: tuple[int, int, int]) -> Image.Image:
    size = 128
    bg = Image.new("RGBA", (size, size), (12, 16, 26, 255))
    d = ImageDraw.Draw(bg)
    for r in range(64, 0, -2):
        t = 1.0 - r / 64.0
        col = (
            int(12 + accent_rgb[0] * 0.25 * t),
            int(16 + accent_rgb[1] * 0.25 * t),
            int(26 + accent_rgb[2] * 0.25 * t),
            255,
        )
        d.ellipse([64 - r, 58 - r, 64 + r, 58 + r], fill=col)
    # Crop upper head/shoulders from portrait
    pw, ph = portrait.size
    crop_h = int(ph * 0.56)
    head = portrait.crop((0, 0, pw, crop_h))
    scale = (size * 1.05) / head.height
    hw = round(head.width * scale)
    hh = round(head.height * scale)
    head = head.resize((hw, hh), Image.Resampling.LANCZOS)
    bg.alpha_composite(head, ((size - hw) // 2, 4))
    return bg


def extract_head(portrait: Image.Image, target_h: int = 96, flip_x: bool = False) -> Image.Image:
    pw, ph = portrait.size
    # Include full head, chin, and upper neck (top 36% of waist-up portrait)
    head = portrait.crop((0, 0, pw, int(ph * 0.36)))
    if flip_x:
        head = head.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    bbox = head.getbbox()
    if bbox:
        head = head.crop(bbox)
    out_w = max(1, round(head.width * (target_h / head.height)))
    return head.resize((out_w, target_h), Image.Resampling.LANCZOS)


def process_scenes_and_cgs() -> None:
    for name, fname in RAW_SCENES.items():
        im = Image.open(ARTIFACTS / fname).convert("RGB")
        im = im.resize((1440, 810), Image.Resampling.LANCZOS)
        out = ASSETS / "scenes" / f"{name}.png"
        im.save(out, "PNG", optimize=True)
        print(f"scene  -> {out.relative_to(ROOT)} ({im.width}x{im.height})")

    for name, fname in RAW_CGS.items():
        im = Image.open(ARTIFACTS / fname).convert("RGB")
        im = im.resize((1440, 810), Image.Resampling.LANCZOS)
        out = ASSETS / "cg" / f"{name}.png"
        im.save(out, "PNG", optimize=True)
        print(f"cg     -> {out.relative_to(ROOT)} ({im.width}x{im.height})")

    # Synthesize Tsing Ma Storm Viaduct (tsing-viaduct.png) cleanly with zero people in sky crop
    finale = Image.open(ARTIFACTS / RAW_CGS["finale"]).convert("RGB").resize((1440, 810), Image.Resampling.LANCZOS)
    wharf = Image.open(ARTIFACTS / RAW_SCENES["kwai-wharf"]).convert("RGB").resize((1440, 810), Image.Resampling.LANCZOS)

    # Top bridge tower & stormy skyline (strictly y=0..265 above Chen & Lin's heads, stretched slightly to 365)
    sky_crop = finale.crop((0, 0, 1440, 265)).resize((1440, 365), Image.Resampling.LANCZOS)
    sky_px = sky_crop.load()
    for y in range(365):
        for x in range(1440):
            r, g, b = sky_px[x, y]
            sky_px[x, y] = (
                min(255, int(r * 0.36 + 10)),
                min(255, int(g * 0.44 + 16)),
                min(255, int(b * 0.64 + 30)),
            )

    viaduct = Image.new("RGBA", (1440, 810), (14, 18, 28, 255))
    viaduct.paste(sky_crop, (0, 0))

    road_crop = wharf.crop((0, 342, 1440, 810)).convert("RGBA")
    road_crop = ImageEnhance.Brightness(road_crop).enhance(0.84)
    r_px = road_crop.load()
    for y in range(36):
        alpha = int((y / 35.0) * 255)
        for x in range(1440):
            r, g, b, _ = r_px[x, y]
            r_px[x, y] = (r, g, b, alpha)
    viaduct.alpha_composite(road_crop, (0, 342))

    # Crisp steel highway sodium-lamp poles & realistic soft amber road sheen
    poles = Image.new("RGBA", (1440, 810), (0, 0, 0, 0))
    pd = ImageDraw.Draw(poles)
    glow = Image.new("RGBA", (1440, 810), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for lx in range(130, 1440, 310):
        pd.line([(lx, 355), (lx, 178), (lx + 38, 160)], fill=(26, 32, 44, 255), width=6)
        pd.line([(lx + 2, 355), (lx + 2, 179), (lx + 38, 162)], fill=(78, 92, 114, 220), width=2)
        pd.ellipse([lx + 26, 154, lx + 50, 168], fill=(255, 220, 140, 240))
        gd.ellipse([lx + 4, 134, lx + 74, 188], fill=(255, 170, 70, 62))
        gd.ellipse([lx - 10, 460, lx + 80, 620], fill=(255, 155, 55, 24))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=14))
    viaduct = Image.alpha_composite(viaduct, glow)
    viaduct = Image.alpha_composite(viaduct, poles)

    rain = Image.new("RGBA", (1440, 810), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rain)
    for i in range(420):
        rx = (i * 197) % 1440
        ry = (i * 131) % 810
        rd.line([(rx, ry), (rx - 4, ry + 26)], fill=(185, 210, 235, 32), width=1)
    viaduct = Image.alpha_composite(viaduct, rain).convert("RGB")
    out_v = ASSETS / "scenes" / "tsing-viaduct.png"
    viaduct.save(out_v, "PNG", optimize=True)
    print(f"scene  -> {out_v.relative_to(ROOT)} ({viaduct.width}x{viaduct.height})")


def shaded_limb(draw: ImageDraw.ImageDraw, p0: tuple[float, float], p1: tuple[float, float], w: float, base_col: tuple[int, int, int], lit_col: tuple[int, int, int]) -> None:
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    ln = max(1.0, math.hypot(dx, dy))
    nx, ny = -dy / ln, dx / ln
    poly = [
        (x0 + nx * w * 0.5, y0 + ny * w * 0.5),
        (x1 + nx * w * 0.44, y1 + ny * w * 0.44),
        (x1 - nx * w * 0.44, y1 - ny * w * 0.44),
        (x0 - nx * w * 0.5, y0 - ny * w * 0.5),
    ]
    draw.polygon(poly, fill=base_col)
    # Rim/front highlight strip
    hi_poly = [
        (x0 + nx * w * 0.46, y0 + ny * w * 0.46),
        (x1 + nx * w * 0.40, y1 + ny * w * 0.40),
        (x1 + nx * w * 0.12, y1 + ny * w * 0.12),
        (x0 + nx * w * 0.14, y0 + ny * w * 0.14),
    ]
    draw.polygon(hi_poly, fill=lit_col)
    r = w * 0.44
    draw.ellipse([x0 - r, y0 - r, x0 + r, y0 + r], fill=base_col)
    draw.ellipse([x1 - r * 0.9, y1 - r * 0.9, x1 + r * 0.9, y1 + r * 0.9], fill=base_col)


def build_realistic_char_sprite(
    head_img: Image.Image,
    out_path: Path,
    pose: str = "idle",
    jacket: tuple[int, int, int] = (46, 52, 64),
    jacket_lit: tuple[int, int, int] = (86, 102, 122),
    shirt: tuple[int, int, int] = (218, 222, 228),
    pants: tuple[int, int, int] = (26, 30, 38),
    pants_lit: tuple[int, int, int] = (48, 56, 70),
    skin: tuple[int, int, int] = (212, 162, 130),
    accent: tuple[int, int, int] | None = None,
    cap: bool = False,
    apron: bool = False,
    cropped_jacket: bool = False,
    tie: bool = False,
) -> None:
    # 4x supersampled canvas (360 x 528) -> final 90 x 132
    W, H = 360, 528
    cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(cv)

    cx = 176
    hip_y = 312 if pose != "run" else 318
    sh_y = 196 if pose != "run" else 204
    lean = 0 if pose == "idle" else (18 if pose == "run" else 22)

    # Leg kinematics
    if pose == "run":
        l_knee, l_foot = (cx - 26, 405), (cx - 56, 488)
        r_knee, r_foot = (cx + 38, 396), (cx + 68, 476)
        b_arm, b_hand = (cx - 26, 260), (cx - 52, 298)
        f_arm, f_hand = (cx + 36, 260), (cx + 68, 240)
    elif pose == "cast":
        l_knee, l_foot = (cx - 30, 412), (cx - 46, 500)
        r_knee, r_foot = (cx + 36, 404), (cx + 52, 500)
        b_arm, b_hand = (cx - 18, 260), (cx - 38, 292)
        f_arm, f_hand = (cx + 56, 224), (cx + 124, 214)
    else:
        l_knee, l_foot = (cx - 18, 412), (cx - 22, 502)
        r_knee, r_foot = (cx + 22, 412), (cx + 28, 502)
        b_arm, b_hand = (cx + 26, 262), (cx + 36, 326)
        f_arm, f_hand = (cx - 26, 262), (cx - 24, 330)

    boot = (18, 20, 26)
    boot_hi = (55, 62, 74)
    dark_j = tuple(max(10, int(c * 0.65)) for c in jacket)
    dark_p = tuple(max(10, int(c * 0.68)) for c in pants)

    # Back arm
    shaded_limb(d, (cx + 16 + lean // 2, sh_y + 12), b_arm, 28, dark_j, jacket)
    shaded_limb(d, b_arm, b_hand, 23, dark_j, jacket)
    d.ellipse([b_hand[0] - 12, b_hand[1] - 12, b_hand[0] + 12, b_hand[1] + 12], fill=skin)

    # Back leg + boot
    shaded_limb(d, (cx + 10, hip_y), r_knee, 36, dark_p, pants)
    shaded_limb(d, r_knee, r_foot, 30, dark_p, pants)
    d.rounded_rectangle([r_foot[0] - 14, r_foot[1] - 6, r_foot[0] + 30, r_foot[1] + 18], radius=8, fill=boot)

    # Front leg + boot
    shaded_limb(d, (cx - 10, hip_y), l_knee, 38, pants, pants_lit)
    shaded_limb(d, l_knee, l_foot, 31, pants, pants_lit)
    d.rounded_rectangle([l_foot[0] - 14, l_foot[1] - 6, l_foot[0] + 32, l_foot[1] + 18], radius=8, fill=boot)
    d.line([(l_foot[0] - 6, l_foot[1] + 2), (l_foot[0] + 24, l_foot[1] + 2)], fill=boot_hi, width=3)

    # Torso (jacket + shirt)
    t_top_y = sh_y
    t_bot_y = hip_y - (18 if cropped_jacket else -8)
    torso_poly = [
        (cx - 42 + lean, t_top_y),
        (cx + 42 + lean, t_top_y + 4),
        (cx + 34, t_bot_y),
        (cx - 34, t_bot_y),
    ]
    d.polygon(torso_poly, fill=jacket)
    # Rim highlight on torso edge
    d.polygon([
        (cx + 22 + lean, t_top_y + 4),
        (cx + 42 + lean, t_top_y + 4),
        (cx + 34, t_bot_y),
        (cx + 18, t_bot_y),
    ], fill=jacket_lit)
    # Shirt V opening
    d.polygon([
        (cx - 10 + lean, t_top_y),
        (cx + 18 + lean, t_top_y + 2),
        (cx + 12, t_bot_y - 4),
        (cx - 4, t_bot_y - 4),
    ], fill=shirt)
    if tie:
        d.polygon([
            (cx + 4 + lean, t_top_y + 10),
            (cx + 12 + lean, t_top_y + 10),
            (cx + 14, t_top_y + 92),
            (cx + 6, t_top_y + 104),
            (cx, t_top_y + 92),
        ], fill=(24, 28, 36))
    if apron:
        d.rounded_rectangle([cx - 28, t_top_y + 52, cx + 32, hip_y + 48], radius=8, fill=(232, 232, 230))
        d.rectangle([cx - 28, t_top_y + 52, cx + 32, t_top_y + 66], fill=(195, 42, 54))
    if accent:
        d.line([(cx + 36 + lean, t_top_y + 12), (cx + 28, t_bot_y - 8)], fill=accent, width=5)

    # Belt
    d.rectangle([cx - 34, hip_y - 12, cx + 34, hip_y + 2], fill=(22, 24, 30))
    d.rectangle([cx + 4, hip_y - 11, cx + 18, hip_y + 1], fill=(175, 185, 198))

    # Front arm
    shaded_limb(d, (cx - 16 + lean, sh_y + 14), f_arm, 30, jacket, jacket_lit)
    shaded_limb(d, f_arm, f_hand, 25, jacket, jacket_lit)
    d.ellipse([f_hand[0] - 13, f_hand[1] - 13, f_hand[0] + 13, f_hand[1] + 13], fill=skin)
    if pose == "cast" and accent:
        d.ellipse([f_hand[0] - 20, f_hand[1] - 20, f_hand[0] + 20, f_hand[1] + 20], outline=accent, width=4)

    # Neck + realistic AI portrait head
    hx = cx + 6 + lean
    hy = sh_y - 24
    d.rounded_rectangle([hx - 16, hy - 10, hx + 16, sh_y + 14], radius=10, fill=skin)
    head_paste = head_img
    hw, hh = head_paste.size
    cv.alpha_composite(head_paste, (int(hx - hw * 0.48), int(hy - hh + 34)))

    if cap:
        d.chord([hx - 48, hy - hh + 10, hx + 48, hy - hh + 56], 180, 360, fill=(22, 34, 56))
        d.rectangle([hx - 4, hy - hh + 30, hx + 58, hy - hh + 38], fill=(14, 18, 28))
        d.ellipse([hx + 8, hy - hh + 20, hx + 20, hy - hh + 30], fill=(238, 198, 86))

    # Soft shadow / depth pass & crop tightly at bottom
    bbox = cv.getbbox()
    if bbox:
        cv = cv.crop(bbox)
    final_h = 132
    final_w = max(1, round(cv.width * (final_h / cv.height)))
    out = cv.resize((final_w, final_h), Image.Resampling.LANCZOS)
    out.save(out_path, "PNG", optimize=True)
    print(f"sprite -> {out_path.relative_to(ROOT)} ({out.width}x{out.height})")


def build_realistic_vehicles() -> None:
    specs = [
        ("sedan", 186, 72, (196, 26, 44), (218, 224, 232), "taxi"),
        ("police", 192, 76, (234, 238, 244), (24, 42, 74), "police"),
        ("convertible", 192, 64, (194, 24, 52), (186, 134, 88), "convertible"),
        ("muscle", 198, 70, (28, 30, 38), (245, 168, 56), "muscle"),
        ("trike_mobility", 114, 72, (232, 182, 42), (244, 236, 210), "trike_mob"),
        ("trike_cargo", 132, 74, (38, 84, 136), (178, 190, 204), "trike_cargo"),
    ]

    for vid, tw, th, body_col, sec_col, mode in specs:
        S = 4
        W, H = tw * S, th * S
        cv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(cv)
        dark_body = tuple(max(10, int(c * 0.55)) for c in body_col)
        lit_body = tuple(min(255, int(c * 1.25 + 24)) for c in body_col)

        if mode.startswith("trike"):
            base_y = H - 28
            # Rear cargo or seat body
            if mode == "trike_cargo":
                d.rounded_rectangle([24, base_y - 108, W - 140, base_y - 26], radius=12, fill=sec_col, outline=(24, 30, 38), width=4)
                # Crates inside open bed
                d.rounded_rectangle([42, base_y - 144, 118, base_y - 100], radius=6, fill=(196, 74, 48))
                d.rounded_rectangle([126, base_y - 138, 200, base_y - 100], radius=6, fill=(48, 116, 178))
                # Cab + windshield canopy
                d.rounded_rectangle([W - 144, base_y - 102, W - 32, base_y - 24], radius=18, fill=body_col)
                d.line([(W - 70, base_y - 98), (W - 58, base_y - 196), (78, base_y - 196), (74, base_y - 108)], fill=(195, 208, 222), width=8)
                d.rectangle([62, base_y - 208, W - 46, base_y - 192], fill=(225, 234, 242))
            else:
                # Yellow/cream compact mobility scooter
                d.rounded_rectangle([38, base_y - 138, 118, base_y - 84], radius=14, fill=(32, 36, 46))
                d.rounded_rectangle([24, base_y - 104, W - 48, base_y - 22], radius=24, fill=body_col)
                d.rounded_rectangle([34, base_y - 98, W - 64, base_y - 74], radius=12, fill=sec_col)
                d.line([(W - 92, base_y - 98), (W - 110, base_y - 178)], fill=(196, 206, 218), width=10)
                d.rounded_rectangle([W - 132, base_y - 186, W - 82, base_y - 168], radius=6, fill=(24, 28, 36))
                d.rounded_rectangle([W - 62, base_y - 136, W - 26, base_y - 94], radius=10, fill=(176, 134, 84))

            # Wheels (rear + front)
            for wx in (76, 118, W - 76):
                r = 34
                d.ellipse([wx - r, base_y - r + 10, wx + r, base_y + r + 10], fill=(18, 20, 26))
                d.ellipse([wx - r + 10, base_y - r + 20, wx + r - 10, base_y + r], fill=(168, 178, 192))
                d.ellipse([wx - 8, base_y + 2, wx + 8, base_y + 18], fill=(32, 38, 48))

            # Headlight & taillight
            d.ellipse([W - 44, base_y - 82, W - 20, base_y - 54], fill=(255, 242, 168))
            d.rounded_rectangle([20, base_y - 82, 34, base_y - 56], radius=4, fill=(255, 66, 86))
        else:
            base_y = H - 36
            body_top = base_y - 108
            if mode == "convertible":
                # Open-top tan seats + raked windshield
                d.rounded_rectangle([W * 0.34, body_top - 26, W * 0.45, body_top + 10], radius=8, fill=sec_col)
                d.rounded_rectangle([W * 0.50, body_top - 26, W * 0.60, body_top + 10], radius=8, fill=sec_col)
                d.polygon([(W * 0.61, body_top + 6), (W * 0.67, body_top - 52), (W * 0.70, body_top - 52), (W * 0.64, body_top + 6)], fill=(150, 215, 242, 180))
            else:
                # Sleek cabin roof + tinted windows
                roof_col = sec_col if mode in ("taxi", "police") else body_col
                cabin = [
                    (W * 0.22, body_top + 8),
                    (W * 0.33, body_top - 64),
                    (W * 0.64, body_top - 64),
                    (W * 0.77, body_top + 8),
                ]
                d.polygon(cabin, fill=roof_col)
                win = [
                    (W * 0.26, body_top + 4),
                    (W * 0.35, body_top - 52),
                    (W * 0.62, body_top - 52),
                    (W * 0.72, body_top + 4),
                ]
                d.polygon(win, fill=(22, 30, 44))
                # Glass reflection streak & B-pillar
                d.polygon([(W * 0.46, body_top + 4), (W * 0.52, body_top - 52), (W * 0.57, body_top - 52), (W * 0.51, body_top + 4)], fill=(120, 198, 232, 85))
                d.rectangle([W * 0.48 - 6, body_top - 56, W * 0.48 + 6, body_top + 6], fill=(18, 22, 30))
                if mode == "taxi":
                    d.rounded_rectangle([W * 0.44, body_top - 86, W * 0.54, body_top - 64], radius=6, fill=(255, 248, 224), outline=(40, 40, 40), width=3)
                elif mode == "police":
                    d.rounded_rectangle([W * 0.43, body_top - 84, W * 0.49, body_top - 64], radius=4, fill=(255, 48, 72))
                    d.rounded_rectangle([W * 0.49, body_top - 84, W * 0.55, body_top - 64], radius=4, fill=(46, 152, 255))

            if mode == "muscle":
                # Rear spoiler
                d.polygon([(20, body_top + 8), (10, body_top - 22), (46, body_top - 22), (56, body_top + 8)], fill=(20, 22, 28))

            # Main sculpted car body
            chassis = [
                (18, base_y - 12),
                (14, body_top + 22),
                (44, body_top),
                (W - 62, body_top + 2),
                (W - 14, body_top + 28),
                (W - 10, base_y - 12),
            ]
            d.polygon(chassis, fill=body_col)
            # Lower rocker shadow + top metallic specular
            d.polygon([(18, base_y - 38), (W - 12, base_y - 38), (W - 10, base_y - 12), (18, base_y - 12)], fill=dark_body)
            d.line([(48, body_top + 14), (W - 58, body_top + 16)], fill=lit_body, width=8)
            if mode == "police":
                d.rectangle([W * 0.28, body_top + 16, W * 0.68, base_y - 20], fill=(24, 42, 74))
                d.line([(20, body_top + 48), (W - 20, body_top + 48)], fill=(48, 178, 255), width=6)
            elif mode == "muscle":
                d.line([(24, body_top + 48), (W - 24, body_top + 48)], fill=sec_col, width=5)

            # Chrome bumpers & lights
            d.rounded_rectangle([10, base_y - 34, 34, base_y - 14], radius=6, fill=(195, 206, 220))
            d.rounded_rectangle([W - 34, base_y - 34, W - 8, base_y - 14], radius=6, fill=(195, 206, 220))
            d.rounded_rectangle([W - 32, body_top + 32, W - 12, body_top + 56], radius=6, fill=(255, 242, 172))
            d.rounded_rectangle([12, body_top + 30, 26, body_top + 54], radius=5, fill=(240, 46, 68))

            # Realistic wheel wells + alloy tires
            for wx in (138, W - 138):
                r = 44
                d.ellipse([wx - r - 8, base_y - r - 12, wx + r + 8, base_y + r - 4], fill=(12, 14, 18))
                d.ellipse([wx - r, base_y - r - 4, wx + r, base_y + r - 4], fill=(22, 24, 30))
                d.ellipse([wx - r + 14, base_y - r + 10, wx + r - 14, base_y + r - 18], fill=(176, 186, 202))
                d.ellipse([wx - 10, base_y - 14, wx + 10, base_y + 6], fill=(38, 44, 56))

        out = cv.resize((tw, th), Image.Resampling.LANCZOS)
        out_path = ASSETS / "vehicles" / f"{vid}.png"
        out.save(out_path, "PNG", optimize=True)
        print(f"veh    -> {out_path.relative_to(ROOT)} ({out.width}x{out.height})")


def build_realistic_props() -> None:
    S = 4

    # 1. Hydrant (36 x 54)
    cv = Image.new("RGBA", (36 * S, 54 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(cv)
    d.rounded_rectangle([42, 46, 102, 206], radius=16, fill=(196, 36, 48))
    d.rounded_rectangle([72, 48, 102, 204], radius=12, fill=(138, 22, 32))
    d.rounded_rectangle([24, 72, 120, 106], radius=10, fill=(235, 192, 68))
    d.rounded_rectangle([46, 24, 98, 52], radius=12, fill=(235, 192, 68))
    d.rounded_rectangle([34, 196, 110, 212], radius=6, fill=(92, 22, 28))
    cv.resize((36, 54), Image.Resampling.LANCZOS).save(ASSETS / "props" / "hydrant.png", "PNG", optimize=True)

    # 2. Hazard Barrel (44 x 60)
    cv = Image.new("RGBA", (44 * S, 60 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(cv)
    d.rounded_rectangle([24, 18, 152, 232], radius=22, fill=(194, 42, 46))
    d.rounded_rectangle([104, 20, 152, 230], radius=18, fill=(124, 24, 28))
    d.ellipse([24, 10, 152, 46], fill=(232, 86, 74))
    d.rectangle([24, 86, 152, 110], fill=(242, 196, 62))
    d.rectangle([24, 156, 152, 180], fill=(242, 196, 62))
    cv.resize((44, 60), Image.Resampling.LANCZOS).save(ASSETS / "props" / "barrel.png", "PNG", optimize=True)

    # 3. Umbrella Table (84 x 90)
    cv = Image.new("RGBA", (84 * S, 90 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(cv)
    d.rectangle([162, 74, 174, 348], fill=(96, 76, 62))
    d.rounded_rectangle([94, 218, 242, 238], radius=6, fill=(214, 196, 172))
    d.line([(114, 238), (104, 350)], fill=(74, 58, 48), width=10)
    d.line([(222, 238), (232, 350)], fill=(74, 58, 48), width=10)
    d.polygon([(14, 118), (168, 24), (322, 118)], fill=(208, 44, 72))
    d.polygon([(92, 118), (168, 24), (244, 118)], fill=(244, 238, 228))
    d.polygon([(142, 118), (168, 24), (194, 118)], fill=(208, 44, 72))
    cv.resize((84, 90), Image.Resampling.LANCZOS).save(ASSETS / "props" / "umbrella.png", "PNG", optimize=True)

    # 4. Vending Machine (58 x 88)
    cv = Image.new("RGBA", (58 * S, 88 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(cv)
    d.rounded_rectangle([24, 16, 208, 344], radius=14, fill=(32, 46, 74))
    d.rounded_rectangle([160, 18, 208, 342], radius=10, fill=(20, 30, 50))
    d.rounded_rectangle([38, 34, 148, 204], radius=8, fill=(74, 226, 255))
    for row_y, col in ((56, (255, 76, 138)), (108, (255, 204, 86)), (160, (74, 240, 198))):
        d.rounded_rectangle([48, row_y, 138, row_y + 28], radius=4, fill=col)
    d.rounded_rectangle([42, 244, 144, 294], radius=6, fill=(14, 18, 28))
    cv.resize((58, 88), Image.Resampling.LANCZOS).save(ASSETS / "props" / "vending.png", "PNG", optimize=True)

    # 5. Jump Ramp (108 x 44)
    cv = Image.new("RGBA", (108 * S, 44 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(cv)
    d.polygon([(12, 164), (416, 164), (416, 22)], fill=(232, 168, 46))
    d.polygon([(380, 164), (416, 164), (416, 22)], fill=(142, 98, 24))
    for sx in range(80, 360, 66):
        d.polygon([(sx, 164), (sx + 28, 164), (sx + 48, 128), (sx + 20, 128)], fill=(26, 30, 38))
    d.line([(12, 164), (416, 22)], fill=(255, 226, 126), width=8)
    cv.resize((108, 44), Image.Resampling.LANCZOS).save(ASSETS / "props" / "ramp.png", "PNG", optimize=True)
    print("props  -> 5 realistic props generated")


def main() -> int:
    ensure_dirs()
    process_scenes_and_cgs()

    portraits: dict[str, Image.Image] = {}
    for pid, (fname, flip_flag) in RAW_PORTRAITS.items():
        p_img = key_chroma_portrait(ARTIFACTS / fname, target_h=580)
        if flip_flag:
            p_img = p_img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        out = ASSETS / "portraits" / f"{pid}.png"
        p_img.save(out, "PNG", optimize=True)
        portraits[pid] = p_img
        print(f"portr  -> {out.relative_to(ROOT)} ({p_img.width}x{p_img.height})")

    make_avatar(portraits["chen"], (46, 232, 200)).save(ASSETS / "portraits" / "avatar_chen.png", "PNG", optimize=True)
    make_avatar(portraits["lin"], (255, 72, 114)).save(ASSETS / "portraits" / "avatar_lin.png", "PNG", optimize=True)

    # Extract clean realistic heads facing right (+X) for in-world sprites
    h_chen = extract_head(portraits["chen"], target_h=94, flip_x=False)
    h_lin = extract_head(portraits["lin"], target_h=90, flip_x=True)
    h_zhou = extract_head(portraits["zhou"], target_h=92, flip_x=True)
    h_shen = extract_head(portraits["shen"], target_h=92, flip_x=True)
    h_kun = extract_head(portraits["kun"], target_h=92, flip_x=False)

    for pose in ("idle", "run", "cast"):
        build_realistic_char_sprite(
            h_chen,
            ASSETS / "sprites" / f"chen_{pose}.png",
            pose=pose,
            jacket=(42, 46, 54),
            jacket_lit=(82, 92, 108),
            shirt=(226, 228, 232),
            pants=(24, 28, 36),
            pants_lit=(48, 56, 70),
            accent=(46, 232, 200),
            tie=True,
        )
        build_realistic_char_sprite(
            h_lin,
            ASSETS / "sprites" / f"lin_{pose}.png",
            pose=pose,
            jacket=(176, 30, 56),
            jacket_lit=(228, 66, 94),
            shirt=(34, 38, 46),
            pants=(24, 26, 34),
            pants_lit=(52, 58, 72),
            accent=(255, 72, 114),
            cropped_jacket=True,
        )

    build_realistic_char_sprite(
        h_zhou,
        ASSETS / "sprites" / "ped_tourist.png",
        pose="idle",
        jacket=(184, 162, 134),
        jacket_lit=(216, 194, 164),
        shirt=(228, 224, 214),
        pants=(48, 54, 66),
        pants_lit=(74, 84, 100),
    )
    build_realistic_char_sprite(
        h_chen,
        ASSETS / "sprites" / "ped_skater.png",
        pose="run",
        jacket=(84, 72, 108),
        jacket_lit=(126, 110, 158),
        shirt=(210, 214, 224),
        pants=(36, 40, 52),
        pants_lit=(64, 72, 92),
        accent=(46, 232, 200),
    )
    build_realistic_char_sprite(
        h_shen,
        ASSETS / "sprites" / "ped_vendor.png",
        pose="idle",
        jacket=(72, 92, 104),
        jacket_lit=(106, 132, 148),
        shirt=(236, 232, 220),
        pants=(38, 44, 52),
        pants_lit=(66, 74, 86),
        apron=True,
    )
    build_realistic_char_sprite(
        h_kun,
        ASSETS / "sprites" / "ped_brawler.png",
        pose="idle",
        jacket=(28, 24, 28),
        jacket_lit=(68, 56, 62),
        shirt=(164, 36, 46),
        pants=(26, 28, 36),
        pants_lit=(54, 58, 72),
        accent=(255, 184, 77),
    )
    build_realistic_char_sprite(
        h_zhou,
        ASSETS / "sprites" / "ped_police.png",
        pose="idle",
        jacket=(26, 46, 78),
        jacket_lit=(52, 84, 132),
        shirt=(212, 222, 234),
        pants=(20, 30, 48),
        pants_lit=(40, 56, 82),
        accent=(240, 204, 105),
        cap=True,
        tie=True,
    )

    build_realistic_vehicles()
    build_realistic_props()
    print("ALL ASSETS READY!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
