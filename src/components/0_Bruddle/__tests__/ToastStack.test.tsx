import { screen } from '@testing-library/react'
// the dismiss aria-label comes from the common catalog via useTranslations
import { renderWithIntl as render } from '@/test-utils/intl'
import { Icon } from '@/components/Global/Icons/Icon'
import ToastStack from '../ToastStack'

const mockReduceMotion = { value: false }
const mockMotionProps: Record<string, unknown>[] = []

jest.mock('framer-motion', () => {
    const react = require('react')
    return {
        AnimatePresence: ({ children }: { children: React.ReactNode }) =>
            react.createElement(react.Fragment, null, children),
        useReducedMotion: () => mockReduceMotion.value,
        motion: {
            div: ({
                children,
                className,
                ...rest
            }: {
                children: React.ReactNode
                className?: string
            } & Record<string, unknown>) => {
                mockMotionProps.push(rest)
                return react.createElement('div', { className }, children)
            },
        },
    }
})

describe('ToastStack', () => {
    // pins the by-construction rule from bea446822: a toast whose content
    // carries its own icon must never also show the stock priority icon.
    // this is the rain cooldown pill's real path (RainCooldownContext:111 —
    // content set, no hideIcon from the caller).
    test('custom-content toast renders exactly one icon: the content one, not the stock priority icon', () => {
        const { container } = render(
            <ToastStack
                toasts={[
                    {
                        id: 'rain-cooldown',
                        duration: 'persistent',
                        content: (
                            <span className="flex items-center gap-2">
                                <Icon name="clock" size={16} />
                                Card cool-down · 4:32
                            </span>
                        ),
                    },
                ]}
                dismiss={() => {}}
            />
        )
        const dismissButton = screen.getByRole('button', { name: 'Close' })
        // svgs in the pill: the content's clock + the dismiss X — nothing else
        const svgsOutsideDismiss = Array.from(container.querySelectorAll('svg')).filter(
            (svg) => !dismissButton.contains(svg)
        )
        expect(svgsOutsideDismiss).toHaveLength(1)
        expect(screen.getByText(/Card cool-down/)).toBeInTheDocument()
    })

    test('plain-message toast keeps the stock priority icon', () => {
        const { container } = render(<ToastStack toasts={[{ id: 1, message: 'Link copied' }]} dismiss={() => {}} />)
        const dismissButton = screen.getByRole('button', { name: 'Close' })
        const svgsOutsideDismiss = Array.from(container.querySelectorAll('svg')).filter(
            (svg) => !dismissButton.contains(svg)
        )
        expect(svgsOutsideDismiss).toHaveLength(1)
    })

    // chip: the countdown strip going static was only half of it — an 80px
    // spring in and a 200px slide out is exactly the large decorative motion
    // prefers-reduced-motion is asking us not to make.
    describe('prefers-reduced-motion', () => {
        beforeEach(() => {
            mockMotionProps.length = 0
        })
        afterEach(() => {
            mockReduceMotion.value = false
        })

        const renderOne = () =>
            render(
                <ToastStack
                    toasts={[{ id: 'x', duration: 2000, type: 'success', message: 'Link cancelled successfully!' }]}
                    dismiss={() => {}}
                />
            )

        test('normally the card springs in and slides out', () => {
            renderOne()
            const props = mockMotionProps[0]
            expect(props.initial).toEqual({ scale: 0.8, y: 80 })
            expect(props.exit).toMatchObject({ y: 200 })
            expect(props.transition).toMatchObject({ type: 'spring' })
        })

        test('under reduce it carries no transform variants at all', () => {
            mockReduceMotion.value = true
            renderOne()
            const props = mockMotionProps[0]
            expect(props.initial).toBeUndefined()
            expect(props.animate).toBeUndefined()
            expect(props.exit).toBeUndefined()
            expect(props.transition).toBeUndefined()
        })
    })
})
