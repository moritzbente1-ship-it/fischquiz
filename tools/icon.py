#!/usr/bin/env python3
"""Zeichnet das App-Icon: Fisch-Silhouette auf Tiefsee-Verlauf."""
from PIL import Image, ImageDraw, ImageFilter
import pathlib
out = pathlib.Path(__file__).resolve().parent.parent / "icons"
N = 1024
img = Image.new("RGB", (N, N))
px = img.load()
top, bot = (20, 120, 128), (6, 28, 44)
for y in range(N):
    t = y / (N - 1)
    c = tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3))
    for x in range(N):
        px[x, y] = c
# weicher Lichtschein oben
glow = Image.new("L", (N, N), 0)
ImageDraw.Draw(glow).ellipse((150, -350, 900, 420), fill=150)
glow = glow.filter(ImageFilter.GaussianBlur(120))
img = Image.composite(Image.new("RGB", (N, N), (120, 240, 230)), img, glow.point(lambda v: v * 0.45))
# Fisch (Maske, 4x übersampelt für glatte Kanten)
S = 4
m = Image.new("L", (N * S, N * S), 0)
d = ImageDraw.Draw(m)
def P(x, y): return (x * S, y * S)
d.ellipse((*P(190, 340), *P(700, 690)), fill=255)                         # Körper
d.polygon([P(640, 515), P(860, 360), P(815, 515), P(860, 670)], fill=255) # Schwanz
d.polygon([P(390, 360), P(470, 270), P(560, 365)], fill=255)              # Rückenflosse
d.ellipse((*P(285, 455), *P(335, 505)), fill=0)                            # Auge
d.arc((*P(360, 400), *P(470, 630)), 300, 60, fill=0, width=14 * S)        # Kiemenbogen
m = m.resize((N, N), Image.LANCZOS)
schatten = m.filter(ImageFilter.GaussianBlur(28)).point(lambda v: v * 0.35)
img = Image.composite(Image.new("RGB", (N, N), (0, 10, 18)), img, schatten.transform((N, N), Image.AFFINE, (1, 0, 0, 0, 1, -18)))
img = Image.composite(Image.new("RGB", (N, N), (236, 252, 250)), img, m)
for s in (180, 192, 512):
    img.resize((s, s), Image.LANCZOS).save(out / f"icon-{s}.png", optimize=True)
print("ok")
