import { isAddress } from 'viem'

import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import { resolveEns } from '@/app/actions/ens'
import * as Sentry from '@sentry/nextjs'
import { RecipientValidationError } from '../url-parser/errors'
import { RecipientType } from '../url-parser/types/payment'
import { usersApi } from '@/services/users'
import { AccountType } from '@/interfaces'

export async function validateAndResolveRecipient(
    recipient: string
): Promise<{ identifier: string; recipientType: RecipientType; resolvedAddress: string }> {
    const recipientType = getRecipientType(recipient)

    switch (recipientType) {
        case 'ENS':
            // resolve the ENS name to address
            const resolvedAddress = await resolveEns(recipient)
            if (!resolvedAddress) {
                throw new RecipientValidationError('ENS name not found')
            }
            return {
                identifier: recipient,
                recipientType,
                resolvedAddress,
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
            if (!isValidPeanutUsername) {
                throw new RecipientValidationError('Invalid Peanut username')
            }
            const user = await usersApi.getByUsername(recipient)
            const address = user.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier
            return {
                identifier: recipient,
                recipientType,
                resolvedAddress: address!,
            }

        default:
            throw new RecipientValidationError('Recipient is not a valid ENS, address, or Peanut Username')
    }
}

export const getRecipientType = (recipient: string): RecipientType => {
    if (recipient.includes('.')) {
        return 'ENS'
    }

    if (recipient.startsWith('0x')) {
        if (isAddress(recipient)) {
            return 'ADDRESS'
        }
        throw new RecipientValidationError('Invalid Ethereum address')
    }

    return 'USERNAME'
}

// utility function to check if a handle is a valid peanut username
export const verifyPeanutUsername = async (handle: string): Promise<boolean> => {
    try {
        // we are in server, call the api directly
        const res = await fetchWithSentry(`${PEANUT_API_URL}/users/username/${handle}`, {
            method: 'HEAD',
        })
        const isValidPeanutUsername = res.status === 200
        return isValidPeanutUsername
    } catch (err) {
        console.error('Error verifying peanut username:', err)
        Sentry.captureException(err)
        return false
    }
}
