import { render, screen } from '@testing-library/react'
import SegmentedControl from '../SegmentedControl'
import { Tabs } from '../Tabs'
import { TabsLookProvider } from '../TabsLook'

/**
 * The look override is /dev/tabs-proposals scaffolding (TASK-22707). The thing
 * that must hold is that it is INERT: with no provider above them — every one
 * of the 10 shipped call sites — both components keep the exact classes they
 * had before. These two assertions are what fails if that stops being true.
 */

const OPTIONS = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
]

describe('TabsLook override', () => {
    test('no provider: SegmentedControl and Tabs keep their shipped selected styles', () => {
        render(
            <>
                <SegmentedControl options={OPTIONS} value="monthly" onChange={() => {}} aria-label="period" />
                <Tabs tabs={[{ value: 'a', label: 'Details', content: <p>panel</p> }]} aria-label="demo" />
            </>
        )
        expect(screen.getByRole('tab', { name: 'Monthly' }).className).toContain(
            'data-[state=active]:bg-action-primary/10'
        )
        expect(screen.getByRole('tab', { name: 'Details' }).className).toContain('rounded-t-sm')
    })

    test('under a provider: both render in the look instead', () => {
        render(
            <TabsLookProvider look="blush">
                <SegmentedControl options={OPTIONS} value="monthly" onChange={() => {}} aria-label="period" />
            </TabsLookProvider>
        )
        const trigger = screen.getByRole('tab', { name: 'Monthly' })
        expect(trigger.className).toContain('data-[state=active]:bg-action-primary')
        expect(trigger.className).not.toContain('bg-action-primary/10')
    })
})
