/**
 * @jest-environment jsdom
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'
import { useSumsubWebSdk } from '../useSumsubWebSdk'

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

const launch = jest.fn()
const sdkHandlers: Record<string, (payload?: unknown) => void> = {}

function installSdk() {
    Object.keys(sdkHandlers).forEach((key) => delete sdkHandlers[key])
    const builder: Record<string, unknown> = {}
    builder.withConf = () => builder
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
    beforeEach(() => {
        jest.clearAllMocks()
        installSdk()
    })

    afterEach(() => {
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
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
