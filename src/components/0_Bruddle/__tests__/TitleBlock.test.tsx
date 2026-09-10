import { render, screen } from '@testing-library/react'
import { TitleBlock } from '../TitleBlock'

describe('TitleBlock', () => {
    test('renders title and description with their tokens', () => {
        render(<TitleBlock title="All done" description="Funds are on the way" />)
        expect(screen.getByText('All done')).toHaveClass('text-heading-card')
        expect(screen.getByText('Funds are on the way')).toHaveClass('text-body-s', 'text-foreground-secondary')
    })

    test('description omitted renders nothing extra', () => {
        render(<TitleBlock title="Just a title" data-testid="block" />)
        expect(screen.getByTestId('block').children).toHaveLength(1)
    })

    test('align center adds text-center; size maps to the heading token', () => {
        render(<TitleBlock title="Hero" align="center" size="s" data-testid="block" />)
        expect(screen.getByTestId('block')).toHaveClass('text-center')
        expect(screen.getByText('Hero')).toHaveClass('text-heading-s')
    })

    test('children render inside the block after the description', () => {
        render(
            <TitleBlock title="t" description="d">
                <button>retry</button>
            </TitleBlock>
        )
        expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
    })
})
