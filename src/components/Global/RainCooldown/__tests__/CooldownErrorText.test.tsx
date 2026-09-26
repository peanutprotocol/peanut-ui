import { act, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { RainCooldownProvider } from '@/context/RainCooldownContext'
import en from '@/i18n/app/messages/en.json'
import CooldownErrorText from '../CooldownErrorText'

// the frozen string useFriendlyError hands every screen for a cooldown
const COOLDOWN_MESSAGE = en.errors.rainCooldownRetryShortly

function fireCooldown(retryAfterSec: number) {
    window.dispatchEvent(new CustomEvent('rain:cooldown', { detail: { retryAfterSec, message: 'cooling down' } }))
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <IntlWrapper>
        <ToastProvider>
            <RainCooldownProvider>{children}</RainCooldownProvider>
        </ToastProvider>
    </IntlWrapper>
)

describe('CooldownErrorText', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers()
        })
        jest.useRealTimers()
    })

    it('shows the same live countdown as the pill and ticks with it', async () => {
        render(<CooldownErrorText message={COOLDOWN_MESSAGE} />, { wrapper })
        act(() => fireCooldown(14))

        // the toast stack is lazy-loaded, so the pill arrives a tick later
        expect(await screen.findByText(/Card cool-down · 0:14/)).toBeInTheDocument()
        expect(screen.getByText('A previous card withdrawal is still active. Try again in 0:14.')).toBeInTheDocument()

        act(() => {
            jest.advanceTimersByTime(1_000)
        })
        expect(screen.getByText('A previous card withdrawal is still active. Try again in 0:13.')).toBeInTheDocument()
        expect(screen.getByText(/Card cool-down · 0:13/)).toBeInTheDocument()
    })

    it('moves the pill and the error together when a retry extends the cooldown', async () => {
        render(<CooldownErrorText message={COOLDOWN_MESSAGE} />, { wrapper })
        act(() => fireCooldown(20))
        expect(await screen.findByText(/Card cool-down · 0:20/)).toBeInTheDocument()

        act(() => fireCooldown(120))
        expect(screen.getByText(/Card cool-down · 2:00/)).toBeInTheDocument()
        expect(screen.getByText('A previous card withdrawal is still active. Try again in 2:00.')).toBeInTheDocument()

        // one shared clock: every tick lands on both surfaces at once
        act(() => {
            jest.advanceTimersByTime(1_000)
        })
        expect(screen.getByText(/Card cool-down · 1:59/)).toBeInTheDocument()
        expect(screen.getByText('A previous card withdrawal is still active. Try again in 1:59.')).toBeInTheDocument()
    })

    it('says the user can retry once the cooldown ends', () => {
        render(<CooldownErrorText message={COOLDOWN_MESSAGE} />, { wrapper })
        act(() => fireCooldown(5))
        act(() => {
            jest.advanceTimersByTime(6_000)
        })
        expect(screen.getByText(en.errors.rainCooldownRetryNow)).toBeInTheDocument()
        expect(screen.queryByText(/Try again in/)).not.toBeInTheDocument()
    })

    it('keeps the ticking text away from screen readers', () => {
        render(<CooldownErrorText message={COOLDOWN_MESSAGE} />, { wrapper })
        act(() => fireCooldown(14))
        const live = screen.getByText(/Try again in 0:14/)
        expect(live).toHaveAttribute('aria-hidden', 'true')
        expect(screen.getByText(COOLDOWN_MESSAGE)).toHaveClass('sr-only')
    })

    it('renders the plain copy when no cooldown has started', () => {
        render(<CooldownErrorText message={COOLDOWN_MESSAGE} />, { wrapper })
        expect(screen.getByText(COOLDOWN_MESSAGE)).not.toHaveClass('sr-only')
    })

    it('leaves any other error untouched during a cooldown', () => {
        render(<CooldownErrorText message="Insufficient balance" />, { wrapper })
        act(() => fireCooldown(14))
        expect(screen.getByText('Insufficient balance')).toBeInTheDocument()
        expect(screen.queryByText(/Try again in/)).not.toBeInTheDocument()
    })

    it('renders the plain copy outside the cooldown provider', () => {
        render(<CooldownErrorText message={COOLDOWN_MESSAGE} />, { wrapper: IntlWrapper })
        expect(screen.getByText(COOLDOWN_MESSAGE)).toBeInTheDocument()
    })
})
