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

jest.mock('../SumsubWebSdkModal', () => ({
    __esModule: true,
    SumsubWebSdkModal: ({ visible, accessToken }: { visible: boolean; accessToken: string | null }) => {
        if (!visible) return null
        return <div data-testid="web-fallback" data-token={accessToken ?? ''} />
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

    // Multi-level: the Level-1 Pending is NOT a finished workflow. Backing out of
    // Level 2 resolves launch() on a non-submitted status, and reporting that as a
    // completion let both flow hooks consume the deferred ACTION_REQUIRED, leaving
    // the applicant on a stale "verifying" modal.
    it('multi-level reports a Level-1-then-backed-out exit as a close, not a completion', async () => {
        let resolveLaunch: (value: unknown) => void = () => {}
        launch.mockReturnValue(new Promise((resolve) => (resolveLaunch = resolve)))
        const props = { ...baseProps(), isMultiLevel: true, onSubmitted: jest.fn() }
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)
        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        await act(async () => {
            statusHandler?.({ newStatus: 'Pending' })
            resolveLaunch({ success: true, status: 'Initial' })
        })

        await waitFor(() => expect(props.onClose).toHaveBeenCalled())
        expect(props.onComplete).not.toHaveBeenCalled()
        // the level they did finish still reaches the funnel
        expect(props.onSubmitted).toHaveBeenCalledTimes(1)
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

    it.each(['Pending', 'Approved', 'ActionCompleted'])(
        'multi-level close with %s does not prove workflow completion',
        async (status) => {
            launch.mockResolvedValue({ success: true, status })
            const props = { ...baseProps(), isMultiLevel: true, onSubmitted: jest.fn() }
            await act(async () => {
                render(<SumsubNativeSdk visible {...props} />)
            })
            await waitFor(() => expect(props.onClose).toHaveBeenCalled())
            expect(props.onComplete).not.toHaveBeenCalled()
        }
    )

    // A native SDK that cannot start must not dead-end the user: the WebSDK
    // takes over with the same session token, and both reporters still hear
    // about the native failure (that telemetry is how the broken 21653381
    // Android binary was caught).
    it('falls back to the WebSDK and reports a failed launch', async () => {
        launch.mockResolvedValue({ success: false, status: 'Failed', errorType: 'Unknown', errorMsg: 'boom' })
        const props = baseProps()
        const { rerender } = render(<SumsubNativeSdk visible={false} {...props} />)

        await act(async () => {
            rerender(<SumsubNativeSdk visible {...props} />)
        })

        const fallback = await screen.findByTestId('web-fallback')
        expect(fallback).toHaveAttribute('data-token', 'tok_abc')
        expect(capture).toHaveBeenCalledWith('kyc_sdk_init_failed', expect.objectContaining({ platform: 'native' }))
        expect(capture).toHaveBeenCalledWith('kyc_web_fallback_used', expect.objectContaining({ reason: 'Unknown' }))
        expect(captureException).toHaveBeenCalled()
    })

    it('falls back to the WebSDK when the plugin is missing from the binary', async () => {
        delete (window as unknown as { SNSMobileSDK?: unknown }).SNSMobileSDK
        const props = baseProps()

        await act(async () => {
            render(<SumsubNativeSdk visible {...props} />)
        })

        expect(screen.getByTestId('web-fallback')).toBeInTheDocument()
        expect(capture).toHaveBeenCalledWith(
            'kyc_sdk_init_failed',
            expect.objectContaining({ reason: 'sdk-unavailable' })
        )
        expect(capture).toHaveBeenCalledWith(
            'kyc_web_fallback_used',
            expect.objectContaining({ reason: 'sdk-unavailable' })
        )
    })

    it('does not render the fallback while the native SDK is up', async () => {
        const props = baseProps()
        await act(async () => {
            render(<SumsubNativeSdk visible {...props} />)
        })
        expect(launch).toHaveBeenCalledTimes(1)
        expect(screen.queryByTestId('web-fallback')).not.toBeInTheDocument()
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
