import { Chain } from 'viem'
import { ParsedURL, ValidatedPayment } from '../url-parser/types/payment'
import { validateAmount } from './amount'
import { validateChain } from './chain'
import { validateRecipient } from './recipient'
import { validateToken } from './token'

export async function validatePaymentParams(parsed: ParsedURL): Promise<ValidatedPayment> {
    // first validate chain if present as other validations might depend on it
    let validatedChain: Chain | undefined
    if (parsed.chain) {
        validatedChain = validateChain(parsed.chain)
    }

    // next validate recipient
    const resolvedAddress = await validateRecipient(parsed.recipient, parsed.recipientType)

    // then validate token if present
    let validatedToken
    if (parsed.token) {
        validatedToken = validateToken(parsed.token, validatedChain)
    }

    // finally validate amount with token context
    let validatedAmount
    if (parsed.amount) {
        validatedAmount = validateAmount(parsed.amount, validatedToken?.info)
    }

    return {
        ...parsed,
        resolvedAddress,
        validatedAmount,
        validatedToken,
        validatedChain,
    }
}
