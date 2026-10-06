/**
 * The method unlock sheet (TASK-23329, D16). For a one-shot user who has not
 * passed the identity check, the sheet asks which ID the user will show,
 * stores the tapped feature with QR, and only then starts the check. For
 * everyone else it is today's sheet: no question, no request, the button
 * starts the check directly.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { __resetOneShotSessionForTests, useOneShotSession } from '@/hooks/useOneShotSession'
import type { KycIntentKey, KycIntentsConfig } from '@/services/kyc-intents'
import UnlockMethodModal from '../UnlockMethodModal'

const getConfig = jest.fn<Promise<KycIntentsConfig>, [string, string | undefined]>()
const setIntents = jest.fn()
jest.mock('@/services/kyc-intents', () => ({
    ...jest.requireActual('@/services/kyc-intents'),
    kycIntentsApi: {
        getConfig: (...args: [string, string | undefined]) => getConfig(...args),
        set: (...args: unknown[]) => setIntents(...args),
    },
}))

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

const open = { available: true }
const closed = (reason: string) => ({ available: false, reason })

// a Spanish resident: no local rails there, and a Venezuelan passport closes the card and the accounts
const answer = (residence: string, idCountry?: string): KycIntentsConfig => ({
    residence,
    intents: {
        qr: open,
        local: closed('local_residence_unsupported'),
        card: idCountry === 'VE' ? closed('document_country_unsupported') : open,
        bank: idCountry === 'VE' ? closed('document_country_unsupported') : open,
    },
})

const onUnlock = jest.fn()
const StoredSet = () => <output data-testid="stored-set">{JSON.stringify(useOneShotSession()?.intents ?? null)}</output>

const renderSheet = (feature?: KycIntentKey) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <IntlWrapper>
                <UnlockMethodModal
                    visible
                    onClose={jest.fn()}
                    onUnlock={onUnlock}
                    methodLabel="EUR · Bank transfer"
                    oneShot={feature ? { residence: 'ES', feature } : null}
                />
                <StoredSet />
            </IntlWrapper>
        </QueryClientProvider>
    )

const pickForeignId = async (country: string) => {
    fireEvent.click(screen.getByRole('radio', { name: 'ID issued by another country' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: country } })
    fireEvent.click(await screen.findByRole('option', { name: country }))
}

describe('UnlockMethodModal', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        __resetOneShotSessionForTests()
        getConfig.mockImplementation(async (residence, idCountry) => answer(residence, idCountry))
        setIntents.mockResolvedValue({ intents: {}, setAt: '2026-10-06T00:00:00.000Z' })
    })

    it("without the one-shot answer it is today's sheet: no question, no request, the button starts the check", () => {
        renderSheet()
        expect(screen.getByRole('heading', { name: 'Unlock EUR · Bank transfer' })).toBeInTheDocument()
        expect(screen.getByTestId('kyc-prep-checklist')).toBeInTheDocument()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'I have these, start' }))
        expect(onUnlock).toHaveBeenCalledTimes(1)
        expect(getConfig).not.toHaveBeenCalled()
        expect(setIntents).not.toHaveBeenCalled()
        expect(capture).not.toHaveBeenCalled()
        expect(screen.getByTestId('stored-set')).toHaveTextContent('null')
    })

    it('with a local ID it stores the tapped feature and QR, then starts the check', async () => {
        renderSheet('bank')
        // the method-worded title and the list of what to have ready stay
        expect(screen.getByRole('heading', { name: 'Unlock EUR · Bank transfer' })).toBeInTheDocument()
        expect(screen.getByTestId('kyc-prep-checklist')).toBeInTheDocument()
        expect(within(screen.getByRole('radiogroup', { name: 'Which ID to use?' })).getAllByRole('radio')).toHaveLength(
            2
        )
        expect(screen.getByRole('radio', { name: 'ID issued by Spain' })).toHaveAttribute('aria-checked', 'true')
        // no checklist: the tap already chose the feature
        expect(screen.queryByRole('switch')).not.toBeInTheDocument()

        const start = screen.getByRole('button', { name: 'I have these, start' })
        await waitFor(() => expect(start).toBeEnabled())
        expect(getConfig).toHaveBeenCalledWith('ES', undefined)
        expect(screen.queryByTestId('unlock-method-refused')).not.toBeInTheDocument()

        fireEvent.click(start)
        await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
        const stored = { qr: true, local: false, card: false, bank: true }
        expect(setIntents).toHaveBeenCalledWith(stored)
        // the setup drawer and the resume read this cell (item 9a)
        expect(screen.getByTestId('stored-set')).toHaveTextContent(JSON.stringify(stored))
        for (const event of ['onboarding_unlock_viewed', 'onboarding_unlock_continued']) {
            expect(capture).toHaveBeenCalledWith(event, {
                entry: 'method',
                residence: 'ES',
                document: 'local',
                intent_qr: true,
                intent_local: false,
                intent_card: false,
                intent_bank: true,
            })
        }
    })

    it('a foreign ID that cannot open the method says why and offers the check for QR alone', async () => {
        renderSheet('bank')
        await waitFor(() => expect(screen.getByRole('button', { name: 'I have these, start' })).toBeEnabled())
        fireEvent.click(screen.getByRole('radio', { name: 'ID issued by another country' }))
        // no issuing country yet: nothing to start on
        expect(screen.getByRole('button', { name: 'I have these, start' })).toBeDisabled()
        await pickForeignId('Venezuela')

        await waitFor(() => expect(getConfig).toHaveBeenCalledWith('ES', 'VE'))
        const refusal = await screen.findByTestId('unlock-method-refused')
        expect(refusal).toHaveTextContent('EUR · Bank transfer')
        expect(refusal).toHaveTextContent('Needs an ID issued by Spain')
        expect(screen.queryByRole('button', { name: 'I have these, start' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Unlock QR payments' }))
        await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
        expect(setIntents).toHaveBeenCalledWith({ qr: true, local: false, card: false, bank: false })
        expect(capture).toHaveBeenCalledWith(
            'onboarding_unlock_continued',
            expect.objectContaining({ entry: 'method', document: 'foreign', intent_qr: true, intent_bank: false })
        )
        // the answer reaches analytics, the issuing country never does
        expect(JSON.stringify(capture.mock.calls)).not.toMatch(/VE|Venezuela/)
    })

    it('a method the residence does not have reads Not available, with the QR start', async () => {
        renderSheet('local')
        const refusal = await screen.findByTestId('unlock-method-refused')
        expect(refusal).toHaveTextContent('Not available')
        fireEvent.click(screen.getByRole('button', { name: 'Unlock QR payments' }))
        await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
        expect(setIntents).toHaveBeenCalledWith({ qr: true, local: false, card: false, bank: false })
    })

    it('QR payments store QR alone and keep the plain start', async () => {
        renderSheet('qr')
        const start = screen.getByRole('button', { name: 'I have these, start' })
        await waitFor(() => expect(start).toBeEnabled())
        fireEvent.click(start)
        await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
        expect(setIntents).toHaveBeenCalledWith({ qr: true, local: false, card: false, bank: false })
    })

    it('a failed save shows the error and does not start the check', async () => {
        setIntents.mockRejectedValue(new Error('Failed to save kyc intents: 500'))
        renderSheet('bank')
        const start = screen.getByRole('button', { name: 'I have these, start' })
        await waitFor(() => expect(start).toBeEnabled())
        fireEvent.click(start)

        expect(await screen.findByText('Could not save your choices. Please try again.')).toBeInTheDocument()
        expect(onUnlock).not.toHaveBeenCalled()
        expect(capture).not.toHaveBeenCalledWith('onboarding_unlock_continued', expect.anything())
        expect(screen.getByTestId('stored-set')).toHaveTextContent('null')
    })

    it('a config that does not load offers a retry and starts nothing', async () => {
        getConfig.mockRejectedValueOnce(new Error('Failed to load kyc intents: 500'))
        renderSheet('bank')
        expect(await screen.findByText('Could not load the features to unlock.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'I have these, start' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'I have these, start' })).toBeEnabled())
    })
})
