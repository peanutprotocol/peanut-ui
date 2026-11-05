import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { render } from '@testing-library/react'
import { KycVerificationInProgressModal } from '../KycVerificationInProgressModal'
import en from '@/i18n/app/messages/en.json'
import es from '@/i18n/app/messages/es-419.json'
import pt from '@/i18n/app/messages/pt-BR.json'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: null }),
    useOptionalAuth: () => ({ user: null }),
}))

describe('post-KYC account-ready notice', () => {
    it.each([
        ['en', en, 'Your account is ready', 'ARS needs one more step.'],
        ['es-419', es, 'Tu cuenta está lista', 'ARS necesita un paso más.'],
        ['es-AR', es, 'Tu cuenta está lista', 'ARS necesita un paso más.'],
        ['pt-BR', pt, 'Sua conta está pronta', 'ARS precisa de mais uma etapa.'],
    ] as const)('names the remaining currency in %s without a timeout warning', (locale, messages, title, copy) => {
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
        expect(screen.getByText(copy)).toBeInTheDocument()
        expect(screen.queryByText('Taking longer than expected')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /continue|continuar/i }))
        expect(onContinue).toHaveBeenCalledTimes(1)
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
        expect(screen.getByText('Your account is ready')).toBeInTheDocument()
        expect(screen.getByText('EUR is still under review. We’ll let you know when it’s ready.')).toBeInTheDocument()
        expect(screen.queryByText('Your account is ready to go.')).not.toBeInTheDocument()
    })
})
