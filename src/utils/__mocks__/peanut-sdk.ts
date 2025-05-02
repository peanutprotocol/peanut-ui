// Mock CHAIN_DETAILS and TOKEN_DETAILS from peanut-sdk
export const CHAIN_DETAILS = {
    1: {
        name: 'Ethereum',
        shortName: 'eth',
        chainId: 1,
        isTestnet: false,
    },
    11155111: {
        name: 'Sepolia',
        shortName: 'sep',
        chainId: 11155111,
        isTestnet: true,
    },
}

export const TOKEN_DETAILS = {
    1: {
        ETH: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18,
            address: '0x0000000000000000000000000000000000000000',
        },
    },
    11155111: {
        ETH: {
            name: 'Sepolia Ether',
            symbol: 'ETH',
            decimals: 18,
            address: '0x0000000000000000000000000000000000000000',
        },
    },
}
