/** @jest-environment jsdom */
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import { useState } from 'react'
import SignupStep from '../Signup'

const mockHandleNext = jest.fn(async (guard?: () => Promise<boolean>) => guard?.())
const mockValidateInviter = jest.fn()
const mockApiFetch = jest.fn()
const mockStoredInvite = { code: '', type: 'DIRECT' }

jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: false }) }))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/services/invites', () => ({
    invitesApi: { validateInviteCode: (...args: unknown[]) => mockValidateInviter(...args) },
}))
jest.mock('@/utils/invite-stash', () => ({
    readInviteCode: () => mockStoredInvite.code,
    readInviteType: () => mockStoredInvite.type,
    stashInvite: (code: string, type: string) => {
        mockStoredInvite.code = code
        mockStoredInvite.type = type
    },
    clearInvite: () => {
        mockStoredInvite.code = ''
    },
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const renderSignup = () =>
    renderWithIntl(
        <SetupFlowProvider masterScreenIds={setupScreenIds}>
            <SignupStep />
        </SetupFlowProvider>
    )

describe('optional inviter on signup', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockStoredInvite.code = ''
        mockStoredInvite.type = 'DIRECT'
        mockApiFetch.mockResolvedValue({ status: 404 })
        mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
    })

    it('lets a direct signup continue without an inviter', async () => {
        renderSignup()
        expect(screen.queryByRole('textbox', { name: "Inviter's Peanut username" })).not.toBeInTheDocument()
        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newuser' } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(1))
        expect(mockStoredInvite.code).toBe('')
    })

    it('reveals, validates, and stores a manual inviter without losing an existing referral on edit', async () => {
        mockStoredInvite.code = 'original-referral'
        renderSignup()
        fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newuser' } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled())

        const reveal = screen.getByRole('button', { name: 'Who invited you?' })
        fireEvent.click(reveal)
        expect(reveal).toHaveAttribute('aria-expanded', 'true')
        const inviter = screen.getByRole('textbox', { name: "Inviter's Peanut username" })
        fireEvent.change(inviter, { target: { value: '@Alice ' } })
        await waitFor(() => expect(mockValidateInviter).toHaveBeenCalledWith('@Alice '))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        await waitFor(() => expect(mockStoredInvite.code).toBe('alice'))

        fireEvent.change(inviter, { target: { value: 'bob' } })
        expect(mockStoredInvite.code).toBe('original-referral')
    })

    it('keeps the entered inviter when the signup step is left and revisited', async () => {
        function FlowHarness() {
            const [onSignup, setOnSignup] = useState(true)
            return (
                <SetupFlowProvider masterScreenIds={setupScreenIds}>
                    <button onClick={() => setOnSignup((current) => !current)}>Switch step</button>
                    {onSignup && <SignupStep />}
                </SetupFlowProvider>
            )
        }

        renderWithIntl(<FlowHarness />)
        fireEvent.click(screen.getByRole('button', { name: 'Who invited you?' }))
        fireEvent.change(screen.getByRole('textbox', { name: "Inviter's Peanut username" }), {
            target: { value: 'alice' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Switch step' }))
        fireEvent.click(screen.getByRole('button', { name: 'Switch step' }))

        expect(screen.getByRole('textbox', { name: "Inviter's Peanut username" })).toHaveValue('alice')
        await act(async () => {
            await Promise.resolve()
        })
    })
})
