import { JUSTANAME_ENS } from '@/constants'
import { resolveFromEnsName } from '@/utils'
import { isAddress } from 'viem'
import { verifyPeanutUsername } from '../recipient'

export async function resolveRecipientToAddress(recipient: string): Promise<string> {
    // if already an address, return it
    if (isAddress(recipient)) {
        return recipient
    }

    // todo: add support for other ENS TLDs
    // if its an ENS name (ends with .eth)
    if (recipient.endsWith('.eth')) {
        const resolved = await resolveFromEnsName(recipient)
        if (!resolved) {
            throw new Error('Could not resolve ENS name')
        }
        return resolved
    }

    // check if its a Peanut username
    const isPeanutUsername = await verifyPeanutUsername(recipient)
    if (isPeanutUsername) {
        // todo: move to env or constants
        // append justaname ens to resolve Peanut username
        const peanutEns = `${recipient}.${JUSTANAME_ENS}`
        const resolved = await resolveFromEnsName(peanutEns)
        if (!resolved) {
            throw new Error('Could not resolve Peanut username')
        }
        return resolved
    }

    // throw error for other cases
    throw new Error('Invalid recipient')
}
