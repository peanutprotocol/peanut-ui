/** @jest-environment jsdom */
import { SetupScreen } from '@/components/Setup/redesign/shell/SetupScreen'
import type { SetupStageSize } from '@/components/Setup/redesign/shell/shell.types'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { renderInShell } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'

jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/Setup/redesign/shell/OnboardingAnimation', () => ({
    __esModule: true,
    default: ({ name }: { name: string }) => <div data-onboarding-animation={name} />,
}))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose }: { pose: string }) => <div data-mascot-pose={pose} />,
}))
jest.mock('@/components/Setup/components/ResidenceHero', () => ({ ResidenceHero: () => <div data-residence-hero /> }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => <div data-clouds /> }))

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

const hero = () => document.querySelector('[data-setup-hero]')

afterEach(() => {
    window.matchMedia = originalMatchMedia
})

/** R1-02: desktop keeps dev's split, dev's side hero beside the phone column; phones get the column alone. */
describe('SetupShell on desktop', () => {
    it('puts dev side hero with the step art left of the shell column from 768 px', () => {
        setWidth(1440)
        renderStep('advantage-fees')
        const frame = document.querySelector('[data-setup-desktop-frame]')!
        expect(hero()).not.toBeNull()
        expect(frame.firstElementChild).toBe(hero())
        expect(hero()!.querySelector('[data-onboarding-animation="accounts"]')).not.toBeNull()
        expect(frame.querySelector('[data-setup-shell]')).not.toBeNull()
    })

    it('shows the landing mascot over the clouds, as dev', () => {
        setWidth(1024)
        renderStep('landing', 'tall')
        expect(hero()!.querySelector('[data-mascot-pose="waving-chill"]')).not.toBeNull()
        expect(hero()!.querySelector('[data-clouds]')).not.toBeNull()
    })

    it('gives the web download landing (no footer) the compact stage and leaves its art to the side hero', () => {
        setWidth(1440)
        renderStep('landing', 'tall')
        const shell = document.querySelector<HTMLElement>('[data-setup-shell]')!
        expect(shell.style.getPropertyValue('--sr-stage-tall-base')).toBe('var(--sr-stage-compact-base)')
    })

    it('keeps the tall stage for a landing with a footer (native, keep-web)', () => {
        setWidth(1440)
        renderInShell(
            'landing',
            <SetupScreen ground="sky" stage="tall" footer={{ primary: { label: 'Sign up', onClick: () => {} } }}>
                <p>panel</p>
            </SetupScreen>
        )
        const shell = document.querySelector<HTMLElement>('[data-setup-shell]')!
        expect(shell.style.getPropertyValue('--sr-stage-tall-base')).toBe('')
    })

    it('mounts no hero on a phone', () => {
        setWidth(767)
        renderStep('advantage-fees')
        expect(hero()).toBeNull()
        expect(document.querySelector('[data-onboarding-animation]')).toBeNull()
    })

    it('drops the hero where dev went full page: the celebration and the residence comparison', () => {
        setWidth(1440)
        const celebration = renderStep('advantage-control', 'full')
        expect(hero()).toBeNull()
        celebration.unmount()
        renderStep('residence', 'compact')
        expect(hero()).toBeNull()
    })
})
