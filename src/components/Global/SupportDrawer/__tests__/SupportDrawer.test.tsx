/**
 * SupportDrawer — Crisp session isolation gate.
 *
 * The bug this guards against: a logged-in user briefly seeing a *different*
 * Peanut user's chat history. The Crisp token is derived asynchronously from
 * the userId (SHA-256), so for one render it is undefined. If we mount the
 * crisp-proxy iframe in that window, Crisp loads with no token and falls back
 * to the anonymous session persisted on client.crisp.chat — which, on a browser
 * that has hosted more than one account, is the previous user's conversation.
 *
 * The gate: while a logged-in user's token is still resolving, the iframe must
 * not render. Anonymous visitors (no userId, no token by design) load right away.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import SupportDrawer from '../index'

const mockUseCrispUserData = jest.fn()
const mockUseCrispTokenId = jest.fn()

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
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const supportIframe = () => screen.queryByTitle('Support Chat')

describe('SupportDrawer Crisp session gate', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset()
        mockUseCrispTokenId.mockReset()
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
