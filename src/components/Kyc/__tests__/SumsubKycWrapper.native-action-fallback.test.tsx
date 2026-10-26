/**
 * Native Sumsub SDK rejecting an action step (TASK-23234, PEANUT-UI-TAH):
 * "Step APPLICANT_DATA is NOT supported in actions". The wrapper must reopen
 * the same action in the web SDK instead of leaving the user on the native
 * failure screen; every other native failure keeps its current behaviour.
 */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, render as rtlRender, screen, waitFor, type RenderOptions } from '@testing-library/react'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { IntlWrapper } from '@/test-utils/intl'
import { SumsubKycWrapper } from '../SumsubKycWrapper'

const render = (ui: ReactElement, options?: RenderOptions) => rtlRender(ui, { wrapper: IntlWrapper, ...options })

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

const captureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureException: (...a: unknown[]) => captureException(...a),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: function MockPortalModal({ visible, children }: { visible: boolean; children: ReactNode }) {
        const [mounted, setMounted] = useState(false)
        useEffect(() => {
            setMounted(visible)
        }, [visible])
        if (!visible || !mounted) return null
        return <div data-testid="modal">{children}</div>
    },
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true, isAndroidNativeBridge: () => false }))
jest.mock('@capacitor/app', () => ({
    App: { addListener: () => Promise.resolve({ remove: jest.fn() }) },
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/components/Global/ActionModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))

const nativeLaunch = jest.fn()
const nativeReset = jest.fn()
const webLaunch = jest.fn()
const webInit = jest.fn()
const webHandlers: Record<string, (payload?: unknown) => void> = {}

function installSdks() {
    const nativeBuilder: Record<string, unknown> = {}
    nativeBuilder.withHandlers = () => nativeBuilder
    nativeBuilder.withLocale = () => nativeBuilder
    nativeBuilder.withDebug = () => nativeBuilder
    nativeBuilder.withApplicantConf = () => nativeBuilder
    nativeBuilder.build = () => ({
        launch: (...a: unknown[]) => nativeLaunch(...a),
        dismiss: jest.fn(),
        sendEvent: jest.fn(),
        getNewAccessToken: jest.fn(),
    })
    ;(window as unknown as { SNSMobileSDK: unknown }).SNSMobileSDK = { init: () => nativeBuilder, reset: nativeReset }

    Object.keys(webHandlers).forEach((key) => delete webHandlers[key])
    const webBuilder: Record<string, unknown> = {}
    webBuilder.withConf = () => webBuilder
    webBuilder.withOptions = () => webBuilder
    webBuilder.on = (event: string, handler: (payload?: unknown) => void) => {
        webHandlers[event] = handler
        return webBuilder
    }
    webBuilder.build = () => ({ launch: webLaunch, destroy: jest.fn() })
    ;(window as unknown as { snsWebSdk: unknown }).snsWebSdk = {
        init: (token: string, refresh: () => Promise<string>) => {
            webInit(token, refresh)
            return webBuilder
        },
    }
}

const props = () => ({
    visible: true,
    accessToken: 'tok_abc',
    onClose: jest.fn(),
    onComplete: jest.fn(),
    onRefreshToken: jest.fn().mockResolvedValue('tok_refreshed'),
})

async function openAndSettle(p: ReturnType<typeof props>): Promise<void> {
    await act(async () => {
        render(<SumsubKycWrapper {...p} />)
    })
    await waitFor(() => expect(nativeLaunch).toHaveBeenCalled())
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
    })
}

const STEPS = ['APPLICANT_DATA', 'IDENTITY', 'QUESTIONNAIRE']
const unsupportedStep = (step: string) => `Step ${step} is NOT supported in actions`
const failureShapes: [string, (message: string) => void][] = [
    ['a rejected launch', (message) => nativeLaunch.mockRejectedValue(new Error(message))],
    [
        'a failed launch result',
        (message) =>
            nativeLaunch.mockResolvedValue({
                success: false,
                status: 'Failed',
                errorType: 'Unknown',
                errorMsg: message,
            }),
    ],
]

beforeEach(() => {
    jest.clearAllMocks()
    const consoleError = console.error
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (!String(args[0]).includes('[sumsub] native sdk failure')) consoleError(...args)
    })
    nativeLaunch.mockReset()
    nativeLaunch.mockReturnValue(new Promise(() => {}))
    webLaunch.mockReset()
    installSdks()
})

afterEach(() => {
    jest.restoreAllMocks()
    delete (window as unknown as { SNSMobileSDK?: unknown }).SNSMobileSDK
    delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
})

describe('native SDK rejects an action step', () => {
    it.each(failureShapes.flatMap(([shape, fail]) => STEPS.map((step) => [shape, step, fail] as const)))(
        'reopens the same action in the web SDK after %s for step %s',
        async (_shape, step, fail) => {
            fail(unsupportedStep(step))
            const p = props()
            await openAndSettle(p)

            await waitFor(() => expect(webLaunch).toHaveBeenCalledTimes(1))
            expect(webLaunch.mock.calls[0][0]).toBeInstanceOf(HTMLElement)
            expect(webInit).toHaveBeenCalledTimes(1)
            expect(webInit.mock.calls[0][0]).toBe('tok_abc')
            expect(nativeLaunch).toHaveBeenCalledTimes(1)
            expect(screen.queryByText(/failed to load verification/i)).not.toBeInTheDocument()
            expect(p.onClose).not.toHaveBeenCalled()
            expect(p.onComplete).not.toHaveBeenCalled()
        }
    )

    it('hands the caller token refresh and completion through to the web SDK', async () => {
        nativeLaunch.mockRejectedValue(new Error(unsupportedStep('APPLICANT_DATA')))
        const p = props()
        await openAndSettle(p)
        await waitFor(() => expect(webLaunch).toHaveBeenCalledTimes(1))

        const refresh = webInit.mock.calls[0][1] as () => Promise<string>
        await expect(refresh()).resolves.toBe('tok_refreshed')
        expect(p.onRefreshToken).toHaveBeenCalledTimes(1)

        act(() => {
            webHandlers['onApplicantSubmitted']?.()
        })
        expect(p.onComplete).toHaveBeenCalledTimes(1)
    })

    it('shows retry UI, not a blank screen, when the web path fails too', async () => {
        nativeLaunch.mockRejectedValue(new Error(unsupportedStep('APPLICANT_DATA')))
        webLaunch.mockImplementation(() => {
            throw new Error('web sdk failed to launch')
        })
        const p = props()
        await openAndSettle(p)

        expect(await screen.findByText(/failed to load verification/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /close|retry|try again/i })).toBeInTheDocument()
        expect(nativeLaunch).toHaveBeenCalledTimes(1)
        expect(webLaunch).toHaveBeenCalledTimes(1)
    })
})

describe("other native SDK outcomes keep today's behaviour", () => {
    it('closes without opening the web SDK when the user cancels', async () => {
        nativeLaunch.mockResolvedValue({ success: true, status: 'Initial' })
        const p = props()
        await openAndSettle(p)

        await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1))
        expect(p.onComplete).not.toHaveBeenCalled()
        expect(webInit).not.toHaveBeenCalled()
        expect(webLaunch).not.toHaveBeenCalled()
        expect(screen.queryByText(/failed to load verification/i)).not.toBeInTheDocument()
    })

    it.each([
        ['a network failure', () => nativeLaunch.mockRejectedValue(new Error('network unavailable'))],
        [
            'a generic failed launch result',
            () =>
                nativeLaunch.mockResolvedValue({
                    success: false,
                    status: 'Failed',
                    errorType: 'Unknown',
                    errorMsg: 'boom',
                }),
        ],
        [
            'an applicant data step that failed for another reason',
            () => nativeLaunch.mockRejectedValue(new Error('APPLICANT_DATA step failed to load')),
        ],
    ])('shows the native failure and reports it without opening the web SDK after %s', async (_label, fail) => {
        fail()
        const p = props()
        await openAndSettle(p)

        expect(await screen.findByText(/failed to load verification/i)).toBeInTheDocument()
        expect(capture).toHaveBeenCalledWith(
            'kyc_sdk_init_failed',
            expect.objectContaining({ reason: expect.any(String) })
        )
        expect(captureException).toHaveBeenCalled()
        expect(webInit).not.toHaveBeenCalled()
        expect(webLaunch).not.toHaveBeenCalled()
        expect(p.onClose).not.toHaveBeenCalled()
        expect(p.onComplete).not.toHaveBeenCalled()
    })

    it('still recovers a stale native instance lock once, natively, without the web SDK', async () => {
        nativeLaunch.mockRejectedValueOnce(new Error('Aborted since another instance is in use!'))
        nativeLaunch.mockResolvedValueOnce({ success: true, status: 'Initial' })
        const p = props()
        await act(async () => {
            render(<SumsubKycWrapper {...p} />)
        })

        await waitFor(() => expect(p.onClose).toHaveBeenCalledTimes(1))
        expect(nativeReset).toHaveBeenCalledTimes(1)
        expect(nativeLaunch).toHaveBeenCalledTimes(2)
        expect(webInit).not.toHaveBeenCalled()
    })
})
