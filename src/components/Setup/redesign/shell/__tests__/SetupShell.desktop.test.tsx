/** @jest-environment jsdom */
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import type { SetupStageSize } from '@/components/Setup/redesign/shell/shell.types'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { renderInShell } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'

jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const originalMatchMedia = window.matchMedia
const setWidth = (width: number) => {
    window.matchMedia = ((query: string) => {
        const min = /min-width:\s*(\d+)px/.exec(query)
        return {
            matches: !!min && width >= Number(min[1]),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }
    }) as unknown as typeof window.matchMedia
}

const renderStep = (screenId: ScreenId, stage: SetupStageSize = 'std') =>
    renderInShell(
        screenId,
        <SetupScreen ground="sky" stage={stage} footer={null}>
            <p>panel</p>
        </SetupScreen>
    )

afterEach(() => {
    window.matchMedia = originalMatchMedia
})

/** no side hero at any width: the shell is full width below lg and the centred phone column from lg. */
describe('SetupShell on desktop', () => {
    it.each([1440, 767])('renders only the phone column at %i px', (width) => {
        setWidth(width)
        const { container } = renderStep('advantage-fees')
        const shell = container.querySelector('[data-setup-shell]')!
        expect(container.firstElementChild).toBe(shell)
        // full width below lg (phones, tablets, phone landscape); the centred 480 px column only from lg
        expect(shell.className.split(' ')).toContain('lg:max-w-[480px]')
        expect(shell.className.split(' ')).not.toContain('max-w-[480px]')
        expect(shell.className).toContain('mx-auto')
    })

    it('marks the web download landing (no footer), whose desktop stage turns compact in globals.css', () => {
        setWidth(1440)
        renderStep('landing', 'tall')
        const shell = document.querySelector<HTMLElement>('[data-setup-shell]')!
        expect(shell.hasAttribute('data-setup-download')).toBe(true)
        expect(shell.style.getPropertyValue('--sr-stage-tall-base')).toBe('')
    })

    it('does not mark a landing with a footer (native, keep-web) or any other step', () => {
        const landing = renderInShell(
            'landing',
            <SetupScreen ground="sky" stage="tall" footer={{ primary: { label: 'Sign up', onClick: () => {} } }}>
                <p>panel</p>
            </SetupScreen>
        )
        expect(document.querySelector('[data-setup-shell]')!.hasAttribute('data-setup-download')).toBe(false)
        landing.unmount()
        renderStep('residence')
        expect(document.querySelector('[data-setup-shell]')!.hasAttribute('data-setup-download')).toBe(false)
    })
})
