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

/** desktop shows the same centred phone column as a phone: no side hero, no desktop-only stage. */
describe('SetupShell on desktop', () => {
    it.each([1440, 767])('renders only the phone column at %i px', (width) => {
        setWidth(width)
        const { container } = renderStep('advantage-fees')
        const shell = container.querySelector('[data-setup-shell]')!
        expect(container.firstElementChild).toBe(shell)
        expect(shell.className).toContain('max-w-[480px]')
        expect(shell.className).toContain('mx-auto')
    })

    it('keeps the web landing tall stage and its art on desktop, as on a phone', () => {
        setWidth(1440)
        renderStep('landing', 'tall')
        const shell = document.querySelector<HTMLElement>('[data-setup-shell]')!
        expect(shell.style.getPropertyValue('--sr-stage-tall-base')).toBe('')
        expect(shell.className).not.toContain('data-setup-art-box')
    })
})
