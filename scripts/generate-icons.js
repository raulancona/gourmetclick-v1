/**
 * Generates PWA PNG icons from SVG using Canvas API in Node.js (via @napi-rs/canvas)
 * Usage: node scripts/generate-icons.js
 */
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function drawIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const r = size * 0.22; // corner radius
    const gold = '#d4af37';
    const dark = '#09090b';

    // Background rounded rect
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();

    // Decorative border
    const bInset = size * 0.063;
    const bR = size * 0.156;
    ctx.beginPath();
    ctx.moveTo(bInset + bR, bInset);
    ctx.lineTo(size - bInset - bR, bInset);
    ctx.quadraticCurveTo(size - bInset, bInset, size - bInset, bInset + bR);
    ctx.lineTo(size - bInset, size - bInset - bR);
    ctx.quadraticCurveTo(size - bInset, size - bInset, size - bInset - bR, size - bInset);
    ctx.lineTo(bInset + bR, size - bInset);
    ctx.quadraticCurveTo(bInset, size - bInset, bInset, size - bInset - bR);
    ctx.lineTo(bInset, bInset + bR);
    ctx.quadraticCurveTo(bInset, bInset, bInset + bR, bInset);
    ctx.closePath();
    ctx.strokeStyle = gold;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = size * 0.031;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const cx = size / 2;
    const cy = size * 0.563;
    const plateR = size * 0.234;
    const innerR = size * 0.156;
    const lw = size * 0.047;

    // Outer plate circle
    ctx.beginPath();
    ctx.arc(cx, cy, plateR, 0, Math.PI * 2);
    ctx.strokeStyle = gold;
    ctx.lineWidth = lw;
    ctx.stroke();

    // Inner plate circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = gold;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = lw * 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Cloche top arc
    const domeTop = size * 0.328;
    ctx.beginPath();
    ctx.arc(cx, cy, plateR, Math.PI, 0);
    ctx.strokeStyle = gold;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Handle stem
    const handleY = cy - plateR;
    ctx.beginPath();
    ctx.moveTo(cx, handleY);
    ctx.lineTo(cx, handleY - size * 0.063);
    ctx.strokeStyle = gold;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    return canvas;
}

const sizes = [192, 512];
for (const size of sizes) {
    const canvas = drawIcon(size);
    const buf = canvas.toBuffer('image/png');
    const outPath = resolve(__dirname, `../public/pwa-icon-${size}.png`);
    writeFileSync(outPath, buf);
    console.log(`✅ Generated: pwa-icon-${size}.png`);
}
