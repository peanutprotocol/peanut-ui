import { fireEvent, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderWithIntl as render } from '@/test-utils/intl'
import NearbyReceiverSearch from '../NearbyReceiverSearch'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <header>{title}</header>,
}))

describe('NearbyReceiverSearch', () => {
    it('uses Peanut avatars in three receiver cards without distance metadata', () => {
        const { container } = render(<NearbyReceiverSearch />)

        expect(screen.getByRole('img', { name: 'Phone sending waves to find people nearby' })).toBeInTheDocument()
        expect(screen.getAllByRole('button')).toHaveLength(3)
        expect(screen.getByRole('button', { name: 'Pay Maya' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Pay Leo' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Pay Nia' })).toBeInTheDocument()
        expect(container.querySelector('img[src="/avatars/basic/frog.webp"]')).toBeInTheDocument()
        expect(container.querySelector('img[src="/avatars/basic/star.webp"]')).toBeInTheDocument()
        expect(container.querySelector('img[src="/avatars/basic/planet.webp"]')).toBeInTheDocument()
        expect(container).not.toHaveTextContent(/\b\d+\s?m\b/)
    })

    it('marks the chosen receiver as selected', () => {
        render(<NearbyReceiverSearch />)

        const maya = screen.getByRole('button', { name: 'Pay Maya' })
        fireEvent.click(maya)

        expect(maya).toHaveAttribute('aria-pressed', 'true')
    })
})
