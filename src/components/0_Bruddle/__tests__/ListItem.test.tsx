/**
 * A row title is either copy or data. Copy wraps, because a cut title hid what
 * the row does (QA 2026-09-24, "Withdraw to your own accou…"). Data — an
 * address, a bank name, a username — opts into one line, so it cannot stack
 * three lines at 375px.
 */
import { render, screen } from '@testing-library/react'
import { ListItem } from '../ListItem'

jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))

describe('ListItem title', () => {
    it('wraps a copy title by default', () => {
        render(<ListItem title="Withdraw to own account" />)
        const title = screen.getByText('Withdraw to own account')
        expect(title).toHaveClass('break-words')
        expect(title).not.toHaveClass('truncate')
    })

    it('keeps a data title on one line when asked', () => {
        render(<ListItem title="0x28c6c06298d514db089934071355e5743bf21d60" truncate />)
        const title = screen.getByText('0x28c6c06298d514db089934071355e5743bf21d60')
        expect(title).toHaveClass('truncate')
        expect(title).not.toHaveClass('break-words')
    })
})
