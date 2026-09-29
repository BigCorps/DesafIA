from pathlib import Path
import io
import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
SVG=(ROOT/'brand/icone.svg').read_text(encoding='utf-8')
icons=ROOT/'public/icons'; icons.mkdir(parents=True,exist_ok=True)

def png(size,path,svg=SVG):
    data=cairosvg.svg2png(bytestring=svg.encode(),output_width=size,output_height=size)
    Image.open(io.BytesIO(data)).convert('RGBA').save(path,optimize=True)

for s in (48,72,96,144,192,512): png(s,icons/f'icon-{s}.png')
png(180,icons/'apple-touch-icon.png')
png(512,ROOT/'brand/play-icone-512.png')
# Para maskable, o desenho já tem área segura ampla.
png(192,icons/'maskable-192.png'); png(512,icons/'maskable-512.png')

# Arte de destaque simples para a Play Store.
w,h=1024,500
im=Image.new('RGB',(w,h),(118,88,245)); d=ImageDraw.Draw(im)
for r,a in [(430,25),(330,35),(230,45)]:
    layer=Image.new('RGBA',(w,h),(0,0,0,0)); ld=ImageDraw.Draw(layer); ld.ellipse((w-530-r//2,-100-r//2,w-530+r//2,-100+r//2),fill=(255,255,255,a)); im=Image.alpha_composite(im.convert('RGBA'),layer)
d=ImageDraw.Draw(im)
try:
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',62)
    small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30)
except: font=small=None
d.text((70,150),'DesafIA',font=font,fill='white')
d.text((72,225),'Pequenos desafios,\ngrandes hábitos.',font=small,fill=(242,238,255))
icon=Image.open(ROOT/'brand/play-icone-512.png').convert('RGBA').resize((360,360))
im.alpha_composite(icon,(620,70))
im.convert('RGB').save(ROOT/'brand/play-arte-destaque-1024x500.png',quality=94,optimize=True)
