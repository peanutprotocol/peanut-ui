/**
 * The prompt names the account provider and links its terms before any consent
 * action, and its own button accepts nothing (TASK-23262, TASK-23295).
 *
 * The android system-browser detour (Capacitor's WebView cancels third-party
 * subframe navigations, so the ToS iframe painted blank) gives the step no
 * acceptance signal — only "the user came back". These cover the resulting
 * contract: Bridge's own answer, not the return itself, decides whether the
 * step is done.
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { BridgeTosStep } from '../BridgeTosStep'
// type-only import — the module itself is mocked below
import { type IframeCloseSource } from '@/components/Global/IframeWrapper'

const mockGetBridgeTosLink = jest.fn()
jest.mock('@/app/actions/users', () => ({
    getBridgeTosLink: () => mockGetBridgeTosLink(),
}))

const mockFetchUser = jest.fn().mockResolvedValue(null)
let mockVerifiedResidence: string | null = null
jest.mock('@/context/authContext', () => {
    const auth = () => ({ fetchUser: mockFetchUser, user: { residence: { verified: mockVerifiedResidence } } })
    return { useAuth: auth, useOptionalAuth: auth }
})

const mockConfirm = jest.fn<Promise<boolean>, [unknown, { observedAcceptance?: boolean }?]>()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    confirmBridgeTosAndAwaitRails: (fetchUser: unknown, options?: { observedAcceptance?: boolean }) =>
        mockConfirm(fetchUser, options),
}))

let closeIframe: ((source?: IframeCloseSource) => void) | undefined
jest.mock('@/components/Global/IframeWrapper', () => ({
    __esModule: true,
    default: ({ visible, onClose }: { visible: boolean; onClose: (source?: IframeCloseSource) => void }) => {
        closeIframe = onClose
        return visible ? <div data-testid="tos-iframe" /> : null
    },
}))

const openTos = async () => {
    await act(async () => {
        screen.getByRole('button', { name: 'Continue' }).click()
    })
}

describe('BridgeTosStep', () => {
    beforeEach(() => {
        closeIframe = undefined
        mockVerifiedResidence = null
        mockConfirm.mockReset()
        mockGetBridgeTosLink.mockReset()
        mockGetBridgeTosLink.mockResolvedValue({ data: { tosLink: 'https://compliance.test/tos' } })
    })

    const renderStep = (onComplete = jest.fn(), onSkip = jest.fn()) => {
        render(
            <IntlWrapper>
                <BridgeTosStep visible onComplete={onComplete} onSkip={onSkip} />
            </IntlWrapper>
        )
        return { onComplete, onSkip }
    }

    it('names the account provider and links the terms of the verified residence before any consent action', () => {
        mockVerifiedResidence = 'DE'
        renderStep()

        expect(screen.getByText('Accept terms')).toBeInTheDocument()
        expect(screen.getByText('Account provider')).toBeInTheDocument()
        expect(screen.getByText('Bridge')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'About Bridge' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Bridge EEA user terms' })).toHaveAttribute(
            'href',
            'https://www.bridge.xyz/legal/eea-user-terms/bridge-building-s-a'
        )
        // the button leads to bridge's page; it accepts nothing itself
        expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
        expect(mockGetBridgeTosLink).not.toHaveBeenCalled()
        const cta = screen.getByRole('button', { name: 'Continue' })
        // the card sits between the description and the button
        expect(
            screen.getByRole('button', { name: 'About Bridge' }).compareDocumentPosition(cta) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })

    it('opens a document in a new tab without starting the acceptance flow', () => {
        renderStep()

        const terms = screen.getByRole('link', { name: 'Bridge terms' })
        expect(terms).toHaveAttribute('target', '_blank')
        // jsdom does not navigate; the click must reach no handler of ours
        terms.addEventListener('click', (e) => e.preventDefault())
        terms.click()

        expect(mockGetBridgeTosLink).not.toHaveBeenCalled()
        expect(screen.queryByTestId('tos-iframe')).not.toBeInTheDocument()
    })

    it('links the US terms for a US resident', () => {
        mockVerifiedResidence = 'US'
        renderStep()

        expect(screen.getByRole('link', { name: 'Bridge US terms' })).toHaveAttribute(
            'href',
            'https://www.bridge.xyz/legal/us-terms/bridge-building-inc'
        )
    })

    it('completes when Bridge confirms the terms were signed', async () => {
        mockConfirm.mockResolvedValue(true)
        const { onComplete } = renderStep()
        await openTos()

        await act(async () => closeIframe?.('returned'))
        expect(onComplete).toHaveBeenCalled()
        // a return is not an observation — the helper must not treat a
        // confirm miss as webhook lag on this path
        expect(mockConfirm).toHaveBeenCalledWith(expect.anything(), { observedAcceptance: false })
    })

    it('keeps the prompt up when the user came back without signing', async () => {
        mockConfirm.mockResolvedValue(false)
        const { onComplete, onSkip } = renderStep()
        await openTos()

        await act(async () => closeIframe?.('returned'))
        expect(onComplete).not.toHaveBeenCalled()
        expect(onSkip).not.toHaveBeenCalled()
        expect(screen.getByText(/haven't been accepted yet/i)).toBeInTheDocument()
    })

    it('trusts an observed acceptance even if the confirm race says otherwise', async () => {
        // `tos_accepted` comes from Bridge's own postMessage (web iframe), so a
        // still-propagating confirm must not bounce the user back to the prompt.
        mockConfirm.mockResolvedValue(false)
        const { onComplete } = renderStep()
        await openTos()

        await act(async () => closeIframe?.('tos_accepted'))
        expect(onComplete).toHaveBeenCalled()
        expect(mockConfirm).toHaveBeenCalledWith(expect.anything(), { observedAcceptance: true })
    })
})
