import { act, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { ToastProvider, useToast } from '../Toast'
import { copyTextToClipboard, resetClipboardWriteMarkForTests } from '@/utils/clipboard.utils'
import { isAndroidNative } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isAndroidNative: jest.fn(() => false),
    isNativeBridge: jest.fn(() => false),
}))

jest.mock('../ToastStack', () => ({
    __esModule: true,
    default: ({ toasts, onShow }: { toasts: { id: string | number }[]; onShow?: (id: string | number) => void }) => {
        const react = require('react')
        react.useEffect(() => {
            toasts.forEach((t) => onShow?.(t.id))
        }, [toasts, onShow])
        return react.createElement('div', { 'data-testid': 'toast' })
    },
}))

const mockedIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>

const Trigger = () => {
    const { info } = useToast()
    return (
        <button type="button" onClick={() => info('Link copied')}>
            fire
        </button>
    )
}

// the stack's own bottom offset — the raised one clears Android's system
// clipboard preview, which is anchored bottom-left and can be ~124px tall
const RAISED = 'bottom-[calc(var(--safe-bottom)_+_8.5rem)]'
const NORMAL = 'bottom-[calc(var(--safe-bottom)_+_1rem)]'

const stack = () => document.querySelector('.fixed.right-4') as HTMLElement

// the provider loads ToastStack through next/dynamic; settling the microtask
// keeps its resolution out of the assertions (and out of act warnings)
const setup = async () => {
    render(
        <ToastProvider>
            <Trigger />
        </ToastProvider>
    )
    await act(async () => {
        await Promise.resolve()
    })
}

const fire = () =>
    act(() => {
        screen.getByRole('button', { name: 'fire' }).click()
    })

describe('toast placement around the android clipboard overlay', () => {
    beforeEach(() => {
        resetClipboardWriteMarkForTests()
        mockedIsAndroidNative.mockReturnValue(false)
        // jsdom has no clipboard API; execCommand is the path that lands
        document.execCommand = jest.fn(() => true)
    })

    test('a toast right after a copy is lifted clear of the overlay on android', async () => {
        mockedIsAndroidNative.mockReturnValue(true)
        await setup()
        await act(async () => {
            await copyTextToClipboard('https://peanut.me/innolope/5USDC')
        })
        fire()
        expect(stack()).toHaveClass(RAISED)
        expect(stack()).not.toHaveClass(NORMAL)
    })

    test('the same copy on any other platform leaves the toast where it was', async () => {
        await setup()
        await act(async () => {
            await copyTextToClipboard('https://peanut.me/innolope/5USDC')
        })
        fire()
        expect(stack()).toHaveClass(NORMAL)
        expect(stack()).not.toHaveClass(RAISED)
    })

    test('a toast that does not follow a copy stays where it was, on android too', async () => {
        mockedIsAndroidNative.mockReturnValue(true)
        await setup()
        fire()
        expect(stack()).toHaveClass(NORMAL)
    })

    test('the lift expires — a later unrelated toast is not still raised', async () => {
        jest.useFakeTimers()
        try {
            mockedIsAndroidNative.mockReturnValue(true)
            await setup()
            await act(async () => {
                await copyTextToClipboard('https://peanut.me/innolope/5USDC')
            })
            // past the grace window the overlay is gone, so nothing to dodge
            act(() => {
                jest.advanceTimersByTime(2000)
            })
            fire()
            expect(stack()).toHaveClass(NORMAL)
        } finally {
            jest.useRealTimers()
        }
    })

    test('the lift transition is gated on motion-safe', async () => {
        await setup()
        fire()
        // a ~120px travel is the same large decorative motion the card's own
        // spring is gated on
        expect(stack()).toHaveClass('motion-safe:transition-[bottom]')
        expect(stack().className).not.toMatch(/(^|\s)transition-\[bottom\]/)
    })
})

// chip: the lift reads a marker that only clipboard.utils sets, so a copy that
// writes the clipboard directly and then toasts shows Android's system preview
// with the toast still underneath it. The QR success screen did exactly that.
// This is the call-site sweep as a test, so the next one cannot bypass it.
describe('every copy-to-toast path goes through clipboard.utils', () => {
    test('no file that toasts also writes the clipboard directly', () => {
        const fs = require('fs') as typeof import('fs')
        const path = require('path') as typeof import('path')
        const root = path.join(__dirname, '..', '..', '..')

        const walk = (dir: string): string[] =>
            fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
                const full = path.join(dir, entry.name)
                if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full)
                return /\.tsx?$/.test(entry.name) ? [full] : []
            })

        const offenders = walk(root)
            .filter((file) => !file.endsWith(path.join('utils', 'clipboard.utils.ts')))
            .filter((file) => {
                const text = fs.readFileSync(file, 'utf8')
                return /\buseToast\b/.test(text) && /navigator\.clipboard\.write/.test(text)
            })
            .map((file) => path.relative(root, file))

        expect(offenders).toEqual([])
    })
})
