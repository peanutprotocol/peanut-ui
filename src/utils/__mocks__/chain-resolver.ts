import { CHAIN_ID_REGEX } from '@/lib/validation/constants'

export const resolveChainId = (chainIdentifier: string | number): string => {
    // hanlde hex chain ids
    if (typeof chainIdentifier === 'string' && CHAIN_ID_REGEX.test(chainIdentifier)) {
        return parseInt(chainIdentifier, 16).toString()
    }

    const chainMap: { [key: string]: string } = {
        eth: '1',
        arbitrum: '42161',
        optimism: '10',
        '42161': '42161',
        '1': '1',
        '10': '10',
    }

    const chainId = chainIdentifier.toString().toLowerCase()
    if (!chainMap[chainId]) {
        throw new Error(`Invalid chain identifier format: ${chainIdentifier}`)
    }

    return chainMap[chainId]
}

export const normalizeChainName = (chainName: string): string => {
    return chainName.toLowerCase()
}
