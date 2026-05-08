"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/* ================================================================
   Particle Engine — renders text as flowing particle formations
   ================================================================ */

interface Vector2D { x: number; y: number }

class Particle {
  pos: Vector2D = { x: 0, y: 0 };
  vel: Vector2D = { x: 0, y: 0 };
  acc: Vector2D = { x: 0, y: 0 };
  target: Vector2D = { x: 0, y: 0 };

  maxSpeed = 2;
  maxForce = 0.08;
  isKilled = false;

  // Color channels — start/target for smooth blend
  sr = 0; sg = 0; sb = 0;
  tr = 0; tg = 217; tb = 163; // --status-safe teal
  colorWeight = 0;
  colorBlendRate = Math.random() * 0.01 + 0.002;

  move() {
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const prox = dist < 80 ? dist / 80 : 1;
    const mag = this.maxSpeed * prox;
    const stx = (dx / dist) * mag - this.vel.x;
    const sty = (dy / dist) * mag - this.vel.y;
    const sm = Math.sqrt(stx * stx + sty * sty) || 1;
    this.acc.x += (stx / sm) * this.maxForce;
    this.acc.y += (sty / sm) * this.maxForce;
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.acc.x = 0;
    this.acc.y = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.colorWeight < 1)
      this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1);
    const r = Math.round(this.sr + (this.tr - this.sr) * this.colorWeight);
    const g = Math.round(this.sg + (this.tg - this.sg) * this.colorWeight);
    const b = Math.round(this.sb + (this.tb - this.sb) * this.colorWeight);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(this.pos.x, this.pos.y, 1.5, 1.5);
  }

  kill(w: number, h: number) {
    if (!this.isKilled) {
      const ang = Math.random() * Math.PI * 2;
      const d = w + h;
      this.target.x = w / 2 + Math.cos(ang) * d;
      this.target.y = h / 2 + Math.sin(ang) * d;
      this.sr = this.sr + (this.tr - this.sr) * this.colorWeight;
      this.sg = this.sg + (this.tg - this.sg) * this.colorWeight;
      this.sb = this.sb + (this.tb - this.sb) * this.colorWeight;
      this.tr = 10; this.tg = 11; this.tb = 15; // fade to surface-base
      this.colorWeight = 0;
      this.isKilled = true;
    }
  }
}

/* ── Brand-aligned color palette for particle text ── */
const PALETTE = [
  { r: 0, g: 217, b: 163 },   // --status-safe  (teal)
  { r: 74, g: 163, b: 255 },   // --status-info  (blue)
  { r: 0, g: 180, b: 140 },    // teal variant
];

function spawnWord(
  word: string,
  canvas: HTMLCanvasElement,
  particles: Particle[],
  colorIdx: number,
) {
  const off = document.createElement("canvas");
  off.width = canvas.width;
  off.height = canvas.height;
  const octx = off.getContext("2d")!;
  const fs = Math.min(canvas.width / 5, 90);
  octx.fillStyle = "white";
  octx.font = `600 ${fs}px "Geist", system-ui, sans-serif`;
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  // Position text in upper 40% of canvas so it doesn't overlap the login form
  octx.fillText(word, off.width / 2, off.height * 0.35);

  const { data: px } = octx.getImageData(0, 0, off.width, off.height);
  const col = PALETTE[colorIdx % PALETTE.length];

  const coords: number[] = [];
  const step = 5;
  for (let i = 0; i < px.length; i += step * 4) if (px[i + 3] > 0) coords.push(i);
  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [coords[i], coords[j]] = [coords[j], coords[i]];
  }

  let pi = 0;
  for (const ci of coords) {
    const x = (ci / 4) % off.width;
    const y = Math.floor(ci / 4 / off.width);
    let p: Particle;
    if (pi < particles.length) {
      p = particles[pi]; p.isKilled = false; pi++;
    } else {
      p = new Particle();
      p.pos.x = Math.random() * canvas.width;
      p.pos.y = Math.random() * canvas.height;
      p.maxSpeed = Math.random() * 2 + 1.5;
      p.maxForce = p.maxSpeed * 0.04;
      particles.push(p);
    }
    p.sr = p.sr + (p.tr - p.sr) * p.colorWeight;
    p.sg = p.sg + (p.tg - p.sg) * p.colorWeight;
    p.sb = p.sb + (p.tb - p.sb) * p.colorWeight;
    p.tr = col.r; p.tg = col.g; p.tb = col.b;
    p.colorWeight = 0;
    p.target.x = x; p.target.y = y;
  }
  for (let i = pi; i < particles.length; i++) particles[i].kill(canvas.width, canvas.height);
}

/* ================================================================
   Login Page Component
   ================================================================ */

const WORDS = ["ALL CLEAR", "PROTECTED", "SECURED"];

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const wordIdxRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, down: false, right: false });

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) { setStatus("error"); setError(err.message); return; }
    setStatus("sent");
  }

  /* ── Canvas lifecycle ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    spawnWord(WORDS[0], canvas, particlesRef.current, 0);

    const ctx = canvas.getContext("2d")!;

    const tick = () => {
      // Transparent black fill for trail effect — matches surface-base
      ctx.fillStyle = "rgba(10, 11, 15, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.move(); p.draw(ctx);
        if (p.isKilled && (p.pos.x < -50 || p.pos.x > canvas.width + 50 || p.pos.y < -50 || p.pos.y > canvas.height + 50))
          particles.splice(i, 1);
      }

      const m = mouseRef.current;
      if (m.down && m.right)
        for (const p of particles) {
          const dx = p.pos.x - m.x, dy = p.pos.y - m.y;
          if (dx * dx + dy * dy < 2500) p.kill(canvas.width, canvas.height);
        }

      frameRef.current++;
      if (frameRef.current % 400 === 0) {
        wordIdxRef.current = (wordIdxRef.current + 1) % WORDS.length;
        spawnWord(WORDS[wordIdxRef.current], canvas, particlesRef.current, wordIdxRef.current);
      }

      animRef.current = requestAnimationFrame(tick);
    };
    tick();

    const onDown = (e: MouseEvent) => {
      mouseRef.current.down = true;
      mouseRef.current.right = e.button === 2;
    };
    const onUp = () => { mouseRef.current.down = false; };
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouseRef.current.y = (e.clientY - r.top) * (canvas.height / r.height);
    };
    const onCtx = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("contextmenu", onCtx);

    return () => {
      cancelAnimationFrame(animRef.current!);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("contextmenu", onCtx);
    };
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "var(--surface-base)" }}
    >
      {/* Particle canvas — full background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.5 }}
      />

      {/* Subtle radial glow behind form */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,217,163,0.06) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* ── Back button — top left ── */}
      <Link
        href="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 text-[11px] tracking-[0.08em] text-text-tertiary hover:text-text-secondary transition-colors duration-200"
      >
        <span className="text-[14px]">&#8592;</span>
        Home
      </Link>

      {/* ── Login Card — always visible, centered ── */}
      <div className="relative z-10 w-full max-w-[380px] mx-4">
        {/* Logo — big and prominent */}
        <div className="text-center mb-10">
          <h1 className="font-mono text-[28px] sm:text-[36px] tracking-[0.18em] text-text-primary font-bold">
            ALL CLEAR
          </h1>
          <div className="mt-3 w-10 h-[2px] bg-status-safe/50 mx-auto" />
          <p className="mt-3 text-[11px] tracking-[0.14em] uppercase text-text-tertiary">
            Operations Console
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl px-8 py-8 ring-1 ring-inset ring-white/[0.06]"
          style={{
            background: "rgba(19, 21, 27, 0.85)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(0,217,163,0.04)",
          }}
        >
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-[18px] font-semibold text-text-primary tracking-[-0.01em]">
              Sign in
            </h2>
            <p className="text-[12px] text-text-secondary mt-1.5 leading-relaxed">
              Enter your email to receive a one-time sign-in link.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-[10px] tracking-[0.12em] uppercase text-text-tertiary mb-2"
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "sending" || status === "sent"}
                placeholder="you@company.com"
                className={cn(
                  "w-full rounded-lg px-4 py-3",
                  "text-[13px] text-text-primary placeholder:text-text-tertiary",
                  "bg-surface-inset ring-1 ring-inset ring-white/[0.06]",
                  "focus:outline-none focus:ring-status-safe/40",
                  "disabled:opacity-50 transition-all duration-200"
                )}
              />
            </div>

            <button
              type="submit"
              disabled={status === "sending" || status === "sent"}
              className={cn(
                "w-full rounded-lg py-3 text-[12px] tracking-[0.06em] font-semibold",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                status === "sent"
                  ? "bg-status-safe/20 text-status-safe ring-1 ring-inset ring-status-safe/20"
                  : "bg-status-safe text-text-on-status hover:brightness-110 shadow-glow-safe"
              )}
            >
              {status === "sending"
                ? "Sending..."
                : status === "sent"
                  ? "Check your inbox"
                  : "Send magic link"}
            </button>

            {/* Status messages */}
            {status === "sent" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-status-safe/[0.08] ring-1 ring-inset ring-status-safe/10">
                <span className="text-status-safe text-[14px] mt-[1px]">✓</span>
                <p className="text-[11px] text-status-safe/80 leading-relaxed">
                  Link sent to <span className="text-status-safe font-medium">{email}</span>.
                  Open it on this device.
                </p>
              </div>
            )}
            {status === "error" && error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-status-critical/[0.08] ring-1 ring-inset ring-status-critical/10">
                <span className="text-status-critical text-[14px] mt-[1px]">!</span>
                <p className="text-[11px] text-status-critical/80 leading-relaxed">{error}</p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-text-tertiary mt-6 tracking-wide">
          AI-powered construction safety monitoring
        </p>
      </div>
    </main>
  );
}
