/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import { loose, msg, renderInShell, setupState } from './redesign-harness'

jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

/**
 * Every T1 component test renders its screen inside the real SetupShell, because the footer (the screens' main
 * buttons) is drawn by the shell. This guards the harness itself: if it fails, every screen suite fails for the
 * same shell reason, not for the screen's.
 */
describe('T1 harness: the real SetupShell', () => {
    it('renders a screen, its h1, its state and its footer without an update loop', () => {
        const Screen = () => (
            <SetupScreen
                ground="sky"
                title={msg('setupRedesign.landing.title')}
                state="harness"
                footer={{ primary: { label: msg('setupRedesign.common.continue'), onClick: () => {} } }}
            >
                <p>panel</p>
            </SetupScreen>
        )
        renderInShell('landing', <Screen />)

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(loose(msg('setupRedesign.landing.title')))
        expect(screen.getByRole('button', { name: msg('setupRedesign.common.continue') })).toBeEnabled()
        expect(setupState()).toBe('harness')
        expect(document.querySelector('[data-setup-footer]')).not.toBeNull()
    })

    it('formats catalog strings by key in every locale and fails loudly on a missing key', () => {
        expect(msg('setupRedesign.username.tooLong', { n: 2 })).toMatch(/2/)
        expect(msg('setupRedesign.common.support')).not.toMatch(/</)
        expect(msg('setupRedesign.landing.title', {}, 'es-AR')).not.toBe(msg('setupRedesign.landing.title'))
        expect(() => msg('setupRedesign.landing.doesNotExist')).toThrow('doesNotExist')
    })
})
