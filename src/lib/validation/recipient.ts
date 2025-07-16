import { isAddress } from 'viem'

import { resolveEns } from '@/app/actions/ens'
import { PEANUT_API_URL } from '@/constants'
import { AccountType } from '@/interfaces'
import { usersApi } from '@/services/users'
import { fetchWithSentry } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { RecipientValidationError } from '../url-parser/errors'
import { RecipientType } from '../url-parser/types/payment'

export async function validateAndResolveRecipient(
    recipient: string,
    isWithdrawal: boolean = false
): Promise<{ identifier: string; recipientType: RecipientType; resolvedAddress: string }> {
    const recipientType = getRecipientType(recipient, isWithdrawal)

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
                throw new RecipientValidationError('Invalid address')
            }
            return {
                identifier: recipient,
                recipientType,
                resolvedAddress: recipient,
            }

        case 'USERNAME':
            recipient = recipient.toLowerCase()
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

export const getRecipientType = (recipient: string, isWithdrawal: boolean = false): RecipientType => {
    if (recipient.includes('.')) {
        return 'ENS'
    }

    if (recipient.startsWith('0x')) {
        if (isAddress(recipient)) {
            return 'ADDRESS'
        }
        throw new RecipientValidationError('Invalid address')
    }

    // For withdrawals, treat non-addresses as ENS names instead of usernames
    if (isWithdrawal) {
        return 'ENS'
    }

    return 'USERNAME'
}

// utility function to check if a handle is a valid peanut username
export const verifyPeanutUsername = async (username: string): Promise<boolean> => {
    try {
        // we are in server, call the api directly
        const res = await fetchWithSentry(`${PEANUT_API_URL}/users/username/${username}`, {
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
