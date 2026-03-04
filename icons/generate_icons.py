"""
generate_icons.py – Generate PNG icons for TabPlusPlus using only Python stdlib.
Produces icon16.png, icon48.png, icon128.png in the same directory as this script.
"""

import os
import struct
import zlib

# Primary brand colour (#667eea)
FILL_R, FILL_G, FILL_B = 0x66, 0x7E, 0xEA
# Accent colour (#764ba2)
ACC_R, ACC_G, ACC_B = 0x76, 0x4B, 0xA2


def _make_png(width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> bytes:
    """Encode a list of RGBA tuples into a minimal PNG byte string."""

    def pack_chunk(chunk_type: bytes, data: bytes) -> bytes:
        length = struct.pack('>I', len(data))
        crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return length + chunk_type + data + crc

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    # Width, Height, bit-depth=8, colour-type=2 (RGB), compression=0, filter=0, interlace=0
    # We'll use RGB (no alpha) to keep it simple

    # Build raw scanlines (filter byte 0 = None, then RGB bytes)
    raw_rows = []
    for y in range(height):
        row = bytearray([0])  # filter type
        for x in range(width):
            r, g, b, _a = pixels[y * width + x]
            row += bytes([r, g, b])
        raw_rows.append(bytes(row))

    idat_data = zlib.compress(b''.join(raw_rows), 9)

    png = (
        b'\x89PNG\r\n\x1a\n'
        + pack_chunk(b'IHDR', ihdr_data)
        + pack_chunk(b'IDAT', idat_data)
        + pack_chunk(b'IEND', b'')
    )
    return png


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def render_icon(size: int) -> list[tuple[int, int, int, int]]:
    """Render a single icon of `size`×`size` pixels."""
    pixels = []
    cx, cy = size / 2.0, size / 2.0
    radius = size / 2.0 - 0.5          # circle fits inside the canvas
    inner_r = radius * 0.85            # inner cutout radius for ring feel

    for y in range(size):
        for x in range(size):
            # Distance from centre (anti-aliased)
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            dist = (dx * dx + dy * dy) ** 0.5

            # Gradient position (diagonal, top-left → bottom-right)
            t = ((x + y) / (2.0 * size))
            gr = int(_lerp(FILL_R, ACC_R, t))
            gg = int(_lerp(FILL_G, ACC_G, t))
            gb = int(_lerp(FILL_B, ACC_B, t))

            # Inside circle?
            aa_edge = 1.2
            inside = max(0.0, min(1.0, (radius - dist) / aa_edge + 0.5))

            if inside < 0.01:
                pixels.append((255, 255, 255, 0))
                continue

            # Draw "T+" text as simple pixel art scaled to icon size
            # We'll draw the symbol using normalised coords [-1, 1]
            nx = (dx / radius)
            ny = (dy / radius)

            on_symbol = False
            stroke = 0.18        # normalised stroke width
            half_s = stroke / 2

            # "T" glyph: horizontal bar and vertical stem
            # Horizontal bar: ny in [-0.62, -0.62+stroke], nx in [-0.55, 0.55]
            t_bar_top    = -0.62
            t_bar_bottom = t_bar_top + stroke
            t_stem_left  = -half_s
            t_stem_right =  half_s
            t_stem_bottom = 0.55

            if (t_bar_top <= ny <= t_bar_bottom and -0.55 <= nx <= 0.55):
                on_symbol = True
            elif (t_stem_left <= nx <= t_stem_right and t_bar_top <= ny <= t_stem_bottom):
                on_symbol = True

            # "+" glyph (right side, offset)
            offset = 0.30
            plus_h_left  = 0.12
            plus_h_right = 0.72
            plus_h_top   = -half_s * 0.9
            plus_h_bot   = half_s * 0.9
            plus_v_top   = -0.35
            plus_v_bot   =  0.35
            plus_v_left  = offset - half_s * 0.9
            plus_v_right = offset + half_s * 0.9

            if (plus_h_left <= nx <= plus_h_right and plus_h_top <= ny <= plus_h_bot):
                on_symbol = True
            elif (plus_v_left <= nx <= plus_v_right and plus_v_top <= ny <= plus_v_bot):
                on_symbol = True

            if on_symbol:
                # White symbol
                alpha = int(inside * 255)
                pixels.append((255, 255, 255, alpha))
            else:
                alpha = int(inside * 255)
                pixels.append((gr, gg, gb, alpha))

    return pixels


def save_icon(size: int, output_path: str) -> None:
    pixels = render_icon(size)

    # For PNG RGB we blend alpha onto white background
    blended = []
    for r, g, b, a in pixels:
        aa = a / 255.0
        br = int(r * aa + 255 * (1 - aa))
        bg = int(g * aa + 255 * (1 - aa))
        bb = int(b * aa + 255 * (1 - aa))
        blended.append((br, bg, bb, 255))

    data = _make_png(size, size, blended)
    with open(output_path, 'wb') as f:
        f.write(data)
    print(f"  Created {output_path}  ({size}×{size}, {len(data)} bytes)")


if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    for sz in (16, 48, 128):
        out = os.path.join(script_dir, f'icon{sz}.png')
        save_icon(sz, out)
    print("Done.")
