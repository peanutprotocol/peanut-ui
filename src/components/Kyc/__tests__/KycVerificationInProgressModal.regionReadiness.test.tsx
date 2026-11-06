import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { render } from '@testing-library/react'
import { KycVerificationInProgressModal } from '../KycVerificationInProgressModal'
import en from '@/i18n/app/messages/en.json'
import es from '@/i18n/app/messages/es-419.json'
import pt from '@/i18n/app/messages/pt-BR.json'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: null }),
    useOptionalAuth: () => ({ user: null }),
}))

describe('post-KYC account-ready notice', () => {
    it.each([
        ['en', en, 'ARS needs one more step.'],
        ['es-419', es, 'ARS necesita un paso más.'],
        ['es-AR', es, 'ARS necesita un paso más.'],
        ['pt-BR', pt, 'ARS precisa de mais uma etapa.'],
    ] as const)('names the remaining currency in %s without showing success', (locale, messages, title) => {
        mockPush.mockClear()
        const onContinue = jest.fn()
        render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <KycVerificationInProgressModal
                    isOpen
                    onClose={jest.fn()}
                    phase="complete"
                    completionNotice={{ kind: 'action', currencies: ['ARS'] }}
                    onContinue={onContinue}
                    preparingTimedOut
                />
            </NextIntlClientProvider>
        )
        expect(screen.getByText(title)).toBeInTheDocument()
        expect(screen.queryByText(messages.kyc.progress.completeTitle)).not.toBeInTheDocument()
        expect(document.querySelector('.bg-background-icon-bubble-green')).not.toBeInTheDocument()
        expect(screen.queryByText('Taking longer than expected')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: messages.kyc.progress.viewAccounts }))
        expect(onContinue).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith('/profile/accounts')
    })

    it('describes review as outstanding rather than an enabled bank account', () => {
        render(
            <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
                <KycVerificationInProgressModal
                    isOpen
                    onClose={jest.fn()}
                    phase="complete"
                    completionNotice={{ kind: 'review', currencies: ['EUR'] }}
                />
            </NextIntlClientProvider>
        )
        expect(screen.getByText('EUR is still under review.')).toBeInTheDocument()
        expect(screen.getByText('We’ll let you know when the review is complete.')).toBeInTheDocument()
        expect(screen.queryByText('Your account is ready to go.')).not.toBeInTheDocument()
        expect(document.querySelector('.bg-background-icon-bubble-green')).not.toBeInTheDocument()
    })

    it('uses success for confirmed completion without an outstanding requirement', () => {
        render(
            <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
                <KycVerificationInProgressModal isOpen onClose={jest.fn()} phase="complete" />
            </NextIntlClientProvider>
        )
        expect(screen.getByText('All set')).toBeInTheDocument()
        expect(document.querySelector('.bg-background-icon-bubble-green')).toBeInTheDocument()
    })
})
