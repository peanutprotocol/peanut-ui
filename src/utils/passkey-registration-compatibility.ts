export class PasskeyProviderUnsupportedError extends Error {
    readonly code = 'PASSKEY_PROVIDER_UNSUPPORTED'

    constructor() {
        super('This passkey provider is incompatible with the wallet validator')
        this.name = 'PasskeyProviderUnsupportedError'
    }
}

export function assertPasskeyRegistrationCompatible(credential: unknown): void {
    const encoded = (credential as { response?: { clientDataJSON?: unknown } } | null)?.response?.clientDataJSON
    try {
        if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) throw new Error()
        const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
        const clientData = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
        const parsed = JSON.parse(clientData)
        if (
            parsed.type !== 'webauthn.create' ||
            typeof parsed.challenge !== 'string' ||
            !/^[A-Za-z0-9_-]+$/.test(parsed.challenge) ||
            typeof parsed.origin !== 'string' ||
            !parsed.origin
        ) {
            throw new Error()
        }
        // The deployed validator fixes the get challenge at byte 23 (create uses byte 26).
        if (!clientData.startsWith(`{"type":"webauthn.create","challenge":${JSON.stringify(parsed.challenge)}`)) {
            throw new Error()
        }
    } catch {
        throw new PasskeyProviderUnsupportedError()
    }
}
