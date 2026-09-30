from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
MASTER=Image.open(ROOT/'brand/icone-1024.png').convert('RGBA')
icons=ROOT/'public/icons'; icons.mkdir(parents=True,exist_ok=True)

def regular(size,path):
    MASTER.resize((size,size),Image.Resampling.LANCZOS).save(path,optimize=True)

def opaque(size,path):
    bg=Image.new('RGBA',MASTER.size,'#7658F5'); bg.alpha_composite(MASTER)
    bg.resize((size,size),Image.Resampling.LANCZOS).convert('RGB').save(path,optimize=True)

for s in (48,72,96,144,192,512): regular(s,icons/f'icon-{s}.png')
opaque(180,icons/'apple-touch-icon.png')
opaque(192,icons/'maskable-192.png'); opaque(512,icons/'maskable-512.png')
opaque(512,ROOT/'brand/play-icone-512.png')

# Arte de destaque para a Play Store.
w,h=1024,500
im=Image.new('RGBA',(w,h),(118,88,245,255)); d=ImageDraw.Draw(im)
for cx,cy,r,a in [(760,-30,470,26),(760,-30,350,30),(760,-30,240,34)]:
    layer=Image.new('RGBA',(w,h),(0,0,0,0)); ld=ImageDraw.Draw(layer)
    ld.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(255,255,255,a)); im=Image.alpha_composite(im,layer)
d=ImageDraw.Draw(im)
try:
    font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',62)
    small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30)
except Exception:
    font=small=None
d.text((70,150),'DesafIA',font=font,fill='white')
d.text((72,225),'Pequenos desafios,\ngrandes hábitos.',font=small,fill=(242,238,255))
icon=Image.open(ROOT/'brand/play-icone-512.png').convert('RGBA').resize((380,380),Image.Resampling.LANCZOS)
im.alpha_composite(icon,(610,60))
im.convert('RGB').save(ROOT/'brand/play-arte-destaque-1024x500.png',quality=94,optimize=True)
