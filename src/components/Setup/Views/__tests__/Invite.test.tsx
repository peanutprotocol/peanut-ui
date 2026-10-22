/** @jest-environment jsdom */
import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import InviteStep from '../Invite'

const mockHandleNext = jest.fn(async () => {})
const mockValidateInviter = jest.fn()
const mockStoredInvite = { code: '', type: 'DIRECT' }

jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: false }),
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
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
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

function InviterState() {
    const { inviterUsername, username } = useSetupFlowContext()
    return (
        <>
            <output data-testid="inviter">{inviterUsername}</output>
            <output data-testid="username">{username}</output>
        </>
    )
}

// Leaving and re-entering the step keeps the provider, as the real flow does.
function FlowHarness() {
    const [onInvite, setOnInvite] = useState(true)
    return (
        <SetupFlowProvider masterScreenIds={setupScreenIds}>
            <button onClick={() => setOnInvite((current) => !current)}>Switch step</button>
            {onInvite && <InviteStep />}
            <InviterState />
        </SetupFlowProvider>
    )
}
const renderInvite = () => renderWithIntl(<FlowHarness />)
const field = () => screen.getByRole('textbox', { name: 'Username of the person who invited you' })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })
const claimInstead = (username: string) => screen.queryByRole('button', { name: `Claim @${username} instead` })

beforeEach(() => {
    jest.clearAllMocks()
    disableDemoMode()
    mockStoredInvite.code = ''
    mockStoredInvite.type = 'DIRECT'
    mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
})

describe('Invited by a friend?', () => {
    it('shows an @-prefixed username field, Continue disabled until a verified inviter, and Skip below it', () => {
        renderInvite()
        // The username step's placeholder is "batman"; this field must read as someone else's username.
        expect(field()).toHaveAttribute('placeholder', 'Friend’s username')
        expect(screen.getByText('@')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        const skip = screen.getByRole('button', { name: 'Skip' })
        expect(continueButton().compareDocumentPosition(skip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(skip.closest('[data-setup-footer]')).toContainElement(continueButton())
    })

    it('applies a verified inviter as the invite registration attributes, then advances', async () => {
        mockStoredInvite.code = 'original-referral'
        renderInvite()
        fireEvent.change(field(), { target: { value: '@Alice ' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        expect(mockValidateInviter).toHaveBeenCalledWith('@Alice ')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, {
            valid: true,
            source: 'signup_optional_inviter',
        })
        fireEvent.click(continueButton())
        expect(mockStoredInvite).toEqual({ code: 'alice', type: 'DIRECT' })
        expect(screen.getByTestId('inviter')).toHaveTextContent('@Alice')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('says the check did not work when the lookup request fails, not that the user is missing', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        expect(await screen.findByText('We couldn’t check this username. Try again.')).toBeInTheDocument()
        expect(screen.queryByText('We couldn’t find this user.')).not.toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
    })

    it('explains an inviter that does not exist and keeps Continue disabled', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'nobody' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        fireEvent.click(continueButton())
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(mockStoredInvite.code).toBe('')
    })

    it('offers an unknown username as the new user’s own, and carries it to the username step on tap', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: '@NewPerson ' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getByTestId('username')).toHaveTextContent('')

        fireEvent.click(claimInstead('newperson')!)
        expect(screen.getByTestId('username')).toHaveTextContent('newperson')
        expect(screen.getByTestId('inviter')).toHaveTextContent('')
        expect(mockStoredInvite.code).toBe('')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITE_USED_AS_USERNAME)
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITE_SKIPPED)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('hides the offer while the person types again', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'newperson' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(claimInstead('newperson')).toBeInTheDocument()
        mockValidateInviter.mockReturnValue(new Promise(() => {}))
        fireEvent.change(field(), { target: { value: 'newperson2' } })
        expect(claimInstead('newperson')).not.toBeInTheDocument()
        expect(claimInstead('newperson2')).not.toBeInTheDocument()
    })

    it('does not offer a name that cannot be a username, or one the check could not look up', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: '1person' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /instead/ })).not.toBeInTheDocument()

        mockValidateInviter.mockResolvedValue({ success: false, attributionResolved: false })
        fireEvent.change(field(), { target: { value: 'person' } })
        expect(await screen.findByText('We couldn’t check this username. Try again.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /instead/ })).not.toBeInTheDocument()
    })

    it('does not validate a handle too short to be one', async () => {
        renderInvite()
        fireEvent.change(field(), { target: { value: 'ab' } })
        await waitFor(() => expect(continueButton()).toBeDisabled())
        expect(mockValidateInviter).not.toHaveBeenCalled()
    })

    it('skips without touching an invite link the user arrived with', () => {
        mockStoredInvite.code = 'aliceinvitesyou'
        mockStoredInvite.type = 'INVITE_LINK'
        renderInvite()
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        expect(mockStoredInvite).toEqual({ code: 'aliceinvitesyou', type: 'INVITE_LINK' })
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITE_SKIPPED)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
        expect(mockValidateInviter).not.toHaveBeenCalled()
    })

    it('keeps an added inviter on return, and Skip then removes it and restores the invite link', async () => {
        mockStoredInvite.code = 'aliceinvitesyou'
        mockStoredInvite.type = 'INVITE_LINK'
        renderInvite()
        fireEvent.change(field(), { target: { value: 'bobby' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(mockStoredInvite).toEqual({ code: 'bobby', type: 'DIRECT' })

        fireEvent.click(screen.getByRole('button', { name: 'Switch step' }))
        fireEvent.click(screen.getByRole('button', { name: 'Switch step' }))
        expect(field()).toHaveValue('bobby')
        await waitFor(() => expect(continueButton()).toBeEnabled())

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        expect(mockStoredInvite).toEqual({ code: 'aliceinvitesyou', type: 'INVITE_LINK' })
        expect(screen.getByTestId('inviter')).toHaveTextContent('')
        expect(mockHandleNext).toHaveBeenCalledTimes(2)
    })

    it('treats demo as an ordinary inviter instead of a demo trigger', async () => {
        renderInvite()
        fireEvent.change(field(), { target: { value: 'demo' } })
        await waitFor(() => expect(mockValidateInviter).toHaveBeenCalledWith('demo'))
        expect(isDemoMode()).toBe(false)
    })
})
