import type { DepositAccount, DepositCorridor, DepositInstructions } from '../types'

/**
 * Bridge virtual account, as `GET /customers/{id}/virtual_accounts` returns
 * it. Verbatim field names on purpose: this type is the provider boundary,
 * and the rest of the app never sees snake_case again.
 *
 * Field presence varies by currency and is not documented — captured from
 * sandbox on 2026-09-11 (see __fixtures__). USD carries no
 * `account_holder_name`; GBP carries no `bank_beneficiary_name`; MXN carries
 * neither a bank name nor a bank address.
 */
export interface BridgeVirtualAccount {
    id: string
    status: string
    customer_id: string
    source_deposit_instructions: {
        currency: string
        bank_name?: string
        bank_address?: string
        bank_routing_number?: string
        bank_account_number?: string
        bank_beneficiary_name?: string
        bank_beneficiary_address?: string
        account_holder_name?: string
        account_number?: string
        sort_code?: string
        iban?: string
        bic?: string
        clabe?: string
        payment_rail?: string
        payment_rails?: string[]
    }
}

const CORRIDOR_BY_CURRENCY: Record<string, DepositCorridor> = {
    usd: 'USD_ACH',
    eur: 'EUR_SEPA',
    gbp: 'GBP_FPS',
    mxn: 'MXN_SPEI',
}

/**
 * Bridge reports an account as activated the moment it exists; anything else
 * is still being set up on their side.
 */
function statusFrom(bridgeStatus: string): DepositAccount['status'] {
    return bridgeStatus === 'activated' ? 'active' : 'provisioning'
}

/**
 * The name a payer types. Bridge puts it in `bank_beneficiary_name` on the
 * corridors that have one and in `account_holder_name` on the rest, so the
 * fallback is the contract, not a convenience.
 */
function holderNameFrom(source: BridgeVirtualAccount['source_deposit_instructions']): string {
    return source.bank_beneficiary_name ?? source.account_holder_name ?? ''
}

function instructionsFrom(source: BridgeVirtualAccount['source_deposit_instructions']): DepositInstructions {
    return {
        accountHolderName: holderNameFrom(source),
        beneficiaryName: source.bank_beneficiary_name,
        beneficiaryAddress: source.bank_beneficiary_address,
        bankName: source.bank_name,
        bankAddress: source.bank_address,
        iban: source.iban,
        bic: source.bic,
        // USD and GBP spell the same thing differently
        accountNumber: source.bank_account_number ?? source.account_number,
        routingNumber: source.bank_routing_number,
        sortCode: source.sort_code,
        clabe: source.clabe,
        paymentRails: source.payment_rails ?? (source.payment_rail ? [source.payment_rail] : []),
    }
}

/**
 * Whether the payer reads the user's name or the provider's. Bridge does not
 * say, so the only honest test is comparing what it returned against the name
 * we hold for the user. Sandbox returns the customer's own name on EUR, USD
 * and MXN, and Bridge's pooled entity on GBP — which is exactly why this is
 * derived per account and never assumed per SKU.
 */
function isUserName(holder: string, userLegalName: string): boolean {
    const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
    return normalise(holder) !== '' && normalise(holder) === normalise(userLegalName)
}

/**
 * A Bridge virtual account is reusable, takes any amount from anybody, and
 * carries no reference. That is the whole difference from the transfers SKU
 * we run today, where every deposit is one pre-agreed amount with a mandatory
 * memo — verified against sandbox on 2026-09-11: no `deposit_message`, no
 * reference field, on any corridor.
 */
export function fromBridgeVirtualAccount(raw: BridgeVirtualAccount, userLegalName: string): DepositAccount | null {
    const source = raw.source_deposit_instructions
    const corridor = CORRIDOR_BY_CURRENCY[source.currency]
    if (!corridor) return null

    const instructions = instructionsFrom(source)

    return {
        corridor,
        currency: source.currency.toUpperCase(),
        provider: 'bridge',
        status: statusFrom(raw.status),
        matching: {
            nameOnAccount: isUserName(instructions.accountHolderName, userLegalName) ? 'user' : 'provider',
            sender: 'anyone',
            memo: 'none',
            amount: 'flexible',
        },
        instructions,
    }
}

export function fromBridgeVirtualAccounts(raws: BridgeVirtualAccount[], userLegalName: string): DepositAccount[] {
    return raws
        .map((raw) => fromBridgeVirtualAccount(raw, userLegalName))
        .filter((account): account is DepositAccount => account !== null)
}
