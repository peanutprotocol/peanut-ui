const originalChain = process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID

afterEach(() => {
    if (originalChain === undefined) delete process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID
    else process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID = originalChain
})

it.each([
    ['42161', '0x0c06ccf38114ddfc35e07427b9424adcca9f44f8'],
    ['421614', '0xfdeed5ce7e281b4e0f163b70ebe2cf0b10803b7b'],
])('uses the configured Arbitrum chain %s and its matching euro token', (chainId, tokenAddress) => {
    process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID = chainId
    jest.isolateModules(() => {
        const { EURE_ASSET, EURC_ASSET } = require('../currency-accounts.consts')
        expect(EURE_ASSET).toMatchObject({ chainId, tokenAddress, decimals: 18, currency: 'EUR' })
        expect(EURC_ASSET).toMatchObject({ chainId: '8453', decimals: 6, asset: 'EURC' })
    })
})
