/**
 * The unlock checklist stores the ticked set, then starts the identity check
 * (TASK-23329). A checklist that left the screen while the save was in flight
 * must not start the check when the answer lands: the drawer form cannot be
 * dismissed during the save, and a page the user left starts nothing.
 * Found by Chip on ui#3584, where the method unlock sheet had the same defect.
 */
/** @jest-environment jsdom */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { InitiateKycModal } from '../InitiateKycModal'

jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false, oneShotResidence: 'AR' }),
}))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/add-money/argentina/bank',
}))

const setIntents = jest.fn()
jest.mock('@/services/kyc-intents', () => ({
    ...jest.requireActual('@/services/kyc-intents'),
    kycIntentsApi: {
        getConfig: async (residence: string) => ({
            residence,
            intents: {
                qr: { available: true },
                local: { available: true },
                card: { available: true },
                bank: { available: true },
            },
        }),
        set: (...args: unknown[]) => setIntents(...args),
    },
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const onVerify = jest.fn()
const onClose = jest.fn()

const renderModal = (presentation: 'modal' | 'page') =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <IntlWrapper>
                <InitiateKycModal
                    visible
                    presentation={presentation}
                    onClose={onClose}
                    onBack={onClose}
                    onVerify={onVerify}
                />
            </IntlWrapper>
        </QueryClientProvider>
    )

describe('InitiateKycModal: the unlock checklist save', () => {
    let finishSave: () => void = () => {}

    beforeEach(() => {
        jest.clearAllMocks()
        setIntents.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finishSave = () => resolve({ intents: {}, setAt: '2026-10-06T00:00:00.000Z' })
                })
        )
    })

    const startSave = async () => {
        const start = await screen.findByRole('button', { name: 'Unlock features' })
        await waitFor(() => expect(start).toBeEnabled())
        fireEvent.click(start)
        await waitFor(() => expect(setIntents).toHaveBeenCalledTimes(1))
    }

    it('the drawer cannot be dismissed while the save is in flight, and starts the check when it lands', async () => {
        const dismiss = () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
        renderModal('modal')
        await waitFor(() => expect(screen.getByRole('button', { name: 'Unlock features' })).toBeEnabled())
        // at rest the sheet closes as it always did
        dismiss()
        expect(onClose).toHaveBeenCalledTimes(1)

        await startSave()
        dismiss()
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onVerify).not.toHaveBeenCalled()

        await act(async () => finishSave())
        await waitFor(() => expect(onVerify).toHaveBeenCalledTimes(1))
        // the lock ends with the save
        await waitFor(() => {
            dismiss()
            expect(onClose).toHaveBeenCalledTimes(2)
        })
    })

    it('starts nothing for a page the user left while the save was in flight', async () => {
        const { unmount } = renderModal('page')
        await startSave()
        // Back, the bottom nav or a link: the page form is gone before the answer
        unmount()

        await act(async () => {
            finishSave()
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
        expect(onVerify).not.toHaveBeenCalled()
    })

    it('starts the check from the page form when the save lands', async () => {
        renderModal('page')
        await startSave()
        expect(onVerify).not.toHaveBeenCalled()

        await act(async () => finishSave())
        await waitFor(() => expect(onVerify).toHaveBeenCalledTimes(1))
    })
})
