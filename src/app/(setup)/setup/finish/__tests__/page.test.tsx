/** @jest-environment jsdom */
import { StrictMode, type ReactNode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import posthog from 'posthog-js'
import FinishSetupPage from '../page'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ signupEntryFlow: 'card' }),
}))
jest.mock('@/hooks/useBackHandler', () => ({ useBackHandler: jest.fn() }))
jest.mock('@/components/Setup/components/SetupWrapper', () => ({
    SetupWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({
    __esModule: true,
    default: () => <button>Confirm and finish</button>,
}))

beforeEach(() => jest.clearAllMocks())

it('reports the standalone recovery step once per visit, including in Strict Mode', () => {
    const tree = (
        <StrictMode>
            <FinishSetupPage />
        </StrictMode>
    )
    const view = renderWithIntl(tree)
    view.rerender(tree)
    expect(posthog.capture).toHaveBeenCalledTimes(1)
    expect(posthog.capture).toHaveBeenCalledWith('signup_step_viewed', {
        screen_id: 'sign-test-transaction',
        step_index: 1,
        total_steps: 1,
        nav_type: 'initial',
        flow_version: 2,
        signup_entry_flow: 'card',
    })
    view.unmount()
    renderWithIntl(tree)
    expect(posthog.capture).toHaveBeenCalledTimes(2)
})
