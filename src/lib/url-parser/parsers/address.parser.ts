import { ENS_REGEX } from '@/lib/validation/constants'
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

    // split the input into user and chain parts
    const [user, chain] = parts

    // validate both parts exist
    if (!user || !chain) {
        return null
    }

    // validate user (must be valid address or ENS)
    if (!isValidUser(user)) {
        return null
    }

    // return the parsed parts
    return {
        user,
        chain,
    }
}

// helper function to validate user
function isValidUser(user: string): boolean {
    // check for ENS names first (including those starting with 0x)
    if (user.endsWith('.eth')) {
        return ENS_REGEX.test(user)
    }

    // for addresses, must be a valid Ethereum address
    if (user.startsWith('0x')) {
        return isAddress(user)
    }

    // for ens names, must match regex
    return ENS_REGEX.test(user)
}

// helper function to format chain-specific address
export function formatChainSpecificAddress(address: string, chain: string): string {
    return `${address}@${chain}`
}
