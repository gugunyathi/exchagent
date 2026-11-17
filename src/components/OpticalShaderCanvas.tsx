import React, { useEffect, useRef } from 'react';

interface OpticalShaderCanvasProps {
  className?: string;
  interactiveTargetRef?: React.RefObject<HTMLElement | null>;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Optical refractive caustic & 4-point Gemini lens spark GLSL shader
const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

// Smooth cosine palette tailored to sapphire / emerald / silver refractive optics
vec3 opticalPalette(float t) {
  vec3 a = vec3(0.06, 0.09, 0.16);
  vec3 b = vec3(0.14, 0.24, 0.36);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.55, 0.65, 0.80);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 m = (u_mouse - 0.5) * vec2(aspect, 1.0);

  float t = u_time * 0.28;

  // Gentle optical field interference
  float wave1 = sin(p.x * 3.1 + t + cos(p.y * 2.4 - t * 0.7));
  float wave2 = cos(p.y * 3.4 - t * 0.8 + sin(p.x * 2.1 + t));
  float caustic = (wave1 + wave2) * 0.5;

  // Interactive cursor optical lens glow + crisp 4-point refractive cross flare
  vec2 dm = p - m;
  float dist = length(dm);
  float halo = exp(-dist * 2.75) * 0.65;

  float sparkX = exp(-abs(dm.y) * 26.0) * exp(-abs(dm.x) * 3.2);
  float sparkY = exp(-abs(dm.x) * 26.0) * exp(-abs(dm.y) * 3.2);
  float spark = (sparkX + sparkY) * 0.52;

  // Secondary ambient optical ribbon drifting from upper right
  vec2 corner = vec2(0.45 * aspect, 0.22);
  float cornerDist = length(p - corner + vec2(sin(t) * 0.06, cos(t * 0.8) * 0.05));
  float cornerGlow = exp(-cornerDist * 2.1) * 0.42;

  vec3 base = vec3(0.024, 0.035, 0.067); // Deep obsidian slate (#060911)
  vec3 flowCol = opticalPalette(caustic * 0.35 + t * 0.15 + uv.x * 0.2);

  vec3 sapphire = vec3(0.11, 0.56, 0.96);
  vec3 emerald = vec3(0.06, 0.73, 0.51);

  vec3 col = base;
  col += flowCol * (0.28 + 0.12 * caustic);
  col += mix(sapphire, emerald, clamp(uv.x, 0.0, 1.0)) * (halo * 0.55 + cornerGlow * 0.45);
  col += vec3(0.68, 0.88, 1.0) * spark * 0.48;

  // Subtle vignette preserving high typography legibility on left column
  float leftCalm = smoothstep(0.65, 0.0, uv.x);
  col = mix(col, base * 1.15, leftCalm * 0.38);

  gl_FragColor = vec4(col, 1.0);
}
`;

export const OpticalShaderCanvas: React.FC<OpticalShaderCanvasProps> = ({
  className = '',
  interactiveTargetRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; tx: number; ty: number }>({
    x: 0.72,
    y: 0.52,
    tx: 0.72,
    ty: 0.52,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targetEl = interactiveTargetRef?.current || canvas.parentElement || canvas;
    const onPointerMove = (e: PointerEvent) => {
      const rect = targetEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const ny = Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / rect.height));
      pointerRef.current.tx = nx;
      pointerRef.current.ty = ny;
    };

    targetEl.addEventListener('pointermove', onPointerMove);

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) {
      // Smooth 2D canvas optical fallback if WebGL disabled
      const ctx2d = canvas.getContext('2d');
      let raf2d = 0;
      const render2d = (now: number) => {
        if (!ctx2d) return;
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(300, Math.floor(rect.width));
        const h = Math.max(200, Math.floor(rect.height));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        pointerRef.current.x += (pointerRef.current.tx - pointerRef.current.x) * 0.08;
        pointerRef.current.y += (pointerRef.current.ty - pointerRef.current.y) * 0.08;

        ctx2d.fillStyle = '#060911';
        ctx2d.fillRect(0, 0, w, h);

        const gx = pointerRef.current.x * w;
        const gy = (1 - pointerRef.current.y) * h;
        const g = ctx2d.createRadialGradient(gx, gy, 10, gx, gy, Math.max(w, h) * 0.55);
        g.addColorStop(0, 'rgba(14, 165, 233, 0.28)');
        g.addColorStop(0.5, 'rgba(16, 185, 129, 0.1)');
        g.addColorStop(1, 'rgba(6, 9, 17, 0)');
        ctx2d.fillStyle = g;
        ctx2d.fillRect(0, 0, w, h);

        if (!prefersReduced) {
          void now;
          raf2d = window.requestAnimationFrame(render2d);
        }
      };
      raf2d = window.requestAnimationFrame(render2d);
      return () => {
        window.cancelAnimationFrame(raf2d);
        targetEl.removeEventListener('pointermove', onPointerMove);
      };
    }

    const compileShader = (type: number, source: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(prog, 'u_resolution');
    const mouseLoc = gl.getUniformLocation(prog, 'u_mouse');
    const timeLoc = gl.getUniformLocation(prog, 'u_time');

    const startTime = performance.now();
    let rafId = 0;

    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(2, Math.floor(rect.width * dpr));
      const h = Math.max(2, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);

      pointerRef.current.x += (pointerRef.current.tx - pointerRef.current.x) * 0.08;
      pointerRef.current.y += (pointerRef.current.ty - pointerRef.current.y) * 0.08;

      const elapsed = prefersReduced ? 1.5 : (now - startTime) / 1000;
      gl.uniform2f(resLoc, w, h);
      gl.uniform2f(mouseLoc, pointerRef.current.x, pointerRef.current.y);
      gl.uniform1f(timeLoc, elapsed);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!prefersReduced) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    rafId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(rafId);
      targetEl.removeEventListener('pointermove', onPointerMove);
    };
  }, [interactiveTargetRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none block w-full h-full ${className}`}
    />
  );
};
