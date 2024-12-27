// Mock wagmi chains
export const mainnet = {
    id: 1,
    name: 'Ethereum',
    network: 'mainnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: ['https://eth-mainnet.g.alchemy.com/v2'] },
    },
}

export const sepolia = {
    id: 11155111,
    name: 'Sepolia',
    network: 'sepolia',
    nativeCurrency: {
        decimals: 18,
        name: 'Sepolia Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: ['https://eth-sepolia.g.alchemy.com/v2'] },
    },
}
