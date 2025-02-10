import { isAddress } from 'viem'

import { next_proxy_url } from '@/constants'
import { resolveFromEnsName } from '@/utils'
import { RecipientValidationError } from '../url-parser/errors'
import { RecipientType } from '../url-parser/types/payment'

// utility function to check if a handle is a valid peanut username
const verifyPeanutUsername = async (handle: string): Promise<boolean> => {
    try {
        const res = await fetch(`${next_proxy_url}/get/users/username/${handle}`, {
            method: 'HEAD',
        })
        const isValidPeanutUsername = res.status === 200
        return isValidPeanutUsername
    } catch (err) {
        return false
    }
}

export async function validateRecipient(recipient: string, type: RecipientType): Promise<string> {
    switch (type) {
        case 'ENS':
            // check if the recipient is a valid ENS name
            if (!recipient.endsWith('.eth')) {
                throw new RecipientValidationError('Invalid ENS name format')
            }

            // resolve the ENS name to address
            const resolved = await resolveFromEnsName(recipient)
            if (!resolved) {
                throw new RecipientValidationError('Could not resolve ENS name')
            }
            return resolved

        case 'ADDRESS':
            // check if the recipient is a valid eth address
            if (!isAddress(recipient)) {
                throw new RecipientValidationError('Invalid Ethereum address')
            }
            return recipient

        case 'USERNAME':
            const isValidPeanutUsername = await verifyPeanutUsername(recipient)

            // check if the recipient is a valid peanut username
            if (!isValidPeanutUsername) {
                throw new RecipientValidationError('Invalid Peanut username')
            }

            return recipient

        default:
            throw new RecipientValidationError('Invalid recipient type')
    }
}
