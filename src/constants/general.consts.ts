import * as interfaces from '@/interfaces'
import { CHAIN_DETAILS, TOKEN_DETAILS } from '@squirrel-labs/peanut-sdk'
import { mainnet, arbitrum, arbitrumSepolia, polygon, optimism, base, bsc, scroll, baseSepolia } from 'viem/chains'

export const peanutWalletIsInPreview = true

export const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY
export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

export const SQUID_INTEGRATOR_ID = '11CBA45B-5EE9-4331-B146-48CCD7ED4C7C'
export const SQUID_API_URL = process.env.SQUID_API_URL

const infuraUrl = (subdomain: string) => (INFURA_API_KEY ? `https://${subdomain}.infura.io/v3/${INFURA_API_KEY}` : null)
const alchemyUrl = (subdomain: string) =>
    ALCHEMY_API_KEY ? `https://${subdomain}.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null

export const rpcUrls: Record<number, string[]> = {
    [mainnet.id]: [infuraUrl('mainnet'), alchemyUrl('eth-mainnet')].filter(Boolean) as string[],
    [arbitrum.id]: [infuraUrl('arbitrum-mainnet'), alchemyUrl('arb-mainnet')].filter(Boolean) as string[],
    [arbitrumSepolia.id]: [infuraUrl('arbitrum-sepolia'), alchemyUrl('arb-sepolia')].filter(Boolean) as string[],
    [polygon.id]: [infuraUrl('polygon-mainnet'), alchemyUrl('polygon-mainnet')].filter(Boolean) as string[],
    [optimism.id]: [infuraUrl('optimism-mainnet'), alchemyUrl('opt-mainnet')].filter(Boolean) as string[],
    [baseSepolia.id]: [infuraUrl('base-sepolia'), alchemyUrl('base-sepolia')].filter(Boolean) as string[],
    // Infura is returning weird estimations for BSC @2025-05-14
    //[bsc.id]: `https://bsc-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    [bsc.id]: ['https://bsc-dataseed.bnbchain.org', infuraUrl('bsc-mainnet'), alchemyUrl('bsc-mainnet')].filter(
        Boolean
    ) as string[],
    [scroll.id]: [infuraUrl('scroll-mainnet')].filter(Boolean) as string[],
    [base.id]: [`https://mainnet.base.org`, alchemyUrl('base-mainnet'), infuraUrl('base-mainnet')].filter(
        Boolean
    ) as string[],
}

export const ipfsProviderArray = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cf-ipfs.com/ipfs/',
    'https://storry.tv/ipfs/',
    'https://hardbin.com/ipfs/',
    'https://w3s.link/ipfs/',
    'https://nftstorage.link/ipfs/',
    'https://gw3.io/ipfs/',
]

export const PEANUT_API_URL = (
    process.env.PEANUT_API_URL ||
    process.env.NEXT_PUBLIC_PEANUT_API_URL ||
    'https://api.peanut.me'
).replace(/\/$/, '') // remove any accidental trailing slash

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.me'
export const next_proxy_url = '/api/proxy'

export const supportedMobulaChains = <{ name: string; chainId: string }[]>[
    {
        name: 'Fantom',
        chainId: '250',
    },
    {
        name: 'Avalanche C-Chain',
        chainId: '43114',
    },
    {
        name: 'Cronos',
        chainId: '25',
    },
    {
        name: 'DFK Subnet',
        chainId: '53935',
    },
    {
        name: 'Ethereum',
        chainId: '1',
    },
    {
        name: 'SmartBCH',
        chainId: '10000',
    },
    {
        name: 'Polygon',
        chainId: '137',
    },
    {
        name: 'BNB Smart Chain (BEP20)',
        chainId: '56',
    },
    {
        name: 'Celo',
        chainId: '42220',
    },
    {
        name: 'XDAI',
        chainId: '100',
    },
    {
        name: 'Klaytn',
        chainId: '8217',
    },
    {
        name: 'Aurora',
        chainId: '1313161554',
    },
    {
        name: 'HECO',
        chainId: '128',
    },
    {
        name: 'Harmony',
        chainId: '1666600000',
    },
    {
        name: 'Boba',
        chainId: '288',
    },
    {
        name: 'OKEX',
        chainId: '66',
    },
    {
        name: 'Moonriver',
        chainId: '1285',
    },
    {
        name: 'Moonbeam',
        chainId: '1284',
    },
    {
        name: 'BitTorrent Chain',
        chainId: '199',
    },
    {
        name: 'Oasis',
        chainId: '42262',
    },
    {
        name: 'Velas',
        chainId: '106',
    },
    {
        name: 'Arbitrum',
        chainId: '42161',
    },
    {
        name: 'Optimistic',
        chainId: '10',
    },
    {
        name: 'Kucoin',
        chainId: '321',
    },
    {
        name: 'Base',
        chainId: '8453',
    },
    {
        name: 'Shibarium',
        chainId: '109',
    },
    {
        name: 'Mantle',
        chainId: '5000',
    },
    {
        name: 'Sui',
        chainId: 'sui',
    },
    {
        name: 'ZetaChain',
        chainId: '7000',
    },
    {
        name: 'Alephium',
        chainId: 'alephium-0',
    },
    {
        name: 'Scroll',
        chainId: '534352',
    },
]

export const supportedPeanutChains: interfaces.IPeanutChainDetails[] = Object.keys(CHAIN_DETAILS).map(
    (key) => CHAIN_DETAILS[key as keyof typeof CHAIN_DETAILS]
)

export const peanutTokenDetails: interfaces.IPeanutTokenDetail[] = TOKEN_DETAILS

export const nativeCurrencyAddresses: string[] = [
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    '0x0000000000000000000000000000000000000000',
]

export const pathTitles: { [key: string]: string } = {
    '/home': 'Dashboard',
    '/send': 'Send',
    '/request/create': 'Request',
    '/request/pay': 'Pay',
    '/cashout': 'Cashout',
    '/history': 'History',
    '/support': 'Support',
    '/claim': 'Claim',
}

export const STABLE_COINS = ['USDC', 'USDT', 'DAI', 'BUSD']
