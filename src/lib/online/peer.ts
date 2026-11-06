import { type Message, serialize } from "./protocol";
import { decodeSignal, encodeSignal } from "./signal";

/**
 * Thin wrapper over RTCPeerConnection + one data channel. The only third-party
 * contact is an optional public STUN lookup so two browsers on different
 * networks can find each other; moves travel directly between the players.
 */
export type IceMode = "internet" | "lan";

const STUN: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];

export interface PeerHandlers {
  onOpen: () => void;
  onMessage: (raw: unknown) => void;
  onClose: (reason: string) => void;
}

/**
 * Wait for ICE candidates, but not for the full gathering run: as soon as a
 * public (server-reflexive) address is known we only wait a moment longer for
 * stragglers, and on a LAN-only setup we stop after a short fixed time. This
 * keeps the invite fast without waiting for slow STUN lookups to time out.
 */
function waitForIce(pc: RTCPeerConnection, maxMs = 3500, graceAfterPublicMs = 500): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let grace: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onState);
      pc.removeEventListener("icecandidate", onCandidate);
      clearTimeout(timer);
      clearTimeout(grace);
      resolve();
    };
    const onState = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const onCandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate?.type === "srflx" && !grace) grace = setTimeout(done, graceAfterPublicMs);
    };
    const timer = setTimeout(done, maxMs); // use what we have gathered so far
    pc.addEventListener("icegatheringstatechange", onState);
    pc.addEventListener("icecandidate", onCandidate);
  });
}

export class Peer {
  private channel: RTCDataChannel | null = null;
  private closed = false;

  private constructor(
    private readonly pc: RTCPeerConnection,
    private readonly handlers: PeerHandlers,
  ) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") this.finish("The connection failed. Check both players are online and try again.");
      else if (pc.connectionState === "disconnected" || pc.connectionState === "closed") this.finish("Your opponent disconnected.");
    };
  }

  private attach(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => this.handlers.onOpen();
    channel.onmessage = (e) => this.handlers.onMessage(e.data);
    channel.onclose = () => this.finish("Your opponent disconnected.");
  }

  private finish(reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.handlers.onClose(reason);
  }

  static supported(): boolean {
    return typeof RTCPeerConnection !== "undefined";
  }

  /** Host: create the invite code that is shared as a link. */
  static async host(handlers: PeerHandlers, mode: IceMode): Promise<{ peer: Peer; code: string }> {
    const pc = new RTCPeerConnection({ iceServers: mode === "internet" ? STUN : [] });
    const peer = new Peer(pc, handlers);
    peer.attach(pc.createDataChannel("tempo", { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIce(pc);
    const desc = pc.localDescription;
    if (!desc) throw new Error("Could not create the invite.");
    return { peer, code: await encodeSignal({ type: "offer", sdp: desc.sdp }) };
  }

  /** Host: finish the handshake with the guest's reply code. */
  async acceptAnswer(code: string): Promise<boolean> {
    const signal = await decodeSignal(code);
    if (!signal || signal.type !== "answer") return false;
    try {
      await this.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
      return true;
    } catch {
      return false;
    }
  }

  /** Guest: answer an invite; returns the reply code to send back to the host. */
  static async join(offerCode: string, handlers: PeerHandlers, mode: IceMode): Promise<{ peer: Peer; code: string } | null> {
    const signal = await decodeSignal(offerCode);
    if (!signal || signal.type !== "offer") return null;
    const pc = new RTCPeerConnection({ iceServers: mode === "internet" ? STUN : [] });
    const peer = new Peer(pc, handlers);
    pc.ondatachannel = (e) => peer.attach(e.channel);
    try {
      await pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitForIce(pc);
    } catch {
      pc.close();
      return null;
    }
    const desc = pc.localDescription;
    if (!desc) return null;
    return { peer, code: await encodeSignal({ type: "answer", sdp: desc.sdp }) };
  }

  send(msg: Message): boolean {
    if (!this.channel || this.channel.readyState !== "open") return false;
    this.channel.send(serialize(msg));
    return true;
  }

  close() {
    this.closed = true;
    try {
      this.channel?.close();
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}
