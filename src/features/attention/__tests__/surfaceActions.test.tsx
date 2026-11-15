import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import BalanceBackupSurface from '../surfaces/BalanceBackupSurface'

jest.mock('@/components/Global/BalanceWarningDrawer', () => ({
    __esModule: true,
    default: ({ onCloseAction }: { onCloseAction: () => void }) => (
        <button onClick={onCloseAction}>Slide confirmed</button>
    ),
}))

test('balance slide reports an action rather than a dismissal', () => {
    const p = {
        askId: 'balance-backup',
        presentation: 'drawer',
        onActed: jest.fn(),
        onDismissed: jest.fn(),
        onSnoozed: jest.fn(),
    } as const
    render(<BalanceBackupSurface {...p} />)
    fireEvent.click(screen.getByText('Slide confirmed'))
    expect(p.onActed).toHaveBeenCalledTimes(1)
    expect(p.onDismissed).not.toHaveBeenCalled()
})
