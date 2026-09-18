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

    // the Weight look distinguishes the two states with two type tokens and the
    // foreground tokens — nothing else. If a border/fill/rule ever comes back,
    // or a raw font-weight utility replaces the token pair, this fails.
    test('active and inactive states are type tokens only, and focus is ruled', () => {
        render(<Tabs tabs={TABS} aria-label="demo" />)
        const [active, inactive] = screen.getAllByRole('tab')
        expect(active.className).toContain('data-[state=active]:text-body-m-semibold')
        expect(active.className).toContain('data-[state=inactive]:text-body-m')
        expect(active.className).not.toMatch(/\bfont-(semibold|bold|medium)\b/)
        expect(active.className).not.toMatch(/\b(border|bg)-/)
        expect(inactive.className).toContain('focus-visible:outline-action-focus')
    })
})
