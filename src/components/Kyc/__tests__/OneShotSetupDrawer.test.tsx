/**
 * The setup drawer after a one-shot SDK session (TASK-23329, item 9a): the
 * checklist's row names, one badge per state, and a button that leaves until
 * every feature is available, then continues.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { SetupRow } from '@/utils/one-shot-setup.utils'
import { OneShotSetupDrawer } from '../OneShotSetupDrawer'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

type Extra = Partial<Omit<React.ComponentProps<typeof OneShotSetupDrawer>, 'open' | 'residence' | 'rows'>>

const renderDrawer = (rows: SetupRow[], residence = 'BR', extra: Extra = {}) => {
    const onClose = jest.fn()
    const onContinue = jest.fn()
    render(
        <IntlWrapper>
            <OneShotSetupDrawer
                open
                residence={residence}
                rows={rows}
                onClose={onClose}
                onContinue={onContinue}
                {...extra}
            />
        </IntlWrapper>
    )
    return { onClose, onContinue }
}

describe('OneShotSetupDrawer', () => {
    beforeEach(() => push.mockClear())

    it('names every ticked feature as the checklist did, with the badge of its state', () => {
        renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'under-review' },
            { key: 'card', state: 'setting-up' },
            { key: 'bank', state: 'setting-up' },
        ])
        const row = (key: string) => within(screen.getByTestId(`setup-row-${key}`))
        expect(row('qr').getByText('QR payments')).toBeInTheDocument()
        expect(row('qr').getByText('Available')).toBeInTheDocument()
        expect(row('local').getByText('BRL bank transfers')).toBeInTheDocument()
        expect(row('local').getByText('Under review')).toBeInTheDocument()
        expect(row('card').getByText('Peanut Card')).toBeInTheDocument()
        expect(row('card').getByText('Setting up')).toBeInTheDocument()
        expect(row('bank').getByText('USD and EUR accounts')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Setting up' })).toBeInTheDocument()
    })

    it('while a feature is not available yet, the button leaves for Home', () => {
        const { onClose, onContinue } = renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'card', state: 'setting-up' },
        ])
        fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith('/home')
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('once every feature is available it reads all set and continues', () => {
        const { onClose, onContinue } = renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'card', state: 'available' },
        ])
        expect(screen.getByRole('heading', { name: 'All set' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onContinue).toHaveBeenCalledTimes(1)
        expect(onClose).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })

    it('names local bank transfers for the residence', () => {
        renderDrawer([{ key: 'local', state: 'setting-up' }], 'AR')
        expect(screen.getByText('ARS bank transfers')).toBeInTheDocument()
    })

    describe('the states of item 9b', () => {
        const row = (key: string) => within(screen.getByTestId(`setup-row-${key}`))

        it('a photo to retake heads the drawer and its button reopens the check', () => {
            const onRetake = jest.fn()
            renderDrawer([{ key: 'qr', state: 'under-review' }], 'BR', { retake: true, onRetake })
            expect(screen.getByRole('heading', { name: 'One photo to retake' })).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Retake photo' }))
            expect(onRetake).toHaveBeenCalledTimes(1)
        })

        it('open card agreements: the row says so and the button continues the card setup', () => {
            const onResumeCard = jest.fn()
            renderDrawer(
                [
                    { key: 'qr', state: 'available' },
                    { key: 'card', state: 'agreements-needed' },
                ],
                'BR',
                { onResumeCard }
            )
            expect(row('card').getByText('Agreements needed')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Continue card setup' }))
            expect(onResumeCard).toHaveBeenCalledTimes(1)
            // leaving stays possible, as a link
            fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }))
            expect(push).toHaveBeenCalledWith('/home')
        })

        it('needs a local ID: the row names the country and the button starts a new check with it', () => {
            const onVerifyAgain = jest.fn()
            renderDrawer(
                [
                    { key: 'qr', state: 'available' },
                    { key: 'card', state: 'needs-local-id' },
                    { key: 'bank', state: 'needs-local-id' },
                ],
                'BR',
                { onVerifyAgain }
            )
            expect(row('card').getByText('Verify ID')).toBeInTheDocument()
            expect(row('card').getByText('Needs an ID issued by Brazil')).toBeInTheDocument()
            expect(screen.getByText('This starts a new identity check with that ID.')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Verify again with a Brazil ID' }))
            expect(onVerifyAgain).toHaveBeenCalledTimes(1)
        })

        it('a document asked by a provider: Upload now opens the step, Later leaves', () => {
            const onUploadDocument = jest.fn()
            const step = { provider: 'bridge' as const, reasonCode: 'proof_of_address' }
            const { onClose } = renderDrawer([{ key: 'bank', state: 'document-needed', step }], 'BR', {
                onUploadDocument,
            })
            expect(row('bank').getByText('Document needed')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Upload now' }))
            expect(onUploadDocument).toHaveBeenCalledWith(step)
            fireEvent.click(screen.getByRole('button', { name: 'Later' }))
            expect(onClose).toHaveBeenCalledTimes(1)
            expect(push).toHaveBeenCalledWith('/home')
        })

        it('the card step outranks a local-ID ask, which outranks a document', () => {
            renderDrawer(
                [
                    { key: 'local', state: 'document-needed', step: { provider: 'manteca' } },
                    { key: 'card', state: 'agreements-needed' },
                    { key: 'bank', state: 'needs-local-id' },
                ],
                'BR',
                { onResumeCard: jest.fn(), onVerifyAgain: jest.fn(), onUploadDocument: jest.fn() }
            )
            expect(screen.getByRole('button', { name: 'Continue card setup' })).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /Verify again/ })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Upload now' })).not.toBeInTheDocument()
        })

        it('an application a person checks reads under review with its line, and offers no retry', () => {
            renderDrawer([{ key: 'card', state: 'checking' }])
            expect(row('card').getByText('Under review')).toBeInTheDocument()
            expect(row('card').getByText('We are checking the application. Nothing to do for now.')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument()
        })

        it('a refused occupation reads not available and points to support', () => {
            const onContactSupport = jest.fn()
            renderDrawer([{ key: 'card', state: 'occupation-not-accepted' }], 'BR', { onContactSupport })
            expect(row('card').getByText('Not available')).toBeInTheDocument()
            expect(row('card').getByText('The occupation given is not accepted for the card.')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
            expect(onContactSupport).toHaveBeenCalledTimes(1)
        })

        it('a failed card request shows in a callout with a retry', () => {
            const onRetryCard = jest.fn()
            renderDrawer([{ key: 'card', state: 'setting-up' }], 'BR', { cardError: 'Network down', onRetryCard })
            expect(screen.getByRole('alert')).toHaveTextContent('Network down')
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            expect(onRetryCard).toHaveBeenCalledTimes(1)
        })
    })
})
