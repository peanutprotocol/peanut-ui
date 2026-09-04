import { act, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { ToastProvider, useToast } from '../Toast'

// ToastStack is next/dynamic in the provider, so its chunk only starts loading
// on the first toast. This mock stands in for that chunk and renders nothing
// until it is "delivered", which is the cold-session case chip flagged: the
// timer used to be armed at creation, so on a slow first load it could run out
// before anything was ever drawn and the user got no feedback at all.
// Delivery is sticky, like a real cached chunk — the provider unmounts the
// stack whenever the list empties, and that remount is not a fresh download.
let mockChunkReady = false
const mockListeners = new Set<() => void>()
const stallRenderer = () =>
    act(() => {
        mockChunkReady = false
        mockListeners.forEach((l) => l())
    })

const deliverChunk = () =>
    act(() => {
        mockChunkReady = true
        mockListeners.forEach((l) => l())
    })

jest.mock('../ToastStack', () => {
    const react = require('react')
    const MockToast = ({ id, onShow }: { id: string | number; onShow?: (id: string | number) => void }) => {
        react.useEffect(() => {
            onShow?.(id)
        }, [id, onShow])
        return react.createElement('div', { 'data-testid': 'toast' })
    }
    return {
        __esModule: true,
        default: ({
            toasts,
            onShow,
        }: {
            toasts: { id: string | number }[]
            onShow?: (id: string | number) => void
        }) => {
            const ready = react.useSyncExternalStore(
                (cb: () => void) => {
                    mockListeners.add(cb)
                    return () => mockListeners.delete(cb)
                },
                () => mockChunkReady,
                () => false
            )
            if (!ready) return null
            // one child per toast, each reporting its own mount — the same shape
            // as the real ToastStack
            return react.createElement(
                'div',
                null,
                toasts.map((t) => react.createElement(MockToast, { key: t.id, id: t.id, onShow }))
            )
        },
    }
})

const Trigger = ({ message }: { message: string }) => {
    const { success } = useToast()
    return (
        <button type="button" onClick={() => success(message)}>
            fire
        </button>
    )
}

const fire = () =>
    act(() => {
        screen.getByRole('button', { name: 'fire' }).click()
    })

// the provider loads ToastStack through next/dynamic, so the lazy component
// only resolves on a microtask — without this the assertions run against the
// render before it swapped in
const settleDynamicImport = async () => {
    await act(async () => {
        await Promise.resolve()
    })
}

const advance = (ms: number) =>
    act(() => {
        jest.advanceTimersByTime(ms)
    })

describe('toast lifetime', () => {
    beforeEach(() => {
        mockChunkReady = false
        mockListeners.clear()
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
    })

    // 'Link copied' is two words, so readingDuration gives it 2000ms.
    test('a toast created before the renderer arrives waits for it, then runs its full lifetime', async () => {
        render(
            <ToastProvider>
                <Trigger message="Link copied" />
            </ToastProvider>
        )
        fire()
        await settleDynamicImport()

        // chunk still in flight, well past the toast's own 2s
        advance(5000)
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument()

        deliverChunk()
        expect(screen.getByTestId('toast')).toBeInTheDocument()

        // the 2s starts here, not back when it was created
        advance(1900)
        expect(screen.getByTestId('toast')).toBeInTheDocument()
        advance(200)
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
    })

    // chip's second pass: gating on the stack alone still armed every LATER
    // toast at creation, before React had committed it. A delayed render then
    // shortened the toast and desynced it from the bar.
    test('a later toast also starts at its own mount, not at creation', async () => {
        render(
            <ToastProvider>
                <Trigger message="Link copied" />
            </ToastProvider>
        )
        fire()
        await settleDynamicImport()
        deliverChunk()
        advance(2100)
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument()

        // renderer stalls before the next toast can be committed
        stallRenderer()
        fire()
        advance(5000)
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument()

        // it appears, and only now does its 2s begin
        deliverChunk()
        expect(screen.getByTestId('toast')).toBeInTheDocument()
        advance(1900)
        expect(screen.getByTestId('toast')).toBeInTheDocument()
        advance(200)
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
    })

    test('dismissing while the renderer is still in flight drops the queued lifetime', async () => {
        let dismissId: string | number = ''
        const Manual = () => {
            const { success, dismiss } = useToast()
            return (
                <>
                    <button type="button" onClick={() => (dismissId = success('Link copied'))}>
                        fire
                    </button>
                    <button type="button" onClick={() => dismiss(dismissId)}>
                        close
                    </button>
                </>
            )
        }
        render(
            <ToastProvider>
                <Manual />
            </ToastProvider>
        )
        fire()
        await settleDynamicImport()
        act(() => {
            screen.getByRole('button', { name: 'close' }).click()
        })

        deliverChunk()
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
        // nothing left behind to fire later
        advance(5000)
        expect(screen.queryByTestId('toast')).not.toBeInTheDocument()
    })
})
