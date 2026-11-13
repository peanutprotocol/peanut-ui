/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import { SignupScreenContext, useSignupControl } from '@/features/setup/useSignupControl'
import { signupControls } from '@/test-utils/signup-controls'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const capture = posthog.capture as jest.Mock

const onScreen = (onFinish?: () => Promise<void>) =>
    function OnResidenceScreen({ children }: { children: ReactNode }) {
        return (
            <SetupFlowProvider masterScreenIds={['residence']} onFinish={onFinish}>
                <SignupScreenContext.Provider value="residence">{children}</SignupScreenContext.Provider>
            </SetupFlowProvider>
        )
    }

beforeEach(() => {
    capture.mockClear()
    localStorage.clear()
})

it('sends the screen, control, action, value and the shared signup context', () => {
    const { result } = renderHook(() => useSignupControl(), { wrapper: onScreen() })
    result.current.track('residence_country', 'select', 'AR')
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CONTROL_USED, {
        flow: 'signup',
        screen_id: 'residence',
        control: 'residence_country',
        action: 'select',
        value: 'AR',
        setup_host: 'signup',
        flow_version: 1,
        signup_entry_flow: 'default',
        returning_device: false,
    })
})

it('names the verify prelude as the host when the screen runs there', () => {
    const { result } = renderHook(() => useSignupControl(), { wrapper: onScreen(async () => {}) })
    result.current.track('continue', 'tap')
    expect(capture.mock.calls[0][1]).toEqual(expect.objectContaining({ setup_host: 'verify-prelude' }))
    expect(capture.mock.calls[0][1]).not.toHaveProperty('value')
})

it('does nothing off a sign-up screen, so shared controls can call it anywhere', () => {
    const { result } = renderHook(() => useSignupControl())
    result.current.track('passkeys_doc', 'open')
    expect(capture).not.toHaveBeenCalled()
})

it('takes an explicit screen for surfaces outside SetupWrapper', () => {
    const { result } = renderHook(() => useSignupControl('setup-error'))
    result.current.track('try_again', 'tap')
    expect(capture.mock.calls[0][1]).toEqual(expect.objectContaining({ screen_id: 'setup-error' }))
})

it('reports a field edit once per mount and an error only when its category changes', () => {
    const { result } = renderHook(() => useSignupControl(), { wrapper: onScreen() })
    result.current.trackOnce('username', 'change')
    result.current.trackOnce('username', 'change')
    result.current.trackError('username', 'too_short')
    result.current.trackError('username', 'too_short')
    result.current.trackError('username', 'taken')
    result.current.trackError('username', null)
    result.current.trackError('username', 'taken')
    expect(signupControls(capture)).toEqual([
        'username:change',
        'username:error:too_short',
        'username:error:taken',
        'username:error:taken',
    ])
})
