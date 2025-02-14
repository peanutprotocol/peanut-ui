import { CHAIN_ID_REGEX, ENS_REGEX, TLD, TLDS } from '@/lib/validation/constants'
import { isAddress } from 'viem'

interface ChainSpecificAddress {
    user: string
    chain: string
}

export function parseChainSpecificAddress(input: string): ChainSpecificAddress | null {
    // split on @ symbol
    const parts = input.split('@')
    if (parts.length !== 2) {
        return null
    }

    const [user, chain] = parts

    // todo: add peanut/justaname usernmae validation
    // validate user (address or ENS subdomain)
    if (!isValidUser(user)) {
        return null
    }

    // validate chain (chain_id | TLD | ens-name.TLD)
    if (!isValidChain(chain)) {
        return null
    }

    return { user, chain }
}

// helper function to validate user
function isValidUser(user: string): boolean {
    return isAddress(user) || ENS_REGEX.test(user)
}

// helper function to validate chain
function isValidChain(chain: string): boolean {
    // case 1: chain ID (0x[a-fA-F0-9]{1,64})
    if (CHAIN_ID_REGEX.test(chain)) {
        return true
    }

    // case 2: TLD (eth | arbitrum | ...)
    if (TLDS.includes(chain.toLowerCase() as TLD)) {
        return true
    }

    // case 3: ENS name with TLD (example.eth)
    if (chain.includes('.')) {
        const parts = chain.split('.')
        const tld = parts[parts.length - 1]
        return TLDS.includes(tld.toLowerCase() as TLD)
    }

    return false
}

// helper function to format chain-specific address
export function formatChainSpecificAddress(address: string, chain: string): string {
    return `${address}@${chain}`
}
