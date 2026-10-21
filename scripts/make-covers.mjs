// Генератор SVG-обложек для демонстрационных книг Lucky Bunny.
// Обложки явно помечены как демонстрационные и рисуются кодом — без внешних изображений.
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/covers");
mkdirSync(outDir, { recursive: true });

const PALETTES = [
  { bg: "#84A59D", band: "#F5CAC3", text: "#2E2A25", accent: "#F28482" },
  { bg: "#F5CAC3", band: "#84A59D", text: "#2E2A25", accent: "#FFB583" },
  { bg: "#FFB583", band: "#B9E4C9", text: "#2E2A25", accent: "#F28482" },
  { bg: "#B9E4C9", band: "#F5CAC3", text: "#2E2A25", accent: "#84A59D" },
  { bg: "#F28482", band: "#F7EDE2", text: "#2E2A25", accent: "#84A59D" },
  { bg: "#BAAAD7", band: "#B9E4C9", text: "#2E2A25", accent: "#FFB583" },
];

function bunny(color) {
  return `
  <g transform="translate(200 330)">
    <ellipse cx="0" cy="0" rx="58" ry="62" fill="${color}"/>
    <ellipse cx="-22" cy="-78" rx="16" ry="48" fill="${color}" transform="rotate(-8 -22 -78)"/>
    <ellipse cx="22" cy="-78" rx="16" ry="48" fill="${color}" transform="rotate(8 22 -78)"/>
    <ellipse cx="-22" cy="-78" rx="7" ry="32" fill="#F5CAC3" transform="rotate(-8 -22 -78)"/>
    <ellipse cx="22" cy="-78" rx="7" ry="32" fill="#F5CAC3" transform="rotate(8 22 -78)"/>
    <circle cx="-20" cy="-10" r="6" fill="#2E2A25"/>
    <circle cx="20" cy="-10" r="6" fill="#2E2A25"/>
    <ellipse cx="0" cy="12" rx="9" ry="6" fill="#2E2A25"/>
    <path d="M0 18 Q -6 28 -14 24 M0 18 Q 6 28 14 24" stroke="#2E2A25" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>`;
}

function wrapTitle(title, max = 16) {
  const words = title.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

export function coverSvg(title, author, i) {
  const p = PALETTES[i % PALETTES.length];
  const lines = wrapTitle(title);
  const titleEls = lines
    .map(
      (l, idx) =>
        `<text x="200" y="${96 + idx * 44}" text-anchor="middle" font-family="'Dela Gothic One',sans-serif" font-size="34" fill="${p.text}">${l}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" rx="18" fill="${p.bg}"/>
  <rect x="0" y="430" width="400" height="170" rx="18" fill="${p.band}" opacity="0.85"/>
  <rect x="0" y="430" width="400" height="60" fill="${p.band}" opacity="0.85"/>
  <text x="200" y="52" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="600" font-size="15" letter-spacing="4" fill="${p.text}" opacity="0.75">LUCKY BUNNY</text>
  ${titleEls}
  ${bunny("#FDF6EC")}
  <text x="200" y="510" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="700" font-size="22" fill="${p.text}">${author}</text>
  <text x="200" y="556" text-anchor="middle" font-family="Manrope,sans-serif" font-size="13" fill="${p.text}" opacity="0.7">демонстрационная обложка</text>
  <circle cx="350" cy="52" r="14" fill="${p.accent}"/>
</svg>`;
}

const titles = JSON.parse(process.argv[2] || "[]");
titles.forEach((t, i) => {
  writeFileSync(join(outDir, `${t.slug}.svg`), coverSvg(t.title, t.author, i));
});
console.log(`Generated ${titles.length} covers in ${outDir}`);
