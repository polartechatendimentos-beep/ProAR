import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.proar.mobile',
  appName: 'ProAR Mobile',
  webDir: 'public',
  server: {
    url: 'https://polartech.proar.online/mobile',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
