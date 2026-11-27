import { act, fireEvent, render, screen } from '@testing-library/react'
import { Tooltip } from '../index'

// jsdom has no PointerEvent; this one carries pointerType like the browser's
class TestPointerEvent extends MouseEvent {
    pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
        super(type, init)
        this.pointerType = init.pointerType ?? ''
    }
}

beforeAll(() => {
    window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent
})

const renderTooltip = () =>
    render(
        <Tooltip content="Your Tron deposit address.">
            <span>Deposit address</span>
        </Tooltip>
    )

// TASK-23929: a tap sends the compatibility mouseenter (opened it) and then
// the click (closed it again), so a tap showed nothing
describe('Tooltip trigger', () => {
    it('a tap opens the tooltip and the next tap closes it', async () => {
        renderTooltip()
        const trigger = screen.getByText('Deposit address')
        // one tap, event by event, as the browser delivers it (each its own task)
        const tap = async () => {
            await act(async () => {
                fireEvent.pointerEnter(trigger, { pointerType: 'touch' })
            })
            await act(async () => {
                fireEvent.mouseEnter(trigger)
            })
            await act(async () => {
                fireEvent.click(trigger)
            })
        }

        await tap()
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        await tap()
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    // the payment network explorer wraps a Button: the tap focuses it before the click
    it('a tap on a focusable trigger opens it and the next tap closes it', async () => {
        render(
            <Tooltip content="Your Tron deposit address.">
                <button type="button">Deposit address</button>
            </Tooltip>
        )
        const button = screen.getByRole('button', { name: 'Deposit address' })
        const tap = async (first: boolean) => {
            await act(async () => {
                fireEvent.pointerDown(button, { pointerType: 'touch' })
            })
            await act(async () => {
                fireEvent.pointerUp(button, { pointerType: 'touch' })
            })
            await act(async () => {
                fireEvent.mouseDown(button)
            })
            if (first) {
                await act(async () => {
                    button.focus()
                })
            }
            await act(async () => {
                fireEvent.click(button)
            })
        }

        await tap(true)
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        await tap(false)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('keyboard focus opens it and Escape closes it', async () => {
        render(
            <Tooltip content="Your Tron deposit address.">
                <button type="button">Deposit address</button>
            </Tooltip>
        )
        const button = screen.getByRole('button', { name: 'Deposit address' })

        await act(async () => {
            button.focus()
        })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        await act(async () => {
            fireEvent.keyDown(button, { key: 'Escape' })
        })
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('a mouse still opens it on hover and closes it on leave', async () => {
        renderTooltip()
        const trigger = screen.getByText('Deposit address')

        await act(async () => {
            fireEvent.pointerEnter(trigger, { pointerType: 'mouse' })
        })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        await act(async () => {
            fireEvent.pointerLeave(trigger, { pointerType: 'mouse' })
        })
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
})
