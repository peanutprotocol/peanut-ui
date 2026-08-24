/**
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
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser }),
}))

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
        screen.getByRole('button', { name: 'Accept Terms' }).click()
    })
}

describe('BridgeTosStep', () => {
    beforeEach(() => {
        closeIframe = undefined
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
