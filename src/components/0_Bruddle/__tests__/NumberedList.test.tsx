import { render, screen } from '@testing-library/react'
import { NumberedList } from '../NumberedList'

describe('NumberedList', () => {
    test('renders an explicitly semantic ordered list with numbered markers', () => {
        render(<NumberedList items={['First step', 'Second step']} />)

        expect(screen.getByRole('list')).toHaveAttribute('role', 'list')
        const listItems = screen.getAllByRole('listitem')
        expect(listItems).toHaveLength(2)
        expect(listItems[0]).toHaveTextContent('First step')
        expect(listItems[0].querySelector('span')).toHaveTextContent('1')
        expect(listItems[1].querySelector('span')).toHaveTextContent('2')
    })
})
