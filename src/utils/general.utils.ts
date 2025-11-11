import * as consts from '@/constants'
import { STABLE_COINS, USER_OPERATION_REVERT_REASON_TOPIC, ENS_NAME_REGEX } from '@/constants'
import { AccountType } from '@/interfaces'
import * as Sentry from '@sentry/nextjs'
import peanut, { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import type { Address, TransactionReceipt } from 'viem'
import { getAddress, isAddress, erc20Abi } from 'viem'
import * as wagmiChains from 'wagmi/chains'
import { getPublicClient, type ChainId } from '@/app/actions/clients'
import { NATIVE_TOKEN_ADDRESS, SQUID_ETH_ADDRESS } from './token.utils'
import { type ChargeEntry } from '@/services/services.types'
import { toWebAuthnKey } from '@zerodev/passkey-validator'
import type { ParsedURL } from '@/lib/url-parser/types/payment'

export function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export const colorMap = {
    lavender: '#90A8ED',
    pink: '#FF90E7',
    green: '#98E9AB',
    yellow: '#FFC900',
}

export const shortenAddress = (address?: string, chars?: number) => {
    if (!address) return ''
    if (!chars) chars = 6
    const firstBit = address.substring(0, chars)

    return firstBit + '...'
}

export const shortenStringLong = (s?: string, chars?: number, firstChars?: number, lastChars?: number): string => {
    if (!s) return ''

    // Default values
    const defaultChars = chars ?? 6
    const firstBitLength = firstChars ?? defaultChars
    const lastBitLength = lastChars ?? defaultChars

    const firstBit = s.substring(0, firstBitLength)
    const endingBit = s.substring(s.length - lastBitLength, s.length)

    return firstBit + '...' + endingBit
}

export const printableAddress = (address: string, firstCharsLen?: number, lastCharsLen?: number): string => {
    if (!isAddress(address)) return address
    return shortenStringLong(address, undefined, firstCharsLen, lastCharsLen)
}

/**
 * Validates ens name accordingto EIP-137
 *
 * <domain> ::= <label> | <domain> "." <label>
 * <label> ::=  any valid string label per [UTS46](https://unicode.org/reports/tr46/)
 *
 * @see https://eips.ethereum.org/EIPS/eip-137#name-syntax
 */
export const validateEnsName = (ensName: string = ''): boolean => {
    return ENS_NAME_REGEX.test(ensName)
}

export function jsonStringify(data: any): string {
    return JSON.stringify(data, (_key, value) => {
        if ('bigint' === typeof value) {
            return {
                '@type': 'BigInt',
                value: value.toString(),
            }
        }
        return value
    })
}

export function jsonParse<T = any>(data: string): T {
    return JSON.parse(data, (_key, value) => {
        if (value && typeof value === 'object' && value['@type'] === 'BigInt') {
            return BigInt(value.value)
        }
        return value
    })
}

export const saveToLocalStorage = (key: string, data: any, expirySeconds?: number) => {
    if (typeof localStorage === 'undefined') return
    try {
        // Convert the data to a string before storing it in localStorage
        const serializedData = jsonStringify(data)
        localStorage.setItem(key, serializedData)
        if (expirySeconds) {
            localStorage.setItem(`${key}-expiry`, (new Date().getTime() + expirySeconds * 1000).toString())
        } else {
            localStorage.removeItem(`${key}-expiry`)
        }
        console.log(`Saved ${key} to localStorage:`, data)
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error saving to localStorage:', error)
    }
}

export const getFromLocalStorage = (key: string) => {
    if (typeof localStorage === 'undefined') return
    try {
        const expiry = localStorage.getItem(`${key}-expiry`)
        if (expiry) {
            const expiryTimestamp = Number(expiry)
            if (expiryTimestamp < new Date().getTime()) {
                return null
            }
        }
        const data = localStorage.getItem(key)
        if (data === null) {
            return null
        }
        const parsedData = jsonParse(data)
        return parsedData
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error getting data from localStorage:', error)
    }
}

export const saveToCookie = (key: string, data: any, expiryDays?: number) => {
    if (typeof document === 'undefined') return
    try {
        // Convert the data to a string before storing it in cookies
        const serializedData = jsonStringify(data)

        let cookieString = `${key}=${encodeURIComponent(serializedData)}`

        if (expiryDays) {
            const expiryDate = new Date(new Date().getTime() + expiryDays * 24 * 60 * 60 * 1000)
            cookieString += `; expires=${expiryDate.toUTCString()}`
        }

        // Add default cookie attributes for security
        // Only add Secure flag in HTTPS contexts to avoid breaking local development
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
        cookieString += `; path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`

        document.cookie = cookieString
        console.log(`Saved ${key} to cookie:`, data)
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error saving to cookie:', error)
    }
}

export const getFromCookie = (key: string) => {
    if (typeof document === 'undefined') return
    try {
        const cookies = document.cookie.split(';')
        const targetCookie = cookies.find((cookie) => {
            const [cookieKey] = cookie.trim().split('=')
            return cookieKey === key
        })

        if (!targetCookie) {
            console.log(`No data found in cookie for ${key}`)
            return null
        }

        const [, ...cookieValueParts] = targetCookie.split('=')
        const cookieValue = cookieValueParts.join('=') // Handle cases where value contains '='
        const decodedValue = decodeURIComponent(cookieValue)

        const parsedData = jsonParse(decodedValue)
        console.log(`Retrieved ${key} from cookie:`, parsedData)
        return parsedData
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error getting data from cookie:', error)
        return null
    }
}

export const removeFromCookie = (key: string) => {
    if (typeof document === 'undefined') return
    try {
        // Set cookie with past expiry date to remove it
        document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`
        console.log(`Removed ${key} from cookie`)
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error removing cookie:', error)
    }
}

// for backward compatibility - save localstorage data in cookie if it does not exist
export const syncLocalStorageToCookie = (key: string) => {
    const localStorageData = getFromLocalStorage(key)
    const cookieData = getFromCookie(key)

    if (localStorageData && !cookieData) {
        saveToCookie(key, localStorageData, 90)
        console.log('Data synced successfully')
    }
}
/**
 * Helper function to format numbers with locale-specific (en-US) thousands separators for display.
 * The caller is responsible for prepending the correct currency symbol.
 *
 * @remarks
 * For true internationalization of read-only amounts, consider a dedicated service or util
 * that uses specific locales (e.g., 'es-AR' for '1.234,56').
 * This function standardizes on en-US for parsable input display.
 *
 * @param {string | undefined} valueStr - The numeric string value to format.
 * @param {object} [options] - Optional formatting options.
 * @param {number} [options.maxDecimals] - The maximum number of decimals to display.
 * @param {number} [options.minDecimals] - The minimum number of decimals to display.
 * @returns {string} The formatted string for display with thousands separators (en-US).
 */
export const formatNumberForDisplay = (
    valueStr: string | undefined,
    options?: { maxDecimals?: number; minDecimals?: number }
): string => {
    if (valueStr === undefined || valueStr === null || valueStr.trim() === '') return ''

    // Preserve the original string if it just ends with a decimal or is just a decimal for intermediate input.
    if (valueStr === '.') return '.' // Allow just a dot temporarily
    if (valueStr.endsWith('.') && (valueStr.match(/\./g) || []).length === 1) {
        // For inputs like "123.", format the numeric part "123"
        const numberPart = valueStr.slice(0, -1)
        if (numberPart === '' || isNaN(Number(numberPart))) return valueStr // Avoid formatting " ." or invalid things like "abc."
        const formattedNumberPart = Number(numberPart).toLocaleString('en-US', {
            minimumFractionDigits: 0, // Whole numbers don't get .00 unless typed
            maximumFractionDigits: options?.maxDecimals ?? 0, // Max decimals for the number part if any
        })
        return formattedNumberPart + '.' // Append the dot back
    }

    // Validate the numeric string, allowing for numbers with or without decimal points.
    // Disallow multiple decimal points or non-numeric characters (except the single dot handled above).
    if (!/^\d*\.?\d*$/.test(valueStr) || (valueStr.match(/\./g) || []).length > 1) {
        return '' // Return empty for invalid numeric strings not caught above
    }

    const num = Number(valueStr)
    if (isNaN(num)) return ''

    const maxDecimals = options?.maxDecimals ?? 0 // Default to 0 if not specified, to avoid .00 for whole numbers
    let minDecimals = options?.minDecimals ?? 0
    const parts = valueStr.split('.')

    if (parts.length === 2 && parts[1].length > 0) {
        // If there's an actual decimal part in the input string (e.g., "1.2", "1.20"),
        // set minDecimals to its length to preserve trailing zeros.
        minDecimals = parts[1].length
    }
    // For whole numbers (e.g. "123"), minDecimals remains 0.

    minDecimals = Math.min(minDecimals, maxDecimals) // Cap by maxDecimals

    return num.toLocaleString('en-US', {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
        roundingMode: 'trunc',
    })
}

export function formatCurrency(valueStr: string | undefined, maxDecimals: number = 2, minDecimals: number = 2): string {
    return formatNumberForDisplay(valueStr, { maxDecimals, minDecimals })
}

/**
 * formats a number by:
 * - displaying 2 significant digits for small numbers (<0.01)
 * - removing unnecessary trailing zeros after decimal point
 * - if all decimal places are zeros, returns the whole number
 * @param amount - number or string to format
 * @returns formatted string representation of the number
 */
export const formatAmount = (amount: string | number): string => {
    // handle undefined, null, or empty string
    if (!amount && amount !== 0) return '0'

    // convert amount to number if not already
    const num = typeof amount === 'string' ? Number(amount) : amount

    // check for NaN after conversion
    if (isNaN(num)) return '0'

    // handle small numbers differently
    if (Math.abs(num) < 0.01) {
        // convert to exponential notation to get significant digits easily
        const exponential = num.toExponential(1) // 1 decimal place = 2 significant digits
        // convert back to decimal notation
        const significantNum = Number(exponential)
        return significantNum.toString()
    }

    // for normal numbers, round to 2 decimals
    const rounded = Number(num.toFixed(2))
    const stringValue = rounded.toString()

    // return as is if no decimal point
    if (!stringValue.includes('.')) {
        return stringValue
    }

    const [integerPart, decimalPart] = stringValue.split('.')

    // return integer if decimal part is all zeros
    if (!decimalPart || !/[1-9]/.test(decimalPart)) {
        return integerPart
    }

    // remove trailing zeros from decimal part
    const trimmedDecimal = decimalPart.replace(/0+$/, '')

    // combine integer part with trimmed decimal
    return `${integerPart}.${trimmedDecimal}`
}

export function floorFixed(value: number, decimals: number) {
    return (Math.floor(value * 10 ** decimals) / 10 ** decimals).toFixed(decimals)
}

export function formatAmountWithSignificantDigits(amount: number, significantDigits: number): string {
    if (amount === 0) return amount.toFixed(significantDigits)
    let fractionDigits = Math.floor(Math.log10(1 / amount)) + significantDigits
    fractionDigits = fractionDigits < 0 ? 0 : fractionDigits
    return floorFixed(amount, fractionDigits)
}

export function formatTokenAmount(amount?: number | string, maxFractionDigits?: number, forInput: boolean = false) {
    if (amount === undefined) return undefined
    maxFractionDigits = maxFractionDigits ?? 6

    // For input mode, preserve progressive typing (e.g., "1.", "0.")
    if (forInput && typeof amount === 'string') {
        let s = amount.trim()
        if (s === '') return ''

        // Handle comma: could be decimal separator (Argentina) or thousands separator (US paste)
        // Heuristic: comma followed by exactly 3 digits = thousands separator
        // Otherwise: decimal separator
        s = s.replace(/,(\d{3})/g, '$1') // Remove commas before exactly 3 digits (thousands)
        s = s.replace(/,/g, '.') // Convert remaining commas to dots (decimal separators)

        const m = s.match(/^(\d*)(?:\.(\d*))?$/)
        if (!m) return '' // invalid → empty
        const whole = m[1] ?? ''
        const fracRaw = m[2] // undefined ⇒ no dot; '' ⇒ dot present with no digits
        if (fracRaw === undefined) return whole
        if (maxFractionDigits === 0) return whole
        const frac = (fracRaw ?? '').slice(0, maxFractionDigits)
        return `${whole}.${frac}`
    }

    const amountNumber = typeof amount === 'string' ? parseFloat(amount) : amount

    // check for NaN after conversion
    if (isNaN(amountNumber)) return undefined

    // floor the amount
    const flooredAmount = Math.floor(amountNumber * Math.pow(10, maxFractionDigits)) / Math.pow(10, maxFractionDigits)

    // Convert number to string to count significant digits
    const amountString = flooredAmount.toFixed(maxFractionDigits)
    const significantDigits = amountString.replace(/^0+\./, '').replace(/\.$/, '').replace(/0+$/, '').length

    // Calculate the number of fraction digits needed to have at least two significant digits
    const fractionDigits = Math.max(2 - significantDigits, 0)

    // Format the number with the calculated fraction digits
    const formattedAmount = flooredAmount.toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: maxFractionDigits,
    })
    return formattedAmount
}

export async function copyTextToClipboardWithFallback(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text)
            return
        } catch (err) {
            Sentry.captureException(err)
            console.error('Clipboard API failed, trying fallback method. Error:', err)
        }
    }

    try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        const successful = document.execCommand('copy')
        const msg = successful ? 'successful' : 'unsuccessful'
        document.body.removeChild(textarea)
    } catch (err) {
        Sentry.captureException(err)
        console.error('Fallback method failed. Error:', err)
    }
}

export const isTestnetChain = (chainId: string) => {
    const isTestnet = !Object.keys(peanut.CHAIN_DETAILS)
        .map((key) => peanut.CHAIN_DETAILS[key as keyof typeof peanut.CHAIN_DETAILS])
        .find((chain) => chain.chainId == chainId)?.mainnet

    return isTestnet
}

export const areEvmAddressesEqual = (address1: string, address2: string): boolean => {
    if (!isAddress(address1) || !isAddress(address2)) return false
    if (address1.toLowerCase() === SQUID_ETH_ADDRESS.toLocaleLowerCase()) address1 = NATIVE_TOKEN_ADDRESS
    if (address2.toLowerCase() === SQUID_ETH_ADDRESS.toLocaleLowerCase()) address2 = NATIVE_TOKEN_ADDRESS
    // By using getAddress we are safe from different cases
    // and other address formatting
    return getAddress(address1) === getAddress(address2)
}

export const isAddressZero = (address: string): boolean => {
    return areEvmAddressesEqual(address, NATIVE_TOKEN_ADDRESS)
}

export const isNativeCurrency = (address: string) => {
    if (consts.nativeCurrencyAddresses.includes(address.toLowerCase())) {
        return true
    } else return false
}

export interface RecentMethod {
    type: 'crypto' | 'country'
    id: string
    title: string
    description?: string
    iconUrl?: string
    currency?: string
    path: string
}

export type UserPreferences = {
    balanceHidden?: boolean
    recentAddMethods?: RecentMethod[]
    webAuthnKey?: Awaited<ReturnType<typeof toWebAuthnKey>>
    notifBannerShowAt?: number
    notifModalClosed?: boolean
    hasSeenBalanceWarning?: { value: boolean; expiry: number }
    // @dev: note, this needs to be deleted post devconnect
    devConnectIntents?: Array<{
        id: string
        recipientAddress: string
        chain: string
        amount: string
        onrampId?: string
        createdAt: number
        status: 'pending' | 'completed'
    }>
}

export const updateUserPreferences = (
    userId: string | undefined,
    partialPrefs: Partial<UserPreferences>
): UserPreferences | undefined => {
    if (!userId) return
    try {
        if (typeof localStorage === 'undefined') return

        const currentPrefs = getUserPreferences(userId) ?? {}
        const newPrefs: UserPreferences = {
            ...currentPrefs,
            ...partialPrefs,
        }
        saveToLocalStorage(`${userId}:user-preferences`, newPrefs)
        return newPrefs
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error updating user preferences:', error)
    }
}

export const getUserPreferences = (userId: string | undefined): UserPreferences | undefined => {
    if (!userId) return
    try {
        const storedData = getFromLocalStorage(`${userId}:user-preferences`)
        if (!storedData) return undefined
        return storedData as UserPreferences
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error getting user preferences:', error)
    }
}

export const estimateIfIsStableCoinFromPrice = (tokenPrice: number) => {
    // if the tokenprice is between .995 and 1.005, return 1
    if (tokenPrice >= 0.995 && tokenPrice <= 1.005) {
        return true
    } else {
        return false
    }
}

export const getExplorerUrl = (chainId: string) => {
    const explorers = consts.supportedPeanutChains.find((detail) => detail.chainId === chainId)?.explorers
    // if the explorers array has blockscout, return the blockscout url, else return the first one
    if (explorers?.find((explorer) => explorer.url.includes('blockscout'))) {
        return explorers?.find((explorer) => explorer.url.includes('blockscout'))?.url
    } else {
        return explorers?.[0].url
    }
}

interface TransferDetails {
    id: string
    timestamp: string
    chain: string
    details: any
}

interface Portfolio {
    id: string
    ownerAddress: string
    assetActivities: TransferDetails[]
}

export function formatDate(date: Date): string {
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
    return `${dateFormatter.format(date)} - ${timeFormatter.format(date)}`
}

// uppercase and add a space inbetween every four characters
export const formatIban = (iban: string) => {
    // if the first two chars of the iban are not letters, return the iban as is (it's not an iban, us account number probably)
    if (!/[a-zA-Z]{2}/.test(iban.substring(0, 2))) return iban
    return iban
        .toUpperCase()
        .replace(/(.{4})/g, '$1 ')
        .trim()
}

export const switchNetwork = async ({
    chainId,
    currentChainId,
    setLoadingState,
    switchChainAsync,
}: {
    chainId: string
    currentChainId: string | undefined
    setLoadingState: (state: consts.LoadingStates) => void
    switchChainAsync: ({ chainId }: { chainId: number }) => Promise<void>
}) => {
    if (currentChainId !== chainId) {
        setLoadingState('Allow network switch')
        try {
            await switchChainAsync({ chainId: Number(chainId) })
            setLoadingState('Switching network')
            await new Promise((resolve) => setTimeout(resolve, 2000))
            setLoadingState('Loading')
        } catch (error) {
            console.error('Error switching network:', error)
            Sentry.captureException(error)
            throw new Error('Error switching network.')
        }
    }
}

/** Gets the token decimals for a given token address and chain ID. */
export function getTokenDecimals(tokenAddress: string, chainId: string): number | undefined {
    return consts.peanutTokenDetails
        .find((chain) => chain.chainId === chainId)
        ?.tokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))?.decimals
}

export function getTokenDetails({ tokenAddress, chainId }: { tokenAddress: Address; chainId: string }):
    | {
          symbol: string
          name: string
          decimals: number
      }
    | undefined {
    const chainTokens = consts.peanutTokenDetails.find((c) => c.chainId === chainId)?.tokens
    if (!chainTokens) return undefined
    const tokenDetails = chainTokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))
    if (!tokenDetails) return undefined
    return tokenDetails
}

/**
 * Gets the token symbol for a given token address and chain ID.
 *
 * From the sdk token list, if you need to be sure to get a token symbol you
 * should use the {@link fetchTokenSymbol} function.
 *
 * @returns The token symbol, or undefined if not found.
 */
export function getTokenSymbol(tokenAddress: string | undefined, chainId: string | undefined): string | undefined {
    if (!tokenAddress || !chainId) return undefined

    const chainTokens = consts.peanutTokenDetails.find((chain) => chain.chainId === chainId)?.tokens
    if (!chainTokens) return undefined

    return chainTokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))?.symbol
}

/**
 * Fetches the token symbol for a given token address and chain ID.
 *
 * This function first checks the sdk token list, and if the token is not found
 * it fetches the token contract details and tries to get the symbol from the
 * contract. If you are ok with only checking the sdk token list, and don't want
 * to await you can use the {@link getTokenSymbol} function.
 *
 * @returns The token symbol, or undefined if not found.
 */
export async function fetchTokenSymbol(tokenAddress: string, chainId: string): Promise<string | undefined> {
    let tokenSymbol = getTokenSymbol(tokenAddress, chainId)
    if (!tokenSymbol) {
        try {
            const client = getPublicClient(Number(chainId) as ChainId)
            tokenSymbol = (await client.readContract({
                address: tokenAddress as Address,
                abi: erc20Abi,
                functionName: 'symbol',
                args: [],
            })) as string
        } catch (error) {
            Sentry.captureException(error)
            console.error('Error fetching token symbol:', error)
        }
    }
    if (!tokenSymbol) {
        console.error(`Failed to get token symbol for token ${tokenAddress} on chain ${chainId}`)
    }
    return tokenSymbol
}

export function getChainName(chainId: string): string | undefined {
    const chain = Object.entries(wagmiChains).find(([, chain]) => chain.id === Number(chainId))?.[1]
    return chain?.name ?? undefined
}

export const getHeaderTitle = (pathname: string) => {
    return consts.pathTitles[pathname] || 'Peanut' // default title if path not found
}

/**
 * Formats a number to use K, M, B, T suffixes if it exceeds 6 characters in length.
 * Uses the formatAmount function to format the number before adding a suffix.
 *
 * @param amount - The number or string to format.
 * @returns A formatted string with appropriate suffix.
 */
/**
 * Formats a number to use K, M, B, T suffixes if it exceeds 6 digits in length.
 * Uses the formatAmount function to format the number before adding a suffix.
 *
 * @param amount - The number or string to format.
 * @returns A formatted string with appropriate suffix.
 */
export const formatExtendedNumber = (amount: string | number, minDigitsForFomatting: number = 6): string => {
    // Handle null/undefined/invalid inputs
    if (!amount && amount !== 0) return '0'

    // Validate input type and convert to number
    const num = typeof amount === 'string' ? parseFloat(amount) : amount

    // Check for NaN values
    if (isNaN(num)) return '0'

    // Count total digits by removing decimal point and negative sign
    const totalDigits = amount.toString().replace(/[.-]/g, '').length

    // If 6 or fewer digits, just use formatAmount
    if (totalDigits <= minDigitsForFomatting) {
        return formatAmount(num)
    }

    // Get absolute value for comparison
    const absNum = Math.abs(num)

    const suffixes: [number, string][] = [
        [1e12, 'T'],
        [1e9, 'B'],
        [1e6, 'M'],
        [1e3, 'K'],
    ]

    for (const [divisor, suffix] of suffixes) {
        if (absNum >= divisor) {
            const scaled = absNum / divisor
            const roundedScaled = Math.round(scaled * 100) / 100

            // Handle boundary cases (e.g., 999999 -> 1M)
            if (roundedScaled === 1000 && suffix !== 'T') {
                const nextSuffixIndex = suffixes.findIndex(([d]) => d === divisor) - 1
                if (nextSuffixIndex >= 0) {
                    const [nextDivisor, nextSuffix] = suffixes[nextSuffixIndex]
                    const nextScaled = absNum / nextDivisor
                    return `${num < 0 ? '-' : ''}${formatAmount(nextScaled)}${nextSuffix}`
                }
            }

            return `${num < 0 ? '-' : ''}${formatAmount(scaled)}${suffix}`
        }
    }

    return formatAmount(num)
}

export function getRequestLink(
    requestData: {
        recipientAccount: {
            type: string
            user?: {
                username: string
            }
        }
        recipientAddress: string
        chainId?: string
        tokenAmount?: string
        tokenSymbol?: string
    } & ({ uuid: string; chargeId?: never } | { uuid?: never; chargeId: string })
): string {
    const { recipientAccount, recipientAddress, chainId, tokenAmount, tokenSymbol, uuid, chargeId } = requestData
    const isPeanutWallet = recipientAccount.type === AccountType.PEANUT_WALLET
    const recipient = isPeanutWallet ? recipientAccount.user!.username : recipientAddress
    let chain: string = ''
    if (!isPeanutWallet && chainId) {
        chain = `@${chainId}`
    }
    let link = `${process.env.NEXT_PUBLIC_BASE_URL}/${recipient}${chain}/`
    if (tokenAmount) {
        link += `${formatAmount(tokenAmount)}`
    }
    if (tokenSymbol) {
        link += `${tokenSymbol}`
    }
    if (uuid) {
        link += `?id=${uuid}`
    } else if (chargeId) {
        link += `?chargeId=${chargeId}`
    }
    return link
}

// for now it works
export function getTokenLogo(tokenSymbol: string): string {
    return `https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/${tokenSymbol.toLowerCase()}.svg`
}

export function getChainLogo(chainName: string): string {
    let name
    switch (chainName.toLowerCase()) {
        case 'arbitrum one':
            name = 'arbitrum'
            break
        case 'bsc':
        case 'bnb':
            name = 'binance'
            break
        default:
            name = chainName.toLowerCase()
    }
    return `https://raw.githubusercontent.com/0xsquid/assets/main/images/webp128/chains/${name}.webp`
}

export function isStableCoin(tokenSymbol: string): boolean {
    return STABLE_COINS.includes(tokenSymbol.toUpperCase())
}

export const saveRedirectUrl = () => {
    const currentUrl = new URL(window.location.href)
    const relativeUrl = currentUrl.href.replace(currentUrl.origin, '')
    saveToLocalStorage('redirect', relativeUrl)
}

export const getRedirectUrl = () => {
    return getFromLocalStorage('redirect')
}

export const clearRedirectUrl = () => {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('redirect')
    }
}

export const sanitizeRedirectURL = (redirectUrl: string): string | null => {
    try {
        const u = new URL(redirectUrl, window.location.origin)
        // Only allow same-origin URLs
        if (u.origin === window.location.origin) {
            return u.pathname + u.search + u.hash
        }
        console.log('Rejecting off-origin URL:', redirectUrl)
        // Reject off-origin URLs
        return null
    } catch {
        // For strings that can't be parsed as URLs, only allow relative paths
        if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
            // Additional check: ensure it doesn't contain a protocol
            if (!redirectUrl.includes('://')) {
                return redirectUrl
            }
        }
        // Reject anything else (including protocol-relative URLs like //evil.com)
        return null
    }
}

export function getLinkFromReceipt({
    txReceipt,
    linkDetails,
    password,
}: {
    txReceipt: TransactionReceipt
    linkDetails: peanutInterfaces.IPeanutLinkDetails
    password: string
}): string {
    const { chainId, baseUrl, trackId } = linkDetails
    const contractVersion = peanut.detectContractVersionFromTxReceipt(txReceipt, chainId)
    const depositIdx = peanut.getDepositIdxs(txReceipt, chainId, contractVersion)[0]
    return peanut.getLinkFromParams(chainId, contractVersion, depositIdx, password, baseUrl, trackId)
}

export const getInitialsFromName = (name: string): string => {
    const nameParts = name.trim().split(/\s+/)
    if (nameParts.length === 1) {
        return nameParts[0].substring(0, 2).toUpperCase()
    } else {
        return nameParts[0].charAt(0).toUpperCase() + nameParts[1].charAt(0).toUpperCase()
    }
}

export function isTxReverted(receipt: TransactionReceipt): boolean {
    if (receipt.status === 'reverted') return true
    return receipt.logs.some((log) => log.topics[0] === USER_OPERATION_REVERT_REASON_TOPIC)
}

export function checkIfInternalNavigation(): boolean {
    return !!document.referrer && new URL(document.referrer).origin === window.location.origin
}

/**
 * Converts a string into a URL-friendly slug
 * @param text - The string to slugify
 * @returns A slugified string with lowercase letters, hyphens, and no special characters
 */
export function slugify(text: string): string {
    return text
        .toLowerCase() // Convert to lowercase
        .trim() // Remove leading/trailing whitespace
        .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
        .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading and trailing hyphens
}

export const generateInvitesShareText = (inviteLink: string) => {
    return `I'm using Peanut, an invite-only app for easy payments. With it you can pay friends, use merchants, and move money in and out of your bank, even cross-border. Here's my invite: ${inviteLink}`
}

/**
 * Generate a deterministic 3-digit suffix from username
 * This is purely cosmetic and derived from a hash of the username
 *
 * ⚠️ IMPORTANT: This logic is duplicated in the backend (peanut-api-ts/src/utils.ts)
 * If you change this, you MUST update the backend version to match!
 */
export const generateInviteCodeSuffix = (username: string): string => {
    const lowerUsername = username.toLowerCase()
    // Create a simple hash from the username
    const hash = lowerUsername.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    // Generate 3 digits between 100-999
    const threeDigits = 100 + (hash % 900)
    return threeDigits.toString()
}

export const generateInviteCodeLink = (username: string) => {
    const suffix = generateInviteCodeSuffix(username)
    const inviteCode = `${username.toUpperCase()}INVITESYOU${suffix}`
    const inviteLink = `${consts.BASE_URL}/invite?code=${inviteCode}`
    return { inviteLink, inviteCode }
}

export const getValidRedirectUrl = (redirectUrl: string, fallbackRoute: string) => {
    let decodedRedirect = redirectUrl
    try {
        decodedRedirect = decodeURIComponent(redirectUrl)
    } catch {
        // if decoding URI fails, push to /login as fallback
        return fallbackRoute
    }
    const sanitizedRedirectUrl = sanitizeRedirectURL(decodedRedirect)
    // Only redirect if the URL is safe (same-origin)
    if (sanitizedRedirectUrl) {
        return sanitizedRedirectUrl
    } else {
        // Reject external redirects, go to home instead
        return fallbackRoute
    }
}

export const getContributorsFromCharge = (charges: ChargeEntry[]) => {
    return charges.map((charge) => {
        const successfulPayment = charge.payments.at(-1)
        let username = successfulPayment?.payerAccount?.user?.username
        if (successfulPayment?.payerAccount?.type === 'evm-address') {
            username = successfulPayment.payerAccount.identifier
        }

        const isPeanutUser = successfulPayment?.payerAccount?.type === AccountType.PEANUT_WALLET

        return {
            uuid: charge.uuid,
            payments: charge.payments,
            amount: charge.tokenAmount,
            username,
            fulfillmentPayment: charge.fulfillmentPayment,
            isUserVerified: successfulPayment?.payerAccount?.user?.bridgeKycStatus === 'approved',
            isPeanutUser,
        }
    })
}

/**
 * helper function to save devconnect intent to user preferences
 * @dev: note, this needs to be deleted post devconnect
 */
/**
 * create deterministic id for devconnect intent based on recipient + chain only
 * amount is not included as it can change during the flow
 * @dev: to be deleted post devconnect
 */
const createDevConnectIntentId = (recipientAddress: string, chain: string): string => {
    const str = `${recipientAddress.toLowerCase()}-${chain.toLowerCase()}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
}

export const saveDevConnectIntent = (
    userId: string | undefined,
    parsedPaymentData: ParsedURL | null,
    amount: string,
    onrampId?: string
): void => {
    if (!userId) return

    // check both redux state and user preferences (fallback if state was reset)
    const devconnectFlowData =
        parsedPaymentData?.isDevConnectFlow && parsedPaymentData.recipient && parsedPaymentData.chain
            ? {
                  recipientAddress: parsedPaymentData.recipient.resolvedAddress,
                  chain: parsedPaymentData.chain.chainId,
              }
            : (() => {
                  try {
                      const prefs = getUserPreferences(userId)
                      const intents = prefs?.devConnectIntents ?? []
                      // get the most recent pending intent
                      return intents.find((i) => i.status === 'pending') ?? null
                  } catch (e) {
                      console.error('Failed to read devconnect intent from user preferences:', e)
                  }
                  return null
              })()

    if (devconnectFlowData) {
        // validate required fields
        const recipientAddress = devconnectFlowData.recipientAddress
        const chain = devconnectFlowData.chain
        const cleanedAmount = amount.replace(/,/g, '')

        if (!recipientAddress || !chain || !cleanedAmount) {
            console.warn('Skipping DevConnect intent: missing required fields')
            return
        }

        try {
            // create deterministic id based on address + chain only
            const intentId = createDevConnectIntentId(recipientAddress, chain)

            const prefs = getUserPreferences(userId)
            const existingIntents = prefs?.devConnectIntents ?? []

            // check if intent with same id already exists
            const existingIntent = existingIntents.find((intent) => intent.id === intentId)

            if (!existingIntent) {
                // create new intent
                const { MAX_DEVCONNECT_INTENTS } = require('@/constants/payment.consts')
                const sortedIntents = existingIntents.sort((a, b) => b.createdAt - a.createdAt)
                const prunedIntents = sortedIntents.slice(0, MAX_DEVCONNECT_INTENTS - 1)

                updateUserPreferences(userId, {
                    devConnectIntents: [
                        {
                            id: intentId,
                            recipientAddress,
                            chain,
                            amount: cleanedAmount,
                            onrampId,
                            createdAt: Date.now(),
                            status: 'pending',
                        },
                        ...prunedIntents,
                    ],
                })
            } else {
                // update existing intent with new amount and onrampId
                const updatedIntents = existingIntents.map((intent) =>
                    intent.id === intentId
                        ? { ...intent, amount: cleanedAmount, onrampId, createdAt: Date.now() }
                        : intent
                )
                updateUserPreferences(userId, {
                    devConnectIntents: updatedIntents,
                })
            }
        } catch (intentError) {
            console.error('Failed to save DevConnect intent:', intentError)
            // don't block the flow if intent storage fails
        }
    }
}
