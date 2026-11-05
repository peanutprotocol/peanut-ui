jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * The native SDK screen is invisible to session replay, so its handlers are
 * the only record of what the user did there. These tests pin the events the
 * component forwards from the Cordova plugin.
 */
import { act, render as rtlRender, waitFor } from '@testing-library/react'
import { type ReactElement, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { SumsubNativeSdk } from '../SumsubNativeSdk'

const IntlWrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en}>
        {children}
    </NextIntlClientProvider>
)
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))
const captureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a) }))
jest.mock('@/components/Global/Modal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/capacitor', () => ({ isAndroidNativeBridge: () => false }))

const launch = jest.fn()
let handlers: SNSMobileSDKHandlers = {}

function installSdk() {
    const builder: Record<string, unknown> = {}
    builder.withHandlers = (h: SNSMobileSDKHandlers) => {
        handlers = h
        return builder
    }
    builder.withLocale = () => builder
    builder.withDebug = () => builder
    builder.withApplicantConf = () => builder
    builder.build = () => ({ launch, dismiss: jest.fn(), sendEvent: jest.fn(), getNewAccessToken: jest.fn() })
    ;(window as unknown as { SNSMobileSDK: unknown }).SNSMobileSDK = { init: () => builder, reset: jest.fn() }
}

const props = () => ({
    accessToken: 'tok_abc',
    onClose: jest.fn(),
    onComplete: jest.fn(),
    onRefreshToken: jest.fn().mockResolvedValue('tok_abc'),
})

const eventsNamed = (name: string) => capture.mock.calls.filter(([event]) => event === name).map(([, data]) => data)

describe('SumsubNativeSdk analytics', () => {
    beforeEach(() => {
        capture.mockClear()
        captureException.mockClear()
        handlers = {}
        launch.mockReset().mockReturnValue(new Promise(() => {}))
        installSdk()
    })

    afterEach(() => {
        delete (window as unknown as { SNSMobileSDK?: unknown }).SNSMobileSDK
    })

    it('forwards status changes and steps from the native screen', async () => {
        await act(async () => {
            render(<SumsubNativeSdk visible {...props()} />)
        })

        act(() => {
            handlers.onEvent?.({ eventType: 'StepInitiated', payload: { idDocSetType: 'IDENTITY' } })
            handlers.onEvent?.({
                eventType: 'StepCompleted',
                payload: { idDocSetType: 'IDENTITY', isCancelled: false },
            })
            handlers.onStatusChanged?.({ prevStatus: 'Incomplete', newStatus: 'Pending' })
        })

        expect(eventsNamed('kyc_sdk_step')).toEqual([
            { sdk: 'native', event_type: 'StepInitiated', step: 'IDENTITY' },
            { sdk: 'native', event_type: 'StepCompleted', step: 'IDENTITY' },
        ])
        expect(eventsNamed('kyc_sdk_status_changed')).toEqual([
            { sdk: 'native', prev_status: 'Incomplete', new_status: 'Pending' },
        ])
    })

    it('tells the caller the ID step is done, not when it was cancelled or another step ended', async () => {
        const identityDone = jest.fn()
        await act(async () => {
            render(<SumsubNativeSdk visible {...props()} onIdentityStepCompleted={identityDone} />)
        })

        act(() => {
            handlers.onEvent?.({ eventType: 'StepCompleted', payload: { idDocSetType: 'IDENTITY', isCancelled: true } })
            handlers.onEvent?.({ eventType: 'StepCompleted', payload: { idDocSetType: 'SELFIE' } })
            handlers.onEvent?.({
                eventType: 'StepCompleted',
                payload: { idDocSetType: 'IDENTITY', isCancelled: false },
            })
        })

        expect(identityDone).toHaveBeenCalledTimes(1)
    })

    it('reports how the native screen closed', async () => {
        launch.mockResolvedValue({ success: true, status: 'Pending' })

        await act(async () => {
            render(<SumsubNativeSdk visible {...props()} />)
        })

        await waitFor(() =>
            expect(eventsNamed('kyc_sdk_closed')).toEqual([
                { sdk: 'native', status: 'Pending', success: true, error_type: null },
            ])
        )
    })

    it('reports a failed close by error type without the error message', async () => {
        launch.mockResolvedValue({ success: false, status: 'Failed', errorType: 'Network', errorMsg: 'offline' })

        await act(async () => {
            render(<SumsubNativeSdk visible {...props()} />)
        })

        await waitFor(() =>
            expect(eventsNamed('kyc_sdk_closed')).toEqual([
                { sdk: 'native', status: 'Failed', success: false, error_type: 'Network' },
            ])
        )
    })

    it('reports the SDK error behind a failed close, with its text kept out of PostHog', async () => {
        const errorDetail = {
            source: 'SNSVerificationStepViewModel',
            message: 'Verification step. Error building state',
            causes: ['com.sumsub.sns.core.data.model.SNSException$Network', 'java.net.SocketException'],
            chain: 'SNSException$Network: java.net.SocketException: Connection reset',
            ageMs: 40,
        }
        launch.mockResolvedValue({
            success: false,
            status: 'Failed',
            errorType: 'Unknown',
            errorMsg: 'Verification step. Error building state',
            errorDetail,
        })

        await act(async () => {
            render(<SumsubNativeSdk visible {...props()} />)
        })

        await waitFor(() => expect(eventsNamed('kyc_sdk_init_failed')).toHaveLength(1))
        expect(eventsNamed('kyc_sdk_init_failed')[0]).toMatchObject({
            reason: 'Unknown',
            error_source: 'SNSVerificationStepViewModel',
            error_root_cause: 'java.net.SocketException',
            error_age_ms: 40,
        })
        expect(JSON.stringify(eventsNamed('kyc_sdk_init_failed')[0])).not.toContain('Connection reset')
        expect(captureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                tags: expect.objectContaining({ sumsub_root_cause: 'java.net.SocketException' }),
                extra: expect.objectContaining({ nativeError: errorDetail }),
            })
        )
    })

    it('keeps the text of a failed native close out of PostHog and in Sentry', async () => {
        const errorMsg = 'Phone +5491155550000 of applicant maria@example.com is not allowed'
        launch.mockResolvedValue({ success: false, status: 'Failed', errorType: 'Unknown', errorMsg })

        await act(async () => {
            render(<SumsubNativeSdk visible {...props()} />)
        })

        await waitFor(() => expect(eventsNamed('kyc_sdk_init_failed')).toHaveLength(1))
        const event = eventsNamed('kyc_sdk_init_failed')[0]
        expect(event).toEqual({ reason: 'Unknown' })
        expect(JSON.stringify(event)).not.toContain('maria@example.com')
        expect(JSON.stringify(event)).not.toContain('5491155550000')
        expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ message: errorMsg }), expect.anything())
    })

    it('still reports the message of a failure raised outside the SDK', async () => {
        launch.mockRejectedValue(new Error('Access token is required'))

        await act(async () => {
            render(<SumsubNativeSdk visible {...props()} />)
        })

        await waitFor(() =>
            expect(eventsNamed('kyc_sdk_init_failed')).toEqual([
                { reason: 'launch-rejected', message: 'Access token is required' },
            ])
        )
    })
})
