/** @jest-environment jsdom */
import { StrictMode } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import posthog from 'posthog-js'
import FinishSetupPage from '../page'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), register_for_session: jest.fn(), unregister_for_session: jest.fn() },
}))
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ signupEntryFlow: 'card' }),
    // the real shell's hooks read the optional flow; the standalone finish page has none
    useOptionalSetupFlow: () => null,
}))
jest.mock('@/hooks/useBackHandler', () => ({ useBackHandler: jest.fn() }))
// the shell's top bar draws the language switcher, which needs the page's locale provider
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/components/Setup/redesign/FinalConfirm/FinalConfirmScreen', () => ({
    FinalConfirmScreen: () => <button>Confirm and finish</button>,
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
        returning_device: false,
    })
    view.unmount()
    renderWithIntl(tree)
    expect(posthog.capture).toHaveBeenCalledTimes(2)
})
