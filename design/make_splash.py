from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np, math, glob, sys
W,H=1290,2796
rng=np.random.default_rng(7)
def lerp(a,b,t): return a+(b-a)*t
def grad(stops,t):
    # stops: [(pos,(r,g,b))]
    out=np.zeros(t.shape+(3,))
    for i in range(len(stops)-1):
        p0,c0=stops[i]; p1,c1=stops[i+1]
        m=(t>=p0)&(t<=p1)
        u=((t-p0)/(p1-p0))[...,None]
        out=np.where(m[...,None], np.array(c0)+(np.array(c1)-np.array(c0))*u, out)
    out=np.where((t>stops[-1][0])[...,None], np.array(stops[-1][1]), out)
    return out
hy=int(H*0.60)   # horizon
yy=np.arange(H)[:,None]*np.ones((1,W))
img=np.zeros((H,W,3))
sky=[(0,(24,16,80)),(0.30,(84,38,132)),(0.60,(196,70,108)),(0.88,(246,124,56)),(1.0,(255,176,92))]
t=np.clip(yy[:hy]/hy,0,1)
img[:hy]=grad(sky,t)
sea=[(0,(238,142,102)),(0.25,(150,104,160)),(1,(52,84,176))]
t=np.clip((yy[hy:]-hy)/(H*0.30),0,1)
img[hy:]=grad(sea,t)
im=Image.fromarray(img.clip(0,255).astype(np.uint8),"RGB").convert("RGBA")

def glow_layer(draw_fn, blur):
    L=Image.new("RGBA",(W,H),(0,0,0,0)); draw_fn(ImageDraw.Draw(L)); return L.filter(ImageFilter.GaussianBlur(blur))
# sun glow
cx,cy,r=int(W*0.5),hy+int(r0:=0)+0,int(W*0.20)
def sunglow(d):
    for i in range(10,0,-1):
        rr=int(r*(1+i*0.30)); d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),fill=(255,150,70,14))
im.alpha_composite(glow_layer(sunglow,40))
# sun (half, clipped at horizon)
sun=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(sun)
d.ellipse((cx-r,cy-r*0.9,cx+r,cy+r*1.1),fill=(255,214,126,255))
d.ellipse((cx-int(r*0.74),cy-int(r*0.74),cx+int(r*0.74),cy+int(r*0.74)),fill=(255,238,176,230))
mask=Image.new("L",(W,H),0); ImageDraw.Draw(mask).rectangle((0,0,W,hy),fill=255)
sun.putalpha(Image.composite(sun.split()[3],Image.new("L",(W,H),0),mask))
im.alpha_composite(sun)
# reflection on sea
ref=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(ref)
y=hy+10; row=0
while y<int(H*0.80):
    k=(y-hy)/(H*0.30)
    w=r*(0.40+k*1.0)*rng.uniform(0.55,1.0)
    a=int(max(0,rng.uniform(120,210)-k*230))
    d.rounded_rectangle((cx-w/2,y,cx+w/2,y+4+k*6),radius=4,fill=(255,206,128,a))
    y+=16+k*34; row+=1
im.alpha_composite(ref.filter(ImageFilter.GaussianBlur(1.2)))
# horizon line
d=ImageDraw.Draw(im,"RGBA"); d.line((0,hy,W,hy),fill=(255,226,178,230),width=3)
# ripples (perspective)
rip=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(rip)
for i,dd in enumerate((0.25,0.62)):
    depth=dd**1.9; y0=hy+(H*0.24)*depth
    wl=120+depth*420; amp=1+depth*7
    pts=[(x,y0+math.sin(x/wl*6.283+i*2.3)*amp) for x in range(0,W+10,10)]
    d.line(pts,fill=(255,255,255,46),width=int(2+depth*3))
im.alpha_composite(rip)
# beach: foam + sand
sand=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(sand)
base=int(H*0.90)
pts=[(x,base+math.sin(x*0.006+1)*26+math.sin(x*0.016)*9) for x in range(0,W+10,10)]
poly=pts+[(W,H),(0,H)]
d.polygon(poly,fill=(253,238,208,255))
im.alpha_composite(sand)
foam=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(foam)
d.line([(x,y-6) for x,y in pts],fill=(255,255,255,235),width=7)
d.line([(x,y-46+math.sin(x*0.01)*8) for x,y in pts],fill=(255,255,255,90),width=4)
im.alpha_composite(foam.filter(ImageFilter.GaussianBlur(0.8)))
# 背景のみ（タイトルの文字は、アプリ側でゆらしながら重ねる）
im.convert("RGB").save(sys.argv[1],quality=92)
print("saved (background only)")
