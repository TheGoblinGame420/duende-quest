from PIL import Image, ImageDraw, ImageFont
import os

base = r"C:\Users\Alonso\OneDrive\Desktop\PRIVADO NO TOCAR\launchduende2,0"
out = os.path.join(base, "assets", "telegram_app_banner.png")

# Create 640x360 canvas
img = Image.new("RGBA", (640, 360), (10, 10, 30, 255))
draw = ImageDraw.Draw(img)

# Dark gradient background
for y in range(360):
    r = int(10 + (20 * y / 360))
    g = int(10 + (5 * y / 360))
    b = int(30 + (40 * y / 360))
    draw.line([(0, y), (639, y)], fill=(r, g, b, 255))

# Neon grid lines
for x in range(0, 640, 40):
    draw.line([(x, 200), (x, 359)], fill=(100, 0, 200, 30), width=1)
for y in range(200, 360, 20):
    draw.line([(0, y), (639, y)], fill=(100, 0, 200, 30), width=1)

# Load hero sprite
hero_path = os.path.join(base, "assets", "skin duende", "duende_comun.png")
if os.path.exists(hero_path):
    hero = Image.open(hero_path).convert("RGBA")
    ratio = 200 / hero.height
    hero = hero.resize((int(hero.width * ratio), 200), Image.NEAREST)
    img.paste(hero, (40, 100), hero)

# Load necromancer skin
necro_path = os.path.join(base, "assets", "skin duende", "skin_necromancer.png")
if os.path.exists(necro_path):
    necro = Image.open(necro_path).convert("RGBA")
    ratio = 160 / necro.height
    necro = necro.resize((int(necro.width * ratio), 160), Image.NEAREST)
    img.paste(necro, (480, 130), necro)

# Fonts
try:
    font_big = ImageFont.truetype("arial.ttf", 36)
    font_med = ImageFont.truetype("arial.ttf", 18)
    font_sm = ImageFont.truetype("arial.ttf", 14)
except:
    font_big = ImageFont.load_default()
    font_med = font_big
    font_sm = font_big

# Title glow
draw.text((198, 32), "DUENDE QUEST", fill=(150, 0, 255, 128), font=font_big)
draw.text((200, 30), "DUENDE QUEST", fill=(255, 230, 0, 255), font=font_big)

# Subtitle
draw.text((200, 75), "Play-to-Earn  |  Solana", fill=(192, 132, 252, 255), font=font_med)

# Features
features = ["Kill enemies & earn $DUENDE", "Staking up to 240% APY", "NFTs & Skins", "Global Ranking"]
for i, f in enumerate(features):
    y_pos = 110 + i * 24
    draw.text((220, y_pos), f"  {f}", fill=(200, 200, 200, 255), font=font_sm)

# Bottom bar
draw.rectangle([(0, 340), (639, 359)], fill=(192, 132, 252, 40))
draw.text((200, 343), "t.me/duendequest_bot/app", fill=(192, 132, 252, 255), font=font_sm)

img.save(out, "PNG")
print(f"Saved: {out}")
print(f"Size: {img.size}")
