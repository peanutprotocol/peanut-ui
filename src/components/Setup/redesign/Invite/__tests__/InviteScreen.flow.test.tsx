/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())
/*
 * 04 Invite inside the real step flow (real useSetupFlow, SetupFlowProvider, nuqs): Back, Continue to Passkey and
 * a restored selection. Contract P2 (mono _temp/signup-redesign/r2/r9/build/contract/P2.md): P2-02, P2-08 and the
 * component half of P2-04. Ported from Views/__tests__/Invite.preaccount.acceptance.test.tsx.
 */
import { act, fireEvent, screen, within } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { useLayoutEffect, useState } from 'react'
import { render } from '@testing-library/react'
import { setupScreenIds, setupSteps } from '@/components/Setup/Setup.consts'
import { InviteScreen } from '@/components/Setup/redesign/Invite/InviteScreen'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { SetupFlowProvider, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { IntlProvider, msg } from '@/components/Setup/redesign/Landing/__tests__/redesign-harness'

const mockValidateInviter = jest.fn()
const mockAcceptInvite = jest.fn()

jest.mock('@/utils/capacitor', () => ({ ...jest.requireActual('@/utils/capacitor'), isNativeBridge: () => false }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: jest.fn(async () => null) }) }))
jest.mock('@/services/invites', () => ({
    invitesApi: {
        validateInviteCode: (...args: unknown[]) => mockValidateInviter(...args),
        acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
    },
}))
jest.mock('@/services/invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: () => ({ destination: '/home', pending: [] }),
}))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/utils/haptics', () => ({
    ...jest.requireActual('@/utils/haptics'),
    notifyHaptic: jest.fn(),
    impactHaptic: jest.fn(),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: {
        capture: jest.fn(),
        onFeatureFlags: jest.fn(() => () => {}),
        isFeatureEnabled: jest.fn(
            (_key: string, options?: { defaultValue?: boolean }) => options?.defaultValue ?? false
        ),
        featureFlags: { hasLoadedFlags: true },
    },
}))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))

const probe = {} as { flow: ReturnType<typeof useSetupFlow>; context: ReturnType<typeof useSetupFlowContext> }

function Host({ selection }: { selection: string }) {
    const context = useSetupFlowContext()
    const flow = useSetupFlow()
    const [ready, setReady] = useState(false)
    useLayoutEffect(() => {
        context.setSteps(setupSteps)
        context.setUsername('kimchi')
        // what a resumed draft (or Back from Passkey) restores
        context.setInviteSelection(selection)
        setReady(true)
        // seed once, as the layout and the draft restore do
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    probe.flow = flow
    probe.context = context
    if (!ready) return null
    const id = flow.step?.screenId
    return (
        <>
            <output data-testid="cursor">{id}</output>
            {id === 'invite' && (
                // as the page renders a step: Back shown when the step allows it and no registration runs
                <SetupShell
                    screenId="invite"
                    showBackButton={!!flow.step?.showBackButton && !context.registrationInProgress}
                    onBack={() => flow.handleBack()}
                >
                    <InviteScreen />
                </SetupShell>
            )}
        </>
    )
}

const renderFlow = (selection = '') =>
    render(
        <IntlProvider>
            <NuqsTestingAdapter hasMemory searchParams={{ screen: 'invite' }}>
                <SetupFlowProvider masterScreenIds={setupScreenIds}>
                    <Host selection={selection} />
                </SetupFlowProvider>
            </NuqsTestingAdapter>
        </IntlProvider>
    )

const cursor = () => screen.getByTestId('cursor').textContent
const field = () => screen.getByRole('textbox', { name: msg('setupRedesign.invite.fieldLabel') })
const footer = () => document.querySelector('[data-setup-footer]') as HTMLElement
const primary = () => within(footer()).getAllByRole('button')[0]
const settle = async (ms = 750) => {
    await act(async () => {
        jest.advanceTimersByTime(ms)
    })
    await act(async () => {})
    await act(async () => {})
}

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    mockValidateInviter.mockResolvedValue({ success: true, attributionResolved: true })
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

describe('04 Invite in the step flow', () => {
    it('P2-02 Back is shown and enabled on 04 with no registration running, and goes to Username (signup)', async () => {
        renderFlow()
        expect(cursor()).toBe('invite')
        const back = screen.getByRole('button', { name: msg('setup.navigation.goBack') })
        expect(back).toBeEnabled()
        await act(async () => {
            fireEvent.click(back)
        })
        await settle(0)
        expect(cursor()).toBe('signup')
    })

    it('P2-08 a restored selection "alice" shows in the field and is checked again, enabling Continue (P2-04 component half)', async () => {
        renderFlow('alice')
        expect(field()).toHaveValue('alice')
        await settle()
        expect(mockValidateInviter).toHaveBeenCalledWith('alice')
        expect(primary()).toBeEnabled()
    })

    it('P2-24 Continue on a found inviter lands on Passkey with the selection stored and nothing accepted', async () => {
        renderFlow()
        fireEvent.change(field(), { target: { value: 'alice' } })
        await settle()
        await act(async () => {
            fireEvent.click(primary())
        })
        await settle(0)
        expect(cursor()).toBe('passkey')
        expect(probe.context.inviteSelection).toBe('alice')
        expect(probe.context.inviterAccepted).toBe(false)
        expect(mockAcceptInvite).not.toHaveBeenCalled()
    })
})
