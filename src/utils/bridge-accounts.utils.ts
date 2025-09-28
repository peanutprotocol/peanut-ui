import * as consts from '@/constants'
import { areEvmAddressesEqual, fetchWithSentry } from '@/utils'
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

export type KYCStatus = 'not_started' | 'under_review' | 'approved' | 'rejected' | 'incomplete'

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

export function isValidRoutingNumber(routingNumber: string): boolean {
    // a valid routing number must be a 9-digit number
    if (!/^\d{9}$/.test(routingNumber)) {
        return false
    }

    const digits = routingNumber.split('').map(Number)
    let sum = 0

    // the checksum is calculated as follows:
    // (3 * (d1 + d4 + d7) + 7 * (d2 + d5 + d8) + 1 * (d3 + d6 + d9)) mod 10 = 0
    for (let i = 0; i < digits.length; i++) {
        const digit = digits[i]
        switch (i % 3) {
            case 0: // digits 1, 4, 7
                sum += digit * 3
                break
            case 1: // digits 2, 5, 8
                sum += digit * 7
                break
            case 2: // digits 3, 6, 9
                sum += digit * 1
                break
        }
    }

    return sum % 10 === 0
}
