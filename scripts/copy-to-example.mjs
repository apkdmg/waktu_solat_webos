// Copies the drop-in build into the example webOS app.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('example/lib', { recursive: true });
copyFileSync('dist/waktu-solat.min.js', 'example/lib/waktu-solat.min.js');
console.log('Copied dist/waktu-solat.min.js -> example/lib/');
