import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

// radix tabs activate on mousedown, not click, so fire both
const clickTab = (el: HTMLElement) => {
    fireEvent.mouseDown(el)
    fireEvent.click(el)
}
import { Tabs } from '../Tabs'

const TABS = [
    { value: 'one', label: 'One', content: <p>panel one</p> },
    { value: 'two', label: 'Two', content: <p>panel two</p> },
]

describe('Tabs', () => {
    test('uncontrolled: the first tab is the default and clicking switches panels', () => {
        render(<Tabs tabs={TABS} aria-label="demo" />)
        expect(screen.getByText('panel one')).toBeInTheDocument()
        expect(screen.queryByText('panel two')).not.toBeInTheDocument()

        clickTab(screen.getByRole('tab', { name: 'Two' }))
        expect(screen.getByText('panel two')).toBeInTheDocument()
        expect(screen.queryByText('panel one')).not.toBeInTheDocument()
    })

    test('controlled: value selects the tab and onValueChange reports clicks', () => {
        const onValueChange = jest.fn()
        const { rerender } = render(<Tabs tabs={TABS} aria-label="demo" value="two" onValueChange={onValueChange} />)
        expect(screen.getByText('panel two')).toBeInTheDocument()

        clickTab(screen.getByRole('tab', { name: 'One' }))
        expect(onValueChange).toHaveBeenCalledWith('one')
        // still controlled by the prop until the parent updates it
        expect(screen.getByText('panel two')).toBeInTheDocument()

        rerender(<Tabs tabs={TABS} aria-label="demo" value="one" onValueChange={onValueChange} />)
        expect(screen.getByText('panel one')).toBeInTheDocument()
    })

    test('controlled by a parent state round-trips', () => {
        const Wrapper = () => {
            const [value, setValue] = useState('one')
            return <Tabs tabs={TABS} aria-label="demo" value={value} onValueChange={setValue} />
        }
        render(<Wrapper />)
        clickTab(screen.getByRole('tab', { name: 'Two' }))
        expect(screen.getByText('panel two')).toBeInTheDocument()
    })

    test('a ReactNode label renders inside the trigger', () => {
        render(
            <Tabs
                tabs={[{ value: 'x', label: <span data-testid="rich-label">Rich</span>, content: <p>panel x</p> }]}
                aria-label="demo"
            />
        )
        expect(screen.getByTestId('rich-label')).toBeInTheDocument()
    })

    test('no tab carries content: the trigger row renders alone, with no panel', () => {
        render(
            <Tabs
                tabs={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' },
                ]}
                aria-label="period"
            />
        )
        expect(screen.getAllByRole('tab')).toHaveLength(2)
        expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()
    })

    test('a panel-less row still reports clicks through onValueChange', () => {
        const onValueChange = jest.fn()
        render(
            <Tabs
                tabs={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' },
                ]}
                aria-label="period"
                value="monthly"
                onValueChange={onValueChange}
            />
        )
        clickTab(screen.getByRole('tab', { name: 'Yearly' }))
        expect(onValueChange).toHaveBeenCalledWith('yearly')
    })

    test('forceMount keeps inactive panels in the DOM, hidden', () => {
        render(<Tabs tabs={TABS} aria-label="demo" forceMount />)
        // both panels exist; only the active one is visible
        expect(screen.getByText('panel one')).toBeInTheDocument()
        expect(screen.getByText('panel two')).toBeInTheDocument()
        expect(screen.getByText('panel two').closest('[data-state="inactive"]')).not.toBeNull()
    })

    // The look is BottomNav's bar standing still, welded flush to it. If the
    // chip ever floats inside a padded track again, or the chip border is
    // dropped in favour of fill alone (the fills are only 1.09:1 apart), this
    // fails.
    test('the chip is welded flush to the track, and the border carries selection', () => {
        render(<Tabs tabs={TABS} aria-label="demo" />)
        const list = screen.getByRole('tablist')
        // track: bordered white pill on the WRAPPER, not on the scrolling list —
        // a scroll container clips at its padding box and could never let the
        // chip paint over its own border
        const track = list.parentElement!
        expect(track.className).toContain('rounded-full')
        expect(track.className).toContain('border-border-default')
        expect(track.className).toContain('bg-background-default')
        // the list itself carries no track surface, only the 1px weld gutter
        expect(list.className).not.toContain('border-border-default')
        expect(list.className).not.toContain('bg-background-default')
        expect(list.className).toContain('-m-px')
        expect(list.className).toContain('p-px')
        expect(list.className).toContain('gap-0')

        const [tab] = screen.getAllByRole('tab')
        // the weld: the chip is a ::before pinned 1px outside the trigger on all
        // four sides, so it lands ON the track's border instead of floating
        // inside it. The overlap survives the scroll box because the list's
        // -m-px/p-px gutter puts its padding ring over that border — the
        // overhang renders inside the scrollport and adds no scrollable
        // overflow, so the row still has nothing to scroll at rest.
        expect(tab.className).toContain('before:absolute')
        expect(tab.className).toContain('before:-inset-px')
        expect(tab.className).toContain('before:rounded-full')
        // selection is carried by a border, never by fill alone
        expect(tab.className).toContain('data-[state=active]:before:border-border-default')
        expect(tab.className).toContain('data-[state=active]:before:bg-background-page')
        // inactive keeps a same-width transparent border so nothing shifts
        expect(tab.className).toContain('before:border-transparent')
        // focus stays ruled, never pink
        expect(tab.className).toContain('focus-visible:outline-action-focus')
        expect(tab.className).not.toContain('action-primary')
        // static: no shadow plane, no spring — those stay in BottomNav
        expect(list.className).not.toContain('shadow-')
        expect(tab.className).not.toContain('transition-transform')
    })

    // the row scrolls on ONE axis. `overflow-x: auto` forces a `visible` y to
    // `auto` by itself, so the y must be written out or the chip's 1px vertical
    // overhang makes the row scroll with nothing to scroll.
    test('the track scrolls horizontally only, never vertically', () => {
        render(<Tabs tabs={TABS} aria-label="demo" />)
        const list = screen.getByRole('tablist')
        expect(list.className).toContain('overflow-x-auto')
        expect(list.className).toContain('overflow-y-hidden')
    })

    // size changes height, padding, the text-token PAIR and the gap — nothing
    // else. If a future edit makes a size move the radius, the weld, the ring or
    // the track, the shared-class check at the bottom fails.
    test.each([
        ['sm', 'min-h-9', 'px-3', 'text-body-s', 'text-body-s-semibold', 'gap-1'],
        ['md', 'min-h-11', 'px-4', 'text-body-m', 'text-body-m-semibold', 'gap-1'],
        ['lg', 'min-h-13', 'px-6', 'text-body-m', 'text-body-m-semibold', 'gap-2'],
    ] as const)(
        'size=%s resolves to %s %s, %s inactive / %s active, with a %s label gap',
        (size, height, pad, idle, active, gap) => {
            const { container } = render(<Tabs tabs={TABS} aria-label="demo" size={size} />)
            const [tab] = screen.getAllByRole('tab')
            expect(tab.className).toContain(height)
            expect(tab.className).toContain(pad)
            // the weight step is a PAIR of type tokens on mutually exclusive
            // state selectors — never a type token plus a raw font-weight class,
            // which is what the ds-lint fontWeightOnTypeToken ratchet counts
            expect(tab.className).toContain(`data-[state=inactive]:${idle}`)
            expect(tab.className).toContain(`data-[state=active]:${active}`)
            expect(tab.className).not.toMatch(/\bfont-(?:semibold|bold|medium|normal)\b/)
            expect(container.querySelector('[role="tab"] > span')?.className).toContain(gap)
        }
    )

    test('md is the default, and size touches nothing but height, padding, text and gap', () => {
        const { unmount } = render(<Tabs tabs={TABS} aria-label="demo" />)
        const byDefault = screen.getAllByRole('tab')[0].className
        expect(byDefault).toContain('min-h-11')
        expect(byDefault).toContain('px-4')
        expect(byDefault).toContain('data-[state=inactive]:text-body-m')
        unmount()

        // everything that must NOT vary with size
        const shared = [
            'before:-inset-px',
            'before:rounded-full',
            'data-[state=active]:before:border-border-default',
            'data-[state=active]:before:bg-background-page',
            'focus-visible:outline-action-focus',
        ]
        for (const size of ['sm', 'md', 'lg'] as const) {
            const { unmount: u } = render(<Tabs tabs={TABS} aria-label="demo" size={size} />)
            const cls = screen.getAllByRole('tab')[0].className
            for (const c of shared) expect(cls).toContain(c)
            // the weight step IS the third selection channel (kush, 2026-09-21,
            // superseding the "unruled" hold this assertion used to guard). It
            // must ride the ACTIVE state only — an unconditional semibold would
            // make every label bold and carry no selection at all.
            const emphasis = size === 'sm' ? 'text-body-s-semibold' : 'text-body-m-semibold'
            expect(cls).toContain(`data-[state=active]:${emphasis}`)
            expect(cls).not.toContain(`data-[state=inactive]:${emphasis}`)
            // and it is never an unprefixed, always-on token
            expect(cls).not.toMatch(new RegExp(`(?<!:)\\b${emphasis}\\b`))
            u()
        }
    })

    test('a disabled tab ignores taps and says it is disabled', () => {
        const onValueChange = jest.fn()
        render(
            <Tabs
                tabs={[
                    { value: 'one', label: 'One' },
                    { value: 'two', label: 'Two', disabled: true },
                ]}
                aria-label="demo"
                value="one"
                onValueChange={onValueChange}
            />
        )
        const two = screen.getByRole('tab', { name: 'Two' })
        clickTab(two)
        expect(onValueChange).not.toHaveBeenCalled()
        expect(two).toBeDisabled()
    })
})
