// Configuração independente do build web: o Capacitor é instalado pelo job Android.
const config = {
  appId: 'br.com.proar.mobile',
  appName: 'ProAR Mobile',
  webDir: 'android-shell/www',
  server: { url: 'https://polartech.proar.online/mobile', cleartext: false },
  android: { allowMixedContent: false }
};
export default config;
