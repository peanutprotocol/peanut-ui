/** @jest-environment jsdom */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider } from '@/features/setup/SetupFlowContext'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { EInviteType } from '@/services/services.types'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import { readInviteCode } from '@/utils/invite-stash'
import InviteStep from '../Invite'

const mockHandleNext = jest.fn(async () => {})
const mockValidateInviter = jest.fn()
const mockAcceptInvite = jest.fn()

jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: false }),
}))
// The step runs after registration: the person is signed in as @newbie.
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'new-user', username: 'newbie' } } }),
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
// Only the network is mocked: the stash and the attribution hand-off are the real ones.
jest.mock('@/services/invites', () => ({
    invitesApi: {
        validateInviteCode: (...args: unknown[]) => mockValidateInviter(...args),
        acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
    },
}))
jest.mock('@/services/invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: () => ({ destination: '/home', pending: [] }),
}))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const ATTRIBUTED = { success: true, attributionResolved: true, onboardingResolved: true, claims: [] }

const renderInvite = () =>
    renderWithIntl(
        <SetupFlowProvider masterScreenIds={setupScreenIds}>
            <InviteStep />
        </SetupFlowProvider>
    )
const field = () => screen.getByRole('textbox', { name: 'Username of the person who invited you' })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    disableDemoMode()
    mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
    mockAcceptInvite.mockResolvedValue(ATTRIBUTED)
})

describe('Invited by a friend? (after registration)', () => {
    it('shows a field that reads as someone else’s username, Continue disabled until a verified inviter, and Skip below it', () => {
        renderInvite()
        // The username step's placeholder is "batman"; this one must not read as the person's own.
        expect(field()).toHaveAttribute('placeholder', 'Friend’s username')
        expect(screen.getByText('@')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        const skip = screen.getByRole('button', { name: 'Skip' })
        expect(continueButton().compareDocumentPosition(skip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(skip.closest('[data-setup-footer]')).toContainElement(continueButton())
    })

    it('accepts a verified inviter once, with its invite code, then advances', async () => {
        renderInvite()
        fireEvent.change(field(), { target: { value: '@Alice ' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        expect(mockValidateInviter).toHaveBeenCalledWith('@Alice ')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, {
            valid: true,
            source: 'signup_optional_inviter',
        })

        fireEvent.click(continueButton())
        await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(1))
        expect(mockAcceptInvite).toHaveBeenCalledTimes(1)
        expect(mockAcceptInvite).toHaveBeenCalledWith('alice', EInviteType.DIRECT)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ATTRIBUTION_SETTLED, {
            trigger: 'setup_invite_step',
            status: 'attributed',
            invite_type: EInviteType.DIRECT,
        })
        expect(readInviteCode()).toBe('')
    })

    it('says the user was not found when the accept is refused, and stays on the step', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: false,
            retryable: false,
            status: 400,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
        expect(readInviteCode()).toBe('')
    })

    it('treats a campaign-only answer (409) as no inviter added', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: true,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(readInviteCode()).toBe('')
    })

    it('keeps a transient failure for a later retry, and Skip then drops it', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: false,
            retryable: true,
            status: 503,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        expect(await screen.findByText('We couldn’t check this username. Try again.')).toBeInTheDocument()
        expect(readInviteCode()).toBe('alice')
        expect(mockHandleNext).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        expect(readInviteCode()).toBe('')
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('explains an inviter that does not exist and keeps Continue disabled', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'nobody' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        fireEvent.click(continueButton())
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('says the check did not work when the lookup request fails, not that the user is missing', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        expect(await screen.findByText('We couldn’t check this username. Try again.')).toBeInTheDocument()
        expect(screen.queryByText('We couldn’t find this user.')).not.toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
    })

    it('refuses the person’s own username without a lookup', async () => {
        renderInvite()
        fireEvent.change(field(), { target: { value: '@Newbie' } })
        expect(await screen.findByText('That’s your own username.')).toBeInTheDocument()
        expect(mockValidateInviter).not.toHaveBeenCalled()
        expect(continueButton()).toBeDisabled()
    })

    it('does not validate a handle too short to be one', async () => {
        renderInvite()
        fireEvent.change(field(), { target: { value: 'ab' } })
        await waitFor(() => expect(continueButton()).toBeDisabled())
        expect(mockValidateInviter).not.toHaveBeenCalled()
    })

    it('skips without an accept and records the skip', () => {
        renderInvite()
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(mockValidateInviter).not.toHaveBeenCalled()
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITE_SKIPPED)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('treats demo as an ordinary inviter instead of a demo trigger', async () => {
        renderInvite()
        fireEvent.change(field(), { target: { value: 'demo' } })
        await waitFor(() => expect(mockValidateInviter).toHaveBeenCalledWith('demo'))
        expect(isDemoMode()).toBe(false)
    })
})
