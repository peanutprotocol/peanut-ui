import { isAddress } from 'viem'

import { resolveFromEnsName } from '@/utils'
import { RecipientValidationError } from '../url-parser/errors'
import { RecipientType } from '../url-parser/types/payment'

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

        // todo: implement peanut username resolution

        default:
            throw new RecipientValidationError('Invalid recipient type')
    }
}
