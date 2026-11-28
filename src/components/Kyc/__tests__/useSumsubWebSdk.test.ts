/**
 * @jest-environment jsdom
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'
import { useSumsubWebSdk } from '../useSumsubWebSdk'

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

const launch = jest.fn()
const configure = jest.fn()
const sdkHandlers: Record<string, (payload?: unknown) => void> = {}

function installSdk() {
    Object.keys(sdkHandlers).forEach((key) => delete sdkHandlers[key])
    const builder: Record<string, unknown> = {}
    builder.withConf = (conf: unknown) => {
        configure(conf)
        return builder
    }
    builder.withOptions = () => builder
    builder.on = (event: string, handler: (payload?: unknown) => void) => {
        sdkHandlers[event] = handler
        return builder
    }
    builder.build = () => ({ launch, destroy: jest.fn() })
    ;(window as unknown as { snsWebSdk: unknown }).snsWebSdk = { init: () => builder }
}

const baseArgs = () => ({
    visible: true,
    accessToken: 'tok_abc',
    onComplete: jest.fn(),
    onRefreshToken: jest.fn().mockResolvedValue('tok_abc'),
})

describe('useSumsubWebSdk', () => {
    it('preselects the saved document and skips the Sumsub document list', () => {
        const documentConfig = {
            documentDefinitions: { IDENTITY: { country: 'PRT', idDocType: 'RESIDENCE_PERMIT' } },
            autoSelectDocumentDefinitions: true as const,
        }
        const { result } = renderHookWithIntl(() => useSumsubWebSdk({ ...baseArgs(), documentConfig }))
        act(() => result.current.setSdkContainer(document.createElement('div')))
        expect(configure).toHaveBeenCalledWith(expect.objectContaining(documentConfig))
    })
    beforeEach(() => {
        jest.clearAllMocks()
        installSdk()
    })

    afterEach(() => {
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
    })

    it('uses the one Peanut appearance set, whatever the level picks', () => {
        const { result } = renderHookWithIntl(() => useSumsubWebSdk(baseArgs()))
        act(() => result.current.setSdkContainer(document.createElement('div')))
        expect(configure).toHaveBeenCalledWith(
            expect.objectContaining({ theme: 'light', customizationName: 'Peanut_DS_20261123' })
        )
    })

    it('launches the SDK once the container attaches', () => {
        const { result } = renderHookWithIntl(() => useSumsubWebSdk(baseArgs()))
        expect(launch).not.toHaveBeenCalled()

        const container = document.createElement('div')
        act(() => {
            result.current.setSdkContainer(container)
        })

        expect(launch).toHaveBeenCalledTimes(1)
        expect(launch).toHaveBeenCalledWith(container)
        expect(capture).toHaveBeenCalledWith('kyc_sdk_launched', expect.anything())
        expect(result.current.sdkLoadError).toBe(false)
    })

    it('prefills the email once without relaunching over an in-progress email edit', () => {
        const args = baseArgs()
        const { result, rerender } = renderHookWithIntl(({ email }) => useSumsubWebSdk({ ...args, email }), {
            initialProps: { email: 'signup@example.com' },
        })
        act(() => result.current.setSdkContainer(document.createElement('div')))
        expect(configure).toHaveBeenCalledWith(expect.objectContaining({ email: 'signup@example.com' }))
        rerender({ email: 'updated-profile@example.com' })
        expect(launch).toHaveBeenCalledTimes(1)
        expect(configure).toHaveBeenCalledTimes(1)
    })

    it('routes a single-level submit to onComplete and flips hasSubmittedRef', () => {
        const args = baseArgs()
        const { result } = renderHookWithIntl(() => useSumsubWebSdk(args))
        act(() => {
            result.current.setSdkContainer(document.createElement('div'))
        })
        expect(result.current.hasSubmittedRef.current).toBe(false)

        act(() => {
            sdkHandlers['onApplicantSubmitted']?.()
        })

        expect(args.onComplete).toHaveBeenCalledTimes(1)
        expect(result.current.hasSubmittedRef.current).toBe(true)
    })

    it('does not launch without an access token, and the watchdog surfaces the stall', () => {
        jest.useFakeTimers()
        try {
            const { result } = renderHookWithIntl(() => useSumsubWebSdk({ ...baseArgs(), accessToken: null }))
            act(() => {
                result.current.setSdkContainer(document.createElement('div'))
            })
            expect(launch).not.toHaveBeenCalled()
            expect(result.current.sdkLoadError).toBe(false)

            act(() => {
                jest.advanceTimersByTime(20_000)
            })

            expect(result.current.sdkLoadError).toBe(true)
            expect(capture).toHaveBeenCalledWith(
                'kyc_sdk_launch_timeout',
                expect.objectContaining({ hadAccessToken: false })
            )
        } finally {
            jest.useRealTimers()
        }
    })

    it('resets error and submission state when hidden', () => {
        const args = baseArgs()
        const { result, rerender } = renderHookWithIntl(
            ({ visible }: { visible: boolean }) => useSumsubWebSdk({ ...args, visible }),
            { initialProps: { visible: true } }
        )
        act(() => {
            result.current.setSdkContainer(document.createElement('div'))
        })
        act(() => {
            sdkHandlers['onApplicantSubmitted']?.()
        })
        expect(result.current.hasSubmittedRef.current).toBe(true)

        rerender({ visible: false })

        expect(result.current.hasSubmittedRef.current).toBe(false)
        expect(result.current.sdkLoadError).toBe(false)
    })
})

describe('SDK credential lifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        installSdk()
    })
    afterEach(() => {
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
    })
    it('refreshing the token preserves the mounted questionnaire; changing session replaces it', () => {
        let token = 'first'
        let sessionKey = 'session:0'
        const { result, rerender } = renderHookWithIntl(() =>
            useSumsubWebSdk({ ...baseArgs(), accessToken: token, sessionKey })
        )
        act(() => result.current.setSdkContainer(document.createElement('div')))
        expect(launch).toHaveBeenCalledTimes(1)
        token = 'refreshed'
        rerender()
        expect(launch).toHaveBeenCalledTimes(1)
        sessionKey = 'session:1'
        rerender()
        expect(launch).toHaveBeenCalledTimes(2)
    })
})

describe('SDK script load failure (TASK-21426)', () => {
    const sdkScript = () => document.getElementById('sumsub-websdk')
    const failScript = () => act(() => void sdkScript()!.dispatchEvent(new Event('error')))

    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
    })
    afterEach(() => {
        jest.useRealTimers()
        sdkScript()?.remove()
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
    })

    it('removes the failed script and reloads it once before it reports an error', () => {
        const { result } = renderHookWithIntl(() => useSumsubWebSdk(baseArgs()))
        const first = sdkScript()
        expect(first).not.toBeNull()

        failScript()
        expect(sdkScript()).toBeNull()
        expect(result.current.sdkLoadError).toBe(false)

        act(() => void jest.advanceTimersByTime(2_000))
        const second = sdkScript()
        expect(second).not.toBeNull()
        expect(second).not.toBe(first)

        failScript()
        expect(sdkScript()).toBeNull()
        expect(result.current.sdkLoadError).toBe(true)
    })

    it('launches the SDK when the reloaded script arrives', () => {
        const { result } = renderHookWithIntl(() => useSumsubWebSdk(baseArgs()))
        act(() => result.current.setSdkContainer(document.createElement('div')))
        failScript()
        act(() => void jest.advanceTimersByTime(2_000))

        installSdk()
        act(() => void sdkScript()!.dispatchEvent(new Event('load')))

        expect(launch).toHaveBeenCalledTimes(1)
        expect(result.current.sdkLoadError).toBe(false)
    })

    it('loads the script again when the modal opens after a failed preload', () => {
        const args = baseArgs()
        const { result, rerender } = renderHookWithIntl(
            ({ visible }: { visible: boolean }) => useSumsubWebSdk({ ...args, visible }),
            { initialProps: { visible: false } }
        )
        failScript()
        act(() => void jest.advanceTimersByTime(2_000))
        failScript()
        expect(result.current.sdkLoadError).toBe(true)

        rerender({ visible: true })

        expect(result.current.sdkLoadError).toBe(false)
        expect(sdkScript()).not.toBeNull()
    })
})
