import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import BackupPasskeyCard from '../surfaces/zone/BackupPasskeyCard'
import type { AskId } from '../types'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/components/Home/HomeCarouselCTA/CarouselCTA', () => ({
    __esModule: true,
    default: ({ onClick, onClose }: { onClick: () => void; onClose: () => void }) => (
        <>
            <button onClick={onClick}>Backup card</button>
            <button onClick={onClose}>Close backup card</button>
        </>
    ),
}))

const props = () => ({
    askId: 'backup-passkey' as AskId,
    mode: 'ask' as const,
    onActed: jest.fn(),
    onDismissed: jest.fn(),
    onSnoozed: jest.fn(),
})

beforeEach(() => mockPush.mockClear())

test('opening the backup guide settles the card as acted and navigates there', () => {
    const p = props()
    renderWithIntl(<BackupPasskeyCard {...p} />)
    fireEvent.click(screen.getByText('Backup card'))
    expect(p.onActed).toHaveBeenCalledTimes(1)
    expect(p.onDismissed).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/profile/backup')
})

test('closing the card dismisses it without navigating', () => {
    const p = props()
    renderWithIntl(<BackupPasskeyCard {...p} />)
    fireEvent.click(screen.getByText('Close backup card'))
    expect(p.onDismissed).toHaveBeenCalledTimes(1)
    expect(p.onActed).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
})
