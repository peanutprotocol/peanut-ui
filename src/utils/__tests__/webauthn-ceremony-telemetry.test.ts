jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

const capture = jest.fn()

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => capture(...args) },
}))

jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => true,
}))

import {
    clearCeremonyLog,
    getCeremonyLog,
    installCeremonyTelemetry,
    latestCeremony,
    openCredentialCall,
    withCeremonyFlow,
    withCeremonyPurpose,
} from '@/utils/webauthn-ceremony-telemetry'

const get = jest.fn()
const create = jest.fn()

beforeAll(() => {
    Object.defineProperty(global.navigator, 'credentials', {
        configurable: true,
        value: { get, create },
    })
    installCeremonyTelemetry()
})

beforeEach(() => {
    capture.mockClear()
    get.mockReset().mockResolvedValue({ id: 'cred' })
    create.mockReset().mockResolvedValue({ id: 'cred' })
    clearCeremonyLog()
})

const events = (name: string) => capture.mock.calls.filter(([event]) => event === name).map(([, props]) => props)

describe('webauthn ceremony telemetry', () => {
    it('records one entry per ceremony, tagged with the purpose stack', async () => {
        await withCeremonyPurpose('user_op', () =>
            navigator.credentials.get({
                publicKey: { challenge: new Uint8Array(1) } as PublicKeyCredentialRequestOptions,
            })
        )

        const log = getCeremonyLog()
        expect(log).toHaveLength(1)
        expect(log[0]).toMatchObject({ seq: 1, kind: 'get', purpose: 'user_op', outcome: 'ok', native: true })
        expect(events('webauthn_ceremony')).toHaveLength(1)
    })

    it('joins nested purposes so a migration userOp is distinguishable from a payment one', async () => {
        await withCeremonyPurpose('kernel_migration', () =>
            withCeremonyPurpose('user_op', () => navigator.credentials.get({}))
        )

        expect(getCeremonyLog()[0].purpose).toBe('kernel_migration>user_op')
    })

    it('labels an unattributed ceremony rather than dropping it', async () => {
        await navigator.credentials.create({})

        expect(getCeremonyLog()[0]).toMatchObject({ kind: 'create', purpose: 'unknown' })
    })

    it('records a failed ceremony with its classified code, and rethrows', async () => {
        const error = new Error('cancelled')
        error.name = 'NotAllowedError'
        get.mockRejectedValueOnce(error)

        await expect(withCeremonyPurpose('login', () => navigator.credentials.get({}))).rejects.toThrow('cancelled')

        expect(getCeremonyLog()[0]).toMatchObject({
            outcome: 'error',
            errorName: 'NotAllowedError',
            errorCode: 'LOGIN_CANCELED',
        })
    })

    it('counts every native device failure and its later successful recovery without raw error data', async () => {
        const error = Object.assign(
            new Error('The operation couldn’t be completed. Device must be unlocked to perform request.'),
            { name: 'NotAllowedError' }
        )
        get.mockRejectedValueOnce(error)
        await expect(withCeremonyPurpose('login', () => navigator.credentials.get({}))).rejects.toBe(error)
        await withCeremonyPurpose('login', () => navigator.credentials.get({}))
        const ceremonies = events('webauthn_ceremony')
        expect(ceremonies).toHaveLength(2)
        expect(ceremonies[0]).toMatchObject({
            outcome: 'error',
            native_reason: 'device_locked',
            error_code: 'PASSKEY_DEVICE_LOCKED',
        })
        expect(ceremonies[0]).not.toHaveProperty('message')
        expect(ceremonies[1]).toMatchObject({ outcome: 'ok' })
    })

    it('records the platform code of an ambiguous refusal, never the message', async () => {
        const error = Object.assign(
            new Error(
                'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)'
            ),
            { name: 'NotAllowedError' }
        )
        create.mockRejectedValueOnce(error)
        await expect(withCeremonyPurpose('registration', () => navigator.credentials.create({}))).rejects.toBe(error)
        const [ceremony] = events('webauthn_ceremony')
        expect(ceremony).toMatchObject({
            outcome: 'error',
            error_code: 'LOGIN_CANCELED',
            native_error_code: 'AuthorizationError:1000',
        })
        expect(ceremony.native_reason).toBeUndefined()
        expect(JSON.stringify(ceremony)).not.toContain('operation couldn')
    })

    it('counts every ceremony a flow triggered — the 2-vs-3 prompt question', async () => {
        await withCeremonyFlow(
            'link_create',
            async () => {
                await withCeremonyPurpose('admin_eip712', () => navigator.credentials.get({}))
                await withCeremonyPurpose('user_op', () => navigator.credentials.get({}))
            },
            () => ({ strategy: 'mixed' })
        )

        const [flow] = events('webauthn_ceremony_flow')
        expect(flow).toMatchObject({
            flow: 'link_create',
            ceremony_count: 2,
            purposes: ['admin_eip712', 'user_op'],
            outcome: 'ok',
            strategy: 'mixed',
        })
        expect(getCeremonyLog().every((record) => record.flow === 'link_create')).toBe(true)
    })

    it('still reports the flow when it fails mid-ceremony', async () => {
        get.mockRejectedValueOnce(new Error('boom'))

        await expect(
            withCeremonyFlow('link_create', () => withCeremonyPurpose('user_op', () => navigator.credentials.get({})))
        ).rejects.toThrow('boom')

        expect(events('webauthn_ceremony_flow')[0]).toMatchObject({ ceremony_count: 1, outcome: 'error' })
    })

    it('keeps an annotation recorded before the failure — a cancelled mixed link stays segmentable', async () => {
        get.mockRejectedValueOnce(new Error('NotAllowedError'))
        let strategy: string | undefined

        await expect(
            withCeremonyFlow(
                'link_create',
                async () => {
                    strategy = 'mixed'
                    return withCeremonyPurpose('admin_eip712', () => navigator.credentials.get({}))
                },
                () => ({ strategy })
            )
        ).rejects.toThrow('NotAllowedError')

        expect(events('webauthn_ceremony_flow')[0]).toMatchObject({ outcome: 'error', strategy: 'mixed' })
    })

    it('measures the gap between back-to-back sheets', async () => {
        await withCeremonyPurpose('user_op', () => navigator.credentials.get({}))
        await withCeremonyPurpose('user_op', () => navigator.credentials.get({}))

        const log = getCeremonyLog()
        expect(log[0].gapMs).toBeNull()
        expect(log[1].gapMs).not.toBeNull()
    })

    it('flags a ceremony that overlapped another one, so its attribution reads as a guess', async () => {
        let release: (value: unknown) => void = () => {}
        get.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))

        const first = withCeremonyPurpose('user_op', () => navigator.credentials.get({}))
        await withCeremonyPurpose('app_lock', () => navigator.credentials.get({}))
        release({ id: 'cred' })
        await first

        // The crossed stacks are the known limit of ambient attribution: app_lock
        // inherits the still-open user_op frame. That is exactly what `overlapped`
        // exists to disclose, so the row is readable as a guess rather than evidence.
        const [second] = getCeremonyLog().filter((record) => record.seq === 2)
        expect(second).toMatchObject({ purpose: 'user_op>app_lock', overlapped: true })
        expect(getCeremonyLog().find((record) => record.seq === 1)?.overlapped).toBe(false)
    })

    it('survives a telemetry sink that throws — the ceremony still resolves', async () => {
        capture.mockImplementationOnce(() => {
            throw new Error('posthog not initialised')
        })

        await expect(withCeremonyPurpose('user_op', () => navigator.credentials.get({}))).resolves.toEqual({
            id: 'cred',
        })
        expect(getCeremonyLog()).toHaveLength(1)
    })

    it('reports the newest OS call still pending, and nothing once it settles', async () => {
        let settle!: (value: unknown) => void
        get.mockReturnValueOnce(new Promise((resolve) => (settle = resolve)))
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000)
        try {
            const pending = navigator.credentials.get({})
            expect(openCredentialCall()).toEqual({ inFlight: true, elapsedMs: 0 })
            nowSpy.mockReturnValue(61_000)
            expect(openCredentialCall()).toEqual({ inFlight: true, elapsedMs: 60_000 })

            settle({ id: 'cred' })
            await pending
            expect(openCredentialCall()).toEqual({ inFlight: false })
        } finally {
            nowSpy.mockRestore()
        }
    })

    describe('clientDataJSON layout (TASK-23931)', () => {
        const challenge = 'dGVzdC1jaGFsbGVuZ2UtdmFsdWU'
        const sortedGet = `{"androidPackageName":"me.peanut.wallet","challenge":"${challenge}","origin":"android:apk-key-hash:x","type":"webauthn.get"}`
        const standardGet = `{"type":"webauthn.get","challenge":"${challenge}","origin":"https://peanut.me"}`
        const standardCreate = `{"type":"webauthn.create","challenge":"${challenge}","origin":"https://peanut.me"}`
        // the native shim hands both fields over as ArrayBuffers
        const clientData = (json: string) => new TextEncoder().encode(json)
        const authenticatorData = (flags: number) => {
            const bytes = new Uint8Array(37)
            bytes[32] = flags
            return bytes.buffer
        }

        it('records a sorted-keys assertion from a device-bound passkey, never the challenge', async () => {
            get.mockResolvedValueOnce({
                response: { clientDataJSON: clientData(sortedGet), authenticatorData: authenticatorData(0x05) },
            })
            await withCeremonyPurpose('user_op', () => navigator.credentials.get({}))

            expect(getCeremonyLog()[0]).toMatchObject({ challengeOffset: 41, backupEligible: false })
            expect(events('webauthn_ceremony')[0]).toMatchObject({ challenge_offset: 41, backup_eligible: false })
            const { addBreadcrumb } = jest.requireMock('@sentry/nextjs')
            expect(JSON.stringify([capture.mock.calls, addBreadcrumb.mock.calls])).not.toContain(challenge)
        })

        it('records the standard layouts: 23 for an assertion, 26 for a registration', async () => {
            get.mockResolvedValueOnce({
                response: { clientDataJSON: clientData(standardGet), authenticatorData: authenticatorData(0x1d) },
            })
            create.mockResolvedValueOnce({ response: { clientDataJSON: clientData(standardCreate) } })
            await withCeremonyPurpose('user_op', () => navigator.credentials.get({}))
            await withCeremonyPurpose('registration', () => navigator.credentials.create({}))

            const [assertion, registration] = events('webauthn_ceremony')
            expect(assertion).toMatchObject({ challenge_offset: 23, backup_eligible: true })
            expect(registration).toMatchObject({ challenge_offset: 26, backup_eligible: undefined })
        })

        it('records neither fact when the shim hands over empty buffers', async () => {
            const empty = { response: { clientDataJSON: new ArrayBuffer(0), authenticatorData: new ArrayBuffer(0) } }
            get.mockResolvedValueOnce(empty)

            await expect(withCeremonyPurpose('user_op', () => navigator.credentials.get({}))).resolves.toBe(empty)
            expect(getCeremonyLog()[0]).toMatchObject({ outcome: 'ok' })
            expect(getCeremonyLog()[0]).not.toHaveProperty('challengeOffset')
            expect(getCeremonyLog()[0]).not.toHaveProperty('backupEligible')
        })

        it('finds the newest user_op assertion of the current attempt only', async () => {
            const nowSpy = jest.spyOn(Date, 'now')
            try {
                nowSpy.mockReturnValue(1_000)
                await withCeremonyPurpose('user_op', () => navigator.credentials.get({}))
                nowSpy.mockReturnValue(2_000)
                get.mockResolvedValueOnce({
                    response: { clientDataJSON: clientData(sortedGet), authenticatorData: authenticatorData(0x05) },
                })
                await withCeremonyPurpose('kernel_migration', () =>
                    withCeremonyPurpose('user_op', () => navigator.credentials.get({}))
                )
                nowSpy.mockReturnValue(3_000)
                await withCeremonyPurpose('login', () => navigator.credentials.get({}))

                expect(latestCeremony('get', 'user_op', 1_500)).toMatchObject({ seq: 2, challengeOffset: 41 })
                expect(latestCeremony('get', 'user_op', 2_500)).toBeUndefined()
            } finally {
                nowSpy.mockRestore()
            }
        })
    })

    it('patches navigator.credentials only once', async () => {
        const patched = navigator.credentials.get
        installCeremonyTelemetry()

        expect(navigator.credentials.get).toBe(patched)
    })
})

describe('after a reload in the same browser session', () => {
    it("keeps the tester's earlier ceremonies and continues the sequence", async () => {
        const earlier = {
            seq: 7,
            kind: 'get',
            purpose: 'admin_eip712',
            flow: 'link_create',
            flowId: 'link_create-1-1',
            startedAt: Date.now() - 5000,
            durationMs: 10,
            gapMs: null,
            outcome: 'ok',
            native: true,
            overlapped: false,
            openFlows: 1,
        }
        window.sessionStorage.setItem('__webauthn_ceremony_log', JSON.stringify([earlier]))

        jest.resetModules()
        const fresh = await import('@/utils/webauthn-ceremony-telemetry')
        fresh.installCeremonyTelemetry()
        await fresh.withCeremonyPurpose('user_op', () => navigator.credentials.get({}))

        const log = fresh.getCeremonyLog()
        expect(log.map((record) => record.seq)).toEqual([7, 8])
        expect(log[1]).toMatchObject({ purpose: 'user_op' })
        expect(log[1].gapMs).not.toBeNull()
    })
})
