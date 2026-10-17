import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { join } from "node:path";
import type { WorkerLike } from "@/lib/engine/engine";

/** The same Stockfish.js lite build the browser uses, run as a Node CLI. */
export const ENGINE_PATH = join(process.cwd(), "public", "engine", "stockfish-19-lite-single.js");

/**
 * Runs the real engine in a child process and exposes it through the
 * WorkerLike interface, so the production UCI client can drive it in Node.
 */
export class ProcessWorker implements WorkerLike {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  private proc: ChildProcessWithoutNullStreams;
  private buffer = "";

  constructor() {
    this.proc = spawn(process.execPath, [ENGINE_PATH]);
    this.proc.stdout.on("data", (d: Buffer) => {
      this.buffer += d.toString();
      let idx: number;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (line) this.onmessage?.({ data: line } as MessageEvent);
      }
    });
    this.proc.on("error", (e) => this.onerror?.({ message: e.message, preventDefault() {} } as ErrorEvent));
  }

  postMessage(cmd: string) {
    if (!this.proc.killed) this.proc.stdin.write(`${cmd}\n`);
  }

  terminate() {
    this.proc.kill();
  }
}
