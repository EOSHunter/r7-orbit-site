// Temporary: a copy of a built page that opens as a plain file (root paths made relative to dist/, stylesheets inlined).
import { readFileSync, writeFileSync } from 'node:fs';
const [, , page, out] = process.argv;
let h = readFileSync(`dist/${page}`, 'utf8');
h = h.replace(/<link rel="stylesheet" href="\/(_astro\/[^"]+\.css)"[^>]*>/g, (m, p) => `<style>${readFileSync(`dist/${p}`, 'utf8').replace(/url\(\//g, 'url(./')}</style>`);
h = h.replace(/([\s"(,])\/(?=(_astro|media|assets|fonts|og-default|favicon|icon|apple-touch|site\.webmanifest|r7)[^"\s,)]*)/g, '$1./');
writeFileSync(`dist/${out}`, h);
console.log('written', out, h.length);
