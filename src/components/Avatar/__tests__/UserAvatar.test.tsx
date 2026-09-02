import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { UserAvatar } from '../UserAvatar'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

describe('UserAvatar', () => {
    it('renders the picked character on its palette', () => {
        const { container } = render(<UserAvatar name="satoshi" avatarKey="basic.frog" />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.svg')
        expect(screen.getByRole('img', { name: 'Avatar for satoshi' })).toBeInTheDocument()
        expect(container).not.toHaveTextContent('S')
    })

    // no pick → the existing first-letter avatar, so the fallback lives in
    // one place (AvatarWithBadge firstLetterOnly, #2924)
    it('falls back to the first-letter avatar without a pick', () => {
        const { container } = render(<UserAvatar name="satoshi" avatarKey={null} />)

        expect(container.querySelector('img')).toBeNull()
        expect(container).toHaveTextContent(/^S$/)
    })

    it('treats a key the manifest does not know as no pick', () => {
        const { container } = render(<UserAvatar name="hal" avatarKey="badge.NOPE.x" />)

        expect(container.querySelector('img')).toBeNull()
        expect(container).toHaveTextContent(/^H$/)
    })

    it('shows the generic user glyph with no name at all', () => {
        const { container } = render(<UserAvatar avatarKey={null} />)

        expect(container.querySelector('svg')).toBeInTheDocument()
        expect(container).toHaveTextContent('')
    })
})
