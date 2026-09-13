/**
 * Generates PWA icons and the favicon from the Acu Heal logo.
 *   pnpm --filter @acuheal/web icons
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BRAND = path.resolve(process.cwd(), 'public/brand');
const SOURCE = path.join(BRAND, 'logo.png');
const BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function square(size: number, padding: number, out: string) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(SOURCE).resize({ width: inner, height: inner, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(BRAND, out));
  console.log(`  ${out} (${size}×${size})`);
}

async function main() {
  await mkdir(BRAND, { recursive: true });
  console.log('Generating icons from public/brand/logo.png');
  await square(192, 0.08, 'icon-192.png');
  await square(512, 0.08, 'icon-512.png');
  // maskable icons need a safe zone, so pad more heavily
  await square(512, 0.2, 'icon-maskable-512.png');
  await square(180, 0.08, 'apple-touch-icon.png');
  await square(32, 0.05, 'favicon-32.png');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
