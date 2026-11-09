// Copies the OCR engine (Tesseract) and its English data into public/vendor,
// so the site reads photos without contacting any other server.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

const out = 'public/vendor/tesseract';
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });

copyFileSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const f of readdirSync('node_modules/tesseract.js-core')) {
  if (/-lstm\.wasm\.js$/.test(f)) copyFileSync(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`);
}
copyFileSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/lang/eng.traineddata.gz`);
console.log('copied OCR assets to', out);
