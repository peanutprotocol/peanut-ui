import * as interfaces from '@/interfaces'
import * as consts from '@/constants'
import * as utils from '@/utils'
import countries from 'i18n-iso-countries'
import { generateKeysFromString } from '@squirrel-labs/peanut-sdk'
import { getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'

export const convertPersonaUrl = (url: string) => {
    const parsedUrl = new URL(url)

    const templateId = parsedUrl.searchParams.get('inquiry-template-id')
    const iqtToken = parsedUrl.searchParams.get('fields[iqt_token]')
    const developerId = parsedUrl.searchParams.get('fields[developer_id]')
    const referenceId = parsedUrl.searchParams.get('reference-id')
    const origin = encodeURIComponent(window.location.origin)

    return `https://bridge.withpersona.com/widget?environment=production&inquiry-template-id=${templateId}&fields[iqt_token=${iqtToken}&iframe-origin=${origin}&redirect-uri=http%3A%2F%2Flocalhost%3A3000&fields[developer_id]=${developerId}&reference-id=${referenceId}`
}
export const fetchUser = async (accountIdentifier: string): Promise<any> => {
    const response = await fetch(`/api/peanut/user/fetch-user?accountIdentifier=${accountIdentifier}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (response.status === 404) {
        return undefined
    }

    const data = await response.json()
    return data
}

export const createUser = async (
    bridgeCustomerId: string,
    email: string,
    fullName: string,
    physicalAddress?: {
        street_line_1: string
        city: string
        country: string
        state: string
        postal_code: string
    },
    userDetails?: any
): Promise<any> => {
    const response = await fetch('/api/peanut/user/create-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bridgeCustomerId,
            email,
            fullName,
            physicalAddress,
            userDetails,
        }),
    })

    if (!response.ok) {
        throw new Error('Failed to create user')
    }

    const data = await response.json()
    return data
}

export const createAccount = async (
    userId: string,
    bridgeCustomerId: string,
    bridgeAccountId: string,
    accountType: string,
    accountIdentifier: string,
    accountDetails: any
): Promise<any> => {
    const response = await fetch('/api/peanut/user/add-account', {
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

export async function fetchApi(url: string, method: string, body?: any): Promise<any> {
    const response = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch data from ${url}`)
    }

    return await response.json()
}

export async function getUserLinks(formData: consts.IOfframpForm) {
    return await fetchApi('/api/bridge/user/new/get-links', 'POST', {
        type: 'individual',
        full_name: formData.name,
        email: formData.email,
    })
}

export async function getStatus(userId: string, type: string) {
    return await fetchApi('/api/bridge/user/new/get-status', 'POST', {
        userId,
        type,
    })
}

export async function getCustomer(customerId: string) {
    return await fetchApi('/api/bridge/get-user-by-id', 'POST', {
        customerId,
    })
}

export async function getExternalAccounts(customerId: string) {
    return await fetchApi('/api/bridge/external-account/get-all-for-customerId', 'POST', {
        customerId,
    })
}

export async function awaitStatusCompletion(
    userId: string,
    type: string,
    initialStatus: string,
    link: string,
    setTosLinkOpened: Function,
    setKycLinkOpened: Function,
    tosLinkOpened: boolean,
    kycLinkOpened: boolean
) {
    let status = initialStatus

    // if (type === 'tos' && !tosLinkOpened) {
    //     window.open(link, '_blank')
    //     setTosLinkOpened(true)
    // } else if (type === 'kyc' && !kycLinkOpened) {
    //     window.open(link, '_blank')
    //     setKycLinkOpened(true)
    // }

    while (status !== 'approved') {
        const statusData = await getStatus(userId, type)
        status = statusData[`${type}_status`]

        if (status === 'under_review') {
            if (type === 'tos') throw new Error('TOS is under review')
            else if (type === 'kyc') throw new Error('KYC is under review.')
        } else if (status !== 'approved') {
            await new Promise((resolve) => setTimeout(resolve, 5000)) // wait 5 seconds before checking again
        }
    }
}

export async function createExternalAccount(
    customerId: string,
    accountType: 'iban' | 'us',
    accountDetails: any,
    address: any,
    accountOwnerName: string
): Promise<interfaces.IBridgeAccount> {
    try {
        const response = await fetch(`/api/bridge/external-account/create-external-account?customerId=${customerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                accountType,
                accountDetails,
                address: address ? address : {},
                accountOwnerName,
            }),
        })

        if (!response.ok) {
            throw new Error('Failed to create external account')
        }

        const data = await response.json()

        return data as interfaces.IBridgeAccount
    } catch (error) {
        console.error('Error:', error)
        throw new Error(`Failed to create external account. Error: ${error}`)
    }
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

export const createLiquidationAddress = async (
    customerId: string,
    chainName: string,
    tokenName: string,
    externalAccountId: string,
    destinationPaymentRail: string,
    destinationCurrency: string
): Promise<interfaces.IBridgeLiquidationAddress> => {
    const response = await fetch('/api/bridge/liquidation-address/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            customer_id: customerId,
            chain: chainName,
            currency: tokenName,
            external_account_id: externalAccountId,
            destination_payment_rail: destinationPaymentRail,
            destination_currency: destinationCurrency,
        }),
    })

    if (!response.ok) {
        throw new Error('Failed to create liquidation address')
    }

    const data: interfaces.IBridgeLiquidationAddress = await response.json()

    return data
}

export const getLiquidationAddresses = async (customerId: string): Promise<interfaces.IBridgeLiquidationAddress[]> => {
    const response = await fetch(`/api/bridge/liquidation-address/get-all?customerId=${customerId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        throw new Error('Failed to fetch liquidation addresses')
    }

    const data: interfaces.IBridgeLiquidationAddress[] = await response.json()
    return data
}

export function getThreeCharCountryCodeFromIban(iban: string): string {
    if (!iban || typeof iban !== 'string' || iban.length < 2) {
        throw new Error('Invalid IBAN')
    }

    const twoCharCountryCode = iban.substring(0, 2).toUpperCase()
    const threeCharCountryCode = countries.alpha2ToAlpha3(twoCharCountryCode)

    if (!threeCharCountryCode) {
        throw new Error('Invalid country code in IBAN')
    }

    return threeCharCountryCode
}

export function getBridgeTokenName(chainId: string, tokenAddress: string): string | undefined {
    const token = consts.supportedBridgeTokensDictionary
        .find((chain) => chain.chainId === chainId)
        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, tokenAddress))
        ?.token.toLowerCase()

    return token ?? undefined
}

export function getBridgeChainName(chainId: string): string | undefined {
    const chain = consts.supportedBridgeChainsDictionary.find((chain) => chain.chainId === chainId)?.chain
    return chain ?? undefined
}

export function getTokenAddressFromBridgeTokenName(chainId: string, tokenName: string): string | undefined {
    const token = consts.supportedBridgeTokensDictionary
        .find((chain) => chain.chainId === chainId)
        ?.tokens.find((token) => token.token === tokenName.toLowerCase())?.address

    return token ?? undefined
}
export function getChainIdFromBridgeChainName(chainName: string): string | undefined {
    const chain = consts.supportedBridgeChainsDictionary.find((chain) => chain.chain === chainName)?.chainId
    return chain ?? undefined
}

export async function validateBankAccount(bankAccount: string): Promise<boolean> {
    bankAccount = bankAccount.replace(/\s/g, '')
    const response = await fetch(`/api/peanut/iban/validate-bank-account`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bankAccount,
        }),
    })

    if (response.status !== 200) {
        return false
    } else {
        return true
    }
}

export async function validateBic(bic: string): Promise<boolean> {
    const response = await fetch(`/api/peanut/iban/validate-bic`, {
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

export async function submitCashoutLink(data: {
    link: string
    bridgeCustomerId: string
    liquidationAddressId: string
    cashoutTransactionHash: string
    externalAccountId: string
    chainId: string
    tokenName: string
}) {
    const fragment = data.link.split('#')[1]
    const password = new URLSearchParams(fragment).get('p')!
    const { address: pubKey } = generateKeysFromString(password)

    try {
        const response = await fetch('/api/peanut/submit-cashout-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bridgeCustomerId: data.bridgeCustomerId,
                liquidationAddressId: data.liquidationAddressId,
                cashoutTransactionHash: data.cashoutTransactionHash,
                externalAccountId: data.externalAccountId,
                chainId: data.chainId,
                tokenName: data.tokenName,
                pubKey,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to submit cashout link, status: ${response.status}`)
        }

        const result = await response.json()
        return result
    } catch (error) {
        console.error('Error in submitCashoutLink:', error)
        throw error
    }
}

export type CashoutStatus =
    | 'PAYMENT_PROCESSED'
    | 'REFUNDED'
    | 'READY'
    | 'AWAITING_TX'
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

export async function getCashoutStatus(link: string): Promise<CashoutTransaction> {
    try {
        // Extract pubKey from the link
        const fragment = link.split('#')[1]
        const password = new URLSearchParams(fragment).get('p')!
        const { address: pubKey } = generateKeysFromString(password)

        const response = await fetch('/api/peanut/get-cashout-status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pubKey }),
        })

        if (!response.ok) {
            throw new Error(`Failed to get cashout status, status: ${response.status}`)
        }

        const result = await response.json()
        return result
    } catch (error) {
        console.error('Error in getCashoutStatus:', error)
        throw error
    }
}

export const fetchRouteRaw = async (
    fromToken: string,
    fromChain: string,
    toToken: string,
    toChain: string,
    tokenDecimals: number,
    tokenAmount: string,
    senderAddress: string
) => {
    try {
        const _tokenAmount = Math.floor(Number(tokenAmount) * Math.pow(10, tokenDecimals)).toString()

        const route = await getSquidRouteRaw({
            squidRouterUrl: 'https://apiplus.squidrouter.com/v2/route',
            fromChain: fromChain,
            fromToken: fromToken.toLowerCase(),
            fromAmount: _tokenAmount,
            toChain: toChain,
            toToken: toToken,
            slippage: 1,
            fromAddress: senderAddress,

            toAddress: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        })
        return route
    } catch (error) {
        console.error('Error fetching route:', error)
        return undefined
    }
}
