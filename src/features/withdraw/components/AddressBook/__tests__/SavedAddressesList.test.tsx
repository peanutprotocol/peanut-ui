/**
 * SavedAddressesList — the crypto address book rows.
 * Pins: nickname, then 4+4 address + chain + recency on one secondary line
 * (recency is a fact, never a badge), tap → onSelect,
 * and that the edit affordance does NOT also fire onSelect (a tap on "…"
 * that started a withdraw would be a nasty surprise).
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import SavedAddressesList from '../SavedAddressesList'
import type { SavedAddress } from '@/interfaces/interfaces'

jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/DisplayIcon', () => ({
    __esModule: true,
    default: (props: { altText: string }) => <div data-testid="chain-icon">{props.altText}</div>,
}))

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const row = (over: Partial<SavedAddress>): SavedAddress => ({
    id: 'id-1',
    address: '0xab5801a7d398351b8be11c439e05c5b3259aec9b',
    chainId: '42161',
    nickname: 'Binance',
    lastUsedAt: daysAgo(1),
    createdAt: daysAgo(1),
    ...over,
})

describe('SavedAddressesList', () => {
    it('renders the nickname, then address, chain and recency on the secondary line', () => {
        const rows = [row({}), row({ id: 'id-2', nickname: 'Cold', lastUsedAt: daysAgo(45) })]
        render(<SavedAddressesList savedAddresses={rows} onSelect={jest.fn()} onEdit={jest.fn()} />, {
            wrapper: IntlWrapper,
        })
        expect(screen.getByText('Binance')).toBeInTheDocument()
        expect(screen.getAllByText(/0xab58\.\.\.ec9b/)).toHaveLength(2)
        expect(screen.getByText(/0xab58\.\.\.ec9b · .* · Used yesterday$/)).toBeInTheDocument()
        expect(screen.getByText(/0xab58\.\.\.ec9b · .* · Used 45 days ago$/)).toBeInTheDocument()
        // badges are for status only: recency never renders as a pill
        expect(screen.queryByText('Used yesterday')).not.toBeInTheDocument()
    })

    it('tap selects; the edit button edits without selecting', () => {
        const onSelect = jest.fn()
        const onEdit = jest.fn()
        const saved = row({})
        render(<SavedAddressesList savedAddresses={[saved]} onSelect={onSelect} onEdit={onEdit} />, {
            wrapper: IntlWrapper,
        })
        fireEvent.click(screen.getByRole('button', { name: /^Edit Binance, 0xab58\.\.\.ec9b on / }))
        expect(onEdit).toHaveBeenCalledWith(saved)
        expect(onSelect).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: /^Binance, 0xab58\.\.\.ec9b on / }))
        expect(onSelect).toHaveBeenCalledWith(saved)
    })

    // Two sibling controls, never one inside the other (sep-23 review, A49).
    it('keeps selecting and editing as separate controls, neither nested in the other', () => {
        render(<SavedAddressesList savedAddresses={[row({})]} onSelect={jest.fn()} onEdit={jest.fn()} />, {
            wrapper: IntlWrapper,
        })
        const select = screen.getByRole('button', { name: /^Binance, 0xab58\.\.\.ec9b on / })
        const edit = screen.getByRole('button', { name: /^Edit Binance, 0xab58\.\.\.ec9b on / })
        expect(select.contains(edit)).toBe(false)
        expect(edit.contains(select)).toBe(false)
        expect(edit.closest('[role="button"]')).toBeNull()
        expect(screen.getAllByRole('button')).toHaveLength(2)
    })

    // One address and name can be saved on two chains, and selecting sets the
    // chain, so each control has to say which chain it is for.
    it('names both controls by address and chain, so two rows that differ only by chain stay apart', () => {
        const onSelect = jest.fn()
        const onEdit = jest.fn()
        const arbitrum = row({ id: 'arb', chainId: '42161' })
        const base = row({ id: 'base', chainId: '8453', lastUsedAt: daysAgo(2) })
        render(<SavedAddressesList savedAddresses={[arbitrum, base]} onSelect={onSelect} onEdit={onEdit} />, {
            wrapper: IntlWrapper,
        })

        const selects = screen.getAllByTestId('saved-address-select').map((el) => el.getAttribute('aria-label'))
        const edits = screen.getAllByTestId('destination-edit').map((el) => el.getAttribute('aria-label'))
        expect(new Set(selects).size).toBe(2)
        expect(new Set(edits).size).toBe(2)
        for (const name of selects) expect(name).toMatch(/^Binance, 0xab58\.\.\.ec9b on \S/)

        fireEvent.click(screen.getByRole('button', { name: selects[1]! }))
        expect(onSelect).toHaveBeenCalledWith(base)
        fireEvent.click(screen.getByRole('button', { name: edits[0]! }))
        expect(onEdit).toHaveBeenCalledWith(arbitrum)
    })

    // The row keeps the ListItem's own padding, like every other list row (A51).
    it('uses the list row at its standard size', () => {
        const { container } = render(
            <SavedAddressesList savedAddresses={[row({})]} onSelect={jest.fn()} onEdit={jest.fn()} />,
            { wrapper: IntlWrapper }
        )
        expect(container.querySelector('.py-2')).toBeNull()
    })
})
