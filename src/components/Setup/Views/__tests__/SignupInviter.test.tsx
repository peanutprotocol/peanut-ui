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
// vaul never finishes its close animation in jsdom, so a closed drawer would keep the page aria-hidden
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <>{children}</> : null),
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
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
        const username = screen.getByPlaceholderText('username')
        const next = screen.getByRole('button', { name: 'Claim username' })
        expect(next).toHaveClass('w-full')
        expect(username.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        fireEvent.change(username, { target: { value: 'newuser' } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Claim username' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Claim username' }))
        await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(1))
        expect(mockStoredInvite.code).toBe('')
    })

    it('suggests ten handles after four idle seconds, then restores the placeholder', () => {
        jest.useFakeTimers()
        try {
            renderSignup()
            const username = screen.getByRole('textbox', { name: 'username' })
            expect(username).toHaveAttribute('placeholder', 'username')
            act(() => jest.advanceTimersByTime(3999))
            expect(screen.queryByText('batman?')).not.toBeInTheDocument()
            act(() => jest.advanceTimersByTime(1))
            expect(screen.getByText('batman?')).toBeInTheDocument()
            for (let idea = 1; idea < 10; idea++) {
                act(() => jest.advanceTimersByTime(2000))
            }
            expect(screen.getByText('peanutpirate?')).toBeInTheDocument()
            act(() => jest.advanceTimersByTime(2000))
            expect(username).toHaveAttribute('placeholder', 'username')
            expect(screen.getByText('peanutpirate?')).not.toBeVisible()
        } finally {
            jest.useRealTimers()
        }
    })

    it('stops handle suggestions when the username field receives focus', () => {
        jest.useFakeTimers()
        try {
            renderSignup()
            const username = screen.getByRole('textbox', { name: 'username' })
            fireEvent.focus(username)
            act(() => jest.advanceTimersByTime(24000))
            expect(username).toHaveAttribute('placeholder', 'username')
            expect(screen.queryByText('batman?')).not.toBeInTheDocument()
        } finally {
            jest.useRealTimers()
        }
    })

    const addInviterInDrawer = async (value: string) => {
        fireEvent.change(await screen.findByRole('textbox', { name: "Inviter's Peanut username" }), {
            target: { value },
        })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Add inviter' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Add inviter' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }

    it('adds a validated inviter from the drawer and stores it on continue', async () => {
        mockStoredInvite.code = 'original-referral'
        renderSignup()
        fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: 'newuser' } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Claim username' })).toBeEnabled())

        fireEvent.click(screen.getByRole('button', { name: 'Who invited you?' }))
        expect(await screen.findByRole('dialog')).toHaveTextContent(
            'Your inviter may earn rewards when you use Peanut.'
        )
        expect(screen.getByRole('button', { name: 'Add inviter' })).toBeDisabled()
        await addInviterInDrawer('@Alice ')
        expect(mockValidateInviter).toHaveBeenCalledWith('@Alice ')
        expect(await screen.findByText('Invited by alice.')).toBeInTheDocument()
        // the hint sits above the CTA so the CTA stays pinned to the bottom
        expect(
            screen
                .getByRole('button', { name: 'Claim username' })
                .compareDocumentPosition(screen.getByText('Invited by alice.')) & Node.DOCUMENT_POSITION_PRECEDING
        ).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Claim username' }))
        await waitFor(() => expect(mockStoredInvite.code).toBe('alice'))
    })

    it('keeps add disabled and explains when the inviter cannot be verified', async () => {
        renderSignup()
        fireEvent.click(screen.getByRole('button', { name: 'Who invited you?' }))
        mockValidateInviter.mockResolvedValue({ success: false, attributionResolved: false })
        fireEvent.change(await screen.findByRole('textbox', { name: "Inviter's Peanut username" }), {
            target: { value: 'nobody' },
        })
        expect(await screen.findByText("We couldn't verify that username. Check it and try again.")).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add inviter' })).toBeDisabled()
    })

    it('shows the inviter behind an invite link and lets a typed inviter replace it', async () => {
        mockStoredInvite.code = 'aliceinvitesyou'
        mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true, username: 'alice' })
        renderSignup()
        expect(await screen.findByText('Invited by alice.')).toBeInTheDocument()
        expect(mockValidateInviter).toHaveBeenCalledWith('aliceinvitesyou')

        fireEvent.click(screen.getByRole('button', { name: 'Change' }))
        mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true, username: 'bobby' })
        await addInviterInDrawer('bobby')
        expect(await screen.findByText('Invited by bobby.')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: 'newuser' } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Claim username' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Claim username' }))
        await waitFor(() => expect(mockStoredInvite.code).toBe('bobby'))
    })

    it('keeps the added inviter when the signup step is left and revisited', async () => {
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
        await addInviterInDrawer('alice')
        fireEvent.click(screen.getByRole('button', { name: 'Switch step' }))
        fireEvent.click(screen.getByRole('button', { name: 'Switch step' }))

        expect(screen.getByText('Invited by alice.')).toBeInTheDocument()
    })

    it('removes a mistaken manual inviter and restores the invite-link referral', async () => {
        mockStoredInvite.code = 'aliceinvitesyou'
        mockStoredInvite.type = 'INVITE_LINK'
        mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true, username: 'alice' })
        renderSignup()
        expect(await screen.findByText('Invited by alice.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Change' }))
        expect(screen.queryByRole('button', { name: 'Remove inviter' })).not.toBeInTheDocument()
        mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true, username: 'bobby' })
        await addInviterInDrawer('bobby')
        fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: 'newuser' } })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Claim username' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Claim username' }))
        await waitFor(() => expect(mockStoredInvite.code).toBe('bobby'))

        mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true, username: 'alice' })
        fireEvent.click(screen.getByRole('button', { name: 'Change' }))
        fireEvent.click(await screen.findByRole('button', { name: 'Remove inviter' }))
        expect(mockStoredInvite).toEqual({ code: 'aliceinvitesyou', type: 'INVITE_LINK' })
        expect(await screen.findByText('Invited by alice.')).toBeInTheDocument()
    })
})
