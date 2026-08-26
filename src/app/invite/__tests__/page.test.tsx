// generateMetadata is the one SERVER reader of the inviter param: the unfurl
// (X / WhatsApp / Telegram preview) is built here, so it must accept the same
// params as the client — `invited_by` for new links, legacy alias `code`.
import { generateMetadata } from '../page'

jest.mock('@/components/Invites/InvitesPage', () => () => null)
jest.mock('@/lib/hosting/get-origin', () => ({
    __esModule: true,
    default: jest.fn(async () => 'https://peanut.me'),
}))
jest.mock('@/utils/og.utils', () => ({
    buildOgImageUrl: jest.fn(
        ({ username }: { username: string }) => `https://peanut.me/api/og?username=${username}&isInvite=true`
    ),
}))
const mockValidateInviteCode = jest.fn()
jest.mock('@/app/actions/invites', () => ({
    validateInviteCode: (...args: unknown[]) => mockValidateInviteCode(...args),
}))

const metadataFor = (searchParams: Record<string, string | string[] | undefined>) =>
    generateMetadata({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) })

beforeEach(() => {
    mockValidateInviteCode.mockReset()
    mockValidateInviteCode.mockResolvedValue({
        data: { success: true, onboardingResolved: true, username: 'alice' },
    })
})

describe('/invite generateMetadata', () => {
    it.each([
        ['invited_by', { invited_by: 'alice' }],
        ['legacy code', { code: 'alice' }],
    ])('personalises the unfurl for %s links', async (_, searchParams) => {
        const metadata = await metadataFor(searchParams)

        expect(mockValidateInviteCode).toHaveBeenCalledWith('alice')
        expect(metadata.title).toBe('alice invited you to join Peanut')
        expect(metadata.openGraph?.images).toEqual([
            expect.objectContaining({ url: 'https://peanut.me/api/og?username=alice&isInvite=true' }),
        ])
    })

    it('lets legacy code win when both are present', async () => {
        await metadataFor({ code: 'offramp', invited_by: 'alice' })
        expect(mockValidateInviteCode).toHaveBeenCalledWith('offramp')
    })

    it('renders the generic page when no inviter param is present', async () => {
        const metadata = await metadataFor({ redirect_uri: '/home' })

        expect(mockValidateInviteCode).not.toHaveBeenCalled()
        expect(metadata.title).toBe('Invites | Peanut')
    })
})
