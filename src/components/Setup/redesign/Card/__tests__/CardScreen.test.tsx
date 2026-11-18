/** @jest-environment jsdom */
/**
 * 06 Card (`advantage-card`), contract P3 § 2, plus the banned-copy check P3-08 for 05 and 06.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import posthog from 'posthog-js'
import { signupControls } from '@/test-utils/signup-controls'
import { AccountsScreen } from '@/components/Setup/redesign/Accounts/AccountsScreen'
import { CardScreen } from '../CardScreen'
import {
    copy,
    copyRx,
    footer,
    renderRedesign,
    tagCopy,
    textMatch,
    visibleText,
} from '../../Accounts/__tests__/redesignHarness'

const mockHandleNext = jest.fn(async () => {})
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: false }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
const mockAnimation = {
    totalFrames: 20,
    frameRate: 30,
    goToAndStop: jest.fn(),
    destroy: jest.fn(),
    addEventListener: jest.fn(),
}
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: () => mockAnimation },
}))
let mockReduced = false
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell(() => mockReduced))

const setReducedMotion = (matches: boolean) => {
    mockReduced = matches
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: matches && query.includes('reduce'),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    })
}

const capture = posthog.capture as jest.Mock
const render = (locale: 'en' | 'es-AR' = 'en') =>
    renderRedesign(<CardScreen />, { screenId: 'advantage-card', locale, showBackButton: true })

const BANNED = /platinum|cashback|bono|no password|sin contraseña|suggested|example|ejemplo/i

beforeEach(() => {
    jest.clearAllMocks()
    setReducedMotion(false)
})

describe('06 Card', () => {
    it.each(['en', 'es-AR'] as const)(
        'P3-07 headline and description, the colour word in brand pink (%s)',
        (locale) => {
            render(locale)
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                copyRx('setupRedesign.card.title', {}, locale)
            )
            const desc = screen.getByText(textMatch(copy('setupRedesign.card.desc', {}, locale)))
            const pink = within(desc).getByText(tagCopy('setupRedesign.card.desc', 'pink', locale))
            // orchestrator ruling (16 Nov, the mock wins over P3-07's wording): the word is a pink highlight
            // (mock `mark.pk`: brand-pink background, ink text), never pink text on pink
            expect(pink).toHaveClass('bg-background-brand')
            expect(pink).toHaveClass('text-foreground-primary')
            expect(pink).not.toHaveClass('text-foreground-brand')
        }
    )

    it('P3-09 mounts the pointing pose through MascotStage', () => {
        const { container } = render()
        expect(container.querySelector('[data-setup-art-layer] [data-mascot-lot="pointing"]')).not.toBeNull()
    })

    it('P3-09 under reduced motion the pose holds its frame and no entrance animates', async () => {
        setReducedMotion(true)
        const { container } = render()
        const mascot = container.querySelector('[data-mascot-pose="pointing"]')
        expect(mascot).not.toBeNull()
        await waitFor(() => expect(mascot).toHaveAttribute('data-lottie-running', 'false'))
        // ArtPiece entrances start at their rest pose: no element is mid-entrance (opacity 0) under reduced motion
        for (const piece of container.querySelectorAll<HTMLElement>('[data-setup-art-box] > div')) {
            expect(piece.style.opacity === '' || piece.style.opacity === '1').toBe(true)
        }
    })

    it('P3-10 Continue reports continue:tap on advantage-card and moves on', () => {
        const { container } = render()
        fireEvent.click(
            within(footer(container)!).getByRole('button', { name: copyRx('setupRedesign.common.continue') })
        )
        expect(signupControls(capture)).toEqual(['continue:tap'])
        expect(capture.mock.calls[0][1]).toEqual(expect.objectContaining({ screen_id: 'advantage-card' }))
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })
})

describe('P3-08 banned copy on 05 and 06', () => {
    it.each([
        ['05', 'en'],
        ['05', 'es-AR'],
        ['06', 'en'],
        ['06', 'es-AR'],
    ] as const)('%s (%s) shows no banned word', (screenNo, locale) => {
        const { container } =
            screenNo === '05'
                ? renderRedesign(<AccountsScreen />, { screenId: 'advantage-fees', locale })
                : renderRedesign(<CardScreen />, { screenId: 'advantage-card', locale })
        expect(visibleText(container)).not.toMatch(BANNED)
    })
})
