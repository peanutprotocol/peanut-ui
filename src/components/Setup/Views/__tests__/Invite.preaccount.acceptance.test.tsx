/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/*
 * Acceptance tests for the Invite screen before an account exists
 * (spec: signup-reorder-spec.md). In the new order Invite runs after Claim
 * username and before the passkey, so nobody is signed in here.
 *
 * ── Guessed names / seams (align the implementation or adjust here) ──────
 * - New screen id 'passkey' follows 'invite' in setupSteps.
 * - Assumption (failure 10, "selection stays editable"): returning to Invite
 *   shows the stored selection in the field, and Skip empties it.
 * - Where the selection is stored is the implementation's choice; an
 *   invite-link stash (`stashInvite`) is never the person's own selection.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Failure-list coverage: 10 (selection stored, never accepted before the
 * account exists, editable), plus the Skip rules. Acceptance after
 * registration is in Passkey.acceptance.test.tsx.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { useLayoutEffect, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen } from '@/test-utils/signup-controls'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { EInviteType } from '@/services/services.types'
import { readInviteCode, stashInvite } from '@/utils/invite-stash'
import InviteStep from '../Invite'

const mockValidateInviter = jest.fn()
const mockAcceptInvite = jest.fn()
const mockFetchUser = jest.fn(async () => null)

jest.mock('@/utils/capacitor', () => ({ ...jest.requireActual('@/utils/capacitor'), isNativeBridge: () => false }))
// No account yet: Invite now runs before the passkey creates it.
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: mockFetchUser }) }))
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

const probe = {} as {
    flow: ReturnType<typeof useSetupFlow>
    context: ReturnType<typeof useSetupFlowContext>
}

function Host() {
    const context = useSetupFlowContext()
    const flow = useSetupFlow()
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        context.setSteps(setupSteps)
        // Claim username ran before Invite: the name is the person's own, not yet an account.
        context.setUsername('kimchi')
        setReady(true)
        // seed once, as the layout does
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    probe.flow = flow
    probe.context = context
    if (!ready) return null
    return (
        <>
            <output data-testid="cursor">{flow.step?.screenId}</output>
            {flow.step?.screenId === 'invite' && onSignupScreen('invite', <InviteStep />)}
        </>
    )
}

const renderInvite = () =>
    renderWithIntl(
        <NuqsTestingAdapter hasMemory searchParams={{ screen: 'invite' }}>
            <SetupFlowProvider masterScreenIds={setupScreenIds}>
                <Host />
            </SetupFlowProvider>
        </NuqsTestingAdapter>
    )

const cursor = () => screen.getByTestId('cursor').textContent
const field = () => screen.getByRole('textbox', { name: 'Username of the person who invited you' })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })
const skipButton = () => screen.getByRole('button', { name: 'Skip' })

const selectInviter = async (value: string) => {
    fireEvent.change(field(), { target: { value } })
    await waitFor(() => expect(continueButton()).toBeEnabled())
    await act(async () => {
        fireEvent.click(continueButton())
    })
}
const back = async () => {
    await act(async () => probe.flow.handleBack())
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
    mockAcceptInvite.mockResolvedValue({ success: true, attributionResolved: true, onboardingResolved: true })
})

describe('Invite before the account exists (failure 10)', () => {
    it('Continue validates, stores the selection and advances to the passkey without accepting anything', async () => {
        renderInvite()
        await selectInviter('alice')
        expect(mockValidateInviter).toHaveBeenCalledWith('alice')
        await waitFor(() => expect(cursor()).toBe('passkey'))

        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(probe.context.inviterAccepted).toBe(false)
        expect(posthog.capture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('keeps the selection editable: Back shows it, and a new inviter replaces it', async () => {
        renderInvite()
        await selectInviter('alice')
        await waitFor(() => expect(cursor()).toBe('passkey'))
        await back()
        expect(cursor()).toBe('invite')
        expect(field()).toHaveValue('alice')

        await selectInviter('carol')
        await waitFor(() => expect(cursor()).toBe('passkey'))
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        await back()
        expect(field()).toHaveValue('carol')
    })

    it.each([
        ['an inviter that does not exist', { success: false, notFound: true, attributionResolved: false }],
        ['a lookup that failed', { success: false, attributionResolved: false }],
    ])('stays on Invite and stores nothing for %s', async (_label, answer) => {
        mockValidateInviter.mockResolvedValue(answer)
        renderInvite()
        fireEvent.change(field(), { target: { value: 'nobody' } })
        await waitFor(() => expect(mockValidateInviter).toHaveBeenCalledWith('nobody'))
        expect(continueButton()).toBeDisabled()
        fireEvent.click(continueButton())
        expect(cursor()).toBe('invite')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(readInviteCode()).toBe('')
    })

    it('refuses the username just claimed as the inviter, before any account exists', async () => {
        renderInvite()
        fireEvent.change(field(), { target: { value: '@KimChi' } })
        expect(await screen.findByText('That’s your own username.')).toBeInTheDocument()
        expect(mockValidateInviter).not.toHaveBeenCalled()
        expect(continueButton()).toBeDisabled()
    })
})

describe('Skip', () => {
    it('clears the person’s own selection and advances without accepting', async () => {
        renderInvite()
        await selectInviter('alice')
        await waitFor(() => expect(cursor()).toBe('passkey'))
        await back()
        fireEvent.click(skipButton())
        await waitFor(() => expect(cursor()).toBe('passkey'))
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        expect(readInviteCode()).toBe('')
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_INVITE_SKIPPED)
        await back()
        expect(field()).toHaveValue('')
    })

    it('never clears an invite-link stash', async () => {
        stashInvite('bob', EInviteType.PAYMENT_LINK)
        renderInvite()
        await act(async () => {
            fireEvent.click(skipButton())
        })
        expect(readInviteCode()).toBe('bob')
        expect(mockAcceptInvite).not.toHaveBeenCalled()
        await waitFor(() => expect(cursor()).toBe('passkey'))
    })
})
