// @vitest-environment node
import { describe, expect, it } from "vitest";
import { START_FEN } from "@/lib/chess/types";
import { applyRemoteMove, parseMessage, serialize } from "@/lib/online/protocol";
import { decodeSignal, encodeSignal, extractCode, trimSdp } from "@/lib/online/signal";

const SDP = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=extmap-allow-mixed",
  "a=msid-semantic: WMS",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=ice-ufrag:abcd",
  "a=ice-pwd:0123456789abcdef012345",
  "a=fingerprint:sha-256 AA:BB:CC:DD",
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "",
].join("\r\n");

describe("signal codes", () => {
  it("round-trips an offer and an answer", async () => {
    const offer = await encodeSignal({ type: "offer", sdp: SDP });
    expect(offer).toMatch(/^[dr]\.[\w-]+$/);
    const back = await decodeSignal(offer);
    expect(back).toEqual({ type: "offer", sdp: trimSdp(SDP) });
    const answer = await decodeSignal(await encodeSignal({ type: "answer", sdp: SDP }));
    expect(answer?.type).toBe("answer");
  });
  it("tolerates whitespace and wrapped pasted codes", async () => {
    const code = await encodeSignal({ type: "offer", sdp: SDP });
    const wrapped = `  ${code.slice(0, 20)}\n${code.slice(20)}  `;
    expect((await decodeSignal(wrapped))?.type).toBe("offer");
  });
  it("rejects garbage and tampered codes", async () => {
    expect(await decodeSignal("")).toBeNull();
    expect(await decodeSignal("hello world")).toBeNull();
    expect(await decodeSignal("d.AAAA")).toBeNull();
    expect(await decodeSignal("r.eyJ0IjoieCIsInMiOiJ2PTAifQ")).toBeNull(); // wrong type
  });
  it("extracts the code from a pasted link", async () => {
    const code = await encodeSignal({ type: "offer", sdp: SDP });
    expect(extractCode(`https://tempochess.vercel.app/play#o=${code}`)).toBe(code);
    expect(extractCode(code)).toBe(code);
  });
});

describe("protocol", () => {
  it("accepts well-formed messages and rejects the rest", () => {
    expect(parseMessage(serialize({ t: "move", uci: "e2e4", ply: 1 }))).toEqual({ t: "move", uci: "e2e4", ply: 1 });
    expect(parseMessage('{"t":"move","uci":"e2e9","ply":1}')).toBeNull();
    expect(parseMessage('{"t":"start","guestColor":"x","game":1}')).toBeNull();
    expect(parseMessage(serialize({ t: "ping", n: 7 }))).toEqual({ t: "ping", n: 7 });
    expect(parseMessage('{"t":"pong","n":-1}')).toBeNull();
    expect(parseMessage("not json")).toBeNull();
    expect(parseMessage({ t: "resign" })).toBeNull(); // must be a string
    expect(parseMessage(`{"t":"resign","pad":"${"x".repeat(600)}"}`)).toBeNull();
  });
  it("applies only legal, in-turn, in-sync moves", () => {
    const ok = applyRemoteMove(START_FEN, "w", 0, { uci: "e2e4", ply: 1 });
    expect(ok.ok && ok.san).toBe("e4");
    expect(applyRemoteMove(START_FEN, "b", 0, { uci: "e7e5", ply: 1 }).ok).toBe(false); // not black's turn
    expect(applyRemoteMove(START_FEN, "w", 0, { uci: "e2e5", ply: 1 }).ok).toBe(false); // illegal
    expect(applyRemoteMove(START_FEN, "w", 0, { uci: "e2e4", ply: 5 }).ok).toBe(false); // out of sync
  });
});
