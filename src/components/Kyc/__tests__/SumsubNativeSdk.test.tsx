import { act, render as rtlRender, screen, waitFor, type RenderOptions } from '@testing-library/react'
import { type ReactElement, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { SumsubNativeSdk } from '../SumsubNativeSdk'

const IntlWrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en}>
        {children}
    </NextIntlClientProvider>
)
const render = (ui: ReactElement, options?: RenderOptions) => rtlRender(ui, { wrapper: IntlWrapper, ...options })

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

const captureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a) }))

jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: function MockModal({ visible, children }: { visible: boolean; children: ReactNode }) {
        if (!visible) return null
        return <div data-testid="modal">{children}</div>
    },
}))

const launch = jest.fn()
const dismiss = jest.fn()
let statusHandler: ((event: { newStatus?: string }) => void) | undefined

function installSdk() {
    const builder: Record<string, unknown> = {}
    builder.withHandlers = (handlers: { onStatusChanged?: (e: { newStatus?: string }) => void }) => {
        statusHandler = handlers.onStatusChanged
        return builder
    }
    builder.withLocale = () => builder
    builder.withDebug = () => builder
    builder.build = () => ({ launch, dismiss })
    ;(window as unknown as { SNSMobileSDK: unknown }).SNSMobileSDK = { init: () => builder }
}

const baseProps = () => ({
    accessToken: 'tok_abc',
    onClose: jest.fn(),
    onComplete: jest.fn(),
    onRefreshToken: jest.fn().mockResolvedValue('tok_abc'),
})

describe('SumsubNativeSdk', () => {
    beforeEach(() => {
        launch.mockReset()
        dismiss.mockReset()
        capture.mockClear()
        captureException.mockClear()
        statusHandler = undefined
        launch.mockReturnValue(new Promise(() => {}))
        installSdk()
    })

    afterEach(() => {
        delete (window as unknown as { SNSMobileSDK?: unknown }).SNSMobileSDK
    })

    it('launches the native SDK when opened, and not before', async () => {
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)
        expect(launch).not.toHaveBeenCalled()

        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        expect(launch).toHaveBeenCalledTimes(1)
        expect(capture).toHaveBeenCalledWith('kyc_sdk_launched', { platform: 'native' })
    })

    it('does not launch without an access token', async () => {
        await act(async () => {
            render(<SumsubNativeSdk visible {...baseProps()} accessToken={null} />)
        })
        expect(launch).not.toHaveBeenCalled()
    })

    // refreshToken() writes a new token into the same state while the native
    // screen is up. Relaunching on that would dismiss the SDK out from under a
    // user mid-verification, so the effect keys on token PRESENCE, not identity.
    it('does not relaunch when the access token is refreshed mid-flow', async () => {
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)
        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })
        expect(launch).toHaveBeenCalledTimes(1)

        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} accessToken="tok_refreshed" />)
        })

        expect(launch).toHaveBeenCalledTimes(1)
        expect(dismiss).not.toHaveBeenCalled()
    })

    it('completes when the SDK closes in a submitted state', async () => {
        launch.mockResolvedValue({ success: true, status: 'Pending' })
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)

        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        await waitFor(() => expect(props.onComplete).toHaveBeenCalled())
        expect(props.onClose).not.toHaveBeenCalled()
    })

    // The plugin reports the state at close, which for a user who backed out of
    // an already-approved level reads Initial — but onStatusChanged saw the
    // submission. Trusting the closing status alone would strand them.
    it('completes when a status event reported a submission even if the closing status did not', async () => {
        let resolveLaunch: (value: unknown) => void = () => {}
        launch.mockReturnValue(new Promise((resolve) => (resolveLaunch = resolve)))
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)
        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        await act(async () => {
            statusHandler?.({ newStatus: 'Pending' })
            resolveLaunch({ success: true, status: 'Initial' })
        })

        await waitFor(() => expect(props.onComplete).toHaveBeenCalled())
    })

    it('closes without completing when the user backs out', async () => {
        launch.mockResolvedValue({ success: true, status: 'Initial' })
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)

        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        await waitFor(() => expect(props.onClose).toHaveBeenCalled())
        expect(props.onComplete).not.toHaveBeenCalled()
    })

    // The whole point of moving off the WebSDK: a Sumsub-side failure used to
    // paint their "Initialization error" screen inside a cross-origin iframe and
    // report nothing. It must now reach the user AND both reporters.
    it('surfaces and reports a failed launch', async () => {
        launch.mockResolvedValue({ success: false, status: 'Failed', errorType: 'Unknown', errorMsg: 'boom' })
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)

        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        expect(await screen.findByText(/failed to load verification/i)).toBeInTheDocument()
        expect(capture).toHaveBeenCalledWith('kyc_sdk_init_failed', expect.objectContaining({ platform: 'native' }))
        expect(captureException).toHaveBeenCalled()
    })

    it('surfaces and reports a missing plugin instead of opening nothing', async () => {
        delete (window as unknown as { SNSMobileSDK?: unknown }).SNSMobileSDK
        const props = baseProps()

        await act(async () => {
            render(<SumsubNativeSdk visible {...props} />)
        })

        expect(screen.getByText(/not available/i)).toBeInTheDocument()
        expect(capture).toHaveBeenCalledWith(
            'kyc_sdk_init_failed',
            expect.objectContaining({ reason: 'sdk-unavailable' })
        )
    })

    // Without this the plugin's module-level lock is never released and every
    // later launch rejects with "Aborted since another instance is in use!".
    it('dismisses the native SDK when the flow closes', async () => {
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)
        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        await act(async () => {
            rerender(<SumsubNativeSdk visible={false} {...props} />)
        })

        expect(dismiss).toHaveBeenCalledTimes(1)
    })
})
