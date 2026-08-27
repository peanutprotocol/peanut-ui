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
    // matches the app shell background so there's no white flash between the
    // splash screen tearing down and the first web paint
    backgroundColor: '#FFFFFF',
    android: {
        allowMixedContent: false,
        // WEBVIEW_DEBUG=true re-enables chrome://inspect on a release build for on-device profiling
        webContentsDebuggingEnabled: process.env.WEBVIEW_DEBUG === 'true' || process.env.NODE_ENV !== 'production',
    },
    plugins: {
        CapacitorUpdater: {
            // autoUpdate:false → the plugin no longer polls getLatest on every
            // foreground, which was hammering Capgo's cloud rate limit (429s in
            // Sentry). initCapgoUpdater() does one guarded check per launch instead.
            autoUpdate: false,
            appReadyTimeout: 15000,
            responseTimeout: 30,
            autoDeleteFailed: true,
            autoDeletePrevious: true,
            // E2E signing: bundles are encrypted/signed with the private key
            // (.capgo_key_v2, CI secret only) and verified on-device with this
            // public key, so only we can ship an OTA the app will accept.
            publicKey:
                '-----BEGIN RSA PUBLIC KEY-----\nMIIBCgKCAQEAr0HzEca/1vuvWcJ8/xYB6tx0j4uJMzw/kT34GnjyMlRmLLUIO9sj\nroXaUGaNoqlOCx73b7Qgp10TLPOAVxmoHV9ZJ4BS9cMCl5mvzB4qIdl6FZLcl3g5\nk5Nkj4w22nskqbBqL7eqMXpk4DD9oWRclnaZC/lCpok1n2AWy4EMZrshemBQ6iXr\ncppo+WByPbqmh/GbHvJyRvkx4Rgt2LSBJBI3laP3eEDkujCq1ZH9qgcIE4MXO5xq\n7c6LsLjN5wkQiNPSPI81zAbqBThhqodKzwav0FwIE1pyiJeGk1nV5Ji5kUgpFNwY\nY78iDVq4OP2jPfWO4jXnnJtnGN7aeKDMEQIDAQAB\n-----END RSA PUBLIC KEY-----\n',
        },
        // CapacitorHttp OFF: its Android GET proxy (_capacitor_http_interceptor_)
        // stalls under load, timing out every in-flight request (PEANUT-UI-R44).
        // Requests go direct from the webview — CORS allows https://localhost and
        // capacitor://, and auth rides the Authorization header from native
        // Preferences (src/utils/auth-token.ts) instead of the plugin's cookie jar.
        CapacitorHttp: {
            enabled: false,
        },
        CapacitorPasskey: {
            // shim patches navigator.credentials.create/get so browser WebAuthn code works natively.
            // origin must match the rpId used for passkey registration.
            // runtime override in peanut.config.tsx reads NEXT_PUBLIC_NATIVE_RP_ID for the actual value.
            autoShim: true,
            origin: `https://${process.env.NEXT_PUBLIC_NATIVE_RP_ID || 'peanut.me'}`,
            domains: [process.env.NEXT_PUBLIC_NATIVE_RP_ID || 'peanut.me'],
        },
        Keyboard: {
            // resize the webview when the soft keyboard shows so inputs aren't hidden.
            resize: 'native',
        },
        SplashScreen: {
            /*
             * The plugin's 500ms auto-hide exposed the login screen before the
             * session had hydrated (logged-in cold starts flashed /setup).
             * useSplashGate (ClientProviders) owns hide() with its own hard
             * timeout, and CapacitorUpdater.appReadyTimeout recovers a bundle
             * that never boots — the splash can't wedge. Binary change: takes
             * effect on the next store release, not via OTA.
             */
            launchAutoHide: false,
            /*
             * 0 disables the plugin's fade-out, which is what stops it calling
             * setOnExitAnimationListener. That listener makes Android hand the
             * system starting window over to our process, and a background/
             * resume mid-launch leaves the handoff with a released leash —
             * SurfaceControl.Transaction.hide(null) crashes the app on the next
             * frame (PEANUT-UI-SVN). Without it the system tears its own splash
             * down. Android-only key; iOS ignores it.
             */
            launchFadeOutDuration: 0,
        },
    },
}

export default config
