import { fireEvent, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { personFrom } from '@/lib/person/person'
import { renderWithIntl as render } from '@/test-utils/intl'
import { AvatarSticker } from '../AvatarSticker'
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
        const { container } = render(
            <UserAvatar person={personFrom({ username: 'satoshi', avatarKey: 'basic.frog' })} />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
        expect(screen.getByRole('img', { name: 'Avatar for satoshi' })).toBeInTheDocument()
        expect(container).not.toHaveTextContent('S')
    })

    // no pick → the initial as sticker art, not a letter in a circle
    it('falls back to the letter sticker without a pick', () => {
        const { container } = render(<UserAvatar person={personFrom({ username: 'satoshi', avatarKey: null })} />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
        expect(container).not.toHaveTextContent('S')
    })

    it('treats a key the manifest does not know as no pick', () => {
        const { container } = render(<UserAvatar person={personFrom({ username: 'hal', avatarKey: 'badge.NOPE.x' })} />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/h.webp')
    })

    // last resort: a name the letter set cannot draw keeps the first-letter
    // avatar (AvatarWithBadge firstLetterOnly, #2924)
    it('falls back to the first-letter avatar for a name outside a-z', () => {
        const { container } = render(<UserAvatar person={personFrom({ username: '0xf39Fd6', avatarKey: null })} />)

        expect(container.querySelector('img')).toBeNull()
        expect(container).toHaveTextContent(/^0$/)
    })

    // list rows show the name next to the avatar — announcing it twice is noise
    it('keeps the name for the letter but leaves the a11y tree when decorative', () => {
        const { container } = render(
            <UserAvatar person={personFrom({ username: 'satoshi', avatarKey: null })} decorative />
        )

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/letter/s.webp')
        expect(screen.queryByRole('img', { name: 'Avatar for satoshi' })).not.toBeInTheDocument()
        expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    })

    it('hides the initials fallback too when decorative', () => {
        const { container } = render(
            <UserAvatar person={personFrom({ username: '0xf39Fd6', avatarKey: null })} decorative />
        )

        expect(container).toHaveTextContent(/^0$/)
        expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    })

    it('keeps bundled art and uses the served url only for keys the bundle lacks', () => {
        mockArt = {
            'basic.frog': 'https://api.peanut.me/badges/art/avatar-basic-frog.0123456789ab.webp',
            'badge.NEW_BADGE.owl': 'https://api.peanut.me/badges/art/avatar-badge-NEW_BADGE-owl.0123456789ab.webp',
        }
        const { container, rerender } = render(
            <UserAvatar person={personFrom({ username: 'satoshi', avatarKey: 'basic.frog' })} />
        )
        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')

        rerender(<UserAvatar person={personFrom({ username: 'satoshi', avatarKey: 'badge.NEW_BADGE.owl' })} />)
        expect(container.querySelector('img')).toHaveAttribute('src', mockArt['badge.NEW_BADGE.owl'])
    })

    // TASK-23547: a missing served file must not leave a broken image
    it('swaps to the initials avatar when the art fails to load, and retries new art', () => {
        mockArt = {
            'badge.NEW_BADGE.owl': 'https://api.peanut.me/badges/art/avatar-badge-NEW_BADGE-owl.0123456789ab.webp',
        }
        const { container, rerender } = render(
            <UserAvatar person={personFrom({ username: 'satoshi', avatarKey: 'badge.NEW_BADGE.owl' })} />
        )

        fireEvent.error(container.querySelector('img')!)
        expect(container.querySelector('img')).toBeNull()
        expect(container).toHaveTextContent(/^S$/i)

        rerender(<UserAvatar person={personFrom({ username: 'satoshi', avatarKey: 'basic.cactus' })} />)
        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/cactus.webp')
    })
})

describe('AvatarSticker', () => {
    // the picker's candidate tiles are art, not a person: no letter, no label
    it('shows the generic user glyph with no letter at all', () => {
        const { container } = render(<AvatarSticker avatarKey={null} letterOf="" />)

        expect(container.querySelector('svg')).toBeInTheDocument()
        expect(container).toHaveTextContent('')
    })

    it('draws a candidate key without labelling it as anyone', () => {
        const { container } = render(<AvatarSticker avatarKey="basic.frog" letterOf="" />)

        expect(container.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.webp')
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })
})
