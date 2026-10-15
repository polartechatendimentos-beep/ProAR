import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {brandIconSvg,brandWordmarkSvg} from '../lib/brand-assets.ts';
await mkdir('public/brand',{recursive:true});
for(const variant of ['system','mobile']){
 const icon=brandIconSvg(variant),wordmark=brandWordmarkSvg(variant);
 await writeFile(`public/brand/proar-${variant}.svg`,icon);
 await writeFile(`public/brand/proar-${variant}-wordmark.svg`,wordmark);
 for(const size of [32,180,192,512])await sharp(Buffer.from(icon)).resize(size,size).png().toFile(`public/brand/proar-${variant}-${size}.png`);
}
const system=Buffer.from(brandIconSvg('system')),mobile=Buffer.from(brandIconSvg('mobile'));
for(const file of ['public/icon.png','public/icon-512.png','app/icon.png'])await sharp(system).resize(512,512).png().toFile(file);
await sharp(system).resize(192,192).png().toFile('public/icon-192.png');
await sharp(Buffer.from(brandWordmarkSvg('system'))).png().toFile('public/proar-logo.png');
await mkdir('app/mobile',{recursive:true});
await sharp(mobile).resize(512,512).png().toFile('app/mobile/icon.png');
await sharp(mobile).resize(180,180).png().toFile('app/mobile/apple-icon.png');
for(const [density,multiplier] of [['mdpi',1],['hdpi',1.5],['xhdpi',2],['xxhdpi',3],['xxxhdpi',4]]){
 const dir=`android-shell/icons/mipmap-${density}`;await mkdir(dir,{recursive:true});
 for(const name of ['ic_launcher','ic_launcher_round'])await sharp(mobile).resize(Math.round(48*multiplier),Math.round(48*multiplier)).png().toFile(`${dir}/${name}.png`);
 const source=brandIconSvg('mobile').replace('width="512" height="512"','x="96" y="96" width="320" height="320"');
 const foreground=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#05152e"/>${source}</svg>`;
 await sharp(Buffer.from(foreground)).resize(Math.round(108*multiplier),Math.round(108*multiplier)).png().toFile(`${dir}/ic_launcher_foreground.png`);
}
