// Script one-shot (pas une étape de build) : génère les icônes PWA manquantes à partir de
// src/app/icon.png (256x256, seule source disponible). À relancer manuellement si le logo change.
// Usage : node scripts/generate-pwa-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "src/app/icon.png");
const iconsDir = path.join(root, "public/icons");

async function main() {
  await mkdir(iconsDir, { recursive: true });

  // Icônes "any" : logo tel quel, redimensionné.
  await sharp(source).resize(192, 192).png().toFile(path.join(iconsDir, "icon-192.png"));
  await sharp(source).resize(512, 512).png().toFile(path.join(iconsDir, "icon-512.png"));

  // Icônes "maskable" : le logo doit tenir dans une zone de sécurité centrale (~80%) car Android
  // applique son propre masque (rond/squircle/carré arrondi) qui peut rogner les bords.
  await makeMaskable(192, path.join(iconsDir, "icon-maskable-192.png"));
  await makeMaskable(512, path.join(iconsDir, "icon-maskable-512.png"));

  // apple-touch-icon (convention de fichier Next.js : src/app/apple-icon.png) : iOS applique déjà
  // ses propres coins arrondis, l'image doit rester carrée, opaque, sans transparence.
  await sharp(source)
    .resize(180, 180)
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(path.join(root, "src/app/apple-icon.png"));

  console.log("Icônes PWA générées dans public/icons/ et src/app/apple-icon.png");
}

async function makeMaskable(size, dest) {
  const safeZone = Math.round(size * 0.8);
  const logo = await sharp(source).resize(safeZone, safeZone).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#1e4fa8" },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(dest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
