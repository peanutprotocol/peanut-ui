/**
 * Sprint 165 smoke: the token-first selector drew ETH with the Arbitrum logo,
 * because the catalog gives native ETH on Arbitrum (and Optimism, Scroll) the
 * chain's logo. A native token now has one logo on every chain.
 */
import { getSupportedChainsAndTokens, tokenLogo } from '@/app/actions/supported-chains'
import { TOKEN_LOGOS } from '@/constants/rhino.consts'

const NATIVE = '0x0000000000000000000000000000000000000000'

const nativeLogo = (chains: Awaited<ReturnType<typeof getSupportedChainsAndTokens>>, chainId: string) =>
    chains[chainId].tokens.find((t) => t.address.toLowerCase() === NATIVE)?.logoURI

describe('native token logos', () => {
    it('native ETH has the ETH logo on every chain, never the chain logo', async () => {
        const chains = await getSupportedChainsAndTokens()
        for (const chainId of ['1', '42161', '10', '8453']) {
            expect(nativeLogo(chains, chainId)).toBe(TOKEN_LOGOS.ETH)
            expect(nativeLogo(chains, chainId)).not.toBe(chains[chainId].chainIconURI)
        }
    })

    it('native BNB and POL get raster logos, not the SVGs next/image refuses', async () => {
        const chains = await getSupportedChainsAndTokens()
        for (const chainId of ['56', '137']) {
            const logo = nativeLogo(chains, chainId)
            expect(logo).toMatch(/^https:\/\/assets\.coingecko\.com\/.+\.png/)
        }
    })

    it('only native tokens are remapped; an ERC-20 keeps its catalog logo', () => {
        expect(tokenLogo(NATIVE, 'eth', 'arbitrum.svg')).toBe(TOKEN_LOGOS.ETH)
        expect(tokenLogo('0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', 'ETH', 'x.svg')).toBe(TOKEN_LOGOS.ETH)
        expect(tokenLogo('0x82af49447d8a07e3bd95bd0d56f35241523fbab1', 'ETH', 'weth.png')).toBe('weth.png')
        expect(tokenLogo(NATIVE, 'XDAI', 'xdai.png')).toBe('xdai.png')
    })
})
