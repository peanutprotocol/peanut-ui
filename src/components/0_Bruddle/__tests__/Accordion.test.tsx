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
})
