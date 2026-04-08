import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'com.peanut.app',
    appName: 'Peanut',
    webDir: 'out',

    // cloudflare tunnel for dev testing (passkeys need HTTPS + stable domain)
    // TODO: remove server.url for production (static export loads from local out/ directory)
    server: {
        url: 'https://peanutdev.site',
        cleartext: false,
    },

    android: {
        allowMixedContent: true,
        webContentsDebuggingEnabled: true,
    },

    plugins: {},
}

export default config
