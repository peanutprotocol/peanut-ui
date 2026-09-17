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

    test('forceMount keeps inactive panels in the DOM, hidden', () => {
        render(<Tabs tabs={TABS} aria-label="demo" forceMount />)
        // both panels exist; only the active one is visible
        expect(screen.getByText('panel one')).toBeInTheDocument()
        expect(screen.getByText('panel two')).toBeInTheDocument()
        expect(screen.getByText('panel two').closest('[data-state="inactive"]')).not.toBeNull()
    })
})
