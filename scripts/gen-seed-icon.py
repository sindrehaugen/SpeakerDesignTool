"""Generate a 1024x1024 placeholder icon PNG for Tauri bundling.

Writes src-tauri/app-icon.png. After running, invoke
`npx tauri icon src-tauri/app-icon.png` to produce the full icon set.
"""
import zlib, struct, os

def png(w: int, h: int, fill=(14, 27, 48), accent=(245, 196, 94)) -> bytes:
    def chunk(t: bytes, d: bytes) -> bytes:
        return (
            struct.pack('>I', len(d))
            + t
            + d
            + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
        )

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))  # 8-bit RGB

    # Simple circular "S" silhouette: navy background, golden ring.
    cx, cy = w / 2.0, h / 2.0
    r_out = min(w, h) * 0.42
    r_in = r_out * 0.70
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter: none
        for x in range(w):
            dx, dy = x - cx, y - cy
            d = (dx * dx + dy * dy) ** 0.5
            r, g, b = (accent if r_in <= d <= r_out else fill)
            raw += bytes((r, g, b))
    idat = chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'src-tauri', 'app-icon.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'wb') as f:
        f.write(png(1024, 1024))
    print(f'wrote {out}  ({os.path.getsize(out)} bytes)')


if __name__ == '__main__':
    main()
