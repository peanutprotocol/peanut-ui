/** @jest-environment jsdom */
import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import JoinWaitlist from '../JoinWaitlist'
import SignupStep from '../Signup'

jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: jest.fn(), isLoading: false }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: jest.fn() }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/services/invites', () => ({
    invitesApi: { validateInviteCode: jest.fn().mockResolvedValue({ success: true, onboardingResolved: true }) },
}))

const InviteStepHarness = () => {
    const [showInviteStep, setShowInviteStep] = useState(true)
    const { resetSetupFlow } = useSetupFlowContext()
    return (
        <>
            <button type="button" onClick={() => setShowInviteStep((show) => !show)}>
                Toggle step
            </button>
            <button type="button" onClick={resetSetupFlow}>
                Start fresh
            </button>
            {showInviteStep && <JoinWaitlist />}
        </>
    )
}

describe('setup username fields', () => {
    it('restores and revalidates the inviter username after leaving and returning to its step', async () => {
        renderWithIntl(
            <SetupFlowProvider masterScreenIds={setupScreenIds}>
                <InviteStepHarness />
            </SetupFlowProvider>
        )

        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'alice' } })
        fireEvent.click(screen.getByRole('button', { name: 'Toggle step' }))
        fireEvent.click(screen.getByRole('button', { name: 'Toggle step' }))
        expect(screen.getByPlaceholderText('Username')).toHaveValue('alice')
        await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled())

        fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }))
        expect(screen.getByPlaceholderText('Username')).toHaveValue('')
    })

    it('places the full-width Next button below the new username field', () => {
        renderWithIntl(
            <SetupFlowProvider masterScreenIds={setupScreenIds}>
                <SignupStep />
            </SetupFlowProvider>
        )

        const input = screen.getByPlaceholderText('Username')
        const next = screen.getByRole('button', { name: 'Next' })
        expect(next).toHaveClass('w-full')
        expect(next.previousElementSibling).toContainElement(input)
    })
})
