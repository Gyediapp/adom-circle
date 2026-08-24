// The Adom Circle brand mark — a 3D "AC" monogram:
// a deep-green coin, a gold 3D "A" with the Black Star on its crossbar,
// wrapped by a tricolour "C" ring (red → gold → green) with bevels and depth.

const STAR_PATH =
  "M 80,40 L 90,66.25 L 118.04,67.64 L 96.17,85.25 L 103.51,112.36 L 80,97 L 56.49,112.36 L 63.83,85.25 L 41.96,67.64 L 70,66.25 Z";

const f = (n: number) => n.toFixed(1);

const rad = (deg: number) => (deg * Math.PI) / 180;

// Point on a circle centred at 100,100
const P = (r: number, deg: number): [number, number] => {
  const a = rad(deg);
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
};

// Annular sector from a1° to a2° (counter-clockwise), outer r 78, inner r 58
const seg = (a1: number, a2: number) => {
  const [ox1, oy1] = P(78, a1);
  const [ox2, oy2] = P(78, a2);
  const [ix1, iy1] = P(58, a1);
  const [ix2, iy2] = P(58, a2);
  return (
    `M ${f(ox1)} ${f(oy1)} A 78 78 0 0 0 ${f(ox2)} ${f(oy2)} ` +
    `L ${f(ix2)} ${f(iy2)} A 58 58 0 0 1 ${f(ix1)} ${f(iy1)} Z`
  );
};

const RED = seg(270, 210);
const GOLD = seg(210, 150);
const GREEN = seg(150, 90);

const A_PATH = "M 100 46 L 132 146 L 116 146 L 100 110 L 84 146 L 68 146 Z";

export function logoMarkMarkup(): string {
  return `
  <defs>
    <filter id="ac-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity="0.45"/>
    </filter>
    <radialGradient id="ac-well" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#1d4a38"/>
      <stop offset="62%" stop-color="#0d1f17"/>
      <stop offset="100%" stop-color="#08120d"/>
    </radialGradient>
    <linearGradient id="ac-red" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff8d99"/>
      <stop offset="45%" stop-color="#ce1126"/>
      <stop offset="100%" stop-color="#7a0916"/>
    </linearGradient>
    <linearGradient id="ac-gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffedb3"/>
      <stop offset="45%" stop-color="#fcd116"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </linearGradient>
    <linearGradient id="ac-green" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4ade9a"/>
      <stop offset="45%" stop-color="#006b3f"/>
      <stop offset="100%" stop-color="#00361f"/>
    </linearGradient>
    <linearGradient id="ac-a" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff6d8"/>
      <stop offset="42%" stop-color="#fcd116"/>
      <stop offset="100%" stop-color="#d9a406"/>
    </linearGradient>
    <radialGradient id="ac-sheen" cx="35%" cy="25%" r="80%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g filter="url(#ac-shadow)">
    <circle cx="100" cy="100" r="95" fill="url(#ac-well)"/>
    <circle cx="100" cy="100" r="95" fill="url(#ac-sheen)"/>
    <circle cx="100" cy="100" r="97" fill="none" stroke="#8a6d0a" stroke-width="3.5" opacity="0.85"/>
    <circle cx="100" cy="100" r="94" fill="none" stroke="#fde98a" stroke-width="1.4" opacity="0.5"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(252,209,22,0.14)" stroke-width="1"/>
    <!-- C ring extrusions (depth) -->
    <g transform="translate(0 3)" opacity="0.55">
      <path d="${RED}" fill="#7a0916"/>
      <path d="${GOLD}" fill="#a87e05"/>
      <path d="${GREEN}" fill="#00361f"/>
    </g>
    <!-- C ring: the flag in a circle -->
    <path d="${RED}" fill="url(#ac-red)"/>
    <path d="${GOLD}" fill="url(#ac-gold)"/>
    <path d="${GREEN}" fill="url(#ac-green)"/>
    <!-- A extrusion (depth) -->
    <path d="${A_PATH}" transform="translate(0 4)" fill="#8a6d0a"/>
    <!-- A: gold 3D letter -->
    <path d="${A_PATH}" fill="url(#ac-a)"/>
    <path d="${A_PATH}" fill="none" stroke="rgba(255,246,216,0.55)" stroke-width="1.6" transform="translate(-0.8 -0.8)"/>
    <!-- Black Star on the crossbar -->
    <g transform="translate(100 112) scale(0.17) translate(-80 -80)">
      <path d="${STAR_PATH}" fill="none" stroke="#d9a406" stroke-width="9" stroke-linejoin="round"/>
      <path d="${STAR_PATH}" fill="#0b0e0c"/>
    </g>
  </g>`;
}

export function logoMarkSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">${logoMarkMarkup()}</svg>`;
}
