import { screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { renderWithIntl } from '@/test-utils/intl'
import { UserAvatar } from '../UserAvatar'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ unoptimized, ...rest }: ComponentProps<'img'> & { unoptimized?: boolean }) => <img {...rest} />,
}))

describe('UserAvatar', () => {
    it('renders the picked character on its palette', () => {
        renderWithIntl(<UserAvatar username="satoshi" avatarKey="basic.frog" />)

        expect(screen.getByRole('img', { name: 'Avatar for satoshi' })).toBeInTheDocument()
        expect(document.querySelector('img')).toHaveAttribute('src', '/avatars/basic/frog.svg')
        expect(screen.queryByText('S')).not.toBeInTheDocument()
    })

    // privacy-safe fallback: exactly one character of the USERNAME. The
    // component has no name/fullName prop at all, so verification data cannot
    // reach it — a username that looks like a full name still yields one letter.
    it('falls back to a single username initial, never more', () => {
        renderWithIntl(<UserAvatar username="Satoshi Nakamoto" avatarKey={null} />)

        expect(screen.getByRole('img', { name: 'Avatar for Satoshi Nakamoto' })).toHaveTextContent(/^S$/)
        expect(document.querySelector('img')).toBeNull()
    })

    it('treats a key the manifest does not know as no pick', () => {
        renderWithIntl(<UserAvatar username="hal" avatarKey="badge.NOPE.x" />)

        expect(screen.getByRole('img', { name: 'Avatar for hal' })).toHaveTextContent(/^H$/)
    })

    it('shows the generic user glyph with no username at all', () => {
        const { container } = renderWithIntl(<UserAvatar avatarKey={null} />)

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        expect(container.querySelector('svg')).toBeInTheDocument()
    })
})
