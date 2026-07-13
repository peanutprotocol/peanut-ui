import { isAddress } from 'viem'

import { resolveEns } from '@/app/actions/ens'

import { AccountType } from '@/interfaces'
import { usersApi } from '@/services/users'
import { serverFetch } from '@/utils/api-fetch'
import * as Sentry from '@sentry/nextjs'
import { RecipientValidationError } from '../url-parser/errors'
import { type RecipientType } from '../url-parser/types/payment'
import { isValidAddressForFamily, type WithdrawAddressFamily } from './addressFamily'

export async function validateAndResolveRecipient(
    recipient: string,
    isWithdrawal: boolean = false,
    addressFamily: WithdrawAddressFamily = 'evm'
): Promise<{ identifier: string; recipientType: RecipientType; resolvedAddress: string }> {
    // Non-EVM withdraw destinations (Solana/Tron): a base58 address is the
    // only valid input — no ENS, no usernames. The family comes from the
    // selected destination chain, never inferred from the string.
    if (addressFamily !== 'evm') {
        if (!isValidAddressForFamily(recipient, addressFamily)) {
            throw new RecipientValidationError(`Invalid ${addressFamily === 'solana' ? 'Solana' : 'Tron'} address`)
        }
        return { identifier: recipient, recipientType: 'ADDRESS', resolvedAddress: recipient }
    }

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

        case 'USERNAME': {
            recipient = recipient.toLowerCase()
            // Single source of truth: getByUsername (GET /users/username/:username)
            // is the same resource the old verifyPeanutUsername pre-check hit, and it
            // 404s for unknown AND deactivated (deletion-requested) usernames — so one
            // fetch validates and resolves, avoiding a duplicate round-trip.
            let user
            try {
                user = await usersApi.getByUsername(recipient)
            } catch {
                throw new RecipientValidationError('Invalid Peanut username')
            }
            const address = user.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier
            return {
                identifier: recipient,
                recipientType,
                resolvedAddress: address!,
            }
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

// utility function to check if a handle is a valid, reachable peanut username
// (profile / send / request recipient validation). Uses GET, not HEAD: the GET
// route filters out deactivated (deletion-requested) accounts and 404s for them,
// whereas HEAD still reports them as existing to keep their username reserved
// (prevents reuse). Signup's availability check is a separate HEAD call.
export const verifyPeanutUsername = async (username: string): Promise<boolean> => {
    try {
        const res = await serverFetch(`/users/username/${encodeURIComponent(username)}`, {
            method: 'GET',
        })
        const isValidPeanutUsername = res.status === 200
        return isValidPeanutUsername
    } catch (err) {
        console.error('Error verifying peanut username:', err)
        Sentry.captureException(err)
        return false
    }
}
