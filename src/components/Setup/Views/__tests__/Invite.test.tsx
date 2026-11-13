/** @jest-environment jsdom */
import { useLayoutEffect, useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { setupScreenIds } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { EInviteType } from '@/services/services.types'
import { disableDemoMode, isDemoMode } from '@/utils/demo'
import { readInviteCode, stashInvite } from '@/utils/invite-stash'
import InviteStep from '../Invite'

const mockHandleNext = jest.fn(async () => {})
const mockValidateInviter = jest.fn()
const mockAcceptInvite = jest.fn()
const mockFetchUser = jest.fn(async () => null)

jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: false }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: null, fetchUser: mockFetchUser }),
}))
jest.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }))
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

function SeededInvite({ selection }: { selection: string }) {
    const { inviterAccepted, inviteSelection, setUsername, setInviteSelection } = useSetupFlowContext()
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        setUsername('newbie')
        setInviteSelection(selection)
        setReady(true)
    }, [selection, setUsername, setInviteSelection])
    return (
        <>
            {ready && onSignupScreen('invite', <InviteStep />)}
            <output data-testid="inviter-accepted">{String(inviterAccepted)}</output>
            <output data-testid="invite-selection">{inviteSelection}</output>
        </>
    )
}

const renderInvite = (selection = '') =>
    renderWithIntl(
        <SetupFlowProvider masterScreenIds={setupScreenIds}>
            <SeededInvite selection={selection} />
        </SetupFlowProvider>
    )
const accepted = () => screen.getByTestId('inviter-accepted').textContent
const field = () => screen.getByRole('textbox', { name: 'Username of the person who invited you' })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    disableDemoMode()
    mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
})

describe('Invited by a friend? (before registration)', () => {
    it('shows a field that reads as someone else’s username, Continue disabled until a verified inviter, and Skip below it', () => {
        renderInvite()
        // The username step's placeholder is "Username"; this one must not read as the person's own.
        expect(field()).toHaveAttribute('placeholder', 'Friend’s username')
        expect(screen.getByText('@')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        const skip = screen.getByRole('button', { name: 'Skip' })
        expect(continueButton().compareDocumentPosition(skip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(skip.closest('[data-setup-footer]')).toContainElement(continueButton())
    })

    it('stores a verified inviter selection and advances without accepting it', async () => {
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
        expect(screen.getByTestId('invite-selection')).toHaveTextContent('alice')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ATTRIBUTION_SETTLED, expect.anything())
        expect(readInviteCode()).toBe('')
    })

    it('keeps the selected inviter editable before registration and does not refresh a profile', async () => {
        const view = renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(1))
        expect(accepted()).toBe('false')
        expect(mockFetchUser).not.toHaveBeenCalled()
        view.unmount()
        renderInvite('alice')
        expect(field()).toHaveValue('alice')
        fireEvent.change(field(), { target: { value: 'bobby' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(2))
        expect(screen.getByTestId('invite-selection')).toHaveTextContent('bobby')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
    })

    it('does not mark an inviter accepted after failed validation or Skip', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
        expect(accepted()).toBe('false')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('stays on Invite when validation confirms the inviter does not exist', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
        expect(readInviteCode()).toBe('')
    })

    it('treats a campaign-only validation answer as no inviter selected', async () => {
        mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'alice' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getByTestId('invite-selection')).toBeEmptyDOMElement()
        expect(readInviteCode()).toBe('')
    })

    it('recovers from a transient validation failure and Skip clears only the stored selection', async () => {
        mockValidateInviter.mockResolvedValueOnce({ success: false, attributionResolved: false })
        stashInvite('linkfriend', EInviteType.DIRECT)
        renderInvite('alice')
        expect(await screen.findByText('We couldn’t check this username. Try again.')).toBeInTheDocument()
        expect(mockHandleNext).not.toHaveBeenCalled()
        fireEvent.change(field(), { target: { value: 'bobby' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(1))
        expect(screen.getByTestId('invite-selection')).toHaveTextContent('bobby')
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        expect(screen.getByTestId('invite-selection')).toBeEmptyDOMElement()
        expect(readInviteCode()).toBe('linkfriend')
        expect(mockHandleNext).toHaveBeenCalledTimes(2)
        expect(mockAcceptInvite).not.toHaveBeenCalled()
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

describe('Invited by a friend? — control analytics', () => {
    const controls = () => signupControls(posthog.capture as jest.Mock)

    it('reports the first edit, why an inviter failed, and Continue', async () => {
        mockValidateInviter.mockResolvedValueOnce({ success: true, notFound: true, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'nobodyhere' } })
        await screen.findByText(/couldn’t find|could not find|not found/i)
        fireEvent.change(field(), { target: { value: 'newbie' } })
        await waitFor(() => expect(controls()).toContain('inviter_username:error:self'))
        fireEvent.change(field(), { target: { value: 'alice' } })
        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())
        await waitFor(() => expect(mockHandleNext).toHaveBeenCalledTimes(1))
        expect(controls()).toEqual([
            'inviter_username:change',
            'inviter_username:error:not_found',
            'inviter_username:error:self',
            'continue:tap',
        ])
        const controlEvents = (posthog.capture as jest.Mock).mock.calls.filter(
            ([event]) => event === ANALYTICS_EVENTS.CONTROL_USED
        )
        expect(JSON.stringify(controlEvents)).not.toMatch(/nobodyhere|alice/)
    })

    it('reports Skip', () => {
        renderInvite()
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
        expect(controls()).toEqual(['skip:tap'])
    })
})
