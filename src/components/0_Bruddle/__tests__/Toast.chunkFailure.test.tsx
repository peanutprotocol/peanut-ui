import { act, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'
import { ToastProvider, useToast } from '../Toast'

// ToastProvider wraps every app route, so a renderer chunk that never loads used
// to unwind to global-error and replace the whole app.
jest.mock('../ToastStack', () => ({
    __esModule: true,
    default: () => {
        throw Object.assign(new Error('Loading chunk 11607 failed.'), { name: 'ChunkLoadError' })
    },
}))
jest.mock('@/utils/chunk-error-recovery', () => ({
    ...jest.requireActual('@/utils/chunk-error-recovery'),
    recoverFromChunkError: jest.fn(),
}))

const Trigger = () => {
    const { success } = useToast()
    return (
        <button type="button" onClick={() => success('Link copied')}>
            fire
        </button>
    )
}

test('a toast renderer that cannot load costs the toast, not the app, and does not reload', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
        <ToastProvider>
            <Trigger />
            <p>app content</p>
        </ToastProvider>
    )

    await act(async () => {
        screen.getByRole('button', { name: 'fire' }).click()
        await Promise.resolve()
    })

    expect(consoleError).toHaveBeenCalledWith(
        'LazyLoad Error Boundary caught error:',
        expect.objectContaining({ name: 'ChunkLoadError' }),
        expect.anything()
    )
    expect(screen.getByText('app content')).toBeInTheDocument()
    expect(recoverFromChunkError).not.toHaveBeenCalled()
    consoleError.mockRestore()
})
