import { screen, within } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { FeatureReport, NextAction } from '@/types/capabilities'
import { selectCardDocumentTask } from '@/utils/bridge-tasks.utils'
import en from '@/i18n/app/messages/en.json'
import { StepsScreen } from '../components/StepsScreen'
import { followUpStep, verifiedFollowUps } from '../followUps'

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

// Chip, ui#3913: a dated request on a working bank feature made "Unlock eligible payments" look locked.
describe('verifiedFollowUps', () => {
    const dated = '2099-01-01T00:00:00Z'
    const terms: NextAction = {
        key: 'accept-tos:sepa',
        kind: 'accept-tos',
        purpose: 'unlock-bridge',
        effectiveDate: dated,
    }
    const hosted: NextAction = {
        key: 'bridge-hosted',
        kind: 'bridge-hosted',
        purpose: 'unlock-bridge',
        currency: 'EUR',
        effectiveDate: dated,
    }
    const report = (bank: FeatureReport['bank']): FeatureReport => ({
        qr: { state: 'on' },
        bank,
        local: { state: 'on', accounts: {} },
        card: { state: 'on' },
    })

    it("a dated request on a bank feature that is on is Home's, not a step: Unlock stays done", () => {
        expect(verifiedFollowUps([terms], report({ state: 'on', action: terms.key, accounts: {} }))).toEqual([])
        expect(verifiedFollowUps([hosted], report({ state: 'on', action: hosted.key, accounts: {} }))).toEqual([])
    })

    it('the same request once its feature waits on it is a step', () => {
        expect(
            verifiedFollowUps([terms], report({ state: 'action_required', action: terms.key, accounts: {} }))
        ).toEqual([{ label: 'bankTerms', note: 'home.pendingTasks.tosDescription', href: '/home' }])
    })

    it("the card's proof of address is a step", () => {
        const rainPoa: NextAction = {
            key: 'sumsub:proof_of_address',
            kind: 'sumsub',
            purpose: 'rain-card',
            levelKey: 'proof_of_address',
        }
        expect(
            verifiedFollowUps([rainPoa], {
                ...report({ state: 'on', accounts: {} }),
                card: { state: 'action_required', action: rainPoa.key },
            }).map((step) => step.label)
        ).toEqual(['cardAddress'])
    })
})
