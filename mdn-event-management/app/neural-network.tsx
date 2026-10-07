"use client";

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number };
type Edge = { a: number; b: number; born: number };
type Traversal = {
  visited: Map<number, number>;
  edges: Edge[];
  frontier: number[];
  dfs: boolean;
  nextStep: number;
  finishedAt: number | null;
};

const LINK_DISTANCE = 140;
const STEP_MS = 110;
const EDGE_MS = 280;
const HOLD_MS = 1400;
const FADE_MS = 1200;

/** Decorative canvas: a faint graph that is repeatedly explored by an
 *  animated BFS / DFS. Edges light up as they are traversed, nodes brighten
 *  when visited, then the whole traversal fades and restarts elsewhere.
 *  Draws in the inherited text colour. */
export function NeuralNetwork({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let trav: Traversal | null = null;
    let useDfs = false;
    let raf = 0;

    function neighbours(i: number): number[] {
      const out: number[] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (
          j !== i &&
          Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < LINK_DISTANCE
        ) {
          out.push(j);
        }
      }
      return out;
    }

    function startTraversal(now: number) {
      const start = Math.floor(Math.random() * nodes.length);
      useDfs = !useDfs;
      trav = {
        visited: new Map([[start, now]]),
        edges: [],
        frontier: [start],
        dfs: useDfs,
        nextStep: now,
        finishedAt: null,
      };
    }

    function step(now: number) {
      if (!trav || trav.finishedAt !== null) return;
      const current = trav.dfs ? trav.frontier.pop() : trav.frontier.shift();
      if (current === undefined) {
        trav.finishedAt = now;
        return;
      }
      for (const nb of neighbours(current)) {
        if (!trav.visited.has(nb)) {
          trav.visited.set(nb, now);
          trav.edges.push({ a: current, b: nb, born: now });
          trav.frontier.push(nb);
        }
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(30, Math.min(110, Math.round((width * height) / 11000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
      }));
      trav = null;
    }

    function line(a: Node, b: Node, alpha: number, w: number, upTo = 1) {
      ctx!.globalAlpha = alpha;
      ctx!.lineWidth = w;
      ctx!.beginPath();
      ctx!.moveTo(a.x, a.y);
      ctx!.lineTo(a.x + (b.x - a.x) * upTo, a.y + (b.y - a.y) * upTo);
      ctx!.stroke();
    }

    function dot(n: Node, r: number, alpha: number) {
      ctx!.globalAlpha = alpha;
      ctx!.beginPath();
      ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx!.fill();
    }

    function draw(now: number) {
      const color = getComputedStyle(canvas!).color;
      ctx!.clearRect(0, 0, width, height);
      ctx!.strokeStyle = color;
      ctx!.fillStyle = color;

      if (!reduceMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
        }
        if (!trav) startTraversal(now);
        while (trav && trav.finishedAt === null && now >= trav.nextStep) {
          step(now);
          trav.nextStep += STEP_MS;
        }
      }

      // Base graph
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < LINK_DISTANCE) line(nodes[i], nodes[j], (1 - d / LINK_DISTANCE) * 0.22, 0.8);
        }
      }
      for (const n of nodes) dot(n, 1, 0.4);

      // Traversal overlay
      if (trav) {
        let fade = 1;
        if (trav.finishedAt !== null) {
          const since = now - trav.finishedAt;
          fade = 1 - Math.max(0, since - HOLD_MS) / FADE_MS;
          if (fade <= 0) {
            trav = null;
            ctx!.globalAlpha = 1;
            if (!reduceMotion) raf = requestAnimationFrame(draw);
            return;
          }
        }
        for (const e of trav.edges) {
          const p = Math.min(1, (now - e.born) / EDGE_MS);
          line(nodes[e.a], nodes[e.b], 0.85 * fade, 1.4, p);
        }
        for (const [i, t] of trav.visited) {
          const age = now - t;
          dot(nodes[i], 2, 0.95 * fade);
          if (age < 500) {
            ctx!.globalAlpha = (1 - age / 500) * 0.6 * fade;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.arc(nodes[i].x, nodes[i].y, 2 + (age / 500) * 9, 0, Math.PI * 2);
            ctx!.stroke();
          }
        }
      }

      ctx!.globalAlpha = 1;
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    }

    resize();
    draw(performance.now());
    const onResize = () => {
      resize();
      if (reduceMotion) draw(performance.now());
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
