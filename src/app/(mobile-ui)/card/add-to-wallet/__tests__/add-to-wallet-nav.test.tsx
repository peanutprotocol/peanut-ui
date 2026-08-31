import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

const push = jest.fn()
const replace = jest.fn()
const onBack = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/hooks/useWalletPlatform', () => ({ useWalletPlatform: () => 'ios' }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => onBack }))
jest.mock('@/components/0_Bruddle/PageContainer', () => {
    return function MockPageContainer(p: { children?: React.ReactNode }) {
        return <div>{p.children}</div>
    }
})
// Surface the carousel's two exits as buttons so the test drives the real page callbacks.
jest.mock('@/components/Card/AddToWalletCarousel', () => {
    return function MockCarousel(p: { onDone: () => void; onPrev?: () => void }) {
        return (
            <div>
                <button onClick={p.onDone}>done</button>
                <button onClick={p.onPrev}>prev</button>
            </div>
        )
    }
})

import AddToWalletPage from '../page'

describe('card add-to-wallet navigation', () => {
    beforeEach(() => {
        push.mockClear()
        replace.mockClear()
        onBack.mockClear()
    })

    // Regression (TASK-21930): Done used router.push, so browser/native Back
    // popped the user straight back into the tutorial they had just finished.
    it('replaces the tutorial entry on Done so Back cannot re-enter it', () => {
        render(<AddToWalletPage />)
        fireEvent.click(screen.getByText('done'))

        expect(replace).toHaveBeenCalledWith('/card')
        expect(push).not.toHaveBeenCalled()
    })

    it('routes Back through useSafeBack', () => {
        render(<AddToWalletPage />)
        fireEvent.click(screen.getByText('prev'))

        expect(onBack).toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
        expect(replace).not.toHaveBeenCalled()
    })
})
