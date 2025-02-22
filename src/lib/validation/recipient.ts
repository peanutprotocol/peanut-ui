import { isAddress } from 'viem'

import { JUSTANAME_ENS, next_proxy_url } from '@/constants'
import { resolveFromEnsName } from '@/utils'
import { RecipientValidationError } from '../url-parser/errors'
import { RecipientType } from '../url-parser/types/payment'

export async function validateAndResolveRecipient(
    recipient: string
): Promise<{ identifier: string; recipientType: RecipientType; resolvedAddress: string }> {
    const recipientType = getRecipientType(recipient)
    let resolvedAddress: string | undefined

    switch (recipientType) {
        case 'ENS':
            // resolve the ENS name to address
            resolvedAddress = await resolveFromEnsName(recipient)

            if (!resolvedAddress) {
                throw new RecipientValidationError('Error resolving ENS name')
            }

            return {
                identifier: recipient,
                recipientType,
                resolvedAddress: resolvedAddress,
            }

        case 'ADDRESS':
            if (!isAddress(recipient)) {
                throw new RecipientValidationError('Invalid Ethereum address')
            }

            return {
                identifier: recipient,
                recipientType,
                resolvedAddress: recipient,
            }

        case 'USERNAME':
            const isValidPeanutUsername = await verifyPeanutUsername(recipient)

            // check if the recipient is a valid peanut username
            if (!isValidPeanutUsername) {
                throw new RecipientValidationError('Invalid Peanut username')
            }

            resolvedAddress = await resolveFromEnsName(`${recipient}.${JUSTANAME_ENS}`)

            return {
                identifier: recipient,
                recipientType,
                resolvedAddress: resolvedAddress || '',
            }

        default:
            throw new RecipientValidationError('Recipient is not a valid ENS, address, or Peanut Username')
    }
}

export const getRecipientType = (recipient: string): RecipientType => {
    if (recipient.includes('.')) {
        return 'ENS'
    }

    if (isAddress(recipient)) {
        return 'ADDRESS'
    }

    return 'USERNAME'
}

// utility function to check if a handle is a valid peanut username
export const verifyPeanutUsername = async (handle: string): Promise<boolean> => {
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
