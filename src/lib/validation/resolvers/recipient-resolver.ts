import { isAddress } from 'viem'
import { resolveFromEnsName } from '../../../utils/general.utils'

export type RecipientType = 'ENS' | 'ADDRESS' | 'USERNAME'

export async function resolveRecipientToAddress(recipient: string): Promise<string> {
    // if already an address, return it
    if (isAddress(recipient)) {
        return recipient
    }

    // check if its ENS
    // TODO: add support for other ENS domains
    if (recipient.endsWith('.eth')) {
        const resolved = await resolveFromEnsName(recipient)
        if (!resolved) {
            throw new Error('Could not resolve ENS name')
        }
        return resolved
    }

    // try resolving as peanut username
    // todo: add support for peanut username and justaname domains

    return recipient
}
