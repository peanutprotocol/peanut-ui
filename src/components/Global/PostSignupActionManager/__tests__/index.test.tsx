/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { PostSignupActionManager } from '../index'

const mockRouterPush = jest.fn()
const mockRouter = { push: mockRouterPush }
const mockGetStoredRedirect = jest.fn()
const mockClearRedirectUrl = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
}))

jest.mock('@/utils/general.utils', () => ({
    getStoredRedirect: (...args: any[]) => mockGetStoredRedirect(...args),
    clearRedirectUrl: (...args: any[]) => mockClearRedirectUrl(...args),
}))

jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: true }),
}))

jest.mock('../../ActionModal', () => ({
    __esModule: true,
    default: ({ visible, ctas, onClose }: any) =>
        visible ? (
            <div>
                <button onClick={ctas[0].onClick}>{ctas[0].text}</button>
                <button onClick={onClose}>Close</button>
            </div>
        ) : null,
}))

describe('PostSignupActionManager', () => {
    const redirect = {
        destination: '/claim?step=claim&id=payment-1',
        origin: 'deep-link' as const,
        generationId: 'generation-a',
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockGetStoredRedirect.mockReturnValue(redirect)
    })

    it('clears the redirect snapshot that opened the action modal', () => {
        render(<PostSignupActionManager onActionModalVisibilityChange={jest.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Claim to bank' }))

        expect(mockRouterPush).toHaveBeenCalledWith(redirect.destination)
        expect(mockClearRedirectUrl).toHaveBeenCalledWith(redirect)
    })

    it('clears the modal snapshot when the user closes it', () => {
        render(<PostSignupActionManager onActionModalVisibilityChange={jest.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: 'Close' }))

        expect(mockClearRedirectUrl).toHaveBeenCalledWith(redirect)
    })
})
