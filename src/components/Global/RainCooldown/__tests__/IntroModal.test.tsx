import { act, fireEvent, screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { RainCooldownProvider } from '@/context/RainCooldownContext'
import RainCooldownIntroModal from '../IntroModal'

jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div role="dialog">{children}</div> : null,
}))

jest.mock('@/components/Global/DocsLink', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

it('shows one countdown in the modal, hands it off on dismissal, and clears it at expiry', async () => {
    jest.useFakeTimers()
    try {
        renderWithIntl(
            <ToastProvider>
                <RainCooldownProvider>
                    <RainCooldownIntroModal />
                </RainCooldownProvider>
            </ToastProvider>
        )
        act(() => window.dispatchEvent(new CustomEvent('rain:cooldown', { detail: { retryAfterSec: 5 } })))
        const dialog = within(screen.getByRole('dialog'))
        expect(dialog.getByText('0:05')).toBeInTheDocument()
        expect(dialog.getByText(/card spending limit/i)).toBeInTheDocument()
        expect(screen.getAllByText(/0:05/)).toHaveLength(1)

        act(() => jest.advanceTimersByTime(1000))
        expect(dialog.getByText('0:04')).toBeInTheDocument()
        fireEvent.click(dialog.getByRole('button', { name: /got it/i }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(await screen.findByText(/0:04/)).toBeInTheDocument()

        act(() => jest.advanceTimersByTime(5000))
        expect(screen.queryByText(/0:0[0-5]/)).not.toBeInTheDocument()

        act(() => window.dispatchEvent(new CustomEvent('rain:cooldown', { detail: { retryAfterSec: 2 } })))
        expect(within(screen.getByRole('dialog')).getByText('0:02')).toBeInTheDocument()
        act(() => jest.advanceTimersByTime(2000))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
        jest.useRealTimers()
    }
})
