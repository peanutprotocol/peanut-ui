import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { __testing } from '@/hooks/useSafeBack'

const back = jest.fn()
const push = jest.fn()
const replace = jest.fn()

jest.mock('next/navigation', () => ({ useRouter: () => ({ back, push, replace, prefetch: jest.fn() }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/hooks/useWalletPlatform', () => ({ useWalletPlatform: () => 'ios' }))
jest.mock('@/components/0_Bruddle/PageContainer', () => {
    return function MockPageContainer(p: { children?: React.ReactNode }) {
        return <div>{p.children}</div>
    }
})
// Surface the carousel's two exits as buttons so the test drives the real page callbacks.
// useSafeBack is deliberately NOT mocked — the whole defect lives in which branch it takes.
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

// Regression (TASK-21930): Done used router.push, so Back popped the user straight back
// into the tutorial they had just finished. The only in-app entry is the link on /card
// (YourCardScreen), so the realistic history is [..., /card, /card/add-to-wallet].
describe('card add-to-wallet navigation', () => {
    beforeEach(() => {
        back.mockReset()
        push.mockReset()
        replace.mockReset()
        __testing.reset()
    })

    it('backs out of the tutorial on Done when entered in-app, leaving no tutorial entry', () => {
        act(() => {
            window.history.pushState({}, '', '/card/add-to-wallet')
        })
        render(<AddToWalletPage />)

        fireEvent.click(screen.getByText('done'))

        expect(back).toHaveBeenCalledTimes(1)
        // A push here is the original bug; a replace would strand the user on /card.
        expect(push).not.toHaveBeenCalled()
        expect(replace).not.toHaveBeenCalled()
    })

    it('replaces rather than pushes on Done from a cold deep link', () => {
        render(<AddToWalletPage />)

        fireEvent.click(screen.getByText('done'))

        expect(replace).toHaveBeenCalledWith('/card')
        expect(push).not.toHaveBeenCalled()
    })

    it('leaves Back on the push fallback, so Done and Back differ only there', () => {
        render(<AddToWalletPage />)

        fireEvent.click(screen.getByText('prev'))

        expect(push).toHaveBeenCalledWith('/card')
        expect(replace).not.toHaveBeenCalled()
    })
})
