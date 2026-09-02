/** @jest-environment jsdom */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import ResidenceChangeModal from '@/components/Profile/views/ResidenceChangeModal'
import { updateUserById } from '@/app/actions/users'
import { readSecondResidence, storeSecondResidence } from '@/utils/declared-residence.storage'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
const mockedUpdate = updateUserById as jest.MockedFunction<typeof updateUserById>

const render = (props?: Partial<React.ComponentProps<typeof ResidenceChangeModal>>) => {
    const onClose = jest.fn()
    const onSaved = jest.fn()
    const onReverify = jest.fn()
    rtlRender(
        <ResidenceChangeModal
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

describe('ResidenceChangeModal', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        window.localStorage.clear()
        mockedUpdate.mockResolvedValue({ data: undefined })
    })

    it('saves the declared residence, refetches, and closes', async () => {
        const { onClose, onSaved, onReverify } = render()
        fireEvent.click(screen.getByText('Save'))
        await waitFor(() => expect(onClose).toHaveBeenCalled())
        expect(mockedUpdate).toHaveBeenCalledWith({ userId: 'u1', residenceCountry: 'ES' })
        expect(onSaved).toHaveBeenCalled()
        expect(onReverify).not.toHaveBeenCalled()
    })

    it('the change cooldown shows its date and blocks changing to another country, not re-saving', () => {
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        render({ declared: 'BR', verified: 'BR', nextChangeAllowedAt: future })
        // The note is visible before any pick, so nobody discovers the wait late.
        expect(screen.getByText(/You can change it again after/)).toBeInTheDocument()
        // Re-saving the current country stays allowed.
        expect(screen.getByText('Save').closest('button')).not.toBeDisabled()
        // Picking a different country under cooldown disables saving.
        fireEvent.click(screen.getByRole('combobox'))
        fireEvent.click(screen.getByText('France'))
        expect(screen.getByText('Save').closest('button')).toBeDisabled()
    })

    it('offers re-verification only when the pick differs from the verified residence', () => {
        render()
        expect(screen.getByText('Submit documents')).toBeInTheDocument()
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
        expect(readSecondResidence('u1')).toBe('ES')
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

    it('warns when the picked country is restricted', () => {
        render({ declared: 'RU', verified: null })
        expect(
            screen.getByText(
                "Heads up: bank transfers and card issuing aren't available for residents of this country."
            )
        ).toBeInTheDocument()
    })
})
