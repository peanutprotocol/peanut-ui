export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Polyfill crypto.randomUUID for Node.js SSR (required by DaimoPayProvider)
        const nodeCrypto = await import('crypto')
        if (!globalThis.crypto) {
            // @ts-ignore - polyfill for SSR
            globalThis.crypto = nodeCrypto.webcrypto
        }
        if (!globalThis.crypto.randomUUID) {
            globalThis.crypto.randomUUID = nodeCrypto.randomUUID
        }

        await import('./sentry.server.config')
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('./sentry.edge.config')
    }
}
