import { fireEvent, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import posthog from 'posthog-js'
import ProfileHeader from '../ProfileHeader'
import { ANALYTICS_EVENTS, REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'

const mockToastInfo = jest.fn()
const mockWriteText = jest.fn()
let mockAuthUsername: string | undefined

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockAuthUsername ? { user: { username: mockAuthUsername } } : null }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: false }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ info: mockToastInfo }),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick }: ComponentProps<'button'>) => <button onClick={onClick}>{children}</button>,
}))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/UserHeader', () => ({
    VerifiedUserLabel: ({ name }: { name: string }) => <span>{name}</span>,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// Pin the origin so the shared value (and the `https://`-stripped pill label) is
// deterministic — `shareableUrl` reads window.location.origin under jsdom.
const ORIGIN = 'https://peanut.example.org'
const originalLocation = window.location
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share')

function restoreProperty(target: object, key: string, descriptor?: PropertyDescriptor) {
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else delete (target as Record<string, unknown>)[key]
}

beforeAll(() => {
    Object.defineProperty(window, 'location', { value: new URL(ORIGIN), writable: true })
})

beforeEach(() => {
    jest.clearAllMocks()
    mockAuthUsername = 'satoshi'
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mockWriteText } })
})

afterAll(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
    restoreProperty(navigator, 'clipboard', originalClipboard)
    restoreProperty(navigator, 'share', originalShare)
})

const sharePill = () => screen.queryByRole('button', { name: 'peanut.example.org/satoshi' })

describe('ProfileHeader share pill', () => {
    it('renders on the signed-in user own profile', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        expect(sharePill()).toBeInTheDocument()
    })

    it('stays hidden on someone else profile even when the caller asks for it', () => {
        mockAuthUsername = 'hal'
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        // wrong-attribution guard: sharing here would hand out `hal`'s pill copy
        // pointing at satoshi's profile.
        expect(sharePill()).not.toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('stays hidden while auth is unresolved', () => {
        // the self-profile call site falls back to `anonymous` until /get-user lands
        mockAuthUsername = undefined
        renderWithIntl(<ProfileHeader name="anonymous" username="anonymous" showShareButton />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('copies the profile url and toasts when the web share api is missing', () => {
        renderWithIntl(<ProfileHeader name="Satoshi" username="satoshi" showShareButton />)

        fireEvent.click(sharePill()!)

        expect(mockWriteText).toHaveBeenCalledWith(`${ORIGIN}/satoshi`)
        expect(mockToastInfo).toHaveBeenCalledWith(en.global.shareButton.linkCopied)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.REFERRAL_CTA_CLICKED, {
            source: REFERRAL_SOURCES.PROFILE_HEADER,
            link_type: 'profile',
        })
    })
})
