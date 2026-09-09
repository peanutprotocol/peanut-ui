import { render, screen } from '@testing-library/react'
import { HeroBackNav } from '../HeroBackNav'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => <button aria-label="Back" />,
}))

describe('HeroBackNav', () => {
    it('uses the shared 16px safe-area-relative navigation origin', () => {
        render(<HeroBackNav />)

        const wrapper = screen.getByRole('button', { name: 'Back' }).parentElement
        expect(wrapper).toHaveClass('left-4', 'top-[calc(var(--safe-top)_+_1rem)]')
    })
})
