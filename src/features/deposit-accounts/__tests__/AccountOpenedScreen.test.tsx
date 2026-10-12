import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { shootDoubleStarConfetti } from '@/utils/confetti'
import { AccountOpenedScreen } from '../components/AccountOpenedScreen'

jest.mock('@/utils/confetti', () => ({ shootDoubleStarConfetti: jest.fn() }))

it('celebrates once in Strict Mode and provides an accessible way to view the account', () => {
    const onContinue = jest.fn()
    render(
        <StrictMode>
            <NextIntlClientProvider locale="en" messages={messages}>
                <AccountOpenedScreen currency="EUR" onContinue={onContinue} />
            </NextIntlClientProvider>
        </StrictMode>
    )

    expect(shootDoubleStarConfetti).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: /EUR/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: messages.depositAccounts.opened.cta }))
    expect(onContinue).toHaveBeenCalledTimes(1)
})

// This is a terminal success screen: Continue is the only forward move. The back
// chevron used to reuse the Continue handler, so it stepped INTO the details
// screen instead of leaving. It is now hidden so it cannot navigate at all.
it('hides the back control — the screen is terminal', () => {
    render(
        <NextIntlClientProvider locale="en" messages={messages}>
            <AccountOpenedScreen currency="EUR" onContinue={jest.fn()} />
        </NextIntlClientProvider>
    )

    expect(screen.queryByTestId('nav-back')).toBeNull()
})
