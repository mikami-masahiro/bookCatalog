// 単色（薄い青）のアプリアイコン build/icon.ico を生成する。
// 追加依存なし（Node 組み込みの zlib のみ）。色は favicon.svg と合わせる。
// 使い方: node scripts/make-icon.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const COLOR = { r: 0x8e, g: 0xc5, b: 0xff }; // #8ec5ff
const SIZES = [16, 32, 48, 64, 128, 256];
// favicon.svg と同じ比率: 32 中 4 の余白、角丸 5。
const PADDING_RATIO = 4 / 32;
const RADIUS_RATIO = 5 / 24; // 内側の正方形に対する角丸半径

const crcTable = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const typeBuf = Buffer.from(type, "ascii");
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
	return Buffer.concat([len, typeBuf, data, crc]);
}

// 角丸正方形内なら 1、外なら 0、境界はアンチエイリアスで 0〜1 を返す。
function coverage(px, py, pad, r, size) {
	const lo = pad;
	const hi = size - pad;
	// 角丸の中心線にクランプして最寄り点までの距離を測る（角丸矩形の SDF）。
	const cx = Math.min(Math.max(px, lo + r), hi - r);
	const cy = Math.min(Math.max(py, lo + r), hi - r);
	const dx = px - cx;
	const dy = py - cy;
	const dist = Math.hypot(dx, dy);
	// r からの距離で 1px 幅のなめらかな境界を作る。
	return Math.min(Math.max(r + 0.5 - dist, 0), 1);
}

// size×size の RGBA（透明パディング付き角丸）を PNG にエンコードする。
function makePng(size) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // color type RGBA
	// 10,11,12 = 0（compression/filter/interlace）

	const pad = size * PADDING_RATIO;
	const r = (size - 2 * pad) * RADIUS_RATIO;

	const raw = Buffer.alloc(size * (1 + size * 4));
	for (let y = 0; y < size; y++) {
		const rowStart = y * (1 + size * 4);
		raw[rowStart] = 0; // フィルタ種別: None
		for (let x = 0; x < size; x++) {
			const a = coverage(x + 0.5, y + 0.5, pad, r, size);
			const o = rowStart + 1 + x * 4;
			raw[o] = COLOR.r;
			raw[o + 1] = COLOR.g;
			raw[o + 2] = COLOR.b;
			raw[o + 3] = Math.round(a * 255);
		}
	}
	const idat = deflateSync(raw);

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", idat),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

// PNG 埋め込み方式の ICO を組み立てる。
function makeIco(pngs) {
	const count = pngs.length;
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(count, 4);

	const entries = [];
	let offset = 6 + count * 16;
	for (const { size, data } of pngs) {
		const e = Buffer.alloc(16);
		e[0] = size >= 256 ? 0 : size; // 0 は 256 を意味する
		e[1] = size >= 256 ? 0 : size;
		e[2] = 0; // パレット数
		e[3] = 0; // reserved
		e.writeUInt16LE(1, 4); // planes
		e.writeUInt16LE(32, 6); // bit count
		e.writeUInt32LE(data.length, 8);
		e.writeUInt32LE(offset, 12);
		entries.push(e);
		offset += data.length;
	}

	return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const pngs = SIZES.map((size) => ({ size, data: makePng(size) }));
const ico = makeIco(pngs);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "build");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "icon.ico");
writeFileSync(outPath, ico);
console.log(`wrote ${outPath} (${ico.length} bytes, sizes: ${SIZES.join(",")})`);
