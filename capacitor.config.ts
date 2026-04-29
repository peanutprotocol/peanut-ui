import type { CapacitorConfig } from '@capacitor/cli'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// capacitor CLI doesn't load .env files — read .env.production.local manually
// so CapacitorPasskey origin/domains match the rpId used in the app code.
try {
    const envFile = readFileSync(resolve(__dirname, '.env.production.local'), 'utf-8')
    for (const line of envFile.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match && !process.env[match[1].trim()]) {
            process.env[match[1].trim()] = match[2].trim()
        }
    }
} catch {}

const config: CapacitorConfig = {
    appId: 'me.peanut.wallet',
    appName: 'Peanut',
    webDir: 'out',
    // no server.url — static export loads from local out/ directory
    android: {
        allowMixedContent: false,
        webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
    },
    plugins: {
        CapacitorUpdater: {
            autoUpdate: true,
            appReadyTimeout: 15000,
            responseTimeout: 30,
            autoDeleteFailed: true,
            autoDeletePrevious: true,
        },
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
