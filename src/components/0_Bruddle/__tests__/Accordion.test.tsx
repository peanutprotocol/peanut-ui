import { fireEvent, render, screen } from '@testing-library/react'
import { Accordion } from '../Accordion'

const renderAccordion = () =>
    render(
        <Accordion type="single" collapsible>
            <Accordion.Item value="one">
                <Accordion.Trigger>First section</Accordion.Trigger>
                <Accordion.Content>First content</Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="two" disabled>
                <Accordion.Trigger>Disabled section</Accordion.Trigger>
                <Accordion.Content>Hidden content</Accordion.Content>
            </Accordion.Item>
        </Accordion>
    )

describe('Accordion', () => {
    test('starts collapsed, expands on trigger click, collapses on second click', () => {
        renderAccordion()
        expect(screen.queryByText('First content')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /First section/ }))
        expect(screen.getByText('First content')).toBeVisible()

        fireEvent.click(screen.getByRole('button', { name: /First section/ }))
        expect(screen.queryByText('First content')).not.toBeInTheDocument()
    })

    test('disabled item cannot be expanded', () => {
        renderAccordion()
        const trigger = screen.getByRole('button', { name: /Disabled section/ })
        expect(trigger).toBeDisabled()
        fireEvent.click(trigger)
        expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
    })

    test('disabled item keeps the default border, only the fill goes gray', () => {
        renderAccordion()
        const item = screen.getByRole('button', { name: /Disabled section/ }).closest('h3')?.parentElement
        expect(item).toHaveClass('border-border-default', 'data-[disabled]:bg-background-disabled')
        expect(item?.className).not.toContain('border-border-subtle')
    })

    test('title/body/leading render the ListItem row anatomy', () => {
        render(
            <Accordion type="single" collapsible>
                <Accordion.Item value="countries">
                    <Accordion.Trigger
                        leading={<span data-testid="bubble" />}
                        title="All countries"
                        body="Pick the country your bank is in."
                    />
                    <Accordion.Content flush>List</Accordion.Content>
                </Accordion.Item>
            </Accordion>
        )
        const trigger = screen.getByRole('button', { name: /All countries/ })
        expect(trigger).toContainElement(screen.getByTestId('bubble'))
        expect(screen.getByText('All countries')).toHaveClass('text-body-m-semibold')
        expect(screen.getByText('Pick the country your bank is in.')).toHaveClass(
            'text-body-s',
            'text-foreground-secondary'
        )
        expect(trigger).toHaveAttribute('aria-expanded', 'false')
    })

    test('flush content drops the padding, default content keeps it', () => {
        render(
            <Accordion type="multiple" defaultValue={['flush', 'padded']}>
                <Accordion.Item value="flush">
                    <Accordion.Trigger>Flush</Accordion.Trigger>
                    <Accordion.Content flush>Flush body</Accordion.Content>
                </Accordion.Item>
                <Accordion.Item value="padded">
                    <Accordion.Trigger>Padded</Accordion.Trigger>
                    <Accordion.Content>Padded body</Accordion.Content>
                </Accordion.Item>
            </Accordion>
        )
        expect(screen.getByText('Flush body')).not.toHaveClass('p-4')
        expect(screen.getByText('Padded body')).toHaveClass('p-4')
    })

    test('forceMount keeps closed content in the DOM, hidden', () => {
        render(
            <Accordion type="single" collapsible>
                <Accordion.Item value="one">
                    <Accordion.Trigger>Countries</Accordion.Trigger>
                    <Accordion.Content forceMount>
                        <input aria-label="search" />
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion>
        )
        const panel = screen.getByLabelText('search').closest('[data-state]')
        expect(panel).toHaveAttribute('data-state', 'closed')
        expect(panel).toHaveClass('data-[state=closed]:hidden')

        fireEvent.click(screen.getByRole('button', { name: /Countries/ }))
        fireEvent.change(screen.getByLabelText('search'), { target: { value: 'arg' } })
        fireEvent.click(screen.getByRole('button', { name: /Countries/ }))
        // closed again, and the typed search survived
        expect(panel).toHaveAttribute('data-state', 'closed')
        expect(screen.getByLabelText('search')).toHaveValue('arg')
    })

    test('an item takes its ListGroup position edges', () => {
        render(
            <Accordion type="single" collapsible>
                <Accordion.Item value="last" position="bottom">
                    <Accordion.Trigger>Last row</Accordion.Trigger>
                    <Accordion.Content>Body</Accordion.Content>
                </Accordion.Item>
            </Accordion>
        )
        const item = screen.getByRole('button', { name: /Last row/ }).closest('h3')?.parentElement
        expect(item).toHaveClass('border-t-0', 'rounded-b-sm')
    })

    test('link variant: no item border, underlined trigger', () => {
        render(
            <Accordion type="single" collapsible variant="link">
                <Accordion.Item value="bank">
                    <Accordion.Trigger>See bank details</Accordion.Trigger>
                    <Accordion.Content flush>IBAN</Accordion.Content>
                </Accordion.Item>
            </Accordion>
        )
        const trigger = screen.getByRole('button', { name: /See bank details/ })
        expect(trigger).toHaveClass('underline')
        expect(trigger.closest('h3')?.parentElement?.className).not.toContain('border')
    })
})
