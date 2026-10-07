/**
 * The method unlock sheet (TASK-23329, D16). For a one-shot user who has not
 * passed the identity check, the sheet asks which ID the user will show,
 * stores the tapped feature with QR, and only then starts the check. For one
 * who passed it, the sheet adds the feature to the stored set and the API sets
 * it up with no new check. For everyone else it is today's sheet: no question,
 * no request, the button starts the check directly.
 */
/** @jest-environment jsdom */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { USER } from '@/constants/query.consts'
import { __resetOneShotSessionForTests, recordOneShotIntents } from '@/hooks/useOneShotSession'
import type { FeatureSetupReport, KycIntentKey, KycIntentsConfig, KycIntentSet } from '@/services/kyc-intents'
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

// what /users/me says: the verified sheet reads the stored set again right before the save
type MockUser = {
    identityVerification?: { status: string; oneShot?: boolean; kycIntents?: KycIntentSet; kycIntentsSetAt?: string }
}
let mockUser: MockUser | null = null
const fetchUser = jest.fn<Promise<MockUser | null>, [unknown?]>()
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: (...args: [unknown?]) => fetchUser(...args) }),
}))

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
const onClose = jest.fn()
const onOneShotDone = jest.fn()
const onOneShotVerifyAgain = jest.fn()
const SET_AT = '2026-10-06T00:00:00.000Z'

let client: QueryClient
// the set the save wrote into the cached user: what the flow hook and the drawer read (item 3b)
const storedSet = () =>
    (client.getQueryData([USER]) as { identityVerification?: { kycIntents?: KycIntentSet } } | undefined)
        ?.identityVerification?.kycIntents ?? null

const renderSheet = (oneShot?: { residence: string; feature: KycIntentKey; verified?: boolean }) =>
    render(
        <QueryClientProvider client={client}>
            <IntlWrapper>
                <UnlockMethodModal
                    visible
                    onClose={onClose}
                    onUnlock={onUnlock}
                    methodLabel="EUR · Bank transfer"
                    oneShot={oneShot ?? null}
                    onOneShotDone={onOneShotDone}
                    onOneShotVerifyAgain={onOneShotVerifyAgain}
                />
            </IntlWrapper>
        </QueryClientProvider>
    )
const renderBefore = (feature?: KycIntentKey) => renderSheet(feature ? { residence: 'ES', feature } : undefined)

const pickForeignId = async (country: string) => {
    fireEvent.click(screen.getByRole('radio', { name: 'ID issued by another country' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: country } })
    fireEvent.click(await screen.findByRole('option', { name: country }))
}

describe('UnlockMethodModal', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        client.setQueryData([USER], { identityVerification: { status: 'not_started', oneShot: true } })
        mockUser = null
        __resetOneShotSessionForTests()
        fetchUser.mockImplementation(async () => mockUser)
        getConfig.mockImplementation(async (residence, idCountry) => answer(residence, idCountry))
        // the API echoes the stored set
        setIntents.mockImplementation(async (set: KycIntentSet) => ({ intents: set, setAt: SET_AT }))
    })

    it("without the one-shot answer it is today's sheet: no question, no request, the button starts the check", () => {
        renderBefore()
        expect(screen.getByRole('heading', { name: 'Unlock EUR · Bank transfer' })).toBeInTheDocument()
        expect(screen.getByTestId('kyc-prep-checklist')).toBeInTheDocument()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'I have these, start' }))
        expect(onUnlock).toHaveBeenCalledTimes(1)
        expect(getConfig).not.toHaveBeenCalled()
        expect(setIntents).not.toHaveBeenCalled()
        expect(capture).not.toHaveBeenCalled()
        expect(storedSet()).toBeNull()
    })

    it('with a local ID it stores the tapped feature and QR, then starts the check', async () => {
        renderBefore('bank')
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
        // the setup drawer and the resume read the cached user (items 9a and 3b)
        expect(storedSet()).toEqual(stored)
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
        renderBefore('bank')
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
        renderBefore('local')
        const refusal = await screen.findByTestId('unlock-method-refused')
        expect(refusal).toHaveTextContent('Not available')
        fireEvent.click(screen.getByRole('button', { name: 'Unlock QR payments' }))
        await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
        expect(setIntents).toHaveBeenCalledWith({ qr: true, local: false, card: false, bank: false })
    })

    it('QR payments store QR alone and keep the plain start', async () => {
        renderBefore('qr')
        const start = screen.getByRole('button', { name: 'I have these, start' })
        await waitFor(() => expect(start).toBeEnabled())
        fireEvent.click(start)
        await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
        expect(setIntents).toHaveBeenCalledWith({ qr: true, local: false, card: false, bank: false })
    })

    it('a failed save shows the error and does not start the check', async () => {
        setIntents.mockRejectedValue(new Error('Failed to save kyc intents: 500'))
        renderBefore('bank')
        const start = screen.getByRole('button', { name: 'I have these, start' })
        await waitFor(() => expect(start).toBeEnabled())
        fireEvent.click(start)

        expect(await screen.findByText('Could not save your choices. Please try again.')).toBeInTheDocument()
        expect(onUnlock).not.toHaveBeenCalled()
        expect(capture).not.toHaveBeenCalledWith('onboarding_unlock_continued', expect.anything())
        expect(storedSet()).toBeNull()
    })

    it('a config that does not load offers a retry and starts nothing', async () => {
        getConfig.mockRejectedValueOnce(new Error('Failed to load kyc intents: 500'))
        renderBefore('bank')
        expect(await screen.findByText('Could not load the features to unlock.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'I have these, start' })).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'I have these, start' })).toBeEnabled())
    })

    // Chip review on ui#3584: a sheet dismissed during the save must not open the check when the answer lands
    it('cannot be dismissed while the save is in flight, and starts the check when it lands', async () => {
        let finishSave: () => void = () => {}
        setIntents.mockImplementation(
            (set: KycIntentSet) =>
                new Promise((resolve) => {
                    finishSave = () => resolve({ intents: set, setAt: SET_AT })
                })
        )
        const dismiss = () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        renderBefore('bank')
        const start = screen.getByRole('button', { name: 'I have these, start' })
        await waitFor(() => expect(start).toBeEnabled())
        // at rest the sheet closes as it always did
        dismiss()
        expect(onClose).toHaveBeenCalledTimes(1)

        fireEvent.click(start)
        await waitFor(() => expect(setIntents).toHaveBeenCalledTimes(1))
        dismiss()
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onUnlock).not.toHaveBeenCalled()

        await act(async () => finishSave())
        await waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1))
        // the lock ends with the save
        await waitFor(() => {
            dismiss()
            expect(onClose).toHaveBeenCalledTimes(2)
        })
    })

    describe('a one-shot user who already passed the check (item 8c, second part)', () => {
        const STORED = { qr: true, local: true, card: false, bank: false }
        const features = (bank: FeatureSetupReport['bank']): FeatureSetupReport => ({
            qr: { state: 'on' },
            local: { state: 'on' },
            card: { state: 'not_requested' },
            bank,
        })
        const answerWith = (bank: FeatureSetupReport['bank'] | null) =>
            setIntents.mockImplementation(async (set: KycIntentSet) => ({
                intents: set,
                setAt: SET_AT,
                ...(bank ? { features: features(bank) } : {}),
            }))
        const renderVerified = () => renderSheet({ residence: 'BR', feature: 'bank', verified: true })

        beforeEach(() => {
            mockUser = {
                identityVerification: {
                    status: 'verified',
                    oneShot: true,
                    kycIntents: STORED,
                    kycIntentsSetAt: SET_AT,
                },
            }
            client.setQueryData([USER], mockUser)
        })

        it('asks no ID question, lists nothing to have ready, and adds the feature to the stored set with no check', async () => {
            answerWith({ state: 'setting_up' })
            renderVerified()
            expect(screen.getByRole('heading', { name: 'Unlock EUR · Bank transfer' })).toBeInTheDocument()
            expect(screen.getByText('Identity verified. No new check needed.')).toBeInTheDocument()
            expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
            expect(screen.queryByTestId('kyc-prep-checklist')).not.toBeInTheDocument()
            expect(getConfig).not.toHaveBeenCalled()

            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            await waitFor(() => expect(onOneShotDone).toHaveBeenCalledTimes(1))
            // the set is read again before the save, so a tick another device added is kept
            expect(fetchUser).toHaveBeenCalledWith({ throwOnError: true })
            // the stored ticks stay, QR stays, the tapped feature joins
            const merged = { qr: true, local: true, card: false, bank: true }
            expect(setIntents).toHaveBeenCalledWith(merged)
            expect(storedSet()).toEqual(merged)
            expect(onOneShotDone).toHaveBeenCalledWith({ kind: 'setup', report: features({ state: 'setting_up' }) })
            // no SDK start and no checklist event
            expect(onUnlock).not.toHaveBeenCalled()
            expect(capture).not.toHaveBeenCalled()
        })

        it('a tick another device added since the page loaded is kept', async () => {
            answerWith({ state: 'setting_up' })
            // the cached user still says QR only; the fresh read says a second device added the card
            client.setQueryData([USER], {
                identityVerification: { status: 'verified', oneShot: true, kycIntents: { ...STORED, local: false } },
            })
            fetchUser.mockResolvedValue({
                identityVerification: {
                    status: 'verified',
                    oneShot: true,
                    kycIntents: { qr: true, local: false, card: true, bank: false },
                    kycIntentsSetAt: '2026-10-07T11:00:00.000Z',
                },
            })
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            await waitFor(() => expect(onOneShotDone).toHaveBeenCalledTimes(1))
            expect(setIntents).toHaveBeenCalledWith({ qr: true, local: false, card: true, bank: true })
        })

        it("a /users/me behind this tab's own save does not lose that save", async () => {
            answerWith({ state: 'setting_up' })
            // this tab stored the card a moment ago; the fresh read is a replica that has not seen it
            recordOneShotIntents({ qr: true, local: true, card: true, bank: false }, '2026-10-07T11:00:00.000Z')
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            await waitFor(() => expect(onOneShotDone).toHaveBeenCalledTimes(1))
            expect(setIntents).toHaveBeenCalledWith({ qr: true, local: true, card: true, bank: true })
        })

        it('a read that fails shows the save error and sends nothing', async () => {
            fetchUser.mockRejectedValue(new Error('network'))
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            expect(await screen.findByText('Could not save your choices. Please try again.')).toBeInTheDocument()
            expect(setIntents).not.toHaveBeenCalled()
            expect(onOneShotDone).not.toHaveBeenCalled()
        })

        it('a method already on hands back on', async () => {
            answerWith({ state: 'on' })
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            await waitFor(() => expect(onOneShotDone).toHaveBeenCalledWith({ kind: 'on' }))
        })

        it('no features in the answer: the drawer reads the rails', async () => {
            answerWith(null)
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            await waitFor(() => expect(onOneShotDone).toHaveBeenCalledWith({ kind: 'setup', report: null }))
        })

        it('a document the plan does not take says which ID would, and offers a new check with it', async () => {
            answerWith({ state: 'refused', reason: 'document_country_unsupported' })
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            const refusal = await screen.findByTestId('unlock-method-refused')
            expect(refusal).toHaveTextContent('EUR · Bank transfer')
            expect(refusal).toHaveTextContent('Needs an ID issued by Brazil')
            expect(onOneShotDone).not.toHaveBeenCalled()
            expect(screen.queryByRole('button', { name: 'Set up now' })).not.toBeInTheDocument()
            expect(screen.getByText('Starts a new identity check.')).toBeInTheDocument()

            fireEvent.click(screen.getByRole('button', { name: 'Verify again with a Brazil ID' }))
            expect(onOneShotVerifyAgain).toHaveBeenCalledTimes(1)
            expect(onUnlock).not.toHaveBeenCalled()
        })

        it('a setup the API could not start yet says to check back, and hands nothing back', async () => {
            answerWith({ state: 'pending' })
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            const note = await screen.findByTestId('unlock-method-pending')
            expect(note).toHaveTextContent('EUR · Bank transfer')
            expect(note).toHaveTextContent('Setting up. Check back later.')
            expect(onOneShotDone).not.toHaveBeenCalled()
            expect(screen.queryByRole('button')).not.toBeInTheDocument()
            // the tick is saved: the next save sets it up
            expect(storedSet()).toEqual({ qr: true, local: true, card: false, bank: true })
        })

        it('another refusal reads its own reason, with no way forward here', async () => {
            answerWith({ state: 'refused', reason: 'under_minimum_age' })
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            expect(await screen.findByTestId('unlock-method-refused')).toHaveTextContent('Only from age 18')
            expect(screen.queryByRole('button')).not.toBeInTheDocument()
        })

        it('a failed save shows the error and hands nothing back', async () => {
            setIntents.mockRejectedValue(new Error('Failed to save kyc intents: 500'))
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            expect(await screen.findByText('Could not save your choices. Please try again.')).toBeInTheDocument()
            expect(onOneShotDone).not.toHaveBeenCalled()
            expect(storedSet()).toEqual(STORED)
        })

        it('cannot be dismissed while the save is in flight', async () => {
            let finishSave: () => void = () => {}
            setIntents.mockImplementation(
                (set: KycIntentSet) =>
                    new Promise((resolve) => {
                        finishSave = () => resolve({ intents: set, setAt: SET_AT, features: features({ state: 'on' }) })
                    })
            )
            renderVerified()
            fireEvent.click(screen.getByRole('button', { name: 'Set up now' }))
            await waitFor(() => expect(setIntents).toHaveBeenCalledTimes(1))
            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
            expect(onClose).not.toHaveBeenCalled()
            await act(async () => finishSave())
            await waitFor(() => expect(onOneShotDone).toHaveBeenCalledWith({ kind: 'on' }))
        })
    })
})
