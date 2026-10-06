/**
 * The unlock checklist on screen (TASK-23329): the rows the config answers,
 * every open row ticked, the ID answer re-querying with the issuing country of
 * a foreign ID, and Continue storing the ticked set before the SDK opens.
 */
/** @jest-environment jsdom */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import type { KycIntentsConfig } from '@/services/kyc-intents'
import { UnlockChecklistStep } from '../UnlockChecklistStep'

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

const answer = (residence: string, idCountry?: string): KycIntentsConfig => {
    if (residence === 'AR' && idCountry === 'VE') {
        return {
            residence,
            intents: {
                qr: open,
                local: closed('document_country_unsupported'),
                card: closed('document_country_unsupported'),
                bank: closed('document_country_unsupported'),
            },
        }
    }
    if (residence === 'IN') {
        return {
            residence,
            intents: {
                qr: open,
                local: closed('local_residence_unsupported'),
                card: closed('geo-blocked'),
                bank: open,
            },
        }
    }
    return { residence, intents: { qr: open, local: open, card: open, bank: open } }
}

const onVerify = jest.fn()
const onExplore = jest.fn()

const renderStep = (residence: string) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <IntlWrapper>
                <UnlockChecklistStep
                    residence={residence}
                    host="page"
                    prepPath="extended"
                    isLoading={false}
                    onVerify={onVerify}
                    onExplore={onExplore}
                    onSavingChange={jest.fn()}
                />
            </IntlWrapper>
        </QueryClientProvider>
    )

describe('UnlockChecklistStep', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getConfig.mockImplementation(async (residence, idCountry) => answer(residence, idCountry))
        setIntents.mockResolvedValue({ intents: {}, setAt: '2026-10-05T00:00:00.000Z' })
    })

    it('ticks every feature an Argentine DNI unlocks and stores the set before the SDK', async () => {
        renderStep('AR')
        expect(screen.getByRole('heading', { name: 'What to unlock in Argentina' })).toBeInTheDocument()
        const toggles = await screen.findAllByRole('switch')
        expect(toggles).toHaveLength(4)
        expect(toggles.every((toggle) => toggle.getAttribute('aria-checked') === 'true')).toBe(true)
        expect(getConfig).toHaveBeenCalledWith('AR', undefined)

        fireEvent.click(screen.getByRole('switch', { name: 'Peanut Card' }))
        fireEvent.click(screen.getByRole('button', { name: 'Unlock features' }))
        await waitFor(() => expect(onVerify).toHaveBeenCalled())
        expect(setIntents).toHaveBeenCalledWith({ qr: true, local: true, card: false, bank: true })
        expect(capture).toHaveBeenCalledWith(
            'onboarding_unlock_continued',
            expect.objectContaining({ residence: 'AR', document: 'local', intent_card: false })
        )
    })

    it('re-queries with the issuing country of a foreign ID and closes the rows that ID cannot open', async () => {
        renderStep('AR')
        await screen.findAllByRole('switch')
        fireEvent.click(screen.getByRole('radio', { name: 'ID issued by another country' }))
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Venezuela' } })
        fireEvent.click(await screen.findByRole('option', { name: 'Venezuela' }))

        await waitFor(() => expect(getConfig).toHaveBeenCalledWith('AR', 'VE'))
        expect(await screen.findByRole('button', { name: 'Unlock QR payments' })).toBeInTheDocument()
        expect(screen.getAllByRole('switch')).toHaveLength(1)
        expect(
            within(screen.getByTestId('unlock-row-card')).getByText('Needs an ID issued by Argentina')
        ).toBeInTheDocument()
    })

    it('shows no card row to a resident of India', async () => {
        renderStep('IN')
        await screen.findAllByRole('switch')
        expect(screen.queryByTestId('unlock-row-card')).not.toBeInTheDocument()
        expect(screen.queryByTestId('unlock-row-local')).not.toBeInTheDocument()
        expect(screen.getByTestId('unlock-row-bank')).toBeInTheDocument()
    })

    // the method unlock sheet sends the same events with entry: 'method' (item 8c)
    it('names the checklist as the entry on its events', async () => {
        renderStep('AR')
        await screen.findAllByRole('switch')
        expect(capture).toHaveBeenCalledWith(
            'onboarding_unlock_viewed',
            expect.objectContaining({ entry: 'checklist', intent_card: true })
        )
    })

    // Chip review on ui#3577: what the screen shows must be what the API stores
    it('holds the choices still while the save is in flight', async () => {
        let finishSave: () => void = () => {}
        setIntents.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishSave = () => resolve({ intents: {}, setAt: '2026-10-05T00:00:00.000Z' })
                })
        )
        renderStep('AR')
        await screen.findAllByRole('switch')
        fireEvent.click(screen.getByRole('button', { name: 'Unlock features' }))
        await waitFor(() => expect(setIntents).toHaveBeenCalledWith({ qr: true, local: true, card: true, bank: true }))

        const card = screen.getByRole('switch', { name: 'Peanut Card' })
        await waitFor(() => expect(card).toBeDisabled())
        fireEvent.click(card)
        fireEvent.click(screen.getByRole('radio', { name: 'ID issued by another country' }))
        expect(card).toHaveAttribute('aria-checked', 'true')
        expect(screen.getByRole('radio', { name: 'Argentine DNI' })).toHaveAttribute('aria-checked', 'true')
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

        await act(async () => finishSave())
        await waitFor(() => expect(onVerify).toHaveBeenCalledTimes(1))
        expect(capture).toHaveBeenCalledWith(
            'onboarding_unlock_continued',
            expect.objectContaining({ document: 'local', intent_card: true })
        )
    })

    it('"Not now" offers exploring first and leaves without storing anything', async () => {
        renderStep('AR')
        await screen.findAllByRole('switch')
        fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Explore first' }))
        expect(onExplore).toHaveBeenCalled()
        expect(setIntents).not.toHaveBeenCalled()
        expect(capture).toHaveBeenCalledWith('onboarding_unlock_skipped', expect.objectContaining({ residence: 'AR' }))
    })
})
