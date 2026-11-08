import { render } from '@testing-library/react'
import { UsEuAccountPair } from '../pages/UsEuAccountPair'
import type { DropInProps } from '../starLp.types'

let mockVisible = false
const mockRef = jest.fn()
jest.mock('../useEntranceArm', () => ({ useEntranceArm: () => ({ ref: mockRef, armed: true }) }))
jest.mock('framer-motion', () => ({ useInView: () => mockVisible }))
jest.mock('../DropIn', () => ({
    DropIn: ({ children, entrance, delay, className }: DropInProps) => (
        <div
            data-drop=""
            data-grouped={!!entrance}
            data-visible={entrance?.visible}
            data-delay={delay}
            className={className}
        >
            {children}
        </div>
    ),
}))
jest.mock('../pages/UsEuAppLink', () => ({
    UsEuAppLink: ({ children, className }: { children: React.ReactNode; className: string }) => (
        <a href="#accounts" className={className}>
            {children}
        </a>
    ),
}))

afterEach(() => {
    mockVisible = false
})

it('shares one entrance across both cards and their coins, with a short stagger', () => {
    const { container, rerender } = render(<UsEuAccountPair pairedEntrance />)
    const layers = Array.from(container.querySelectorAll('[data-drop]'))
    expect(layers).toHaveLength(4)
    layers.forEach((layer) => {
        expect(layer).toHaveAttribute('data-grouped', 'true')
        expect(layer).toHaveAttribute('data-visible', 'false')
    })
    expect(layers.map((layer) => layer.getAttribute('data-delay'))).toEqual(['0', '0', '0.1', '0.1'])
    mockVisible = true
    rerender(<UsEuAccountPair pairedEntrance />)
    container.querySelectorAll('[data-drop]').forEach((layer) => expect(layer).toHaveAttribute('data-visible', 'true'))
})

it('lets both coin layers clear both card surfaces without an enclosing card z-index', () => {
    const { container } = render(<UsEuAccountPair pairedEntrance />)
    const coins = Array.from(container.querySelectorAll('[data-drop].z-20'))
    expect(coins).toHaveLength(2)
    coins.forEach((coin) => {
        expect(coin.parentElement).not.toHaveClass('z-10')
        expect(coin).toHaveClass('absolute', 'inset-0')
    })
})

it('preserves the star accounts page default card structure, triggers and delays', () => {
    const { container } = render(<UsEuAccountPair />)
    const layers = Array.from(container.querySelectorAll('[data-drop]'))
    expect(layers).toHaveLength(2)
    expect(layers.map((layer) => layer.getAttribute('data-delay'))).toEqual(['0.15', '0.45'])
    layers.forEach((layer) => expect(layer).toHaveAttribute('data-grouped', 'false'))
    expect(layers[1]).toHaveClass('z-10')
})
