"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Particle engine 
interface Vector2D {
  x: number;
  y: number;
}

class Particle {
  pos: Vector2D = { x: 0, y: 0 };
  vel: Vector2D = { x: 0, y: 0 };
  acc: Vector2D = { x: 0, y: 0 };
  target: Vector2D = { x: 0, y: 0 };

  maxSpeed = 2;
  maxForce = 0.08;
  isKilled = false;

  sr = 0; sg = 0; sb = 0;
  tr = 255; tg = 255; tb = 255;
  colorWeight = 0;
  colorBlendRate = Math.random() * 0.01 + 0.001;

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
    if (this.colorWeight < 1) this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1);
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
      this.tr = 0; this.tg = 0; this.tb = 0;
      this.colorWeight = 0;
      this.isKilled = true;
    }
  }
}

// Helpers 

function spawnWord(
  word: string,
  canvas: HTMLCanvasElement,
  particles: Particle[]
) {
  const off = document.createElement("canvas");
  off.width = canvas.width;
  off.height = canvas.height;
  const octx = off.getContext("2d")!;
  const fs = Math.min(canvas.width / 4, 110);
  octx.fillStyle = "white";
  octx.font = `bold ${fs}px Arial`;
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  octx.fillText(word, off.width / 2, off.height / 2);

  const { data: px } = octx.getImageData(0, 0, off.width, off.height);
  const col = {
    r: Math.random() * 200 + 55,
    g: Math.random() * 200 + 55,
    b: Math.random() * 200 + 55,
  };

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

// Component

const WORDS = ["ALL CLEAR", "SECURE", "ENSURED"];

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const wordIdxRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, down: false, right: false });

  const [showForm, setShowForm] = useState(false);
  const [formMounted, setFormMounted] = useState(false);

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // open: mount first, then animate in
  function openForm() {
    setFormMounted(true);
    setTimeout(() => setShowForm(true), 10);
  }

  // close: animate out, then unmount
  function closeForm() {
    setShowForm(false);
    setTimeout(() => setFormMounted(false), 350);
  }

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

    spawnWord(WORDS[0], canvas, particlesRef.current);

    const ctx = canvas.getContext("2d")!;

    const tick = () => {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
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
        spawnWord(WORDS[wordIdxRef.current], canvas, particlesRef.current);
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
    <main className="relative min-h-screen w-full bg-black overflow-hidden flex items-end justify-center pb-14 px-6">
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.65 }}
      />

      {/* "All Clear" wordmark — top left */}
      <div className="absolute top-8 left-8 z-10 select-none">
        <span className="text-[11px] tracking-[0.25em] text-white/30 uppercase font-light">
          All Clear
        </span>
      </div>

      {/* Sign in pill button */}
      <button
        onClick={openForm}
        className={cn(
          "relative z-10 px-7 py-2.5 rounded-full text-sm font-medium tracking-wide",
          "bg-white/8 border border-white/20 text-white/80 backdrop-blur-md",
          "hover:bg-white/14 transition-all duration-300",
          showForm || formMounted
            ? "opacity-0 pointer-events-none translate-y-1"
            : "opacity-100 translate-y-0"
        )}
      >
        Sign in
      </button>

      {/* Login card */}
      {formMounted && (
        <div
          className={cn(
            "absolute z-10 bottom-14 w-72 rounded-2xl",
            "border border-white/10 bg-black/75 backdrop-blur-md",
            "px-6 py-5",
            "transition-all duration-350 ease-out",
            showForm
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3 pointer-events-none"
          )}
        >
          {/* Header */}
          <div className="mb-5">
            <p className="text-[9px] tracking-[0.22em] text-white/30 uppercase mb-1">
              All Clear
            </p>
            <h1 className="text-[17px] font-semibold text-white leading-snug">
              Operations console
            </h1>
            <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed">
              We'll send a one-time magic link — no password needed.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="block text-[9px] tracking-[0.1em] uppercase text-white/35 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "sending" || status === "sent"}
                placeholder="you@company.com"
                className={cn(
                  "w-full bg-white/6 border border-white/12 rounded-lg px-3 py-2",
                  "text-[12px] text-white placeholder:text-white/20",
                  "focus:outline-none focus:border-white/30",
                  "disabled:opacity-50 transition-colors"
                )}
              />
            </div>

            <button
              type="submit"
              disabled={status === "sending" || status === "sent"}
              className={cn(
                "w-full rounded-lg py-2.5 text-[12px] font-medium",
                "bg-white text-black",
                "hover:opacity-88 transition-opacity",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {status === "sending"
                ? "Sending…"
                : status === "sent"
                  ? "Check your inbox"
                  : "Send magic link"}
            </button>

            {status === "sent" && (
              <p className="text-[11px] text-emerald-400 pt-0.5">
                Link sent to {email}. Open it on this device.
              </p>
            )}
            {status === "error" && error && (
              <p className="text-[11px] text-red-400 pt-0.5">{error}</p>
            )}
          </form>

          {/* Back */}
          <button
            onClick={closeForm}
            className="mt-3 text-[11px] text-white/20 hover:text-white/45 transition-colors w-full text-center"
          >
            ← back
          </button>
        </div>
      )}
    </main>
  );
}
