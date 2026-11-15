/** @jest-environment jsdom */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import ResidenceChangeDrawer from '@/components/Profile/views/ResidenceChangeDrawer'
import { updateUserById } from '@/app/actions/users'
import { readSecondResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { KYC_INTENTS_BY_COUNTRY } from '@/test-utils/kycIntents.fixture'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PaperworkVerificationTrackingProvider } from '@/features/paperwork-verification/analytics'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
let mockRestrictionsKnown = true
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    useResidenceRestrictionSets: () =>
        mockRestrictionsKnown
            ? {
                  full: new Set(['RU']),
                  cardOnly: new Set<string>(),
                  bankingOnly: new Set<string>(),
                  refusedIdIssuers: new Set<string>(),
                  bankingNewCustomersOnly: new Set<string>(),
              }
            : null,
}))
// Off by default: the older cases pin the save mechanics, not what a move closes.
let mockIntents = false
jest.mock('@/hooks/useKycIntents', () => ({
    useKycIntents: (country: string | null) => ({
        intents: mockIntents && country ? KYC_INTENTS_BY_COUNTRY[country] : undefined,
        settled: true,
    }),
}))
const mockedUpdate = updateUserById as jest.MockedFunction<typeof updateUserById>

const render = (props?: Partial<React.ComponentProps<typeof ResidenceChangeDrawer>>) => {
    const onClose = jest.fn()
    const onSaved = jest.fn()
    const onReverify = jest.fn()
    rtlRender(
        <ResidenceChangeDrawer
            visible
            onClose={onClose}
            userId="u1"
            declared="ES"
            verified="BR"
            onSaved={onSaved}
            onReverify={onReverify}
            {...props}
        />,
        { wrapper: IntlWrapper }
    )
    return { onClose, onSaved, onReverify }
}

describe('ResidenceChangeDrawer', () => {
    beforeEach(() => {
        mockRestrictionsKnown = true
        jest.clearAllMocks()
        window.localStorage.clear()
        mockedUpdate.mockResolvedValue({ data: undefined })
        mockIntents = false
    })

    // Slava, 2026-10-27: an approved move into a country that restricts a service closes it.
    it('names what a verified user loses before the move, and asks them to confirm', async () => {
        mockIntents = true
        const { onClose } = render({ declared: 'PT', verified: 'PT', pending: 'VE' })
        expect(screen.getByTestId('residence-change-lost')).toHaveTextContent(
            "Venezuela doesn't allow the Peanut card and bank accounts. They pause when you submit your move."
        )
        fireEvent.click(screen.getByText('Move anyway'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'VE' })
    })

    it('says nothing about losses when the new country opens the same services', () => {
        mockIntents = true
        render({ declared: 'PT', verified: 'PT', pending: 'DE' })
        expect(screen.queryByTestId('residence-change-lost')).not.toBeInTheDocument()
        expect(screen.getByText('Save')).toBeInTheDocument()
    })

    it('saves the requested residence, refetches, and closes without starting verification', async () => {
        const { onClose, onSaved, onReverify } = render()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'ES' })
        expect(onSaved).toHaveBeenCalled()
        expect(onReverify).not.toHaveBeenCalled()
    })

    it('changing the dropdown only updates the selection; Save persists without starting verification', async () => {
        const { onClose, onReverify } = render({ declared: 'BR', verified: 'BR' })
        for (const country of ['France', 'Germany']) {
            fireEvent.click(screen.getByRole('combobox'))
            fireEvent.click(screen.getByText(country))
        }
        expect(mockedUpdate).not.toHaveBeenCalled()
        expect(onReverify).not.toHaveBeenCalled()
        expect(screen.queryByText(/You can change it again after/)).not.toBeInTheDocument()
        expect(screen.getByText('Save').closest('button')).not.toBeDisabled()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'DE' })
        expect(onReverify).not.toHaveBeenCalled()
    })

    it('offers re-verification only when the pick differs from the verified residence', () => {
        render()
        expect(screen.getByText('Submit documents')).toBeInTheDocument()
    })

    it('starts the dedicated residence action after saving', async () => {
        const { onClose, onReverify } = render()
        fireEvent.click(screen.getByText('Submit documents'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'ES' })
        expect(onReverify).toHaveBeenCalledWith('ES')
    })

    it('hides re-verification when declared matches verified', () => {
        render({ declared: 'BR', verified: 'BR' })
        expect(screen.queryByText('Submit documents')).not.toBeInTheDocument()
    })

    it('save-and-reverify saves first, then starts the restart flow', async () => {
        const { onReverify } = render()
        fireEvent.click(screen.getByText('Submit documents'))
        await waitFor(() => expect(onReverify).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalled()
    })

    it('a failed save surfaces the error and never closes or re-verifies', async () => {
        mockedUpdate.mockResolvedValue({ error: 'nope' })
        const { onClose, onReverify } = render()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(screen.getByText('nope')).toBeInTheDocument())
        expect(onClose).not.toHaveBeenCalled()
        expect(onReverify).not.toHaveBeenCalled()
    })

    // A dual-residence pair is stricter than either country alone: the
    // restriction hook intersects both slots. Promoting the second document
    // country must therefore SWAP the pair, not overwrite the primary and
    // leave both slots holding the same country — that silently drops the
    // outgoing country from the intersection.
    it('promoting the second document country swaps the pair instead of dropping one', async () => {
        storeSecondResidence('u1', 'FR')
        const { onClose } = render({ declared: 'ES', verified: 'ES' })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText('France'))
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        // both slots travel with the request: the server pair is the durable
        // one, and a local-only swap would just hide the loss on this device
        expect(mockedUpdate).toHaveBeenCalledWith({
            userId: 'u1',
            residenceCountry: 'FR',
            secondResidenceCountry: 'ES',
        })
        // The active pair does not move until the new primary is GREEN.
        expect(readSecondResidence('u1')).toBe('FR')
    })

    it('moving to a country in neither slot leaves the second document alone', async () => {
        storeSecondResidence('u1', 'FR')
        const { onClose } = render({ declared: 'ES', verified: 'ES' })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText('Germany'))
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'DE' })
        expect(readSecondResidence('u1')).toBe('FR')
    })

    // The device mirror is absent on a fresh device, so trusting it there is
    // exactly what let a reorder wipe the outgoing country. The durable value
    // comes from /users/me.
    it('swaps from the server value with no device mirror at all', async () => {
        const { onClose } = render({ declared: 'ES', verified: 'ES', declaredSecond: 'FR' })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText('France'))
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({
            userId: 'u1',
            residenceCountry: 'FR',
            secondResidenceCountry: 'ES',
        })
    })

    it('prefers the server value over a stale device mirror', async () => {
        storeSecondResidence('u1', 'DE')
        const { onClose } = render({ declared: 'ES', verified: 'ES', declaredSecond: 'FR' })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText('France'))
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({
            userId: 'u1',
            residenceCountry: 'FR',
            secondResidenceCountry: 'ES',
        })
    })

    it('a server answer of no second residence keeps a stale device mirror from reordering', async () => {
        storeSecondResidence('u1', 'FR')
        const { onClose } = render({ declared: 'ES', verified: 'ES', declaredSecond: null })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText('France'))
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'FR' })
    })

    it('preselects an existing pending residence without treating it as active', async () => {
        const { onClose } = render({ declared: 'BR', verified: 'BR', pending: 'ES' })
        expect(screen.getByText('Submit documents')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'ES' })
    })

    it('shows a submitted target under review with a way to leave and no duplicate upload', async () => {
        const { onClose, onReverify } = render({
            declared: 'BR',
            verified: 'BR',
            pending: 'ES',
            pendingStatus: 'REVIEW_PENDING',
        })
        expect(screen.getByText(/under review/i)).toBeInTheDocument()
        expect(screen.queryByText(/(?:a few|a couple of|\d+)\s+minutes?/i)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Submit documents' })).not.toBeInTheDocument()
        const save = screen.queryByRole('button', { name: 'Save' })
        if (save) expect(save).toBeDisabled()
        fireEvent.keyDown(document, { key: 'Escape' })
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).not.toHaveBeenCalled()
        expect(onReverify).not.toHaveBeenCalled()
    })

    it.each([
        ['France', 'FR', 'Submit documents'],
        ['Brazil', 'BR', 'Save'],
    ])('preserves the normal action for %s during review of Spain', async (name, country, action) => {
        const { onClose, onReverify } = render({
            declared: 'BR',
            verified: 'BR',
            pending: 'ES',
            pendingStatus: 'REVIEW_PENDING',
        })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText(name))
        expect(screen.queryByText(/under review/i)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: action }))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: country })
        if (country === 'BR') {
            expect(onReverify).not.toHaveBeenCalled()
        } else {
            expect(onReverify).toHaveBeenCalledWith(country)
        }
    })

    it('warns when the picked country is restricted', () => {
        render({ declared: 'RU', verified: null })
        expect(
            screen.getByText(
                "Heads up: bank transfers and card issuing aren't available for residents of this country."
            )
        ).toBeInTheDocument()
    })
    it('shows no restriction note when lists are unknown', () => {
        mockRestrictionsKnown = false
        render({ declared: 'RU', verified: null })
        expect(screen.queryByText(/Heads up:/)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    })
})

describe('ResidenceChangeDrawer control analytics', () => {
    const controls = () =>
        (posthog.capture as jest.Mock).mock.calls
            .filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)
            .map(([, props]) => props)
    const renderInFlow = () => {
        const onClose = jest.fn()
        rtlRender(
            <PaperworkVerificationTrackingProvider
                value={{ flow: 'paperwork_verification', residence: 'BR', features: { card: true } }}
            >
                <ResidenceChangeDrawer
                    visible
                    onClose={onClose}
                    userId="u1"
                    declared="BR"
                    verified="BR"
                    onSaved={jest.fn()}
                    onReverify={jest.fn()}
                />
            </PaperworkVerificationTrackingProvider>,
            { wrapper: IntlWrapper }
        )
        return onClose
    }

    beforeEach(() => {
        mockRestrictionsKnown = true
        jest.clearAllMocks()
        window.localStorage.clear()
        mockedUpdate.mockResolvedValue({ data: undefined })
        mockIntents = false
    })

    it("reports the country pick and the save inside /verify's flow, never the typed search", async () => {
        const onClose = renderInFlow()
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'privatequery' } })
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Fra' } })
        fireEvent.click(screen.getByText('France'))
        fireEvent.click(screen.getByText('Submit documents'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(controls().map(({ control, action, value }) => [control, action, value])).toEqual([
            ['residence_country', 'select', 'FR'],
            ['save_and_reverify', 'tap', undefined],
        ])
        expect(controls()).toEqual(
            controls().map(() =>
                expect.objectContaining({
                    flow: 'paperwork_verification',
                    residence: 'BR',
                    feature_card: true,
                    screen_id: 'change-residence',
                })
            )
        )
        expect(JSON.stringify((posthog.capture as jest.Mock).mock.calls)).not.toContain('privatequery')
    })

    it('reports a Save, and a close without one as a dismissal', async () => {
        const onClose = renderInFlow()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        fireEvent.keyDown(document, { key: 'Escape' })
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
        expect(controls().map(({ control, action }) => `${control}:${action}`)).toEqual([
            'save:tap',
            'change_residence:dismiss',
        ])
    })

    it('sends nothing from the profile page, outside the flow', () => {
        render({ declared: 'BR', verified: 'BR' })
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText('France'))
        fireEvent.click(screen.getByText('Save'))
        expect(controls()).toEqual([])
    })
})
