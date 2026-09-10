import { render, screen } from '@testing-library/react'
import { BulletList } from '../BulletList'

describe('BulletList', () => {
    test('renders semantic list items with pink action markers', () => {
        render(<BulletList items={['First point', 'Second point']} />)

        const listItems = screen.getAllByRole('listitem')
        expect(listItems).toHaveLength(2)
        expect(listItems[0].querySelector('div')).toHaveClass('text-body-s', 'text-foreground-secondary')
        expect(listItems[0].querySelector('[aria-hidden="true"] > span')).toHaveClass('bg-action-primary')
    })

    test('supports the compact body-xs size used in dense cards', () => {
        render(<BulletList items={['Compact point']} size="xs" />)

        expect(screen.getByRole('listitem').querySelector('div')).toHaveClass('text-body-xs')
        expect(screen.getByRole('listitem').querySelector('[aria-hidden="true"]')).toHaveClass('h-4')
    })
})
