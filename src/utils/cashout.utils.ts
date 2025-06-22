import * as consts from '@/constants'
import { areEvmAddressesEqual, fetchWithSentry } from '@/utils'
import { getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'
import { parseUnits } from 'viem'
import { isIBAN } from 'validator'

const ALLOWED_PARENT_DOMAINS = ['intersend.io', 'app.intersend.io']

// Helper function to check if the app is running within an allowed iframe
const isInAllowedFrame = (): boolean => {
    if (window.location === window.parent.location) return false

    // Check ancestor origins (modern browsers)
    if (window.location.ancestorOrigins?.length) {
        return ALLOWED_PARENT_DOMAINS.some((domain) => window.location.ancestorOrigins[0].includes(domain))
    }

    // Fallback to referrer check
    return ALLOWED_PARENT_DOMAINS.some((domain) => document.referrer.includes(domain))
}

export const convertPersonaUrl = (url: string) => {
    const parsedUrl = new URL(url)

    const templateId = parsedUrl.searchParams.get('inquiry-template-id')
    const iqtToken = parsedUrl.searchParams.get('fields[iqt_token]')
    const developerId = parsedUrl.searchParams.get('fields[developer_id]')
    const referenceId = parsedUrl.searchParams.get('reference-id')

    // Use parent frame origin if in allowed iframe, otherwise use current origin
    const origin = encodeURIComponent(isInAllowedFrame() ? new URL(document.referrer).origin : window.location.origin)

    return `https://bridge.withpersona.com/widget?environment=production&inquiry-template-id=${templateId}&fields[iqt_token=${iqtToken}&iframe-origin=${origin}&redirect-uri=${origin}&fields[developer_id]=${developerId}&reference-id=${referenceId}`
}

export const createAccount = async (
    userId: string,
    bridgeCustomerId: string,
    bridgeAccountId: string,
    accountType: string,
    accountIdentifier: string,
    accountDetails: any
): Promise<any> => {
    const response = await fetchWithSentry('/api/peanut/user/add-account', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userId,
            bridgeCustomerId,
            bridgeAccountId,
            accountType,
            accountIdentifier,
            accountDetails,
        }),
    })

    if (!response.ok) {
        throw new Error('Failed to create account')
    }

    const data = await response.json()
    return data
}

export type KYCStatus = 'not_started' | 'under_review' | 'approved' | 'rejected' | 'incomplete'

export type GetUserLinksResponse = {
    id: string
    full_name: string
    email: string
    type: string
    kyc_link: string
    tos_link: string
    kyc_status: KYCStatus
    rejection_reasons: string[]
    tos_status: string
    created_at: string
    customer_id: string
    persona_inquiry_type: string
}

export const validateAccountFormData = async (formData: any, setAccountFormError: any) => {
    let isValid = true
    if (!formData.accountNumber) {
        setAccountFormError('accountNumber', { type: 'required', message: 'Account number is required' })
        isValid = false
    }

    if (formData.type === 'iban') {
        if (!formData.BIC) {
            setAccountFormError('BIC', { type: 'required', message: 'BIC is required' })
            isValid = false
        }
        const isValidBic = await validateBic(formData.BIC)

        if (!isValidBic) {
            setAccountFormError('BIC', {
                type: 'invalid',
                message: 'BIC not accepted, please get in contact via discord',
            })
            isValid = false
        }
    } else if (formData.type === 'us') {
        if (!formData.routingNumber) {
            setAccountFormError('routingNumber', { type: 'required', message: 'Routing number is required' })
            isValid = false
        }
        if (!formData.street) {
            setAccountFormError('street', { type: 'required', message: 'Street is required' })
            isValid = false
        }
        if (!formData.city) {
            setAccountFormError('city', { type: 'required', message: 'City is required' })
            isValid = false
        }
        if (!formData.country) {
            setAccountFormError('country', { type: 'required', message: 'Country is required' })
            isValid = false
        }
        if (!formData.postalCode) {
            setAccountFormError('postalCode', { type: 'required', message: 'Postal code is required' })
            isValid = false
        }
        if (!formData.state) {
            setAccountFormError('state', { type: 'required', message: 'State is required' })
            isValid = false
        }
    }

    return isValid
}

export async function validateIban(iban: string): Promise<boolean> {
    return isIBAN(iban.replace(/\s+/g, ''))
}

export function getBridgeTokenName(chainId: string, tokenAddress: string): string | undefined {
    const token = consts.supportedBridgeTokensDictionary
        .find((chain) => chain.chainId === chainId)
        ?.tokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))
        ?.token.toLowerCase()

    return token ?? undefined
}

export function getBridgeChainName(chainId: string): string | undefined {
    const chain = consts.supportedBridgeChainsDictionary.find((chain) => chain.chainId === chainId)?.chain
    return chain ?? undefined
}

export async function validateBankAccount(bankAccount: string): Promise<boolean> {
    const bankAccountNumber = bankAccount.replace(/\s/g, '')
    const response = await fetchWithSentry(`/api/peanut/iban/validate-bank-account-number`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bankAccountNumber,
        }),
    })

    if (response.status !== 200) {
        return false
    } else {
        return true
    }
}

export async function validateBic(bic: string): Promise<boolean> {
    const response = await fetchWithSentry(`/api/peanut/iban/validate-bic`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bic,
        }),
    })

    if (response.status !== 200) {
        return false
    } else {
        return true
    }
}

type CashoutStatus =
    | 'PAYMENT_PROCESSED'
    | 'REFUNDED'
    | 'READY'
    | 'AWAITING_TX'
    | 'AWAITING_FIAT'
    | 'FUNDS_IN_BRIDGE'
    | 'FUNDS_MOVED_AWAY'
    | 'FUNDS_IN_BANK'
    | 'AWAITING_FUNDS'
    | 'IN_REVIEW'
    | 'FUNDS_RECEIVED'
    | 'PAYMENT_SUBMITTED'
    | 'CANCELED'
    | 'ERROR'
    | 'RETURNED'

export interface CashoutTransaction {
    status: CashoutStatus
    currency: string | null
    amount: string
    bridge_customer_id: string
    liquidation_address: string | null
    created_at: string // ISO timestamp format
    updated_at: string // ISO timestamp format
    cashout_transaction_hash: string
    external_account_id: string
    liquidation_address_id: string
    chain_id: string
    token_name: string
    pub_key: string
    user_id: string | null
}

export const CashoutStatusDescriptions: { [key in CashoutStatus]: string } = {
    REFUNDED: 'The funds will be refunded to your address.',
    READY: 'The cashout is ready and can be processed.',
    AWAITING_TX: 'Awaiting the transaction to be broadcast on the blockchain.',
    AWAITING_FIAT: 'Awaiting the funds to be moved to FIAT.',
    FUNDS_IN_BRIDGE: 'Funds are currently in the bridge, moving to the destination chain.',
    FUNDS_MOVED_AWAY: 'Funds have been moved from the bridge to another chain.',
    FUNDS_IN_BANK: 'Funds have been deposited into your bank account.',
    AWAITING_FUNDS: 'Awaiting the availability of funds to process the transaction.',
    IN_REVIEW: 'The cashout is currently under review by the system or team.',
    FUNDS_RECEIVED: 'Funds have been successfully received by the recipient.',
    PAYMENT_SUBMITTED: 'The payment has been submitted for processing.',
    PAYMENT_PROCESSED: 'The payment has been successfully processed.',
    CANCELED: 'The transaction has been canceled by the user or system.',
    ERROR: 'An error occurred during the cashout process.',
    RETURNED: 'The funds have been returned to the original account or address.',
}

export const fetchRouteRaw = async (
    fromToken: string,
    fromChain: string,
    toToken: string,
    toChain: string,
    tokenDecimals: number,
    tokenAmount: string,
    fromAddress?: string
) => {
    try {
        const fromAmount = parseUnits(tokenAmount, tokenDecimals).toString()

        const route = await getSquidRouteRaw({
            squidRouterUrl: `${consts.SQUID_API_URL}/route`,
            fromChain: fromChain,
            fromToken: fromToken.toLowerCase(),
            fromAmount,
            // TODO: move placeholder address to consts file
            fromAddress: fromAddress ?? '0x9647BB6a598c2675310c512e0566B60a5aEE6261', // placeholder address just to get a route sample
            toAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C', // placeholder address just to get a route sample
            toChain: toChain,
            toToken: toToken,
            slippage: 1,
        })
        return route
    } catch (error) {
        console.error('Error fetching route:', error)
        return undefined
    }
}
