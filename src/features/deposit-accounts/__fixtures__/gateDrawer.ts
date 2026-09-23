import { act, fireEvent } from '@testing-library/react'
import { GATE_DRAWER_CLOSE_MS } from '../components/DepositAccountsFlow'

/**
 * TESTS ONLY. Tap a gate-drawer button and let the drawer's close animation
 * pass, so a sheet it hands off to (verification, terms, email, support) has
 * been asked to open by the time the test looks.
 */
export function tapGateButton(button: HTMLElement): void {
    jest.useFakeTimers()
    try {
        fireEvent.click(button)
        act(() => {
            jest.advanceTimersByTime(GATE_DRAWER_CLOSE_MS)
        })
    } finally {
        jest.useRealTimers()
    }
}
