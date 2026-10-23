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
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
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
})
