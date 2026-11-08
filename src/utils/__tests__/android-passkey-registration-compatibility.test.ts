/**
 * Acceptance contract authored from the AA24 specification only.
 * Fixtures deliberately preserve the exact native signed bytes.
 */
export {}

jest.mock('../native-capability', () => ({
    nativeCapability: jest.fn().mockReturnValue({ isSupportedPlatform: jest.fn(), call: jest.fn() }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('../sentry-lazy', () => ({ addBreadcrumb: jest.fn() }))

const challenge = 'private-challenge-aa24-spec'
const credentialId = 'private-credential-aa24-spec'
const origin = 'android:apk-key-hash:spec-origin'
const standard = JSON.stringify({ type: 'webauthn.create', challenge, origin })
const sorted = JSON.stringify({ androidPackageName: 'me.peanut.wallet', challenge, origin, type: 'webauthn.create' })

function encode(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url')
}

function credential(clientDataJSON: unknown = encode(standard)) {
    return {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key' as const,
        clientExtensionResults: {},
        response: { clientDataJSON, attestationObject: 'opaque-native-attestation' },
    }
}

function permutations<T>(values: T[]): T[][] {
    if (values.length === 0) return [[]]
    return values.flatMap((value, index) =>
        permutations(values.filter((_, candidate) => candidate !== index)).map((rest) => [value, ...rest])
    )
}

describe('Android registration signed-layout compatibility acceptance', () => {
    let install: (plugin: any) => void
    let classify: (error: unknown) => { code: string; message: string }
    let setupKey: (code: any) => string
    let nativeCapability: { isSupportedPlatform: jest.Mock; call: jest.Mock }
    let capture: jest.Mock
    let addBreadcrumb: jest.Mock

    beforeEach(() => {
        jest.resetModules()
        nativeCapability = require('../native-capability').nativeCapability()
        capture = require('posthog-js').default.capture
        addBreadcrumb = require('../sentry-lazy').addBreadcrumb
        jest.clearAllMocks()
        nativeCapability.isSupportedPlatform.mockReturnValue(true)
        nativeCapability.call.mockResolvedValue({})
        install = require('../android-passkey-control').installAndroidPasskeyControl
        const errors = require('../webauthn.utils')
        classify = errors.classifyPasskeyError
        setupKey = errors.getPasskeySetupKey
    })

    function pluginFor(result = credential()) {
        const nativeCreate = jest.fn().mockResolvedValue(result)
        const nativeGet = jest.fn().mockResolvedValue({ authentication: 'unchanged-native-result' })
        const plugin = { createCredential: nativeCreate, getCredential: nativeGet }
        install(plugin)
        return { plugin, nativeCreate, nativeGet }
    }

    async function rejectedRegistration(result: ReturnType<typeof credential>) {
        const { plugin, nativeCreate } = pluginFor(result)
        const registerOrVerifyOnServer = jest.fn()
        let caught: unknown
        try {
            await plugin.createCredential({}).then(registerOrVerifyOnServer)
        } catch (error) {
            caught = error
        }
        expect(registerOrVerifyOnServer).not.toHaveBeenCalled()
        expect(nativeCreate).toHaveBeenCalledTimes(1)
        expect(caught).toBeDefined()
        expect(caught).toHaveProperty('name', 'PasskeyProviderUnsupportedError')
        return caught
    }

    it('accepts the standard UTF-8 layout and returns the original native object and signed bytes', async () => {
        const result = credential()
        const signedBytes = result.response.clientDataJSON
        const { plugin, nativeCreate } = pluginFor(result)
        const options = { publicKey: { challenge: 'request-challenge' } }

        expect(await plugin.createCredential(options)).toBe(result)
        expect(result.response.clientDataJSON).toBe(signedBytes)
        expect(nativeCreate).toHaveBeenCalledTimes(1)
        expect(nativeCreate).toHaveBeenCalledWith(expect.objectContaining(options))
    })

    it('allows a Unicode origin and additional Unicode fields after the exact standard prefix', async () => {
        const json = JSON.stringify({
            type: 'webauthn.create',
            challenge,
            origin: 'https://例え.テスト',
            label: 'Peñaut 🥜',
        })
        const result = credential(encode(json))
        const { plugin } = pluginFor(result)

        expect(await plugin.createCredential({})).toBe(result)
        expect(result.response.clientDataJSON).toBe(encode(json))
    })

    it.each(['opaque-device-bound-attestation', 'opaque-synced-attestation', ''])(
        'does not reject standard signed layout based on opaque attestation bytes: %s',
        async (attestationObject) => {
            const result = credential()
            result.response.attestationObject = attestationObject
            const { plugin } = pluginFor(result)
            expect(await plugin.createCredential({})).toBe(result)
        }
    )

    it('rejects the sorted Android provider layout before server registration or verification', async () => {
        const result = credential(encode(sorted))
        await rejectedRegistration(result)
        expect(result.response.clientDataJSON).toBe(encode(sorted))
    })

    const fields = { type: 'webauthn.create', challenge, origin }
    it.each(permutations(['type', 'challenge', 'origin'] as const))(
        'enforces the exact standard property order: %s / %s / %s',
        async (...order) => {
            const json = JSON.stringify(Object.fromEntries(order.map((key) => [key, fields[key]])))
            const result = credential(encode(json))
            if (order.join(',') === 'type,challenge,origin') {
                const { plugin } = pluginFor(result)
                expect(await plugin.createCredential({})).toBe(result)
            } else {
                await rejectedRegistration(result)
            }
            expect(result.response.clientDataJSON).toBe(encode(json))
        }
    )

    it.each([
        ['empty encoded data', ''],
        ['missing encoded data', undefined],
        ['null encoded data', null],
        ['non-string encoded data', 42],
        ['invalid base64url', '%%%'],
        ['malformed JSON', encode('{"type":"webauthn.create","challenge":"')],
        ['JSON null', encode('null')],
        ['missing challenge', encode(JSON.stringify({ type: 'webauthn.create', origin }))],
        ['empty challenge', encode(JSON.stringify({ type: 'webauthn.create', challenge: '', origin }))],
        ['non-string challenge', encode(JSON.stringify({ type: 'webauthn.create', challenge: 123, origin }))],
        ['missing type', encode(JSON.stringify({ challenge, origin }))],
        ['authentication type', encode(JSON.stringify({ type: 'webauthn.get', challenge, origin }))],
        ['whitespace before prefix', encode(` ${standard}`)],
        ['UTF-8 BOM before prefix', encode(`\ufeff${standard}`)],
        ['whitespace inside prefix', encode(standard.replace(',"challenge"', ', "challenge"'))],
    ])('rejects %s before any server continuation', async (_label, clientDataJSON) => {
        // Assign after construction so undefined means missing data, not the fixture default.
        const result = credential()
        result.response.clientDataJSON = clientDataJSON
        await rejectedRegistration(result)
    })

    it('maps the rejection to the existing provider guidance without exposing signed data in errors or telemetry', async () => {
        const error = await rejectedRegistration(credential(encode(sorted)))
        const classified = classify(error)
        expect(classified.code).toBe('PASSKEY_PROVIDER_UNSUPPORTED')
        expect(classified.message).toEqual(expect.any(String))
        expect(setupKey(classified.code)).toBe('testTransaction.errors.passkeyProviderUnsupported')

        const errorFields = Object.fromEntries(
            Object.getOwnPropertyNames(error).map((key) => [key, (error as Record<string, unknown>)[key]])
        )
        const observable = JSON.stringify({
            errorFields,
            classified,
            captures: capture.mock.calls,
            breadcrumbs: addBreadcrumb.mock.calls,
            diagnostics: nativeCapability.call.mock.calls,
        })
        for (const secret of [sorted, encode(sorted), challenge, credentialId]) {
            expect(observable).not.toContain(secret)
        }
    })

    it('releases request ownership after incompatibility so a supported retry can finish', async () => {
        const supported = credential()
        const { plugin, nativeCreate } = pluginFor(credential(encode(sorted)))
        nativeCreate.mockResolvedValueOnce(credential(encode(sorted))).mockResolvedValueOnce(supported)

        await expect(plugin.createCredential({})).rejects.toHaveProperty('name', 'PasskeyProviderUnsupportedError')
        expect(await plugin.createCredential({})).toBe(supported)
        expect(nativeCreate).toHaveBeenCalledTimes(2)
    })

    it('is idempotent when installed twice', async () => {
        const result = credential()
        const { plugin, nativeCreate } = pluginFor(result)
        const installedCreate = plugin.createCredential
        const installedGet = plugin.getCredential
        install(plugin)

        expect(plugin.createCredential).toBe(installedCreate)
        expect(plugin.getCredential).toBe(installedGet)
        expect(await plugin.createCredential({})).toBe(result)
        expect(nativeCreate).toHaveBeenCalledTimes(1)
    })

    it('does not apply registration layout policy to authentication', async () => {
        const { plugin, nativeGet, nativeCreate } = pluginFor()
        const authentication = credential(encode(JSON.stringify({ challenge, type: 'webauthn.get', origin })))
        nativeGet.mockResolvedValue(authentication)
        const options = { publicKey: { challenge: 'authentication-request' } }

        expect(await plugin.getCredential(options)).toBe(authentication)
        expect(nativeGet).toHaveBeenCalledTimes(1)
        expect(nativeGet).toHaveBeenCalledWith(expect.objectContaining(options))
        expect(nativeCreate).not.toHaveBeenCalled()
    })

    it('leaves original plugin methods untouched on unsupported platforms', async () => {
        nativeCapability.isSupportedPlatform.mockReturnValue(false)
        const originalCreate = jest.fn().mockResolvedValue(credential(encode(sorted)))
        const originalGet = jest.fn().mockResolvedValue({ untouched: true })
        const plugin = { createCredential: originalCreate, getCredential: originalGet }
        install(plugin)

        expect(plugin.createCredential).toBe(originalCreate)
        expect(plugin.getCredential).toBe(originalGet)
        expect(await plugin.createCredential({})).toBe(await originalCreate.mock.results[0].value)
    })
})
