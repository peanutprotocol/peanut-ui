import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { DataRow } from '../DataRow'

describe('DataRow', () => {
    test('renders label and value', () => {
        render(<DataRow label="Fee" value="$0.10" />)
        expect(screen.getByText('Fee')).toBeInTheDocument()
        expect(screen.getByText('$0.10')).toBeInTheDocument()
    })

    test('clickable row activates on click and keyboard', () => {
        const onClick = jest.fn()
        render(<DataRow label="Details" value="show" onClick={onClick} />)
        const row = screen.getByRole('button')
        fireEvent.click(row)
        fireEvent.keyDown(row, { key: 'Enter' })
        fireEvent.keyDown(row, { key: ' ' })
        expect(onClick).toHaveBeenCalledTimes(3)
    })

    test('non-clickable row exposes no button role', () => {
        render(<DataRow label="Fee" value="$0.10" />)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    test('loading replaces the value', () => {
        render(<DataRow label="Fee" value="$0.10" loading />)
        expect(screen.queryByText('$0.10')).not.toBeInTheDocument()
    })

    test('trailing slot renders next to the value', () => {
        render(<DataRow label="Limit" value="$500" trailing={<button>Edit</button>} />)
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })
})
