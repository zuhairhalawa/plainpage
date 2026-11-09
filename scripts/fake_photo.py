"""Turns the rendered sample letter into phone-style photos of printed pages:
split into A4 pages, slightly rotated and skewed on a desk, uneven light and
sensor noise. Output: eval/out/sample-photo-p1.jpg, -p2.jpg (fictional letter).
Run: python -I scripts/fake_photo.py
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
src = Image.open(ROOT / "eval/out/sample-page.png").convert("RGB")
W = src.width
H = int(W * 297 / 210)  # A4
random.seed(7)

pages = []
y = 0
while y < src.height:
    page = Image.new("RGB", (W, H), "white")
    page.paste(src.crop((0, y, W, min(y + H, src.height))), (0, 0))
    pages.append(page)
    y += H - 140  # a little overlap so no line is cut in half

for i, page in enumerate(pages, 1):
    page = page.resize((W // 2 * 2 // 2, H // 2), Image.LANCZOS) if False else page
    # Desk and a soft shadow.
    desk = Image.new("RGB", (int(W * 1.18), int(H * 1.12)), (92, 84, 74))
    shadow = Image.new("L", desk.size, 0)
    ox, oy = (desk.width - W) // 2, (desk.height - H) // 2
    ImageDraw.Draw(shadow).rectangle((ox + 18, oy + 24, ox + W + 18, oy + H + 24), fill=150)
    desk.paste((40, 36, 30), mask=shadow.filter(ImageFilter.GaussianBlur(30)))
    # Slight perspective: the top edge a bit narrower than the bottom.
    k = 0.025
    quad = (-W * k, 0, -W * k * 0.2, H, W * (1 + k * 0.2), H, W * (1 + k), 0)
    warped = page.transform((W, H), Image.QUAD, quad, Image.BICUBIC, fillcolor=(92, 84, 74))
    desk.paste(warped, (ox, oy))
    desk = desk.rotate(random.choice([-1, 1]) * random.uniform(0.8, 1.6), resample=Image.BICUBIC, fillcolor=(92, 84, 74))
    # Uneven light: brighter top-left, darker bottom-right.
    light = Image.linear_gradient("L").rotate(35, expand=False).resize(desk.size)
    dark = Image.new("RGB", desk.size, (0, 0, 0))
    desk = Image.composite(desk, Image.blend(desk, dark, 0.22), light.point(lambda v: 255 - v // 3))
    # Sensor noise and a touch of blur.
    noise = Image.effect_noise(desk.size, 18).convert("RGB")
    desk = Image.blend(desk, noise, 0.05).filter(ImageFilter.GaussianBlur(0.6))
    desk = desk.resize((desk.width * 3 // 4, desk.height * 3 // 4), Image.LANCZOS)
    out = ROOT / f"eval/out/sample-photo-p{i}.jpg"
    desk.save(out, quality=84)
    print("wrote", out.name, desk.size)
