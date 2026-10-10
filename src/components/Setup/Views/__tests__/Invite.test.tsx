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
    const { inviterUsername } = useSetupFlowContext()
    return <output data-testid="inviter">{inviterUsername}</output>
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
        expect(field()).toHaveAttribute('placeholder', 'Username')
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

    it('explains an inviter that cannot be verified and keeps Continue disabled', async () => {
        mockValidateInviter.mockResolvedValue({ success: false, attributionResolved: false })
        renderInvite()
        fireEvent.change(field(), { target: { value: 'nobody' } })
        expect(await screen.findByText('We couldn’t find this user.')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()
        fireEvent.click(continueButton())
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(mockStoredInvite.code).toBe('')
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
