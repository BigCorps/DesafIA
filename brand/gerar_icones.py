#!/usr/bin/env python3
"""
Gera os ícones do app e as artes da Play Store a partir do personagem.

Uso:  pip install cairosvg   e depois   python3 brand/gerar_icones.py
Para a arte de destaque com o texto certo, instale a fonte Grandstander
(public/fonts/Grandstander.ttf) no sistema antes de rodar.
"""
from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "brand"
ICONS = ROOT / "public" / "icons"
ICONS.mkdir(parents=True, exist_ok=True)

# Paleta do personagem (cor rosa, igual ao jogo)
BODY = ("#FFBCC8", "#FF8FA3", "#EE6684")
LIMB, FOOT, BELLY, CHEEK, INK = "#F27A93", "#E35C7A", "#FFE4EA", "#FF5577", "#2A2350"


def pet(transform, flower=True, happy=True, uid="p"):
    """O bichinho em coordenadas 0..200, posicionado por `transform`."""
    flower_svg = f"""
      <path d="M100 25 C112 13 126 16 131 23 C123 33 108 33 100 25Z" fill="#76DDA0"/>
      <circle cx="100" cy="7" r="6" fill="#FFD54A"/><circle cx="92" cy="13" r="6" fill="#FFD54A"/>
      <circle cx="108" cy="13" r="6" fill="#FFD54A"/><circle cx="95" cy="21" r="6" fill="#FFD54A"/>
      <circle cx="105" cy="21" r="6" fill="#FFD54A"/><circle cx="100" cy="15" r="5" fill="#FF8C42"/>""" if flower else ""
    mouth = (f'<path d="M86 121 Q100 146 114 121 Z" fill="{INK}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
             f'<path d="M93 133 Q100 141 107 133" fill="#FF7A95"/>') if happy else \
        f'<path d="M88 124 Q100 136 112 124" stroke="{INK}" stroke-width="4.5" stroke-linecap="round" fill="none"/>'
    return f"""
  <defs>
    <radialGradient id="{uid}-body" cx="36%" cy="30%" r="78%">
      <stop offset="0" stop-color="{BODY[0]}"/><stop offset=".58" stop-color="{BODY[1]}"/><stop offset="1" stop-color="{BODY[2]}"/>
    </radialGradient>
  </defs>
  <g transform="{transform}">
    <ellipse cx="100" cy="191" rx="58" ry="8" fill="#000" opacity=".16"/>
    <path d="M100 48 C98 36 102 28 100 16" stroke="#3FA86E" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M100 32 C88 21 75 24 70 31 C79 40 92 40 100 32Z" fill="#5CCB8A"/>
    {flower_svg}
    <ellipse cx="72" cy="179" rx="17" ry="9" fill="{FOOT}"/>
    <ellipse cx="128" cy="179" rx="17" ry="9" fill="{FOOT}"/>
    <ellipse cx="29" cy="134" rx="10" ry="17" fill="{LIMB}" transform="rotate(22 29 134)"/>
    <ellipse cx="171" cy="134" rx="10" ry="17" fill="{LIMB}" transform="rotate(-22 171 134)"/>
    <path d="M100 44 C150 44 176 84 176 124 C176 162 146 182 100 182 C54 182 24 162 24 124 C24 84 50 44 100 44Z" fill="url(#{uid}-body)"/>
    <ellipse cx="100" cy="148" rx="46" ry="30" fill="{BELLY}"/>
    <ellipse cx="76" cy="106" rx="10" ry="13" fill="{INK}"/><circle cx="79.5" cy="101" r="4.2" fill="#fff"/><circle cx="73" cy="111.5" r="1.8" fill="#fff"/>
    <ellipse cx="124" cy="106" rx="10" ry="13" fill="{INK}"/><circle cx="127.5" cy="101" r="4.2" fill="#fff"/><circle cx="121" cy="111.5" r="1.8" fill="#fff"/>
    <ellipse cx="59" cy="127" rx="10" ry="6" fill="{CHEEK}" opacity=".5"/>
    <ellipse cx="141" cy="127" rx="10" ry="6" fill="{CHEEK}" opacity=".5"/>
    {mouth}
  </g>"""


def sparkle(x, y, s, color="#FFD54A"):
    return (f'<path transform="translate({x} {y}) scale({s})" fill="{color}" '
            f'd="M0 -50 C6 -14 14 -6 50 0 C14 6 6 14 0 50 C-6 14 -14 6 -50 0 C-14 -6 -6 -14 0 -50Z"/>')


def icon_svg(rounded, pad=1.0):
    """Ícone quadrado 1024. rounded=True: cantos arredondados (PWA 'any' e favicon).
    pad<1 encolhe o personagem para caber na área segura do ícone adaptável."""
    s = 3.05 * pad
    rx = 230 if rounded else 0
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9C85FF"/><stop offset="1" stop-color="#5A3EDC"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="44%" r="52%"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <clipPath id="clip"><rect width="1024" height="1024" rx="{rx}"/></clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <circle cx="512" cy="470" r="420" fill="url(#glow)"/>
    <ellipse cx="512" cy="1060" rx="640" ry="250" fill="#5CCB8A"/>
    <ellipse cx="512" cy="1075" rx="640" ry="235" fill="#4DB77A"/>
    {sparkle(772, 262, 1.15 * pad)}
    {sparkle(262, 330, 0.6 * pad, "#FFFFFF")}
    {sparkle(800, 520, 0.45 * pad, "#FFFFFF")}
    {pet(f"translate(512 {545 + (1 - pad) * 40}) scale({s}) translate(-100 -104)", uid="ic")}
  </g>
</svg>"""


def monochrome_svg():
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(512 540) scale(2.5) translate(-100 -104)" fill="#fff">
    <path d="M100 48 C98 36 102 28 100 16" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M100 32 C88 21 75 24 70 31 C79 40 92 40 100 32Z"/>
    <path d="M100 25 C112 13 126 16 131 23 C123 33 108 33 100 25Z"/>
    <ellipse cx="72" cy="179" rx="17" ry="9"/><ellipse cx="128" cy="179" rx="17" ry="9"/>
    <path d="M100 44 C150 44 176 84 176 124 C176 162 146 182 100 182 C54 182 24 162 24 124 C24 84 50 44 100 44Z"/>
  </g>
</svg>"""


def feature_svg():
    """Arte de destaque da Play Store: 1024 x 500, sem transparência."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 500" width="1024" height="500">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#63BEFF"/><stop offset=".8" stop-color="#CBEBFF"/></linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#sky)"/>
  <circle cx="930" cy="92" r="46" fill="#FFD54A"/>
  <circle cx="930" cy="92" r="66" fill="#FFD54A" opacity=".22"/>
  <g fill="#fff" opacity=".95">
    <rect x="560" y="70" width="110" height="34" rx="17"/><circle cx="595" cy="70" r="24"/><circle cx="632" cy="76" r="17"/>
    <rect x="96" y="380" width="0" height="0"/>
  </g>
  <ellipse cx="760" cy="600" rx="460" ry="200" fill="#8EDFA8"/>
  <ellipse cx="880" cy="640" rx="420" ry="190" fill="#5CCB8A"/>
  {sparkle(640, 200, 0.55)}
  {sparkle(930, 300, 0.4, "#FFFFFF")}
  {pet("translate(790 300) scale(1.75) translate(-100 -104)", uid="fg")}
  <text x="72" y="215" font-family="Grandstander" font-size="120" fill="#2A2350">Desafia</text>
  <text x="76" y="278" font-family="Atkinson Hyperlegible" font-weight="bold" font-size="34" fill="#2A2350">Pequenos desafios, grandes hábitos.</text>
  <g font-family="Atkinson Hyperlegible" font-weight="bold" font-size="24" fill="#2A2350">
    <rect x="76" y="318" width="150" height="48" rx="24" fill="#FFFFFF" opacity=".92"/><text x="151" y="350" text-anchor="middle">Missões</text>
    <rect x="240" y="318" width="150" height="48" rx="24" fill="#FFFFFF" opacity=".92"/><text x="315" y="350" text-anchor="middle">Estrelas</text>
    <rect x="404" y="318" width="150" height="48" rx="24" fill="#FFFFFF" opacity=".92"/><text x="479" y="350" text-anchor="middle">Prêmios</text>
  </g>
</svg>"""


def png(svg, path, size, w=None, h=None):
    cairosvg.svg2png(bytestring=svg.encode(), write_to=str(path),
                     output_width=w or size, output_height=h or size)


def main():
    rounded, full, safe = icon_svg(True), icon_svg(False), icon_svg(False, pad=0.86)
    (BRAND / "icone.svg").write_text(rounded)
    (BRAND / "icone-quadrado.svg").write_text(full)
    (BRAND / "icone-adaptavel.svg").write_text(safe)
    (BRAND / "arte-destaque.svg").write_text(feature_svg())
    (ROOT / "public" / "favicon.svg").write_text(rounded)

    for s in (48, 72, 96, 144, 192, 512):
        png(rounded, ICONS / f"icon-{s}.png", s)
    for s in (192, 512):
        png(safe, ICONS / f"maskable-{s}.png", s)
    png(full, ICONS / "apple-touch-icon.png", 180)
    png(monochrome_svg(), ICONS / "monochrome-512.png", 512)

    # Play Store: ícone 512x512 (quadrado, o Google arredonda) e arte de destaque 1024x500
    png(full, BRAND / "play-icone-512.png", 512)
    png(feature_svg(), BRAND / "play-arte-destaque-1024x500.png", 0, 1024, 500)
    png(rounded, BRAND / "icone-1024.png", 1024)
    print("Ícones e artes gerados em public/icons e brand/")


if __name__ == "__main__":
    main()
