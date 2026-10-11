import { useEffect, useRef, type ReactNode } from 'react';
import { celestialPosition, rgb, skyAt } from '../lib/scene/sky';

interface GrassSceneProps {
  /** Livelier wind and more fireflies, e.g. while the model is thinking. */
  active?: boolean;
  className?: string;
  children?: ReactNode;
}

interface Blade {
  x: number;
  height: number;
  width: number;
  layer: number;
  phase: number;
  hue: number;
  light: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
}

const LAYERS = 3;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeBlades(w: number, h: number): Blade[] {
  // Fewer blades on small screens keeps phones smooth.
  const perPx = w < 640 ? 0.55 : 0.8;
  const count = Math.min(900, Math.round(w * perPx));
  const blades: Blade[] = [];
  for (let i = 0; i < count; i++) {
    const layer = i % LAYERS;
    const depth = (layer + 1) / LAYERS; // back = small, front = big
    blades.push({
      x: rand(-10, w + 10),
      height: h * rand(0.16, 0.34) * (0.55 + depth * 0.6),
      width: rand(2, 4.5) * (0.6 + depth * 0.6),
      layer,
      phase: rand(0, Math.PI * 2),
      hue: rand(88, 128),
      light: rand(26, 42) + layer * 5,
    });
  }
  return blades.sort((a, b) => a.layer - b.layer);
}

function makeMotes(w: number, h: number, n: number): Mote[] {
  return Array.from({ length: n }, () => ({
    x: rand(0, w),
    y: rand(h * 0.35, h * 0.95),
    vx: rand(-0.15, 0.15),
    vy: rand(-0.12, 0.06),
    phase: rand(0, Math.PI * 2),
    size: rand(1.2, 2.6),
  }));
}

function makeStars(w: number, h: number): Star[] {
  const n = Math.round((w * h) / 4500);
  return Array.from({ length: n }, () => ({
    x: rand(0, w),
    y: rand(0, h * 0.6),
    size: rand(0.4, 1.4),
    phase: rand(0, Math.PI * 2),
  }));
}

/**
 * Animated sky-and-grass banner. The sky follows the local time of day, the grass sways in a
 * gusty wind and parts around the pointer. Purely decorative: hidden from screen readers,
 * paused when off-screen or in a background tab, and frozen for prefers-reduced-motion.
 */
export function GrassScene({ active = false, className = '', children }: GrassSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let blades: Blade[] = [];
    let motes: Mote[] = [];
    let stars: Star[] = [];
    let raf = 0;
    let visible = true;
    const pointer = { x: -9999, y: -9999, strength: 0 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blades = makeBlades(w, h);
      motes = makeMotes(w, h, w < 640 ? 18 : 32);
      stars = makeStars(w, h);
      if (reduceMotion) draw(performance.now());
    };

    const hills = (baseY: number, amp: number, freq: number, offset: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) {
        ctx.lineTo(x, baseY - Math.sin(x * freq + offset) * amp - Math.sin(x * freq * 2.3 + offset * 1.7) * amp * 0.35);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    const draw = (now: number) => {
      const t = now / 1000;
      const date = new Date();
      const hour = date.getHours() + date.getMinutes() / 60;
      const sky = skyAt(hour);
      const night = sky.night;
      const energy = activeRef.current ? 1.8 : 1;

      // Sky
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, rgb(sky.top));
      grad.addColorStop(1, rgb(sky.bottom));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      if (night > 0.3) {
        for (const s of stars) {
          const tw = 0.5 + 0.5 * Math.sin(t * 1.6 + s.phase);
          ctx.globalAlpha = (night - 0.3) * (0.4 + tw * 0.6);
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Sun or moon
      const pos = celestialPosition(hour);
      const cx = pos.x * w;
      const cy = h * 0.62 - pos.y * h * 0.48;
      const isSun = sky.sunUp > 0;
      const radius = Math.max(14, Math.min(w, h) * 0.07);
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 4);
      glow.addColorStop(0, isSun ? 'rgba(255, 240, 200, 0.55)' : 'rgba(220, 230, 255, 0.28)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - radius * 4, cy - radius * 4, radius * 8, radius * 8);
      ctx.fillStyle = isSun ? '#fff4d6' : '#e8ecf8';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      if (!isSun) {
        ctx.fillStyle = rgb(sky.top, 0.9);
        ctx.beginPath();
        ctx.arc(cx + radius * 0.45, cy - radius * 0.2, radius * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Distant hills
      const dark = 1 - night * 0.7;
      hills(h * 0.68, h * 0.05, 0.004, 1.3, `hsl(120, 22%, ${32 * dark}%)`);
      hills(h * 0.76, h * 0.04, 0.007, 4.1, `hsl(110, 28%, ${26 * dark}%)`);

      // Grass
      const gust = Math.sin(t * 0.35) * 0.5 + Math.sin(t * 0.9 + 1.3) * 0.25;
      pointer.strength *= 0.94;
      for (const b of blades) {
        const depth = (b.layer + 1) / LAYERS;
        const sway =
          (Math.sin(t * 1.4 * energy + b.x * 0.012 + b.phase) * 0.12 + gust * 0.22) * energy * (0.6 + depth * 0.4);
        let bend = sway * b.height;

        const tipY = h - b.height;
        const dx = b.x - pointer.x;
        const dy = tipY - pointer.y;
        const dist = Math.hypot(dx, dy);
        const reach = 90 + depth * 40;
        if (dist < reach && pointer.strength > 0.01) {
          bend += (dx >= 0 ? 1 : -1) * (1 - dist / reach) * b.height * 0.55 * pointer.strength;
        }

        const light = b.light * dark;
        ctx.fillStyle = `hsl(${b.hue}, ${48 + depth * 12}%, ${light}%)`;
        ctx.beginPath();
        ctx.moveTo(b.x - b.width, h + 2);
        ctx.quadraticCurveTo(b.x - b.width * 0.4 + bend * 0.35, h - b.height * 0.55, b.x + bend, tipY);
        ctx.quadraticCurveTo(b.x + b.width * 0.4 + bend * 0.35, h - b.height * 0.55, b.x + b.width, h + 2);
        ctx.closePath();
        ctx.fill();
      }

      // Fireflies by night, pollen sparkles by day
      const moteCount = Math.round(motes.length * (activeRef.current ? 1 : 0.6));
      for (let i = 0; i < moteCount; i++) {
        const m = motes[i]!;
        if (!reduceMotion) {
          m.x += m.vx * energy + Math.sin(t + m.phase) * 0.2;
          m.y += m.vy + Math.cos(t * 0.8 + m.phase) * 0.15;
          if (m.x < -10) m.x = w + 10;
          if (m.x > w + 10) m.x = -10;
          if (m.y < h * 0.3 || m.y > h) {
            m.y = rand(h * 0.55, h * 0.95);
            m.x = rand(0, w);
          }
        }
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + m.phase * 3);
        const r = m.size * (night > 0.4 ? 2.4 : 1.4);
        const halo = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 4);
        const color = night > 0.4 ? '255, 236, 140' : '255, 255, 235';
        halo.addColorStop(0, `rgba(${color}, ${0.85 * pulse})`);
        halo.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(m.x - r * 4, m.y - r * 4, r * 8, r * 8);
      }

      // Soft fade into the page below
      const fade = ctx.createLinearGradient(0, h * 0.82, 0, h);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
    };

    const loop = (now: number) => {
      draw(now);
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      if (!reduceMotion && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.strength = 1;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      start();
    });
    io.observe(canvas);
    const onVisibility = () => start();
    document.addEventListener('visibilitychange', onVisibility);
    const host = canvas.parentElement ?? canvas;
    host.addEventListener('pointermove', onPointer);
    host.addEventListener('pointerdown', onPointer);

    resize();
    if (reduceMotion) draw(performance.now());
    else start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      host.removeEventListener('pointermove', onPointer);
      host.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-pan-y" aria-hidden="true" />
      {children && <div className="relative z-10 h-full">{children}</div>}
    </div>
  );
}
