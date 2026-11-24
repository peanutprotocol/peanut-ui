import { render } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { CardAcquisitionScreen } from '../components/CardAcquisitionScreen'

// renders the real card face, so each state shows the art it ships with (TASK-25341)
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useFormatter: () => ({ number: (n: number) => String(n), list: (items: string[]) => items.join(', ') }),
}))
jest.mock('framer-motion', () => ({ useReducedMotion: () => false }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/utils/confetti', () => ({ shootDoubleStarConfetti: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/HoldToClaimButton', () => ({ HoldToClaimButton: () => null }))
// jsdom has no layout, so the face would never get a width to scale to
jest.mock('@/hooks/useFitToWidth', () => ({ useFitToWidth: () => ({ hostRef: { current: null }, scale: 1 }) }))

const props = {
    userId: 'alice',
    eligible: true,
    funded: false,
    fundingRequired: false,
    onApply: jest.fn(),
    onPrev: jest.fn(),
}

// the hand is the only draggable={false} image on the card face
function renderHand(step: string) {
    const { container } = render(<CardAcquisitionScreen {...props} />, {
        wrapper: withNuqsTestingAdapter({ searchParams: `?card_step=${step}` }),
    })
    const hand = container.querySelector<HTMLImageElement>('img[draggable="false"]')
    expect(hand).not.toBeNull()
    return { container, hand: hand! }
}

beforeEach(() => {
    localStorage.clear()
    // jsdom has no canvas; the tease rasterises its logos and number on one
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillText: jest.fn(),
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        drawImage: jest.fn(),
    } as unknown as CanvasRenderingContext2D)
})

it.each(['eligibility', 'looking-up'])('shows the pixel-art card on the %s tease, not a blur', (step) => {
    const { container, hand } = renderHand(step)
    expect(hand.style.imageRendering).toBe('pixelated')
    expect(container.querySelector('[data-card-tease="blur"]')).toBeNull()
    expect(container.innerHTML).not.toMatch(/blur\(/)
})

it.each(['available', 'entry'])('shows the crisp card on the %s screen, as in 1.37', (step) => {
    const { container, hand } = renderHand(step)
    expect(hand.style.imageRendering).toBe('')
    expect(container.innerHTML).not.toMatch(/blur\(/)
})
