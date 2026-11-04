import { fireEvent, render, screen } from '@testing-library/react'
import RootError from '../error'
import { captureException } from '@/utils/sentry-lazy'

jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn() }))

const GUARD_KEY = 'peanut-chunk-reload-at'

const chunkError = () =>
    Object.assign(new Error('Loading chunk 110 failed.\n(error: https://peanut.me/_next/static/chunks/110-x.js)'), {
        name: 'ChunkLoadError',
    })

describe('root error boundary', () => {
    const originalLocation = window.location
    let reload: jest.Mock

    beforeEach(() => {
        reload = jest.fn()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, reload },
        })
        sessionStorage.clear()
        jest.spyOn(console, 'error').mockImplementation(() => {})
        ;(captureException as jest.Mock).mockClear()
    })

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
        jest.restoreAllMocks()
    })

    it('renders a recoverable page whose "Try again" calls reset', () => {
        const reset = jest.fn()
        render(<RootError error={new Error('boom')} reset={reset} />)

        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/')
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(reset).toHaveBeenCalledTimes(1)
    })

    it('reports the error and does not reload for a non-chunk error', () => {
        const error = new Error('boom')
        render(<RootError error={error} reset={jest.fn()} />)

        expect(captureException).toHaveBeenCalledWith(error)
        expect(reload).not.toHaveBeenCalled()
        expect(sessionStorage.getItem(GUARD_KEY)).toBeNull()
    })

    it('hard-reloads once on a ChunkLoadError and sets the loop guard', () => {
        render(<RootError error={chunkError()} reset={jest.fn()} />)

        expect(reload).toHaveBeenCalledTimes(1)
        expect(Number(sessionStorage.getItem(GUARD_KEY))).toBeGreaterThan(0)
    })

    it('does not reload again while the guard is fresh', () => {
        sessionStorage.setItem(GUARD_KEY, String(Date.now()))
        render(<RootError error={chunkError()} reset={jest.fn()} />)

        expect(reload).not.toHaveBeenCalled()
        // the fallback stays on screen so the visitor can still act
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('makes "Try again" a hard reload for a chunk error, since reset cannot refetch the chunk', () => {
        sessionStorage.setItem(GUARD_KEY, String(Date.now()))
        const reset = jest.fn()
        render(<RootError error={chunkError()} reset={reset} />)

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(reload).toHaveBeenCalledTimes(1)
        expect(reset).not.toHaveBeenCalled()
    })
})
