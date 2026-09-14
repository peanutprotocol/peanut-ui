import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import InfoTooltip from '../InfoTooltip'

describe('InfoTooltip', () => {
    it('portals outside clipping ancestors and masks its content', async () => {
        const { container } = render(
            <aside style={{ overflow: 'auto', width: 80 }}>
                <InfoTooltip label="time filters">Tooltip detail</InfoTooltip>
            </aside>
        )
        const button = screen.getByRole('button', { name: 'About time filters' })
        fireEvent.focus(button)
        const tooltip = await screen.findByRole('tooltip')
        const protectedContent = within(tooltip).getByText('Tooltip detail')
        expect(button).toHaveAttribute('aria-describedby', tooltip.id)
        expect(tooltip.parentElement?.parentElement).toBe(document.body)
        expect(protectedContent).toHaveClass('ph-no-capture')
        expect(protectedContent).toHaveAttribute('data-private', 'true')
        expect(protectedContent).toHaveAttribute('data-sentry-mask')
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
