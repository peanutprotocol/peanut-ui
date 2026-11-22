import { render, screen } from '@testing-library/react'
import { HeroBackNav } from '../HeroBackNav'
import { isNativeHelpContext } from '@/utils/native-help-context'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/utils/native-help-context', () => ({ isNativeHelpContext: jest.fn(() => false) }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ hideBackBtn }: { hideBackBtn?: boolean }) => (hideBackBtn ? null : <button aria-label="Back" />),
}))

describe('HeroBackNav', () => {
    it('uses the shared 16px safe-area-relative navigation origin', () => {
        render(<HeroBackNav />)

        const wrapper = screen.getByRole('button', { name: 'Back' }).parentElement
        expect(wrapper).toHaveClass('left-4', 'top-[calc(var(--safe-top)_+_1rem)]')
    })

    it('shows no back arrow inside the app help sheet, which a page cannot close (TASK-23926)', () => {
        jest.mocked(isNativeHelpContext).mockReturnValue(true)

        render(<HeroBackNav />)

        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    })
})
