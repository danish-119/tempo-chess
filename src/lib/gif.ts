/**
 * Minimal GIF89a encoder (no dependencies). Frames are RGBA canvas pixel
 * arrays; a single global 256-colour palette is built by median cut over a
 * sample of all frames, which suits flat-colour chess graphics well.
 */
export interface GifFrame {
  /** RGBA pixels, width * height * 4 bytes (e.g. from ImageData.data). */
  data: Uint8ClampedArray | Uint8Array;
  /** Display time in milliseconds. */
  delayMs: number;
}

type Rgb = [number, number, number];

/** Median-cut palette of at most `size` colours from packed 0xRRGGBB samples. */
export function buildPalette(samples: Uint32Array, size = 256): Rgb[] {
  if (samples.length === 0) return [[0, 0, 0]];
  type Box = { colors: number[] };
  const unique = [...new Set(samples)];
  const boxes: Box[] = [{ colors: unique }];
  const channel = (c: number, ch: 0 | 1 | 2) => (c >> (16 - ch * 8)) & 255;

  while (boxes.length < size) {
    // Split the box with the widest colour range.
    let target = -1;
    let bestRange = 0;
    let bestChannel: 0 | 1 | 2 = 0;
    boxes.forEach((box, i) => {
      if (box.colors.length < 2) return;
      for (const ch of [0, 1, 2] as const) {
        let lo = 255;
        let hi = 0;
        for (const c of box.colors) {
          const v = channel(c, ch);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        if (hi - lo > bestRange) {
          bestRange = hi - lo;
          target = i;
          bestChannel = ch;
        }
      }
    });
    if (target === -1) break;
    const box = boxes[target];
    box.colors.sort((a, b) => channel(a, bestChannel) - channel(b, bestChannel));
    const mid = box.colors.length >> 1;
    boxes.splice(target, 1, { colors: box.colors.slice(0, mid) }, { colors: box.colors.slice(mid) });
  }

  return boxes.map(({ colors }) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const c of colors) {
      r += channel(c, 0);
      g += channel(c, 1);
      b += channel(c, 2);
    }
    const n = colors.length || 1;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)] as Rgb;
  });
}

function nearest(palette: Rgb[], r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
      if (d === 0) break;
    }
  }
  return best;
}

/** Map RGBA pixels onto palette indices (transparent pixels are flattened onto white). */
export function quantize(data: ArrayLike<number>, palette: Rgb[], cache: Map<number, number>): Uint8Array {
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const a = data[i + 3] / 255;
    const r = Math.round(data[i] * a + 255 * (1 - a));
    const g = Math.round(data[i + 1] * a + 255 * (1 - a));
    const b = Math.round(data[i + 2] * a + 255 * (1 - a));
    const key = (r << 16) | (g << 8) | b;
    let idx = cache.get(key);
    if (idx === undefined) {
      idx = nearest(palette, r, g, b);
      cache.set(key, idx);
    }
    out[j] = idx;
  }
  return out;
}

class ByteWriter {
  private chunks: number[] = [];
  byte(b: number) {
    this.chunks.push(b & 255);
  }
  word(w: number) {
    this.byte(w);
    this.byte(w >> 8);
  }
  str(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  bytes(arr: ArrayLike<number>) {
    for (let i = 0; i < arr.length; i++) this.chunks.push(arr[i] & 255);
  }
  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

/** GIF-flavoured LZW over palette indices. Returns the code stream packed LSB-first. */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const out: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let codeSize = minCodeSize + 1;

  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuffer & 255);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };

  let dict = new Map<number, number>();
  let next = eoi + 1;
  const reset = () => {
    dict = new Map();
    next = eoi + 1;
    codeSize = minCodeSize + 1;
  };

  emit(clear);
  reset();
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next - 1 === 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      reset();
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bitCount > 0) out.push(bitBuffer & 255);
  return Uint8Array.from(out);
}

function writeSubBlocks(w: ByteWriter, data: Uint8Array) {
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.subarray(i, Math.min(i + 255, data.length));
    w.byte(chunk.length);
    w.bytes(chunk);
  }
  w.byte(0);
}

/** Encode frames into an animated GIF (loops forever; the last frame can hold longer via its delay). */
export function encodeGif(frames: GifFrame[], width: number, height: number): Uint8Array {
  if (frames.length === 0) throw new Error("No frames to encode.");
  if (width <= 0 || height <= 0 || width > 65535 || height > 65535) throw new Error("Invalid GIF size.");

  // Sample pixels across all frames for the palette.
  const samples: number[] = [];
  const step = Math.max(1, Math.floor((width * height) / 4000));
  for (const f of frames) {
    for (let p = 0; p < width * height; p += step) {
      const i = p * 4;
      const a = f.data[i + 3] / 255;
      const r = Math.round(f.data[i] * a + 255 * (1 - a));
      const g = Math.round(f.data[i + 1] * a + 255 * (1 - a));
      const b = Math.round(f.data[i + 2] * a + 255 * (1 - a));
      samples.push((r << 16) | (g << 8) | b);
    }
  }
  const palette = buildPalette(Uint32Array.from(samples), 256);
  while (palette.length < 256) palette.push([0, 0, 0]);

  const w = new ByteWriter();
  w.str("GIF89a");
  w.word(width);
  w.word(height);
  w.byte(0b11110111); // global colour table, 8 bits per colour, 256 entries
  w.byte(0); // background colour index
  w.byte(0); // pixel aspect ratio
  for (const [r, g, b] of palette) {
    w.byte(r);
    w.byte(g);
    w.byte(b);
  }
  // Netscape loop extension: loop forever.
  w.byte(0x21);
  w.byte(0xff);
  w.byte(11);
  w.str("NETSCAPE2.0");
  w.byte(3);
  w.byte(1);
  w.word(0);
  w.byte(0);

  const cache = new Map<number, number>();
  for (const f of frames) {
    // Graphic control extension: delay in 1/100 s.
    w.byte(0x21);
    w.byte(0xf9);
    w.byte(4);
    w.byte(0);
    w.word(Math.max(2, Math.round(f.delayMs / 10)));
    w.byte(0);
    w.byte(0);
    // Image descriptor.
    w.byte(0x2c);
    w.word(0);
    w.word(0);
    w.word(width);
    w.word(height);
    w.byte(0);
    w.byte(8); // LZW minimum code size
    writeSubBlocks(w, lzwEncode(quantize(f.data, palette, cache), 8));
  }
  w.byte(0x3b);
  return w.toUint8Array();
}
