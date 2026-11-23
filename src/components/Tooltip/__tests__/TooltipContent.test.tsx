import { act, render, screen } from '@testing-library/react'
import { TooltipContent } from '../TooltipContent'

// 375x667 phone, a 230px-wide panel
const PANEL = { width: 230, height: 60 }

beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 667 })
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0)
        return 0
    })
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        ...PANEL,
        top: 0,
        left: 0,
        right: PANEL.width,
        bottom: PANEL.height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    } as DOMRect)
})
afterEach(() => jest.restoreAllMocks())

const renderAt = (left: number, width = 110) => {
    const updatePosition = jest.fn()
    render(
        <TooltipContent
            content="Send only USDT on Tron to this address."
            position="bottom"
            initialPosition="bottom"
            coords={{ top: 300, left, width, height: 20 }}
            updatePosition={updatePosition}
        />
    )
    return updatePosition
}

const panel = () => screen.getByRole('tooltip').parentElement as HTMLElement
const arrow = () => screen.getByRole('tooltip').lastElementChild as HTMLElement

// TASK-23929 item 3: on the Tron and Solana deposit the label is short, so the
// panel centred under it would start off screen; it sat against the screen edge
describe('TooltipContent near the screen edge', () => {
    it('keeps the panel 16px inside the left edge and points the arrow at the trigger', async () => {
        await act(async () => {
            renderAt(32)
        })
        // trigger centre 87; centred panel would start at -28; clamped to 16
        expect(panel().style.left).toBe(`${16 + PANEL.width / 2}px`)
        // arrow at the trigger centre, 71px into the panel
        expect(arrow().style.left).toBe('calc(50% - 44px)')
    })

    it('keeps the panel 16px inside the right edge', async () => {
        await act(async () => {
            renderAt(300, 40)
        })
        expect(panel().style.left).toBe(`${375 - 16 - PANEL.width / 2}px`)
    })

    it('leaves a centred panel where it is', async () => {
        await act(async () => {
            renderAt(130)
        })
        expect(panel().style.left).toBe('185px')
        expect(arrow().style.left).toBe('')
    })
})
