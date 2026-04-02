#!/usr/bin/env python3
"""
generate_assets.py – Generate Chrome Web Store promotional images for TabPlusPlus.

Produces:
  marquee_1400x560.png      – Marquee / top promo banner
  small_tile_440x280.png    – Small promotional tile
  screenshot_1_tabs.png     – Screenshot: Side Panel Tabs view (1280×800)
  screenshot_2_filters.png  – Screenshot: Filters & Sorting (1280×800)
  screenshot_3_bulk.png     – Screenshot: Bulk Actions (1280×800)
  screenshot_4_bookmarks.png– Screenshot: Bookmark Manager (1280×800)
  screenshot_5_sessions.png – Screenshot: Session Save & Restore (1280×800)
  screenshot_6_settings.png – Screenshot: Settings Page (1280×800)
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

# ── Brand colours ──────────────────────────────────────────────────────────────
PRIMARY    = (102, 126, 234)   # #667eea
ACCENT     = (118,  75, 162)   # #764ba2
WHITE      = (255, 255, 255)
BG_DARK    = ( 18,  19,  31)   # #12131f  (dark UI background)
CARD_DARK  = ( 28,  29,  46)   # #1c1d2e
BORDER_DARK= ( 42,  45,  74)   # #2a2d4a
TEXT_PRI   = (232, 234, 246)   # #e8eaf6
TEXT_SEC   = (159, 163, 199)   # #9fa3c7
TEXT_MUT   = (108, 111, 148)   # #6c6f94
SUCCESS    = ( 16, 185, 129)   # #10b981
DANGER     = (239,  68,  68)   # #ef4444
BG_LIGHT   = (247, 248, 252)   # #f7f8fc  (light UI background)
CARD_LIGHT = (255, 255, 255)
BORDER_LIGHT=(229, 231, 235)   # #e5e7eb

# ── Font paths ─────────────────────────────────────────────────────────────────
FONT_BOLD   = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR= "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


# ── Helpers ────────────────────────────────────────────────────────────────────

def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def gradient_rect(draw: ImageDraw.ImageDraw,
                  x0: int, y0: int, x1: int, y1: int,
                  c0: tuple, c1: tuple,
                  direction: str = "horizontal") -> None:
    """Fill a rectangle with a linear gradient from c0 to c1."""
    length = (x1 - x0) if direction == "horizontal" else (y1 - y0)
    if length <= 0:
        return
    for i in range(length):
        t = i / (length - 1) if length > 1 else 0
        r = int(c0[0] + (c1[0] - c0[0]) * t)
        g = int(c0[1] + (c1[1] - c0[1]) * t)
        b = int(c0[2] + (c1[2] - c0[2]) * t)
        if direction == "horizontal":
            draw.line([(x0 + i, y0), (x0 + i, y1)], fill=(r, g, b))
        else:
            draw.line([(x0, y0 + i), (x1, y0 + i)], fill=(r, g, b))


def diagonal_gradient(img: Image.Image,
                       c0: tuple, c1: tuple) -> None:
    """Paint a 135° diagonal gradient over the whole image."""
    w, h = img.size
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            r = int(c0[0] + (c1[0] - c0[0]) * t)
            g = int(c0[1] + (c1[1] - c0[1]) * t)
            b = int(c0[2] + (c1[2] - c0[2]) * t)
            px[x, y] = (r, g, b)


def rounded_rect(draw: ImageDraw.ImageDraw,
                 xy: tuple, radius: int, fill=None, outline=None,
                 outline_width: int = 1) -> None:
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius,
                            fill=fill, outline=outline, width=outline_width)


def draw_t_plus_logo(draw: ImageDraw.ImageDraw,
                     cx: int, cy: int, size: int,
                     bg: tuple = None) -> None:
    """Draw the T+ icon as a rounded-square badge."""
    half = size // 2
    r = size // 6
    if bg:
        rounded_rect(draw, (cx - half, cy - half, cx + half, cy + half),
                     radius=r, fill=bg)
    font_size = int(size * 0.42)
    fnt = load_font(FONT_BOLD, font_size)
    draw.text((cx, cy), "T+", font=fnt, fill=WHITE, anchor="mm")


def draw_wrapped_text(draw: ImageDraw.ImageDraw,
                      text: str, font: ImageFont.FreeTypeFont,
                      x: int, y: int, max_width: int,
                      fill: tuple, line_spacing: int = 6,
                      anchor: str = "la") -> int:
    """Draw word-wrapped text, return y position after last line."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    for line in lines:
        draw.text((x, y), line, font=font, fill=fill, anchor=anchor)
        bbox = draw.textbbox((0, 0), line, font=font)
        y += (bbox[3] - bbox[1]) + line_spacing
    return y


# ── Mock UI components ────────────────────────────────────────────────────────

def draw_browser_chrome(img: Image.Image, dark: bool = True) -> None:
    """Draw a simplified browser chrome (title bar + address bar)."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    bar_h = 52
    bg = (30, 30, 36) if dark else (240, 240, 245)
    tab_bg = (50, 50, 60) if dark else (255, 255, 255)
    text_col = (200, 200, 210) if dark else (60, 60, 80)
    addr_bg = (20, 20, 26) if dark else (220, 220, 228)

    # Title bar background
    draw.rectangle([0, 0, w, bar_h], fill=bg)

    # Three traffic-light dots
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        draw.ellipse([14 + i * 22, 18, 14 + i * 22 + 14, 18 + 14], fill=col)

    # Active tab pill
    tab_x, tab_w = 80, 200
    rounded_rect(draw, (tab_x, 8, tab_x + tab_w, bar_h + 4),
                 radius=8, fill=tab_bg)
    fnt_sm = load_font(FONT_REGULAR, 12)
    draw.text((tab_x + tab_w // 2, bar_h // 2 + 2),
              "GitHub – Dashboard", font=fnt_sm, fill=text_col, anchor="mm")

    # Address bar
    addr_x = tab_x + tab_w + 20
    addr_w = w - addr_x - 100
    rounded_rect(draw, (addr_x, 12, addr_x + addr_w, bar_h - 8),
                 radius=14, fill=addr_bg)
    draw.text((addr_x + addr_w // 2, bar_h // 2),
              "github.com/dashboard", font=fnt_sm, fill=text_col, anchor="mm")

    # Separator line
    draw.line([(0, bar_h), (w, bar_h)], fill=(60, 60, 70) if dark else (210, 210, 220))


def draw_webpage_content(draw: ImageDraw.ImageDraw,
                         x0: int, y0: int, x1: int, y1: int,
                         dark: bool = True) -> None:
    """Fill the main page area with a placeholder 'webpage'."""
    bg = BG_DARK if dark else BG_LIGHT
    draw.rectangle([x0, y0, x1, y1], fill=bg)

    fnt = load_font(FONT_BOLD, 18)
    fnt_sm = load_font(FONT_REGULAR, 12)
    text_col = TEXT_PRI if dark else (30, 30, 50)
    muted = TEXT_MUT if dark else (180, 180, 200)
    card = CARD_DARK if dark else CARD_LIGHT
    border = BORDER_DARK if dark else BORDER_LIGHT

    # Simulated page content blocks
    cx = (x0 + x1) // 2
    draw.text((cx, y0 + 40), "GitHub Dashboard", font=fnt,
              fill=text_col, anchor="mm")
    for i in range(5):
        ry = y0 + 70 + i * 50
        rounded_rect(draw, (x0 + 20, ry, x1 - 20, ry + 36),
                     radius=6, fill=card, outline=border)
        draw.text((x0 + 50, ry + 18), f"Repository update #{i + 1}",
                  font=fnt_sm, fill=text_col, anchor="lm")
        dot_col = SUCCESS if i % 3 == 0 else (PRIMARY if i % 3 == 1 else DANGER)
        draw.ellipse([x0 + 30, ry + 13, x0 + 42, ry + 25], fill=dot_col)


def draw_side_panel_header(draw: ImageDraw.ImageDraw,
                           px: int, py: int, pw: int,
                           active_tab: str = "tabs") -> int:
    """Draw the side panel header with logo and nav tabs. Returns y after header."""
    header_h = 48
    gradient_rect(draw, px, py, px + pw, py + header_h,
                  PRIMARY, ACCENT, direction="horizontal")

    # Logo
    fnt_logo = load_font(FONT_BOLD, 13)
    fnt_icon = load_font(FONT_BOLD, 10)
    draw.rounded_rectangle([px + 10, py + 11, px + 30, py + 37],
                            radius=4, fill=(255, 255, 255, 40))
    draw.text((px + 20, py + 24), "T+", font=fnt_icon, fill=WHITE, anchor="mm")
    draw.text((px + 38, py + 24), "TabPlusPlus", font=fnt_logo,
              fill=WHITE, anchor="lm")

    # Nav tabs
    tabs = [("Tabs", "tabs"), ("Bookmarks", "bk"), ("Sessions", "sess")]
    tab_w = pw // len(tabs)
    fnt_tab = load_font(FONT_REGULAR, 11)
    nav_y = py + header_h
    nav_h = 32
    draw.rectangle([px, nav_y, px + pw, nav_y + nav_h], fill=CARD_DARK)
    for i, (label, key) in enumerate(tabs):
        tx = px + i * tab_w + tab_w // 2
        is_active = (key == active_tab)
        col = WHITE if is_active else TEXT_SEC
        draw.text((tx, nav_y + nav_h // 2), label, font=fnt_tab,
                  fill=col, anchor="mm")
        if is_active:
            draw.line([(px + i * tab_w + 8, nav_y + nav_h - 2),
                       (px + (i + 1) * tab_w - 8, nav_y + nav_h - 2)],
                      fill=PRIMARY, width=2)
    draw.line([(px, nav_y + nav_h), (px + pw, nav_y + nav_h)],
              fill=BORDER_DARK, width=1)
    return nav_y + nav_h


def draw_search_bar(draw: ImageDraw.ImageDraw,
                    px: int, y: int, pw: int,
                    placeholder: str = "Search tabs…") -> int:
    """Draw a search input bar. Returns y below it."""
    fnt = load_font(FONT_REGULAR, 12)
    bar_h = 34
    rounded_rect(draw, (px + 10, y + 6, px + pw - 10, y + 6 + bar_h),
                 radius=8, fill=CARD_DARK, outline=BORDER_DARK)
    draw.text((px + 28, y + 6 + bar_h // 2), "🔍 " + placeholder,
              font=fnt, fill=TEXT_MUT, anchor="lm")
    return y + 6 + bar_h + 6


def draw_filter_pills(draw: ImageDraw.ImageDraw,
                      px: int, y: int, pw: int,
                      active: str = "All") -> int:
    """Draw filter pill buttons. Returns y below them."""
    filters = ["All", "Window", "Audible", "Pinned", "Dupes"]
    fnt = load_font(FONT_REGULAR, 10)
    pill_h = 22
    x = px + 10
    for label in filters:
        bbox = draw.textbbox((0, 0), label, font=fnt)
        tw = bbox[2] - bbox[0]
        pill_w = tw + 16
        is_active = (label == active)
        bg = PRIMARY if is_active else CARD_DARK
        outline = PRIMARY if is_active else BORDER_DARK
        text_c = WHITE if is_active else TEXT_SEC
        rounded_rect(draw, (x, y, x + pill_w, y + pill_h),
                     radius=pill_h // 2, fill=bg, outline=outline)
        draw.text((x + pill_w // 2, y + pill_h // 2), label,
                  font=fnt, fill=text_c, anchor="mm")
        x += pill_w + 6
        if x > px + pw - 10:
            break
    return y + pill_h + 6


def draw_tab_item(draw: ImageDraw.ImageDraw,
                  px: int, y: int, pw: int,
                  title: str, url: str,
                  active: bool = False,
                  checked: bool = False,
                  audible: bool = False,
                  favicon_col: tuple = None) -> int:
    """Draw a single tab list item. Returns y below it."""
    item_h = 44
    bg = (40, 42, 70) if active else CARD_DARK
    border = PRIMARY if active else BORDER_DARK
    rounded_rect(draw, (px + 8, y + 2, px + pw - 8, y + item_h),
                 radius=6, fill=bg, outline=border, outline_width=(2 if active else 1))

    fnt_t = load_font(FONT_BOLD, 11)
    fnt_u = load_font(FONT_REGULAR, 9)

    # Checkbox
    cbx = px + 18
    if checked:
        draw.rounded_rectangle([cbx, y + 14, cbx + 14, y + 28], radius=3,
                                fill=PRIMARY, outline=PRIMARY)
        draw.text((cbx + 7, y + 21), "✓", font=load_font(FONT_BOLD, 8),
                  fill=WHITE, anchor="mm")
    else:
        draw.rounded_rectangle([cbx, y + 14, cbx + 14, y + 28], radius=3,
                                fill=CARD_DARK, outline=BORDER_DARK)

    # Favicon circle
    fav_col = favicon_col or (100, 120, 200)
    fx = cbx + 22
    draw.ellipse([fx, y + 14, fx + 16, y + 30], fill=fav_col)

    # Title & URL
    tx = fx + 22
    max_w = pw - (tx - px) - 30
    draw.text((tx, y + 14), title[:35], font=fnt_t, fill=TEXT_PRI)
    url_short = url[:40] if len(url) > 40 else url
    draw.text((tx, y + 28), url_short, font=fnt_u, fill=TEXT_MUT)

    # Audible icon
    if audible:
        draw.text((px + pw - 24, y + item_h // 2 + 2), "♪",
                  font=load_font(FONT_REGULAR, 11), fill=SUCCESS, anchor="mm")

    return y + item_h + 2


def draw_tab_count_badge(draw: ImageDraw.ImageDraw,
                         px: int, y: int, pw: int, count: int) -> None:
    """Draw a small count badge row."""
    fnt = load_font(FONT_REGULAR, 10)
    text = f"{count} tabs"
    draw.text((px + pw // 2, y + 10), text, font=fnt, fill=TEXT_MUT, anchor="mm")


# ── Image generators ───────────────────────────────────────────────────────────

def make_marquee() -> Image.Image:
    """1400 × 560 Marquee / top promotional banner."""
    W, H = 1400, 560
    img = Image.new("RGB", (W, H))
    diagonal_gradient(img, PRIMARY, ACCENT)
    draw = ImageDraw.Draw(img)

    # Decorative circles (background)
    for cx, cy, r, alpha in [
        (900, -60, 320, 25), (1350, 400, 260, 18),
        (1100, 580, 200, 15), (50, 520, 280, 12)
    ]:
        overlay = Image.new("RGB", (W, H), WHITE)
        mask = Image.new("L", (W, H), 0)
        md = ImageDraw.Draw(mask)
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
        img.paste(overlay, mask=mask)

    # ── Left: text copy ────────────────────────────────────────────────────────
    fnt_h1 = load_font(FONT_BOLD, 64)
    fnt_h2 = load_font(FONT_BOLD, 26)
    fnt_sub = load_font(FONT_REGULAR, 20)
    fnt_feat = load_font(FONT_REGULAR, 17)

    # Headline (two lines)
    draw.text((80, 90), "All Your Tabs.", font=fnt_h1, fill=WHITE)
    draw.text((80, 168), "Under Control.", font=fnt_h1, fill=WHITE)

    # Sub-headline
    draw_wrapped_text(draw,
                      "Search, filter, save sessions, and clean duplicates",
                      fnt_sub, 82, 262, 560, WHITE, line_spacing=8)
    draw_wrapped_text(draw,
                      "— all in a persistent side panel.",
                      fnt_sub, 82, 298, 560, (220, 220, 255), line_spacing=8)

    # Feature list
    features = [
        "🗂  Tab Management & Smart Filters",
        "🔖  Bookmark Manager with Full-text Search",
        "💾  Session Save & Restore",
        "🧹  Duplicate Tab Cleaner",
        "⌨️   Keyboard Navigation",
    ]
    fy = 358
    for feat in features:
        draw.text((90, fy), feat, font=fnt_feat, fill=(200, 210, 255))
        fy += 32

    # Logo mark bottom-left
    draw.rounded_rectangle([80, 506, 130, 540], radius=8,
                            fill=(255, 255, 255, 40))
    draw.text((105, 523), "T+", font=load_font(FONT_BOLD, 16),
              fill=WHITE, anchor="mm")
    draw.text((142, 523), "TabPlusPlus", font=load_font(FONT_BOLD, 16),
              fill=WHITE, anchor="lm")

    # ── Right: mock browser screenshot ────────────────────────────────────────
    # Browser frame
    bx, by, bw, bh = 760, 40, 580, 490
    frame_r = 12
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=frame_r,
                            fill=BG_DARK, outline=(80, 80, 100), width=2)

    # Browser title bar
    tb_h = 36
    draw.rounded_rectangle([bx, by, bx + bw, by + tb_h], radius=frame_r,
                            fill=(28, 28, 40))
    draw.rectangle([bx, by + tb_h // 2, bx + bw, by + tb_h], fill=(28, 28, 40))
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        draw.ellipse([bx + 12 + i * 18, by + 11, bx + 12 + i * 18 + 14, by + 25],
                     fill=col)
    fnt_url = load_font(FONT_REGULAR, 10)
    draw.rounded_rectangle([bx + 80, by + 8, bx + bw - 20, by + 28],
                            radius=10, fill=(18, 18, 28))
    draw.text((bx + bw // 2, by + 18), "github.com/dashboard",
              font=fnt_url, fill=TEXT_MUT, anchor="mm")

    # Main content area
    content_x = bx + 4
    content_y = by + tb_h
    content_w = bw - 280  # leave room for side panel
    content_h = bh - tb_h
    draw.rectangle([content_x, content_y, content_x + content_w, content_y + content_h],
                   fill=BG_DARK)
    fnt_pg = load_font(FONT_BOLD, 13)
    fnt_sm = load_font(FONT_REGULAR, 10)
    draw.text((content_x + content_w // 2, content_y + 28),
              "GitHub Dashboard", font=fnt_pg, fill=TEXT_PRI, anchor="mm")
    for i in range(7):
        ry = content_y + 50 + i * 38
        if ry + 30 > content_y + content_h - 10:
            break
        rounded_rect(draw, (content_x + 10, ry,
                             content_x + content_w - 10, ry + 28),
                     radius=5, fill=CARD_DARK, outline=BORDER_DARK)
        col = [SUCCESS, PRIMARY, (150, 100, 200)][i % 3]
        draw.ellipse([content_x + 18, ry + 9, content_x + 28, ry + 19], fill=col)
        draw.text((content_x + 36, ry + 14),
                  ["octocat/Hello-World", "torvalds/linux", "microsoft/vscode",
                   "facebook/react", "tensorflow/tensorflow",
                   "vuejs/vue", "nodejs/node"][i % 7],
                  font=fnt_sm, fill=TEXT_PRI, anchor="lm")

    # Side panel
    sp_x = content_x + content_w
    sp_w = bw - content_w - 4
    draw.rectangle([sp_x, content_y, sp_x + sp_w, content_y + content_h],
                   fill=CARD_DARK)
    draw.line([(sp_x, content_y), (sp_x, content_y + content_h)],
              fill=BORDER_DARK, width=1)

    # Side panel header
    ph = 36
    gradient_rect(draw, sp_x, content_y, sp_x + sp_w, content_y + ph,
                  PRIMARY, ACCENT)
    draw.text((sp_x + sp_w // 2, content_y + ph // 2),
              "T+ TabPlusPlus", font=load_font(FONT_BOLD, 10),
              fill=WHITE, anchor="mm")

    # Nav tabs
    nav_y = content_y + ph
    nav_h = 22
    draw.rectangle([sp_x, nav_y, sp_x + sp_w, nav_y + nav_h], fill=CARD_DARK)
    tab_labels = ["Tabs", "Bkmks"]
    tw = sp_w // len(tab_labels)
    for i, lbl in enumerate(tab_labels):
        tx = sp_x + i * tw + tw // 2
        col = WHITE if i == 0 else TEXT_MUT
        draw.text((tx, nav_y + nav_h // 2), lbl,
                  font=load_font(FONT_REGULAR, 9), fill=col, anchor="mm")
    draw.line([(sp_x + 4, nav_y + nav_h - 1), (sp_x + tw - 4, nav_y + nav_h - 1)],
              fill=PRIMARY, width=2)

    # Search bar
    sb_y = nav_y + nav_h + 4
    rounded_rect(draw, (sp_x + 6, sb_y, sp_x + sp_w - 6, sb_y + 18),
                 radius=5, fill=BG_DARK, outline=BORDER_DARK)
    draw.text((sp_x + 14, sb_y + 9), "Search…",
              font=load_font(FONT_REGULAR, 8), fill=TEXT_MUT, anchor="lm")

    # Tab items in side panel
    tab_data = [
        ("GitHub", "github.com", True, (80, 90, 160)),
        ("Google Docs", "docs.google.com", False, (66, 133, 244)),
        ("Stack Overflow", "stackoverflow.com", False, (244, 128, 36)),
        ("YouTube", "youtube.com", False, (255, 0, 0)),
        ("VS Code Docs", "code.visualstudio.com", False, (0, 122, 204)),
        ("MDN Web Docs", "developer.mozilla.org", False, (0, 150, 200)),
    ]
    item_y = sb_y + 22
    for title, url, active, fav_col in tab_data:
        if item_y + 28 > content_y + content_h - 6:
            break
        bg = (40, 42, 70) if active else CARD_DARK
        border_c = PRIMARY if active else BORDER_DARK
        draw.rounded_rectangle([sp_x + 4, item_y, sp_x + sp_w - 4, item_y + 26],
                                radius=4, fill=bg, outline=border_c,
                                width=(2 if active else 1))
        draw.ellipse([sp_x + 10, item_y + 7, sp_x + 22, item_y + 19],
                     fill=fav_col)
        draw.text((sp_x + 26, item_y + 9), title[:18],
                  font=load_font(FONT_BOLD, 8), fill=TEXT_PRI)
        draw.text((sp_x + 26, item_y + 19), url[:20],
                  font=load_font(FONT_REGULAR, 7), fill=TEXT_MUT)
        item_y += 28

    return img


def make_small_tile() -> Image.Image:
    """440 × 280 Small promotional tile."""
    W, H = 440, 280
    img = Image.new("RGB", (W, H))
    diagonal_gradient(img, PRIMARY, ACCENT)
    draw = ImageDraw.Draw(img)

    # Background decorative circles
    for cx, cy, r, alpha in [(380, -40, 180, 22), (-20, 260, 150, 15)]:
        overlay = Image.new("RGB", (W, H), WHITE)
        mask = Image.new("L", (W, H), 0)
        md = ImageDraw.Draw(mask)
        md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
        img.paste(overlay, mask=mask)

    # Big T+ logo icon
    icon_size = 88
    ix, iy = W // 2, 90
    draw.rounded_rectangle(
        [ix - icon_size // 2, iy - icon_size // 2,
         ix + icon_size // 2, iy + icon_size // 2],
        radius=20,
        fill=(255, 255, 255, 40)
    )
    # Use a semi-transparent white box as the icon background
    draw.rounded_rectangle(
        [ix - icon_size // 2 + 4, iy - icon_size // 2 + 4,
         ix + icon_size // 2 - 4, iy + icon_size // 2 - 4],
        radius=16,
        fill=(255, 255, 255)
    )
    fnt_t = load_font(FONT_BOLD, 38)
    draw.text((ix, iy), "T+", font=fnt_t, fill=PRIMARY, anchor="mm")

    # Name
    fnt_name = load_font(FONT_BOLD, 28)
    draw.text((W // 2, 166), "TabPlusPlus", font=fnt_name,
              fill=WHITE, anchor="mm")

    # Tagline
    fnt_tag = load_font(FONT_REGULAR, 16)
    draw.text((W // 2, 200), "Your browser. Organized.", font=fnt_tag,
              fill=(210, 220, 255), anchor="mm")

    # Feature pills row
    features = ["Search", "Filter", "Sessions", "Bookmarks"]
    fnt_pill = load_font(FONT_REGULAR, 11)
    pill_y = 228
    total_w = 0
    pill_sizes = []
    for f in features:
        bbox = draw.textbbox((0, 0), f, font=fnt_pill)
        pw = bbox[2] - bbox[0] + 20
        pill_sizes.append(pw)
        total_w += pw
    total_w += (len(features) - 1) * 8
    sx = (W - total_w) // 2
    for f, pw in zip(features, pill_sizes):
        draw.rounded_rectangle([sx, pill_y, sx + pw, pill_y + 22],
                                radius=11,
                                fill=(255, 255, 255, 40))
        draw.rounded_rectangle([sx + 1, pill_y + 1, sx + pw - 1, pill_y + 21],
                                radius=10,
                                outline=(255, 255, 255, 80))
        draw.text((sx + pw // 2, pill_y + 11), f, font=fnt_pill,
                  fill=WHITE, anchor="mm")
        sx += pw + 8

    return img


# ── Screenshot helpers ─────────────────────────────────────────────────────────

def new_screenshot() -> tuple:
    """Return a blank 1280×800 screenshot canvas with browser chrome."""
    W, H = 1280, 800
    img = Image.new("RGB", (W, H), BG_DARK)
    draw_browser_chrome(img, dark=True)
    return img, ImageDraw.Draw(img), W, H


SP_X = 960   # Side panel starts at x=960
SP_W = 320   # Side panel width
BROWSER_BAR_H = 52


def draw_page_area(draw: ImageDraw.ImageDraw, W: int, H: int) -> None:
    draw_webpage_content(draw, 0, BROWSER_BAR_H, SP_X, H, dark=True)


def draw_panel_frame(img: Image.Image) -> ImageDraw.ImageDraw:
    draw = ImageDraw.Draw(img)
    draw.rectangle([SP_X, BROWSER_BAR_H, SP_X + SP_W, img.height],
                   fill=CARD_DARK)
    draw.line([(SP_X, BROWSER_BAR_H), (SP_X, img.height)],
              fill=BORDER_DARK, width=1)
    return draw


def make_screenshot_tabs() -> Image.Image:
    """Screenshot 1: Side Panel — Tabs View."""
    img, draw, W, H = new_screenshot()
    draw_page_area(draw, W, H)
    draw = draw_panel_frame(img)

    y = draw_side_panel_header(draw, SP_X, BROWSER_BAR_H, SP_W, "tabs")
    y = draw_search_bar(draw, SP_X, y, SP_W, "Search tabs…")
    y = draw_filter_pills(draw, SP_X, y, SP_W, "All")

    # Tab count
    draw_tab_count_badge(draw, SP_X, y, SP_W, 24)
    y += 22

    # Tab items
    tabs = [
        ("GitHub – Dashboard", "github.com/dashboard", True, False, (80, 90, 160)),
        ("Google Docs – Untitled", "docs.google.com/document/d/1...", False, False, (66, 133, 244)),
        ("Stack Overflow – Python", "stackoverflow.com/questions/…", False, False, (244, 128, 36)),
        ("YouTube – Coding Tutorial", "youtube.com/watch?v=…", False, True, (255, 0, 0)),
        ("VS Code Documentation", "code.visualstudio.com/docs", False, False, (0, 122, 204)),
        ("MDN – CSS Reference", "developer.mozilla.org/en-US/…", False, False, (0, 150, 200)),
        ("Hacker News", "news.ycombinator.com", False, False, (255, 102, 0)),
        ("Wikipedia – Python", "en.wikipedia.org/wiki/Python", False, False, (150, 150, 150)),
    ]
    for title, url, active, audible, fav_col in tabs:
        if y + 46 > H - 10:
            break
        y = draw_tab_item(draw, SP_X, y, SP_W, title, url,
                          active=active, audible=audible, favicon_col=fav_col)

    return img


def make_screenshot_filters() -> Image.Image:
    """Screenshot 2: Tab Filters & Sorting."""
    img, draw, W, H = new_screenshot()
    draw_page_area(draw, W, H)
    draw = draw_panel_frame(img)

    y = draw_side_panel_header(draw, SP_X, BROWSER_BAR_H, SP_W, "tabs")
    y = draw_search_bar(draw, SP_X, y, SP_W, "youtube")
    y = draw_filter_pills(draw, SP_X, y, SP_W, "Audible")

    # Sort dropdown (shown open)
    fnt_sm = load_font(FONT_REGULAR, 10)
    fnt_b = load_font(FONT_BOLD, 10)
    sort_y = y + 2
    rounded_rect(draw, (SP_X + 10, sort_y, SP_X + SP_W - 10, sort_y + 24),
                 radius=5, fill=CARD_DARK, outline=BORDER_DARK)
    draw.text((SP_X + 18, sort_y + 12), "Sort: Recent  ▾",
              font=fnt_sm, fill=TEXT_SEC, anchor="lm")

    # Dropdown open
    dd_y = sort_y + 24
    rounded_rect(draw, (SP_X + 10, dd_y, SP_X + SP_W - 10, dd_y + 66),
                 radius=5, fill=(35, 36, 60), outline=BORDER_DARK)
    for i, opt in enumerate(["Recent", "Title", "Domain"]):
        oy = dd_y + 4 + i * 20
        if i == 0:
            draw.rectangle([SP_X + 11, oy - 1, SP_X + SP_W - 11, oy + 17],
                           fill=(50, 52, 90))
        draw.text((SP_X + 20, oy + 8), opt, font=fnt_sm,
                  fill=(WHITE if i == 0 else TEXT_SEC), anchor="lm")

    y = dd_y + 70

    # Grouped view label
    draw.text((SP_X + 14, y + 4), "▸ youtube.com  (2)",
              font=fnt_b, fill=PRIMARY)
    y += 22

    tabs = [
        ("YouTube – Coding Tutorial", "youtube.com/watch?v=abc", False, True, (255, 0, 0)),
        ("YouTube – Music Mix", "youtube.com/watch?v=xyz", False, True, (255, 0, 0)),
    ]
    for title, url, active, audible, fav_col in tabs:
        if y + 46 > H - 10:
            break
        y = draw_tab_item(draw, SP_X, y, SP_W, title, url,
                          active=active, audible=audible, favicon_col=fav_col)

    return img


def make_screenshot_bulk() -> Image.Image:
    """Screenshot 3: Bulk Actions."""
    img, draw, W, H = new_screenshot()
    draw_page_area(draw, W, H)
    draw = draw_panel_frame(img)

    y = draw_side_panel_header(draw, SP_X, BROWSER_BAR_H, SP_W, "tabs")
    y = draw_search_bar(draw, SP_X, y, SP_W)
    y = draw_filter_pills(draw, SP_X, y, SP_W, "All")

    fnt_sm = load_font(FONT_REGULAR, 10)
    draw.text((SP_X + 14, y + 6), "3 selected",
              font=fnt_sm, fill=PRIMARY)
    y += 22

    tabs = [
        ("GitHub – Dashboard", "github.com", True, False, False, (80, 90, 160)),
        ("Stack Overflow – Q&A", "stackoverflow.com", False, True, False, (244, 128, 36)),
        ("Hacker News", "news.ycombinator.com", False, True, False, (255, 102, 0)),
        ("VS Code Documentation", "code.visualstudio.com", False, False, False, (0, 122, 204)),
        ("MDN – CSS Reference", "developer.mozilla.org", False, True, False, (0, 150, 200)),
        ("Wikipedia – Python", "en.wikipedia.org", False, False, False, (150, 150, 150)),
    ]
    for title, url, active, checked, audible, fav_col in tabs:
        if y + 46 > H - 60:
            break
        y = draw_tab_item(draw, SP_X, y, SP_W, title, url,
                          active=active, checked=checked, favicon_col=fav_col)

    # Bulk action toolbar at bottom
    bar_h = 48
    bar_y = H - bar_h
    draw.rectangle([SP_X, bar_y, SP_X + SP_W, H], fill=(28, 30, 52))
    draw.line([(SP_X, bar_y), (SP_X + SP_W, bar_y)], fill=PRIMARY, width=1)
    fnt_btn = load_font(FONT_BOLD, 11)
    # Close button
    btn_w = (SP_W - 30) // 2
    rounded_rect(draw, (SP_X + 8, bar_y + 8, SP_X + 8 + btn_w, bar_y + 40),
                 radius=6, fill=DANGER)
    draw.text((SP_X + 8 + btn_w // 2, bar_y + 24), "Close (3)",
              font=fnt_btn, fill=WHITE, anchor="mm")
    # Group button
    gx = SP_X + 16 + btn_w
    rounded_rect(draw, (gx, bar_y + 8, gx + btn_w, bar_y + 40),
                 radius=6, fill=PRIMARY)
    draw.text((gx + btn_w // 2, bar_y + 24), "Group (3)",
              font=fnt_btn, fill=WHITE, anchor="mm")

    return img


def make_screenshot_bookmarks() -> Image.Image:
    """Screenshot 4: Bookmark Manager."""
    img, draw, W, H = new_screenshot()
    draw_page_area(draw, W, H)
    draw = draw_panel_frame(img)

    y = draw_side_panel_header(draw, SP_X, BROWSER_BAR_H, SP_W, "bk")
    y = draw_search_bar(draw, SP_X, y, SP_W, "Search bookmarks…")

    # Breadcrumb
    fnt_bc = load_font(FONT_REGULAR, 10)
    draw.text((SP_X + 14, y + 6), "📁 Bookmarks Bar  ›  Dev Resources",
              font=fnt_bc, fill=TEXT_MUT)
    y += 22

    # Section header
    fnt_sec = load_font(FONT_BOLD, 10)
    draw.text((SP_X + 14, y + 4), "RECENT", font=fnt_sec, fill=TEXT_MUT)
    y += 20

    bookmarks_recent = [
        ("GitHub", "github.com", (80, 90, 160)),
        ("Stack Overflow", "stackoverflow.com", (244, 128, 36)),
    ]
    fnt_bm = load_font(FONT_REGULAR, 11)
    fnt_url = load_font(FONT_REGULAR, 9)
    for title, url, col in bookmarks_recent:
        rounded_rect(draw, (SP_X + 8, y, SP_X + SP_W - 8, y + 34),
                     radius=5, fill=CARD_DARK, outline=BORDER_DARK)
        draw.ellipse([SP_X + 16, y + 9, SP_X + 28, y + 23], fill=col)
        draw.text((SP_X + 36, y + 10), title, font=fnt_bm, fill=TEXT_PRI)
        draw.text((SP_X + 36, y + 22), url, font=fnt_url, fill=TEXT_MUT)
        y += 38

    # Folder tree
    y += 4
    draw.text((SP_X + 14, y + 4), "FOLDERS", font=fnt_sec, fill=TEXT_MUT)
    y += 20

    folders = [
        ("Dev Resources", 4, True),
        ("  MDN Web Docs", 0, False),
        ("  Can I Use", 0, False),
        ("  CSS Tricks", 0, False),
        ("Reading List", 0, False),
        ("Tools", 0, False),
    ]
    for name, indent, expanded in folders:
        icon = "📂" if expanded else ("📁" if "  " not in name else "🔖")
        rounded_rect(draw, (SP_X + 8 + indent * 6, y,
                             SP_X + SP_W - 8, y + 28),
                     radius=4, fill=(35, 36, 60) if expanded else CARD_DARK,
                     outline=(PRIMARY if expanded else BORDER_DARK))
        draw.text((SP_X + 18 + indent * 6, y + 14),
                  icon + " " + name.strip(),
                  font=fnt_bm, fill=(WHITE if expanded else TEXT_PRI), anchor="lm")
        y += 32

    # Add bookmark button
    add_y = H - 50
    rounded_rect(draw, (SP_X + 8, add_y, SP_X + SP_W - 8, add_y + 36),
                 radius=6, fill=PRIMARY)
    draw.text((SP_X + SP_W // 2, add_y + 18), "+ Add Bookmark",
              font=load_font(FONT_BOLD, 11), fill=WHITE, anchor="mm")

    return img


def make_screenshot_sessions() -> Image.Image:
    """Screenshot 5: Session Save & Restore (popup view)."""
    W, H = 1280, 800
    img = Image.new("RGB", (W, H), BG_DARK)
    draw_browser_chrome(img, dark=True)
    draw = ImageDraw.Draw(img)
    draw_webpage_content(draw, 0, BROWSER_BAR_H, W, H, dark=True)

    # Popup modal overlay
    pop_w, pop_h = 320, 440
    pop_x = (W - pop_w) // 2
    pop_y = BROWSER_BAR_H + 20

    # Shadow
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle([pop_x - 8, pop_y - 8, pop_x + pop_w + 8, pop_y + pop_h + 8],
                             radius=16, fill=(0, 0, 0, 80))
    img.paste(Image.new("RGB", (W, H), (0, 0, 0)),
              mask=shadow.split()[3])

    draw = ImageDraw.Draw(img)
    rounded_rect(draw, (pop_x, pop_y, pop_x + pop_w, pop_y + pop_h),
                 radius=14, fill=CARD_DARK, outline=BORDER_DARK)

    # Popup header
    gradient_rect(draw, pop_x, pop_y, pop_x + pop_w, pop_y + 52,
                  PRIMARY, ACCENT)
    draw.rounded_rectangle([pop_x, pop_y, pop_x + pop_w, pop_y + 52],
                            radius=14, fill=None, outline=None)
    draw.rectangle([pop_x, pop_y + 28, pop_x + pop_w, pop_y + 52],
                   fill=None)
    # re-draw header properly
    gradient_rect(draw, pop_x + 1, pop_y + 1, pop_x + pop_w - 1, pop_y + 52,
                  PRIMARY, ACCENT)
    draw.text((pop_x + pop_w // 2, pop_y + 26),
              "T+ TabPlusPlus", font=load_font(FONT_BOLD, 15),
              fill=WHITE, anchor="mm")

    # Stats row
    stats_y = pop_y + 58
    for i, (val, lbl) in enumerate([(24, "Tabs"), (3, "Windows"), (847, "Bookmarks")]):
        sx = pop_x + 10 + i * (pop_w - 20) // 3
        sw = (pop_w - 20) // 3 - 4
        rounded_rect(draw, (sx, stats_y, sx + sw, stats_y + 46),
                     radius=8, fill=CARD_DARK, outline=BORDER_DARK)
        draw.text((sx + sw // 2, stats_y + 16), str(val),
                  font=load_font(FONT_BOLD, 18), fill=PRIMARY, anchor="mm")
        draw.text((sx + sw // 2, stats_y + 34), lbl,
                  font=load_font(FONT_REGULAR, 10), fill=TEXT_MUT, anchor="mm")

    # Save Session button (highlighted)
    btn_y = stats_y + 58
    rounded_rect(draw, (pop_x + 10, btn_y, pop_x + pop_w - 10, btn_y + 38),
                 radius=8, fill=ACCENT)
    draw.text((pop_x + pop_w // 2, btn_y + 19), "💾  Save Session",
              font=load_font(FONT_BOLD, 13), fill=WHITE, anchor="mm")

    # Sessions list
    sec_y = btn_y + 50
    draw.text((pop_x + 14, sec_y), "Recent Sessions",
              font=load_font(FONT_BOLD, 11), fill=TEXT_PRI)
    sec_y += 24

    sessions = [
        ("Work – Morning", "24 tabs", "2 min ago"),
        ("Research – AI", "18 tabs", "Yesterday"),
        ("Side Project", "12 tabs", "3 days ago"),
    ]
    for name, tabs_s, time_s in sessions:
        rounded_rect(draw, (pop_x + 10, sec_y, pop_x + pop_w - 10, sec_y + 44),
                     radius=6, fill=CARD_DARK, outline=BORDER_DARK)
        draw.text((pop_x + 20, sec_y + 12), name,
                  font=load_font(FONT_BOLD, 11), fill=TEXT_PRI)
        draw.text((pop_x + 20, sec_y + 28), tabs_s + "  ·  " + time_s,
                  font=load_font(FONT_REGULAR, 9), fill=TEXT_MUT)
        # Restore button
        rb_w = 62
        rounded_rect(draw, (pop_x + pop_w - 14 - rb_w, sec_y + 10,
                             pop_x + pop_w - 14, sec_y + 32),
                     radius=5, fill=PRIMARY)
        draw.text((pop_x + pop_w - 14 - rb_w + rb_w // 2, sec_y + 21),
                  "Restore", font=load_font(FONT_REGULAR, 9),
                  fill=WHITE, anchor="mm")
        sec_y += 50

    return img


def make_screenshot_settings() -> Image.Image:
    """Screenshot 6: Settings Page."""
    W, H = 1280, 800
    img = Image.new("RGB", (W, H), BG_DARK)
    draw = ImageDraw.Draw(img)

    # Settings page full-screen
    gradient_rect(draw, 0, 0, W, 60, PRIMARY, ACCENT)
    draw.text((W // 2, 30), "TabPlusPlus — Settings",
              font=load_font(FONT_BOLD, 22), fill=WHITE, anchor="mm")
    draw.text((W // 2, 52), "Customize your experience",
              font=load_font(FONT_REGULAR, 12), fill=(200, 210, 255), anchor="mm")

    # Settings grid: two columns
    COL_W = 560
    col1_x = (W // 2) - COL_W - 20
    col2_x = (W // 2) + 20
    settings_y = 80

    sections = [
        ("General", [
            ("Remember last active view", True),
            ("Persist filter and sort preferences", True),
            ("Show tab count badge on icon", True),
        ]),
        ("Bookmarks", [
            ("Default view mode: Folder", True),
            ("Show breadcrumb navigation", True),
            ("Number of recent bookmarks", "5"),
        ]),
        ("Keyboard Navigation", [
            ("Enable keyboard tab navigation", False),
            ("Navigate-next shortcut", "Alt+]"),
            ("Navigate-prev shortcut", "Alt+["),
        ]),
        ("Sessions", [
            ("Max saved sessions", "10"),
            ("Confirm before restoring", True),
            ("Auto-name sessions by date", False),
        ]),
    ]

    for col_idx, (col_x, (title, items)) in enumerate(
        zip([col1_x, col2_x, col1_x, col2_x],
            sections)):
        if col_idx >= 2:
            sy = settings_y + 220
        else:
            sy = settings_y

        # Section card
        card_h = 180
        rounded_rect(draw, (col_x, sy, col_x + COL_W, sy + card_h),
                     radius=10, fill=CARD_DARK, outline=BORDER_DARK)

        # Section title
        draw.text((col_x + 20, sy + 16), title,
                  font=load_font(FONT_BOLD, 14), fill=TEXT_PRI)
        draw.line([(col_x + 16, sy + 36), (col_x + COL_W - 16, sy + 36)],
                  fill=BORDER_DARK, width=1)

        item_y = sy + 46
        for label, val in items:
            draw.text((col_x + 20, item_y + 10), label,
                      font=load_font(FONT_REGULAR, 12), fill=TEXT_PRI)
            if isinstance(val, bool):
                # Toggle switch
                tx = col_x + COL_W - 58
                toggle_bg = SUCCESS if val else BORDER_DARK
                draw.rounded_rectangle([tx, item_y + 4, tx + 40, item_y + 22],
                                       radius=9, fill=toggle_bg)
                knob_x = tx + 22 if val else tx + 2
                draw.ellipse([knob_x, item_y + 6, knob_x + 16, item_y + 20],
                             fill=WHITE)
            else:
                # Value chip
                tx = col_x + COL_W - 48
                rounded_rect(draw, (tx, item_y + 4, tx + 38, item_y + 22),
                             radius=5, fill=BG_DARK, outline=BORDER_DARK)
                draw.text((tx + 19, item_y + 13), str(val),
                          font=load_font(FONT_REGULAR, 10), fill=TEXT_SEC, anchor="mm")
            item_y += 38

    # Bottom bar
    bar_y = H - 60
    draw.rectangle([0, bar_y, W, H], fill=CARD_DARK)
    draw.line([(0, bar_y), (W, bar_y)], fill=BORDER_DARK, width=1)
    draw.text((W // 2, bar_y + 20), "TabPlusPlus v1.2.0  ·  MIT License  ·  github.com/ZepengW/TabPlusPlus",
              font=load_font(FONT_REGULAR, 11), fill=TEXT_MUT, anchor="mm")
    rounded_rect(draw, (W // 2 - 80, bar_y + 32, W // 2 + 80, bar_y + 52),
                 radius=6, fill=PRIMARY)
    draw.text((W // 2, bar_y + 42), "Save Changes",
              font=load_font(FONT_BOLD, 11), fill=WHITE, anchor="mm")

    return img


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    tasks = [
        ("marquee_1400x560.png",       make_marquee),
        ("small_tile_440x280.png",     make_small_tile),
        ("screenshot_1_tabs.png",      make_screenshot_tabs),
        ("screenshot_2_filters.png",   make_screenshot_filters),
        ("screenshot_3_bulk.png",      make_screenshot_bulk),
        ("screenshot_4_bookmarks.png", make_screenshot_bookmarks),
        ("screenshot_5_sessions.png",  make_screenshot_sessions),
        ("screenshot_6_settings.png",  make_screenshot_settings),
    ]
    for filename, fn in tasks:
        out_path = os.path.join(OUTPUT_DIR, filename)
        print(f"  Generating {filename}…", end=" ", flush=True)
        image = fn()
        image.save(out_path, "PNG", optimize=True)
        print(f"saved  ({image.width}×{image.height})")
    print("Done. All assets written to:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
