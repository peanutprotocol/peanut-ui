/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { IntlWrapper } from '@/test-utils/intl'
import { loadMessages } from '@/i18n/app/messages'
import { InitiateKycModal } from '../InitiateKycModal'

jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/add-money/argentina/bank',
}))

const bankAction = { key: 'manteca-kyc-action:AR', kind: 'sumsub', purpose: 'unlock-manteca-bank' } as const

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) =>
    render(
        <IntlWrapper>
            <InitiateKycModal
                visible
                onClose={jest.fn()}
                onVerify={jest.fn()}
                presentation="page"
                variant="provider_rejection"
                nextAction={bankAction}
                {...props}
            />
        </IntlWrapper>
    )

describe('Manteca bank action copy', () => {
    it.each(['manteca_action_incomplete', 'manteca_action_expired'])(
        '%s continues bank setup without suggesting a document upload',
        (reasonCode) => {
            const onVerify = jest.fn()
            renderModal({ reasonCode, onVerify })

            expect(screen.getByRole('heading', { name: 'Finish your bank setup' })).toBeInTheDocument()
            const button = screen.getByRole('button', { name: 'Continue verification' })
            expect(button.querySelector('svg')).toBeNull()
            expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument()
            fireEvent.click(button)
            expect(onVerify).toHaveBeenCalledTimes(1)
        }
    )

    it('keeps correction wording and invokes verification once without an upload icon', () => {
        const onVerify = jest.fn()
        renderModal({ reasonCode: 'manteca_action_correction_required', onVerify })

        expect(screen.getByRole('heading', { name: 'Correct bank verification details' })).toBeInTheDocument()
        const button = screen.getByRole('button', { name: 'Correct details' })
        expect(button.querySelector('svg')).toBeNull()
        fireEvent.click(button)
        expect(onVerify).toHaveBeenCalledTimes(1)
    })

    it.each(['requirements_missing', 'eea_tin_reupload'])(
        '%s retains its document upload wording and icon',
        (reasonCode) => {
            renderModal({ reasonCode, nextAction: undefined })

            expect(screen.getByRole('heading', { name: 'One more document needed' })).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Upload document' }).querySelector('svg')).not.toBeNull()
            expect(screen.queryByRole('heading', { name: 'Finish your bank setup' })).not.toBeInTheDocument()
        }
    )

    it('retains the EEA questionnaire copy and action', () => {
        renderModal({
            reasonCode: 'eea_uplift',
            nextAction: { key: 'sumsub:eea_uplift', kind: 'sumsub', purpose: 'unlock', levelKey: 'eea_uplift' },
        })

        expect(
            screen.getByText('We need some additional information to comply with EEA regulations.')
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Answer questions' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Finish your bank setup' })).not.toBeInTheDocument()
    })

    it.each([
        ['es-419', 'Termina de configurar tu cuenta bancaria'],
        ['es-AR', 'Terminá de configurar tu cuenta bancaria'],
        ['pt-BR', 'Conclua a configuração da sua conta bancária'],
    ] as const)('renders the approved %s bank setup heading', async (locale, heading) => {
        const messages = await loadMessages(locale)
        render(
            <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                <InitiateKycModal
                    visible
                    onClose={jest.fn()}
                    onVerify={jest.fn()}
                    presentation="page"
                    variant="provider_rejection"
                    reasonCode="manteca_action_incomplete"
                    nextAction={bankAction}
                />
            </NextIntlClientProvider>
        )

        expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })
})
