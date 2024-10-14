export interface IOfframpForm {
    name: string
    email: string
    password: string
    recipient: string
}

export const supportedBridgeChainsDictionary = [
    {
        chain: 'arbitrum',
        chainId: '42161',
    },
    {
        chain: 'optimism',
        chainId: '10',
    },
    {
        chain: 'ethereum',
        chainId: '1',
    },
    {
        chain: 'polygon',
        chainId: '137',
    },
    {
        chain: 'base',
        chainId: '8453',
    },
    {
        chain: 'avalanche',
        chainId: '43114',
    },
]

export const supportedBridgeTokensDictionary = [
    {
        chainId: '137',
        tokens: [
            {
                token: 'usdc',
                address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            },
            {
                token: 'usdc',
                address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            },
        ],
    },
    {
        chainId: '1',
        tokens: [
            {
                token: 'usdc',
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
            {
                token: 'usdt',
                address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            },
        ],
    },
    {
        chainId: '10',
        tokens: [
            {
                token: 'usdc',
                address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
            },
            {
                token: 'usdc',
                address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            },
        ],
    },
    {
        chainId: '42161',
        tokens: [
            {
                token: 'usdc',
                address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            },
            {
                token: 'usdc',
                address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            },
        ],
    },
    {
        chainId: '43114',
        tokens: [
            {
                token: 'usdc',
                address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            },
        ],
    },
    {
        chainId: '8453',
        tokens: [
            {
                token: 'usdc',
                address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            },
        ],
    },
]
