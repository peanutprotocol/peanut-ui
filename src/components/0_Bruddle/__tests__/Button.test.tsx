import React from 'react'
import { render, screen } from '@testing-library/react'
import { Button } from '../Button'

// marker mock so tests can tell next/link anchors from plain <a>
jest.mock('next/link', () => ({
    __esModule: true,
    default: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function MockLink(
        { children, ...props },
        ref
    ) {
        return (
            <a data-nextlink="" ref={ref} {...props}>
                {children}
            </a>
        )
    }),
}))

describe('Button', () => {
    test('shadowless variant renders no press translate', () => {
        render(<Button variant="transparent">Ghost</Button>)
        expect(screen.getByRole('button', { name: /Ghost/ }).className).not.toContain('active:translate')
    })

    test('primary (shadowed) variant renders press translate', () => {
        render(<Button variant="primary">Pay</Button>)
        const cls = screen.getByRole('button', { name: /Pay/ }).className
        expect(cls).toContain('active:translate-x-1')
        expect(cls).toContain('active:translate-y-1')
    })

    test('caller shadow-none suppresses press translate even on primary', () => {
        render(
            <Button variant="primary" className="shadow-none">
                Flat
            </Button>
        )
        expect(screen.getByRole('button', { name: /Flat/ }).className).not.toContain('active:translate')
    })

    test('loading hides children svg icons via class', () => {
        render(
            <Button loading>
                <svg data-testid="child-icon" />
                Sending
            </Button>
        )
        expect(screen.getByRole('button', { name: /Sending/ }).className).toContain('[&_svg]:hidden')
    })
})

describe('Button link mode', () => {
    test('href renders ONE anchor and no button (no nested interactive)', () => {
        const { container } = render(<Button href="/home">Home</Button>)
        const link = screen.getByRole('link', { name: /Home/ })
        expect(link).toHaveAttribute('href', '/home')
        expect(container.querySelectorAll('a, button')).toHaveLength(1)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    test('internal route goes through next/link', () => {
        render(<Button href="/home">Home</Button>)
        expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('data-nextlink')
    })

    test('scheme hrefs render a plain <a>', () => {
        render(<Button href="mailto:support@peanut.me">Mail</Button>)
        const link = screen.getByRole('link', { name: /Mail/ })
        expect(link).toHaveAttribute('href', 'mailto:support@peanut.me')
        expect(link).not.toHaveAttribute('data-nextlink')
    })

    test('external renders a plain <a> targeting a new tab', () => {
        render(
            <Button href="https://peanut.me" external>
                Site
            </Button>
        )
        const link = screen.getByRole('link', { name: /Site/ })
        expect(link).not.toHaveAttribute('data-nextlink')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    test('download renders a plain <a> carrying the attribute', () => {
        render(
            <Button href="/receipt/1/pdf" download>
                PDF
            </Button>
        )
        const link = screen.getByRole('link', { name: /PDF/ })
        expect(link).not.toHaveAttribute('data-nextlink')
        expect(link).toHaveAttribute('download')
    })

    test('plainAnchor forces a plain <a> for an internal route', () => {
        render(
            <Button href="/" plainAnchor>
                Home
            </Button>
        )
        const link = screen.getByRole('link', { name: /Home/ })
        expect(link).toHaveAttribute('href', '/')
        expect(link).not.toHaveAttribute('data-nextlink')
    })

    test('disabled link drops the href and blocks navigation accessibly', () => {
        const { container } = render(
            <Button href="/home" disabled>
                Home
            </Button>
        )
        const link = container.querySelector('a')!
        expect(link).not.toHaveAttribute('href')
        expect(link).toHaveAttribute('aria-disabled', 'true')
        expect(link).toHaveAttribute('role', 'link')
        expect(link.className).toContain('pointer-events-none')
        expect(link.className).toContain('opacity-40')
    })

    test('ref lands on the element the mode renders', () => {
        const buttonRef = React.createRef<HTMLButtonElement>()
        const anchorRef = React.createRef<HTMLAnchorElement>()
        render(<Button ref={buttonRef}>AsButton</Button>)
        render(
            <Button href="/home" ref={anchorRef}>
                AsLink
            </Button>
        )
        expect(buttonRef.current).toBeInstanceOf(HTMLButtonElement)
        expect(anchorRef.current).toBeInstanceOf(HTMLAnchorElement)

        // compile-time: the wrong pairing is a type error (runtime no-ops)
        // @ts-expect-error button mode rejects an anchor ref
        void (<Button ref={anchorRef}>Wrong</Button>)
        void (
            (
                // @ts-expect-error link mode rejects a button ref
                <Button href="/home" ref={buttonRef}>
                    Wrong
                </Button>
            )
        )
    })

    test('link mode carries the exact button classes (plus no-underline)', () => {
        render(<Button variant="stroke">AsButton</Button>)
        render(
            <Button variant="stroke" href="/home">
                AsLink
            </Button>
        )
        const btnClasses = screen
            .getByRole('button', { name: /AsButton/ })
            .className.split(/\s+/)
            .sort()
        const linkClasses = screen
            .getByRole('link', { name: /AsLink/ })
            .className.split(/\s+/)
            .sort()
        const extra = linkClasses.filter((c) => !btnClasses.includes(c))
        expect(extra).toEqual(['no-underline'])
        expect(btnClasses.filter((c) => !linkClasses.includes(c))).toEqual([])
    })
})
