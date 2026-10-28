import { render } from '@testing-library/react'
import { DropIn } from '../DropIn'

let mockArmed = true
const mockRef = jest.fn()
jest.mock('../useEntranceArm', () => ({ useEntranceArm: () => ({ ref: mockRef, armed: mockArmed }) }))
jest.mock('framer-motion', () => ({
    MotionConfig: ({ children }: { children: React.ReactNode }) => children,
    motion: {
        div: ({
            children,
            animate,
            initial,
            whileInView,
        }: {
            children: React.ReactNode
            animate: unknown
            initial: unknown
            whileInView: unknown
        }) => (
            <div
                data-animate={JSON.stringify(animate)}
                data-initial={JSON.stringify(initial)}
                data-viewport={JSON.stringify(whileInView)}
            >
                {children}
            </div>
        ),
    },
}))

afterEach(() => {
    mockArmed = true
})

it('waits for the shared trigger rather than each individual layer entering the viewport', () => {
    const { container, rerender } = render(<DropIn entrance={{ armed: true, visible: false }}>card</DropIn>)
    expect(container.firstChild).not.toHaveAttribute('data-animate')
    expect(container.firstChild).not.toHaveAttribute('data-viewport')
    rerender(<DropIn entrance={{ armed: true, visible: true }}>card</DropIn>)
    expect(JSON.parse(container.firstElementChild!.getAttribute('data-animate')!)).toMatchObject({
        opacity: 1,
        scale: 1,
        y: 0,
    })
})

it('keeps independent viewport entrances when no shared trigger is supplied', () => {
    const { container } = render(<DropIn>card</DropIn>)
    expect(container.firstChild).not.toHaveAttribute('data-animate')
    expect(JSON.parse(container.firstElementChild!.getAttribute('data-viewport')!)).toMatchObject({
        opacity: 1,
        scale: 1,
        y: 0,
    })
})

it('stays at rest when the shared entrance is not armed, including reduced motion', () => {
    const { container } = render(<DropIn entrance={{ armed: false, visible: false }}>card</DropIn>)
    expect(container.firstChild).toHaveAttribute('data-initial', 'false')
    expect(JSON.parse(container.firstElementChild!.getAttribute('data-animate')!)).toMatchObject({
        opacity: 1,
        scale: 1,
        y: 0,
    })
})
