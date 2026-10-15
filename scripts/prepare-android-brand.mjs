import { cp, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const resources = resolve('android/app/src/main/res');
await access(resources);
for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  await cp(resolve(`android-shell/icons/mipmap-${density}`), `${resources}/mipmap-${density}`, { recursive: true });
}
await mkdir(`${resources}/mipmap-anydpi-v26`, { recursive: true });
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/proar_icon_background" />
  <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>\n`;
for (const name of ['ic_launcher', 'ic_launcher_round']) await writeFile(`${resources}/mipmap-anydpi-v26/${name}.xml`, xml);
await mkdir(`${resources}/values`, { recursive: true });
await writeFile(`${resources}/values/proar_brand.xml`, '<?xml version="1.0" encoding="utf-8"?><resources><color name="proar_icon_background">#05152e</color></resources>\n');
console.log('ProAR Mobile launcher icons applied.');
