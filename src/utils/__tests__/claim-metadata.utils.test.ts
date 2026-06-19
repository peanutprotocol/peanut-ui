import { buildClaimMetadata, getClaimLinkData, type ClaimLinkData } from '@/utils/claim-metadata.utils'
import { sendLinksApi } from '@/services/sendLinks'

const SITE_URL = 'https://peanut.me'

const ogImageUrl = (metadata: ReturnType<typeof buildClaimMetadata>): string => {
    const image = (metadata.openGraph?.images as Array<{ url: string }>)?.[0]
    return image?.url ?? ''
}

const unclaimed = (
    overrides: Partial<ClaimLinkData['linkDetails']> = {},
    username: string | null = null
): ClaimLinkData => ({
    username,
    linkDetails: {
        senderAddress: '0x1111111111111111111111111111111111111111',
        tokenAmount: '100',
        tokenSymbol: 'USDC',
        claimed: false,
        ...overrides,
    },
})

describe('buildClaimMetadata', () => {
    it('falls back to the generic Peanut preview when the link cannot be resolved', () => {
        const metadata = buildClaimMetadata({ claimData: null, siteUrl: SITE_URL })

        expect(metadata.title).toBe('Claim Payment | Peanut')
        // Regression guard: the bug shipped exactly this generic image for real links.
        expect(ogImageUrl(metadata)).toBe('/metadata-img.png')
        expect(metadata.description).toBe('Tap the link to receive instantly and without fees.')
    })

    it('uses the sender username + amount when the link is unclaimed', () => {
        const metadata = buildClaimMetadata({ claimData: unclaimed({}, 'kkonrad'), siteUrl: SITE_URL })

        expect(metadata.title).toBe('kkonrad sent you $100 via Peanut')

        const url = new URL(ogImageUrl(metadata))
        expect(url.origin + url.pathname).toBe('https://peanut.me/api/og')
        expect(url.searchParams.get('type')).toBe('send')
        expect(url.searchParams.get('username')).toBe('kkonrad')
        expect(url.searchParams.get('amount')).toBe('100')
        expect(url.searchParams.get('token')).toBe('USDC')
        expect(url.searchParams.get('isReceipt')).toBeNull()
    })

    it('falls back to the sender address + token when there is no username', () => {
        const metadata = buildClaimMetadata({ claimData: unclaimed(), siteUrl: SITE_URL })

        expect(metadata.title).toBe('You received 100 in USDC!')
        expect(new URL(ogImageUrl(metadata)).searchParams.get('username')).toBe(
            '0x1111111111111111111111111111111111111111'
        )
    })

    it('says "some" for dust amounts under a cent', () => {
        const metadata = buildClaimMetadata({ claimData: unclaimed({ tokenAmount: '0.004' }), siteUrl: SITE_URL })
        expect(metadata.title).toBe('You received some USDC!')
    })

    it('renders the receipt variant for a claimed link', () => {
        const metadata = buildClaimMetadata({
            claimData: unclaimed({ claimed: true }, 'kkonrad'),
            siteUrl: SITE_URL,
        })

        expect(metadata.title).toBe('This link has been claimed')
        expect(metadata.description).toBe('This payment link has already been claimed.')

        const url = new URL(ogImageUrl(metadata))
        expect(url.searchParams.get('isReceipt')).toBe('true')
        expect(url.searchParams.get('amount')).toBeNull()
    })
})

describe('getClaimLinkData', () => {
    it('returns null without hitting the API when chainId or depositIdx is missing', async () => {
        const getByParamsSpy = jest.spyOn(sendLinksApi, 'getByParams')

        await expect(getClaimLinkData({}, SITE_URL)).resolves.toBeNull()
        await expect(getClaimLinkData({ c: '42161' }, SITE_URL)).resolves.toBeNull()
        await expect(getClaimLinkData({ i: '159' }, SITE_URL)).resolves.toBeNull()

        expect(getByParamsSpy).not.toHaveBeenCalled()
        getByParamsSpy.mockRestore()
    })
})
