import type { CapacitorPasskeyPlugin } from '@capgo/capacitor-passkey'

const mockCall = jest.fn()
const mockSetAuthToken = jest.fn()
jest.mock('../native-capability', () => ({
    nativeCapability: () => ({ call: mockCall, isSupportedPlatform: () => true }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('../sentry-lazy', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }))
jest.mock('../capacitor', () => ({ isCapacitor: () => true }))
jest.mock('../auth-token', () => ({ setAuthToken: mockSetAuthToken }))
jest.mock('@/services/step-up-cache', () => ({ setCachedStepUpToken: jest.fn() }))
jest.mock('../webauthn-ceremony-telemetry', () => ({ openCredentialCall: () => undefined }))

const API = 'https://api.peanut.me/passkeys'

const deferred = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((yes) => {
        resolve = yes
    })
    return { promise, resolve }
}

// jsdom has no Response; the capture wrapper only touches ok/status/clone/json/text.
const jsonResponse = (body: unknown): Response => {
    const response = {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: () => response,
    }
    return response as unknown as Response
}

const routes = new Map<string, Array<Promise<Response>>>()
const mockFetch = jest.fn((input: string) => {
    const path = input.replace(API, '')
    const next = routes.get(path)?.shift()
    if (!next) throw new Error(`unexpected fetch ${path}`)
    return next
})
const queue = (path: string) => {
    const reply = deferred<Response>()
    routes.set(path, [...(routes.get(path) ?? []), reply.promise])
    return { respond: (body: unknown) => reply.resolve(jsonResponse(body)) }
}

// The ZeroDev SDK's login path: options fetch -> native get -> verify fetch.
const login = (plugin: CapacitorPasskeyPlugin) => async () => {
    const options = await (await window.fetch(`${API}/login/options`, { method: 'POST' })).json()
    const credential = await plugin.getCredential({ publicKey: { challenge: options.challenge } } as never)
    await (await window.fetch(`${API}/login/verify`, { method: 'POST' })).json()
    return credential
}
// Its register path nests the options one level down.
const register = (plugin: CapacitorPasskeyPlugin) => async () => {
    const { options } = await (await window.fetch(`${API}/register/options`, { method: 'POST' })).json()
    return plugin.createCredential({ publicKey: { challenge: options.challenge } } as never)
}

async function setup() {
    jest.resetModules()
    routes.clear()
    window.fetch = mockFetch as unknown as typeof fetch
    ;(globalThis as Record<string, unknown>).__capgoPasskeyShimInstalled = true
    const { installPasskeyVerifyCapture } = await import('../passkey-auth-capture')
    const { installAndroidPasskeyControl } = await import('../android-passkey-control')
    const { guardPasskeyCeremony } = await import('../passkeyCeremony.utils')
    const scopes = await import('../android-passkey-scope')
    installPasskeyVerifyCapture()
    const raw = { getCredential: jest.fn(), createCredential: jest.fn() }
    const plugin = { ...raw } as unknown as CapacitorPasskeyPlugin
    installAndroidPasskeyControl(plugin)
    const challengesSeen = (method: 'getCredential' | 'createCredential') =>
        raw[method].mock.calls.map(([options]) => options.publicKey.challenge)
    return { guardPasskeyCeremony, plugin, raw, challengesSeen, scopes }
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockCall.mockImplementation(async (method: string) =>
        method === 'cancelRequest' ? { cancelled: true, released: true } : { pluginVersion: '8.2.2-peanut.2' }
    )
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('an SDK operation that never settles is retired after the grace; the next login works and the stale prompt never opens', async () => {
    const { guardPasskeyCeremony, plugin, raw, challengesSeen } = await setup()
    const staleOptions = queue('/login/options')
    const first = guardPasskeyCeremony(login(plugin)).catch((error: Error) => error)
    await jest.advanceTimersByTimeAsync(60_000)
    await expect(first).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })

    queue('/login/options').respond({ challenge: 'fresh-challenge' })
    queue('/login/verify').respond({ verification: { verified: true } })
    raw.getCredential.mockResolvedValue('fresh credential')
    const second = guardPasskeyCeremony(login(plugin))
    await jest.advanceTimersByTimeAsync(2_000)
    await expect(second).resolves.toBe('fresh credential')

    // The abandoned flow wakes up after it was retired: its prompt is refused before native.
    staleOptions.respond({ challenge: 'stale-challenge' })
    await jest.advanceTimersByTimeAsync(0)
    expect(challengesSeen('getCredential')).toEqual(['fresh-challenge'])
})

it('a stale native call while a newer ceremony is live is refused, and the newer call proceeds', async () => {
    const { guardPasskeyCeremony, plugin, raw, challengesSeen } = await setup()
    const staleOptions = queue('/register/options')
    const stale = guardPasskeyCeremony(register(plugin)).catch((error: Error) => error)
    await jest.advanceTimersByTimeAsync(60_000)
    await expect(stale).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })

    const liveOptions = queue('/login/options')
    queue('/login/verify').respond({ verification: { verified: true } })
    raw.getCredential.mockResolvedValue('live credential')
    const live = guardPasskeyCeremony(login(plugin))
    await jest.advanceTimersByTimeAsync(2_000)

    staleOptions.respond({ options: { challenge: 'stale-registration' } })
    await jest.advanceTimersByTimeAsync(0)
    // No stale prompt, so no passkey can be registered server-side for the abandoned signup.
    expect(raw.createCredential).not.toHaveBeenCalled()

    liveOptions.respond({ challenge: 'live-challenge' })
    await expect(live).resolves.toBe('live credential')
    expect(challengesSeen('getCredential')).toEqual(['live-challenge'])
})

it('a late verify from the retired flow cannot persist auth into the newer ceremony', async () => {
    const { guardPasskeyCeremony, plugin, raw } = await setup()
    queue('/login/options').respond({ challenge: 'old-challenge' })
    const staleVerify = queue('/login/verify')
    raw.getCredential.mockResolvedValue('credential')
    const first = guardPasskeyCeremony(login(plugin)).catch((error: Error) => error)
    await jest.advanceTimersByTimeAsync(60_000)
    await expect(first).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })

    const newVerify = queue('/login/verify')
    queue('/login/options').respond({ challenge: 'new-challenge' })
    const second = guardPasskeyCeremony(login(plugin))
    await jest.advanceTimersByTimeAsync(2_000)
    staleVerify.respond({ verification: { verified: true }, token: 'stale-session' })
    await jest.advanceTimersByTimeAsync(0)
    newVerify.respond({ verification: { verified: true } })
    await expect(second).resolves.toBe('credential')
    expect(mockSetAuthToken).not.toHaveBeenCalled()
})

it('signing after a retired flow uses its own challenge and still runs', async () => {
    const { guardPasskeyCeremony, plugin, raw, challengesSeen } = await setup()
    const staleOptions = queue('/login/options')
    void guardPasskeyCeremony(login(plugin)).catch(() => {})
    await jest.advanceTimersByTimeAsync(60_000)

    const signature = deferred<unknown>()
    raw.getCredential.mockReturnValue(signature.promise)
    // Signing has no options fetch: its challenge is the user-op hash, used within the same tick.
    const sign = guardPasskeyCeremony(() => plugin.getCredential({ publicKey: { challenge: 'user-op-hash' } } as never))
    await jest.advanceTimersByTimeAsync(2_000)
    staleOptions.respond({ challenge: 'stale-challenge' })
    await jest.advanceTimersByTimeAsync(0)
    signature.resolve('signature')
    await expect(sign).resolves.toBe('signature')
    expect(challengesSeen('getCredential')).toEqual(['user-op-hash'])
})

it('a second tap while the first ceremony is live is still a conflict', async () => {
    const { guardPasskeyCeremony, plugin } = await setup()
    queue('/login/options')
    void guardPasskeyCeremony(login(plugin)).catch(() => {})
    await jest.advanceTimersByTimeAsync(30_000)
    await expect(guardPasskeyCeremony(login(plugin))).rejects.toMatchObject({ name: 'CeremonyConflictError' })
})

it('a challenge no options response announced falls back to the current scope', async () => {
    const { plugin, raw, scopes } = await setup()
    raw.getCredential.mockResolvedValue('credential')
    const live = scopes.beginAndroidPasskeyScope()!
    await expect(plugin.getCredential({ publicKey: { challenge: 'unknown' } } as never)).resolves.toBe('credential')
    live.expire()
    await expect(plugin.getCredential({ publicKey: { challenge: 'unknown' } } as never)).rejects.toMatchObject({
        name: 'CeremonyTimeoutError',
    })
    expect(raw.getCredential).toHaveBeenCalledTimes(1)
})
