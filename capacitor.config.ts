import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'com.peanut.app',
    appName: 'Peanut',
    webDir: 'out',

    // vercel preview for passkey testing (rpId must match this domain)
    // TODO: remove server.url for production (static export loads from local out/ directory)
    server: {
        url: 'https://peanut-wallet-git-feat-native-app-squirrellabs.vercel.app',
        cleartext: false,
    },

    android: {
        allowMixedContent: true,
        webContentsDebuggingEnabled: true,
    },

    plugins: {},
}

export default config
