import {readFileSync,writeFileSync} from 'node:fs';
const image=readFileSync(new URL('../public/assets/avatar-fast.webp',import.meta.url));
writeFileSync(new URL('./avatar.mjs',import.meta.url),'export const AVATAR='+JSON.stringify('data:image/webp;base64,'+image.toString('base64'))+';\n');
console.log('Original Blog-CDN-Gateway page retained; Fanxing avatar embedded.');
