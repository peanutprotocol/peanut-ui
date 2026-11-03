import { screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { NextAction } from '@/types/capabilities'
import { selectCardDocumentTask } from '@/utils/bridge-tasks.utils'
import en from '@/i18n/app/messages/en.json'
import { StepsScreen } from '../components/StepsScreen'
import { followUpStep } from '../followUps'

const steps = en.kyc.paperworkVerification.steps

const rowTexts = () =>
    within(screen.getByTestId('verify-steps'))
        .getAllByRole('listitem')
        .map((row) => ({
            text: row.textContent?.replace(` ${steps.done}`, ''),
            current: row.getAttribute('aria-current') === 'step',
            done: row.textContent?.includes(steps.done) ?? false,
        }))

// Staging, 2026-11-03: the card asked for a proof of address after the review passed, and the
// verified timeline showed every step green, Unlock included, with nothing about it.
describe('the verified timeline with a step a feature still asks for', () => {
    it('adds the step after the review, current, and Unlock waits behind it', () => {
        renderWithIntl(
            <StepsScreen
                phase="verified"
                followUps={['cardAddress']}
                note="Our card partner needs a proof of address to finish your application."
                cta="Continue"
                onBack={jest.fn()}
                onContinue={jest.fn()}
            />
        )
        expect(rowTexts()).toEqual([
            { text: steps.residence, current: false, done: true },
            { text: steps.questions, current: false, done: true },
            { text: steps.photo, current: false, done: true },
            { text: steps.selfie, current: false, done: true },
            { text: steps.review, current: false, done: true },
            { text: `6${steps.followUp.cardAddress}`, current: true, done: false },
            { text: `7${steps.unlock}`, current: false, done: false },
        ])
        expect(screen.getByTestId('verify-steps-note')).toHaveTextContent(
            'Our card partner needs a proof of address to finish your application.'
        )
        expect(screen.getByTestId('verify-verified-payments')).toHaveTextContent('Continue')
    })

    it('with nothing asked, every step is done and the button sets up payments', () => {
        renderWithIntl(<StepsScreen phase="verified" onBack={jest.fn()} onContinue={jest.fn()} />)
        expect(rowTexts().every((row) => row.done)).toBe(true)
        expect(screen.getByTestId('verify-steps-note')).toHaveTextContent(steps.verifiedNote)
        expect(screen.getByTestId('verify-verified-payments')).toHaveTextContent(steps.setUpPayments)
    })
})

describe('followUpStep', () => {
    const rainPoa: NextAction = {
        key: 'sumsub:proof_of_address',
        kind: 'sumsub',
        purpose: 'rain-card',
        levelKey: 'proof_of_address',
    }
    const cardTask = selectCardDocumentTask([rainPoa], {
        qr: { state: 'on' },
        bank: { state: 'on', accounts: {} },
        local: { state: 'on', accounts: {} },
        card: { state: 'action_required', action: rainPoa.key },
    })

    it("the card's proof of address is done on /card", () => {
        expect(followUpStep(cardTask!)).toEqual({
            label: 'cardAddress',
            note: 'home.pendingTasks.cardAddressDescription',
            href: '/card',
        })
    })

    it("a bank's asks are done from Home's task card", () => {
        expect(followUpStep({ key: 'accept-tos:sepa', kind: 'accept-tos', purpose: 'unlock-bridge' })).toMatchObject({
            label: 'bankTerms',
            href: '/home',
        })
        expect(
            followUpStep({ key: 'bridge-document:sumsub:poa', kind: 'sumsub', purpose: 'unlock-bridge' })
        ).toMatchObject({ label: 'bankDocument', note: 'kyc.setup.documentDescription', href: '/home' })
        expect(
            followUpStep({ key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'unlock-bridge', currency: 'EUR' })
        ).toMatchObject({ label: 'bankCheck', href: '/home' })
    })
})
