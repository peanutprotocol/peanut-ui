// Mock for @simplewebauthn/browser
export const browserSupportsWebAuthn = jest.fn(() => true)

export const browserSupportsWebAuthnAutofill = jest.fn(() => Promise.resolve(true))

export const startRegistration = jest.fn(() =>
    Promise.resolve({
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        response: {
            clientDataJSON: 'mock-client-data',
            attestationObject: 'mock-attestation',
        },
        type: 'public-key',
    })
)

export const startAuthentication = jest.fn(() =>
    Promise.resolve({
        id: 'mock-credential-id',
        rawId: 'mock-raw-id',
        response: {
            clientDataJSON: 'mock-client-data',
            authenticatorData: 'mock-auth-data',
            signature: 'mock-signature',
            userHandle: 'mock-user-handle',
        },
        type: 'public-key',
    })
)

export const platformAuthenticatorIsAvailable = jest.fn(() => Promise.resolve(true))

export const base64URLStringToBuffer = jest.fn((base64URLString: string) => {
    return new ArrayBuffer(8)
})

export const bufferToBase64URLString = jest.fn((buffer: ArrayBuffer) => {
    return 'mock-base64-string'
})

export class WebAuthnError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WebAuthnError'
    }
}

export class WebAuthnAbortService {
    static createNewAbortSignal() {
        return new AbortController().signal
    }
}
