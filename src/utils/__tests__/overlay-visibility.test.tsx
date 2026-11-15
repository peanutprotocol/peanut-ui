import React from 'react'
import { act, render } from '@testing-library/react'

const mockCaptureMessage = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureMessage: (...args: unknown[]) => mockCaptureMessage(...args) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

import Modal from '@/components/Global/Modal'
import {
    AttentionSurfaceContext,
    isManagerOverlayOpen,
    OVERLAY_COLLISION_GRACE_MS,
    resetOverlayCollisionForTests,
    useAnyOverlayOpen,
} from '../overlay-visibility'

let busy = false
function Busy() {
    busy = useAnyOverlayOpen()
    return null
}

function Overlays({ user, manager }: { user: boolean; manager: boolean }) {
    return (
        <>
            <Busy />
            {user && (
                <Modal visible onClose={() => {}}>
                    user modal
                </Modal>
            )}
            {manager && (
                <AttentionSurfaceContext.Provider value={true}>
                    <Modal visible onClose={() => {}}>
                        manager modal
                    </Modal>
                </AttentionSurfaceContext.Provider>
            )}
        </>
    )
}

beforeEach(() => {
    jest.useFakeTimers()
    mockCaptureMessage.mockClear()
    resetOverlayCollisionForTests()
    busy = false
})
afterEach(() => jest.useRealTimers())

test("a real modal marks the app busy for the manager; the manager's own modal does not", () => {
    const view = render(<Overlays user={false} manager />)
    expect(busy).toBe(false)
    expect(isManagerOverlayOpen()).toBe(true)
    view.rerender(<Overlays user manager={false} />)
    expect(busy).toBe(true)
    view.unmount()
})

test('a manager prompt and another overlay open together are reported once, after the hand-off grace', () => {
    const view = render(<Overlays user={false} manager />)
    view.rerender(<Overlays user manager />)
    expect(mockCaptureMessage).not.toHaveBeenCalled()
    act(() => {
        jest.advanceTimersByTime(OVERLAY_COLLISION_GRACE_MS)
    })
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
    expect(mockCaptureMessage).toHaveBeenCalledWith(
        'attention: a manager prompt and another overlay are open together',
        {
            level: 'warning',
            tags: { feature: 'attention', second: 'other' },
        }
    )
    view.unmount()
})

test('a prompt that hands over to the next overlay within the grace is not a collision', () => {
    const view = render(<Overlays user={false} manager />)
    view.rerender(<Overlays user manager />)
    view.rerender(<Overlays user manager={false} />)
    act(() => {
        jest.advanceTimersByTime(OVERLAY_COLLISION_GRACE_MS)
    })
    expect(mockCaptureMessage).not.toHaveBeenCalled()
    view.unmount()
})
