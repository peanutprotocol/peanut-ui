import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import InfoTooltip from '../InfoTooltip'

describe('InfoTooltip', () => {
    it('portals outside clipping ancestors and clamps to the viewport', async () => {
        const { container } = render(
            <aside style={{ overflow: 'auto', width: 80 }}>
                <InfoTooltip label="time filters">Tooltip detail</InfoTooltip>
            </aside>
        )
        const button = screen.getByRole('button', { name: 'About time filters' })
        jest.spyOn(button, 'getBoundingClientRect').mockReturnValue({
            x: 4,
            y: 30,
            left: 4,
            top: 30,
            right: 18,
            bottom: 44,
            width: 14,
            height: 14,
            toJSON: () => undefined,
        })

        fireEvent.mouseEnter(button)
        const tooltip = await screen.findByRole('tooltip')
        jest.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            right: 224,
            bottom: 60,
            width: 224,
            height: 60,
            toJSON: () => undefined,
        })
        fireEvent(window, new Event('resize'))

        await waitFor(() => expect(tooltip).toHaveStyle({ left: '8px', top: '52px', visibility: 'visible' }))
        expect(tooltip.parentElement).toBe(document.body)
        expect(tooltip).toHaveClass('ph-no-capture')
        expect(tooltip).toHaveAttribute('data-private', 'true')
        expect(tooltip).toHaveAttribute('data-sentry-mask')
        expect(container.querySelector('[role="tooltip"]')).not.toBeInTheDocument()
    })

    it('dismisses a keyboard tooltip with Escape without moving focus', async () => {
        render(<InfoTooltip label="rail filters">Tooltip detail</InfoTooltip>)
        const button = screen.getByRole('button', { name: 'About rail filters' })
        act(() => button.focus())
        expect(await screen.findByRole('tooltip')).toBeInTheDocument()

        fireEvent.keyDown(button, { key: 'Escape' })

        await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
        expect(button).toHaveFocus()
    })
})
