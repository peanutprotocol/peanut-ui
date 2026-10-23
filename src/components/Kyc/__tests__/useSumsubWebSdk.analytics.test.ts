/**
 * @jest-environment jsdom
 */
/**
 * The web SDK paints inside a cross-origin iframe that session replay cannot
 * record. It must report the same status and step events as the native SDK.
 */
import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'
import { useSumsubWebSdk } from '../useSumsubWebSdk'

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

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
    builder.build = () => ({ launch: jest.fn(), destroy: jest.fn() })
    ;(window as unknown as { snsWebSdk: unknown }).snsWebSdk = { init: () => builder }
}

const launchSdk = () => {
    const { result } = renderHookWithIntl(() =>
        useSumsubWebSdk({
            visible: true,
            accessToken: 'tok_abc',
            onComplete: jest.fn(),
            onRefreshToken: jest.fn().mockResolvedValue('tok_abc'),
        })
    )
    act(() => result.current.setSdkContainer(document.createElement('div')))
}

const eventsNamed = (name: string) => capture.mock.calls.filter(([event]) => event === name).map(([, data]) => data)

describe('useSumsubWebSdk analytics', () => {
    beforeEach(() => {
        capture.mockClear()
        installSdk()
    })

    afterEach(() => {
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
    })

    it('reports steps once, whichever event name the SDK version uses', () => {
        launchSdk()

        act(() => {
            sdkHandlers['idCheck.onStepInitiated']({ idDocSetType: 'IDENTITY', types: ['PASSPORT'] })
            sdkHandlers['onStepInitiated']({ idDocSetType: 'IDENTITY', types: ['PASSPORT'] })
            sdkHandlers['idCheck.onStepCompleted']({ idDocSetType: 'IDENTITY' })
        })

        expect(eventsNamed('kyc_sdk_step')).toEqual([
            { sdk: 'web', event_type: 'StepInitiated', step: 'IDENTITY' },
            { sdk: 'web', event_type: 'StepCompleted', step: 'IDENTITY' },
        ])
    })

    it('marks the status the SDK reports on launch as a snapshot, then reports real changes', () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
        launchSdk()

        act(() => {
            // a retry opens on the previous attempt's result
            sdkHandlers['onApplicantStatusChanged']({
                reviewStatus: 'completed',
                reviewResult: { reviewAnswer: 'RED' },
            })
        })
        now.mockReturnValue(1_000_000 + 60_000)
        act(() => {
            sdkHandlers['onApplicantStatusChanged']({ reviewStatus: 'pending' })
            sdkHandlers['idCheck.onApplicantStatusChanged']({ reviewStatus: 'pending' })
        })
        now.mockRestore()

        expect(eventsNamed('kyc_sdk_status_changed')).toEqual([
            { sdk: 'web', prev_status: null, new_status: 'completed', review_answer: 'RED', snapshot: true },
            { sdk: 'web', prev_status: 'completed', new_status: 'pending' },
        ])
    })
})
