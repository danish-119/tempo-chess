import { describe, expect, it } from "vitest";
import { buildPalette, encodeGif, lzwEncode } from "@/lib/gif";

/** Reference GIF LZW decoder used only to prove the encoder round-trips. */
function lzwDecode(data: Uint8Array, minCodeSize: number, expected: number): number[] {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  const resetDict = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    dict[clear] = [];
    dict[eoi] = [];
    codeSize = minCodeSize + 1;
  };
  resetDict();
  const out: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  let pos = 0;
  let prev: number[] | null = null;
  while (out.length < expected) {
    while (bitCount < codeSize && pos < data.length) {
      bitBuffer |= data[pos++] << bitCount;
      bitCount += 8;
    }
    if (bitCount < codeSize) break;
    const code = bitBuffer & ((1 << codeSize) - 1);
    bitBuffer >>>= codeSize;
    bitCount -= codeSize;
    if (code === clear) {
      resetDict();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code];
    else if (prev) entry = [...prev, prev[0]];
    else throw new Error("bad code");
    out.push(...entry);
    if (prev && dict.length < 4096) {
      dict.push([...prev, entry[0]]);
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  return out;
}

function pseudoRandom(n: number, seed = 1): Uint8Array {
  const out = new Uint8Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (s >>> 24) % 17; // low-ish entropy so the dictionary grows and resets
  }
  return out;
}

describe("lzwEncode", () => {
  it.each([10, 300, 5000, 60000])("round-trips %i pixels (including dictionary growth and reset)", (n) => {
    const input = pseudoRandom(n, n);
    const decoded = lzwDecode(lzwEncode(input, 8), 8, n);
    expect(decoded).toEqual([...input]);
  });
  it("round-trips a flat image", () => {
    const input = new Uint8Array(20000).fill(3);
    expect(lzwDecode(lzwEncode(input, 8), 8, input.length)).toEqual([...input]);
  });
});

describe("buildPalette", () => {
  it("keeps few colours exact and caps at 256", () => {
    const small = buildPalette(Uint32Array.from([0xff0000, 0x00ff00, 0x0000ff]));
    expect(small).toHaveLength(3);
    const many = buildPalette(Uint32Array.from({ length: 5000 }, (_, i) => (i * 2654435761) & 0xffffff));
    expect(many.length).toBeLessThanOrEqual(256);
  });
});

describe("encodeGif", () => {
  it("writes a valid animated GIF structure", () => {
    const w = 8;
    const h = 6;
    const frame = (r: number, g: number, b: number) => {
      const d = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) d.set([r, g, b, 255], i * 4);
      return { data: d, delayMs: 500 };
    };
    const gif = encodeGif([frame(255, 0, 0), frame(0, 0, 255)], w, h);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe("GIF89a");
    expect(gif[6] | (gif[7] << 8)).toBe(w);
    expect(gif[8] | (gif[9] << 8)).toBe(h);
    expect(gif[gif.length - 1]).toBe(0x3b);
    const text = String.fromCharCode(...gif);
    expect(text).toContain("NETSCAPE2.0");
    expect(text.split("\x21\xf9").length - 1).toBe(2); // one graphic-control block per frame
  });
  it("rejects empty input", () => {
    expect(() => encodeGif([], 4, 4)).toThrow();
  });
});
