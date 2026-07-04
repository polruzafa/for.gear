// Genera les icones PNG de la PWA sense cap dependència (només node:zlib).
// Dibuixa una motxilla blanca sobre fons taronja amb formes arrodonides.
// Ús: node scripts/make-icons.mjs

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

const ORANGE = [232, 84, 29]
const WHITE = [251, 249, 244]

// ── PNG mínim ────────────────────────────────────────────────────────────────

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filtre: cap
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y)
      raw.writeUInt8(r, rowStart + 1 + x * 4)
      raw.writeUInt8(g, rowStart + 2 + x * 4)
      raw.writeUInt8(b, rowStart + 3 + x * 4)
      raw.writeUInt8(a, rowStart + 4 + x * 4)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bits per canal
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Formes (distàncies signades, amb antialiàsing d'1 px) ───────────────────

function roundedRect(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r)
  const dy = Math.abs(y - cy) - (hh - r)
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r
}

function coverage(dist) {
  return Math.min(1, Math.max(0, 0.5 - dist))
}

function blend(base, top, alpha) {
  return base.map((c, i) => Math.round(c + (top[i] - c) * alpha))
}

/**
 * Dibuixa la icona en coordenades normalitzades (0..1) i escala `s`.
 * `bleed = true` omple tot el quadrat (per a la versió «maskable»);
 * si no, el fons és un quadrat arrodonit sobre transparent.
 */
function makeIcon(size, { bleed = false, scale = 1 } = {}) {
  return png(size, (px, py) => {
    const s = size
    const x = (px - s / 2) / scale + s / 2
    const y = (py - s / 2) / scale + s / 2

    // Fons
    let alphaBg = 1
    if (!bleed) {
      alphaBg = coverage(roundedRect(x, y, s / 2, s / 2, s / 2, s / 2, s * 0.22) / 1)
    }
    if (alphaBg <= 0) return [0, 0, 0, 0]

    let color = ORANGE

    // Cos de la motxilla
    const body = roundedRect(x, y, s * 0.5, s * 0.57, s * 0.185, s * 0.225, s * 0.075)
    // Butxaques laterals
    const sideL = roundedRect(x, y, s * 0.285, s * 0.62, s * 0.045, s * 0.13, s * 0.04)
    const sideR = roundedRect(x, y, s * 0.715, s * 0.62, s * 0.045, s * 0.13, s * 0.04)
    // Tapa superior, més ampla que el cos
    const lid = roundedRect(x, y, s * 0.5, s * 0.315, s * 0.15, s * 0.055, s * 0.05)
    // Nansa
    const handle = roundedRect(x, y, s * 0.5, s * 0.225, s * 0.05, s * 0.018, s * 0.018)
    const glyph = Math.min(body, sideL, sideR, lid, handle)
    color = blend(color, WHITE, coverage(glyph))

    // Butxaca frontal i corretja, retallades en taronja sobre el cos blanc
    const pocket = roundedRect(x, y, s * 0.5, s * 0.665, s * 0.1, s * 0.09, s * 0.045)
    const strap = roundedRect(x, y, s * 0.5, s * 0.465, s * 0.185, s * 0.013, 0)
    const cut = Math.min(pocket, strap)
    color = blend(color, ORANGE, coverage(cut) * 0.9)

    return [...color, Math.round(alphaBg * 255)]
  })
}

writeFileSync(join(OUT, 'icon-192.png'), makeIcon(192))
writeFileSync(join(OUT, 'icon-512.png'), makeIcon(512))
// La versió «maskable» omple tot el llenç i encongeix el dibuix a la zona segura.
writeFileSync(join(OUT, 'icon-512-maskable.png'), makeIcon(512, { bleed: true, scale: 0.8 }))
writeFileSync(join(OUT, 'apple-touch-icon.png'), makeIcon(180, { bleed: true }))

console.log(`Icones escrites a ${OUT}`)
