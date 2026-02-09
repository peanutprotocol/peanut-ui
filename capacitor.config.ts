import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.peanut.app',
  appName: 'Peanut',
  webDir: 'out',

  // Load from ngrok for passkey testing (needs HTTPS + assetlinks)
  server: {
    url: 'https://3ff1-146-70-189-102.ngrok-free.app',
    cleartext: false,
  },

  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },

  plugins: {},
};

export default config;
