/**
 * SupportDrawer — Crisp session isolation gate.
 *
 * The bug this guards against: a logged-in user briefly seeing a *different*
 * Peanut user's chat history. The Crisp token is derived asynchronously from
 * the userId (SHA-256), so for one render it is undefined. If we open Crisp in
 * that window with no token, it falls back to the shared/device-local anonymous
 * session — which, where more than one account has been used, is the previous
 * user's conversation.
 *
 * The gate (`isAwaitingToken`) covers both surfaces:
 *  - web: the crisp-proxy iframe must not mount until the token resolves.
 *  - native (Capacitor): openMessenger() must not fire until the token resolves.
 * Anonymous visitors (no userId, no token by design) proceed immediately.
 */
import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import SupportDrawer from '../index'
import { isCapacitor } from '@/utils/capacitor'

const mockUseCrispUserData = jest.fn()
const mockUseCrispTokenId = jest.fn()
const mockIsCapacitor = isCapacitor as jest.Mock

const nativeCrisp = {
    setUser: jest.fn(),
    setTokenID: jest.fn(),
    setString: jest.fn(),
    sendMessage: jest.fn(),
    openMessenger: jest.fn(),
}

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        isSupportModalOpen: true,
        setIsSupportModalOpen: jest.fn(),
        supportPrefilledMessage: undefined,
    }),
}))
jest.mock('@/hooks/useCrispUserData', () => ({
    useCrispUserData: () => mockUseCrispUserData(),
}))
jest.mock('@/hooks/useCrispTokenId', () => ({
    useCrispTokenId: () => mockUseCrispTokenId(),
}))
jest.mock('@/hooks/useCrispProxyUrl', () => ({
    useCrispProxyUrl: (_data: unknown, _msg: unknown, tokenId?: string) =>
        tokenId ? `/crisp-proxy?crisp_token_id=${tokenId}` : '/crisp-proxy',
}))
jest.mock('../../PeanutLoading', () => ({
    __esModule: true,
    default: () => <div data-testid="peanut-loading" />,
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn() }))
jest.mock('@capgo/capacitor-crisp', () => ({ CapacitorCrisp: nativeCrisp }))

const supportIframe = () => screen.queryByTitle('Support Chat')

describe('SupportDrawer Crisp session gate — web iframe', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset()
        mockUseCrispTokenId.mockReset()
        mockIsCapacitor.mockReset().mockReturnValue(false)
    })

    it('does NOT mount the proxy iframe while a logged-in user’s token is still resolving', () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue(undefined)

        render(<SupportDrawer />)

        expect(supportIframe()).not.toBeInTheDocument()
        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })

    it('mounts a token-bound iframe once the logged-in user’s token resolves', () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue('token-abc')

        render(<SupportDrawer />)

        const iframe = supportIframe()
        expect(iframe).toBeInTheDocument()
        expect(iframe).toHaveAttribute('src', '/crisp-proxy?crisp_token_id=token-abc')
    })

    it('mounts the anonymous proxy immediately for a logged-out visitor (no userId, no token)', () => {
        mockUseCrispUserData.mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReturnValue(undefined)

        render(<SupportDrawer />)

        const iframe = supportIframe()
        expect(iframe).toBeInTheDocument()
        expect(iframe).toHaveAttribute('src', '/crisp-proxy')
    })
})

describe('SupportDrawer Crisp session gate — native (Capacitor)', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset()
        mockUseCrispTokenId.mockReset()
        mockIsCapacitor.mockReset().mockReturnValue(true)
        Object.values(nativeCrisp).forEach((fn) => fn.mockReset())
    })

    it('does NOT open the native messenger while a logged-in user’s token is still resolving', async () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue(undefined)

        await act(async () => {
            render(<SupportDrawer />)
        })

        expect(nativeCrisp.openMessenger).not.toHaveBeenCalled()
    })

    it('opens the native messenger with the token bound once it resolves', async () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue('token-abc')

        await act(async () => {
            render(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())
        expect(nativeCrisp.setTokenID).toHaveBeenCalledWith({ tokenID: 'token-abc' })
    })

    it('opens the native messenger immediately for a logged-out visitor (no token bound)', async () => {
        mockUseCrispUserData.mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReturnValue(undefined)

        await act(async () => {
            render(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())
        expect(nativeCrisp.setTokenID).not.toHaveBeenCalled()
    })
})
