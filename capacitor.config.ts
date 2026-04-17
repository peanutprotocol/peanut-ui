import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
    appId: 'com.peanut_dev.app',
    appName: 'Peanut',
    webDir: 'out',
    // no server.url — static export loads from local out/ directory
    android: {
        allowMixedContent: false,
        webContentsDebuggingEnabled: true,
    },
    plugins: {
        CapacitorHttp: {
            enabled: true,
        },
        CapacitorPasskey: {
            // shim patches navigator.credentials.create/get so browser WebAuthn code works natively.
            // origin must match the rpId used for passkey registration.
            // runtime override in peanut.config.tsx reads NEXT_PUBLIC_NATIVE_RP_ID for the actual value.
            autoShim: true,
            origin: `https://${process.env.NEXT_PUBLIC_NATIVE_RP_ID || 'peanut.me'}`,
            domains: [process.env.NEXT_PUBLIC_NATIVE_RP_ID || 'peanut.me'],
        },
    },
}

export default config
