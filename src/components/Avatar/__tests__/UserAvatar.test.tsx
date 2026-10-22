import { fireEvent, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderWithIntl as render } from '@/test-utils/intl'
import { UserAvatar } from '../UserAvatar'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

let mockArt: Record<string, string> = {}
jest.mock('../useAvatarArt', () => ({ useAvatarArt: () => mockArt }))

beforeEach(() => {
    mockArt = {}
})

describe('UserAvatar', () => {
    it('renders the picked character on its palette', () => {
        const { container } = render(<UserAvatar name="satoshi" avatarKey="basic.frog" />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
        expect(screen.getByRole('img', { name: 'Avatar for satoshi' })).toBeInTheDocument()
        expect(container).not.toHaveTextContent('S')
    })

    // no pick → the initial as sticker art, not a letter in a circle
    it('falls back to the letter sticker without a pick', () => {
        const { container } = render(<UserAvatar name="satoshi" avatarKey={null} />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
        expect(container).not.toHaveTextContent('S')
    })

    it('treats a key the manifest does not know as no pick', () => {
        const { container } = render(<UserAvatar name="hal" avatarKey="badge.NOPE.x" />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/h.webp')
    })

    // last resort: a name the letter set cannot draw keeps the first-letter
    // avatar (AvatarWithBadge firstLetterOnly, #2924)
    it('falls back to the first-letter avatar for a name outside a-z', () => {
        const { container } = render(<UserAvatar name="0xf39Fd6" avatarKey={null} />)

        expect(container.querySelector('img')).toBeNull()
        expect(container).toHaveTextContent(/^0$/)
    })

    it('shows the generic user glyph with no name at all', () => {
        const { container } = render(<UserAvatar avatarKey={null} />)

        expect(container.querySelector('svg')).toBeInTheDocument()
        expect(container).toHaveTextContent('')
    })

    // list rows show the name next to the avatar — announcing it twice is noise
    it('keeps the name for the letter but leaves the a11y tree when decorative', () => {
        const { container } = render(<UserAvatar name="satoshi" avatarKey={null} decorative />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
        expect(screen.queryByRole('img', { name: 'Avatar for satoshi' })).not.toBeInTheDocument()
        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    })

    it('hides the initials fallback too when decorative', () => {
        const { container } = render(<UserAvatar name="0xf39Fd6" avatarKey={null} decorative />)

        expect(container).toHaveTextContent(/^0$/)
        expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    })

    it('renders the served art url when the API has one', () => {
        mockArt = { 'basic.frog': 'https://api.peanut.me/badges/art/avatar-basic-frog.0123456789ab.webp' }
        const { container } = render(<UserAvatar name="satoshi" avatarKey="basic.frog" />)

        expect(container.querySelector('img')).toHaveAttribute('src', mockArt['basic.frog'])
    })

    // TASK-23547: a missing file must not leave a broken image
    it('swaps to the initials avatar when the art fails to load, and retries new art', () => {
        const { container, rerender } = render(<UserAvatar name="satoshi" avatarKey="basic.frog" />)

        fireEvent.error(container.querySelector('img')!)
        expect(container.querySelector('img')).toBeNull()
        expect(container).toHaveTextContent(/^S$/i)

        rerender(<UserAvatar name="satoshi" avatarKey="basic.cactus" />)
        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/cactus.webp')
    })
})
