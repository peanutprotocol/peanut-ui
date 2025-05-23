import * as interfaces from '@/interfaces'
import { CHAIN_DETAILS, TOKEN_DETAILS } from '@squirrel-labs/peanut-sdk'
const ipfsProviderArray = [
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

export const PEANUT_API_URL = (process.env.PEANUT_API_URL || 'https://api.peanut.to').replace(/\/$/, '') // remove any accidental trailing slash
export const next_proxy_url = '/api/proxy'

const supportedWalletconnectChains = <{ chainId: string; name: string }[]>[
    { chainId: '1', name: 'Ethereum' },
    { chainId: '10', name: 'Optimism' },
    { chainId: '56', name: 'Binance Smart Chain' },
    { chainId: '100', name: 'Gnosis Chain' },
    { chainId: '137', name: 'Polygon' },
    { chainId: '324', name: 'zkSync Era' },
    { chainId: '1101', name: 'Polygon Zkevm' },
    { chainId: '5000', name: 'Mantle 1' }, //
    { chainId: '8217', name: 'Klaytn Mainnet' },
    { chainId: '8453', name: 'Base' },
    { chainId: '42161', name: 'Arbitrum' },
    { chainId: '42220', name: 'Celo' },
    { chainId: '43114', name: 'Avalanche C-Chain' },
    { chainId: '7777777', name: 'Zora 1' },
    { chainId: '1313161554', name: 'Aurora 1' },
]

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

export const FILE_UPLOAD_ALLOWED_MIME_TYPES = new Set([
    // images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // pdfs
    'application/pdf',
])

export const FILE_UPLOAD_MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * A constant object that holds valid file signatures (magic numbers) for different file types.
 * These signatures are used to verify the integrity and type of a file based on its binary content.
 * used https://www.garykessler.net/library/file_sigs.html and https://en.wikipedia.org/wiki/List_of_file_signatures as references
 */
export const VALID_FILE_SIGNATURES = {
    PNG: '89504e47', // ‰PNG
    JPEG: [
        'ffd8ffe0', // JPEG/JFIF
        'ffd8ffe1', // JPEG with EXIF
        'ffd8ffe2', // JPEG with SPIFF
    ],
    PDF: '25504446', // %PDF
} as const
