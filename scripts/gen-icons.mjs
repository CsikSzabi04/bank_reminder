// PWA ikonok egyetlen forrásból (§13.2): `npm run gen:icons`. Kimenet: public/icons/*, app/icon.svg
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });
const TEAL = "#0B7F70";

// a harang + pipa jel, a megadott méretre/pozícióra illesztve (512-es koordináta-rendszerben)
const glyph = (scale, color, check = true) => {
  const size = 512 * scale;
  const off = (512 - size) / 2;
  return `<g transform="translate(${off} ${off}) scale(${scale})">
    <g transform="translate(96 88) scale(13.33)" fill="${color}">
      <path d="M12 2a1.6 1.6 0 0 0-1.6 1.6v.5A6.5 6.5 0 0 0 5.5 10.4V15L3.7 17.3a1 1 0 0 0 .8 1.7h15a1 1 0 0 0 .8-1.7L18.5 15v-4.6a6.5 6.5 0 0 0-4.9-6.3v-.5A1.6 1.6 0 0 0 12 2z"/>
      <path d="M9.4 20.2a2.7 2.7 0 0 0 5.2 0z"/>
    </g>
    ${check ? `<path d="M215 262l31 31 58-64" fill="none" stroke="${TEAL}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
  </g>`;
};
const svg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${inner}</svg>`);
const rounded = (g) => svg(`<rect width="512" height="512" rx="112" fill="${TEAL}"/>${g}`);
const bleed = (g) => svg(`<rect width="512" height="512" fill="${TEAL}"/>${g}`); // átlátszatlan (iOS) / maszkolható

const jobs = [
  ["icon-192.png", 192, rounded(glyph(1, "#fff"))],
  ["icon-512.png", 512, rounded(glyph(1, "#fff"))],
  // maszkolható: a jel a középső ~60%-on belül (safe zone 80%)
  ["maskable-192.png", 192, bleed(glyph(0.62, "#fff"))],
  ["maskable-512.png", 512, bleed(glyph(0.62, "#fff"))],
  // az iOS az átlátszóságot feketére festi → átlátszatlan háttér
  ["apple-touch-icon.png", 180, bleed(glyph(0.7, "#fff"))],
  ["apple-touch-icon-167.png", 167, bleed(glyph(0.7, "#fff"))],
  ["apple-touch-icon-152.png", 152, bleed(glyph(0.7, "#fff"))],
  // Android státuszsor: fehér, átlátszó hátterű monokróm jel
  ["badge-96.png", 96, svg(glyph(0.9, "#fff", false))],
  ["shortcut-add.png", 96, rounded(`<path d="M256 150v212M150 256h212" stroke="#fff" stroke-width="48" stroke-linecap="round"/>`)],
];

for (const [name, size, input] of jobs) {
  await sharp(input).resize(size, size).png({ compressionLevel: 9 }).toFile(`${OUT}/${name}`);
}
copyFileSync("assets/logo.svg", "app/icon.svg"); // a Next ezt linkeli faviconként
console.log(`gen:icons ✔ ${jobs.length} PNG + app/icon.svg (${readFileSync("assets/logo.svg").length} B forrás)`);
