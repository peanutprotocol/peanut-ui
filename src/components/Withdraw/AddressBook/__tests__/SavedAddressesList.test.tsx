/**
 * SavedAddressesList — the crypto address book rows.
 * Pins: nickname + 4+4 address + chain, the last-used tone, tap → onSelect,
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
    it('renders nickname, short address, and the last-used pill tone', () => {
        const rows = [row({}), row({ id: 'id-2', nickname: 'Cold', lastUsedAt: daysAgo(45) })]
        render(<SavedAddressesList savedAddresses={rows} onSelect={jest.fn()} onEdit={jest.fn()} />, {
            wrapper: IntlWrapper,
        })
        expect(screen.getByText('Binance')).toBeInTheDocument()
        expect(screen.getAllByText(/0xab58\.\.\.ec9b/)).toHaveLength(2)
        expect(screen.getByText('Used yesterday')).toHaveAttribute('data-tone', 'recent')
        expect(screen.getByText('Used 45 days ago')).toHaveAttribute('data-tone', 'stale')
    })

    it('tap selects; the edit button edits without selecting', () => {
        const onSelect = jest.fn()
        const onEdit = jest.fn()
        const saved = row({})
        render(<SavedAddressesList savedAddresses={[saved]} onSelect={onSelect} onEdit={onEdit} />, {
            wrapper: IntlWrapper,
        })
        fireEvent.click(screen.getByLabelText('Edit Binance'))
        expect(onEdit).toHaveBeenCalledWith(saved)
        expect(onSelect).not.toHaveBeenCalled()
        fireEvent.click(screen.getByText('Binance'))
        expect(onSelect).toHaveBeenCalledWith(saved)
    })
})
