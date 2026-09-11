import { nativeCurrencyAddresses } from '@/constants/general.consts'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants/token-registry.consts'
import { toInviteCode } from '@/utils/invite-code.utils'
import { jsonStringify, jsonParse, saveToCookie, getFromCookie, sanitizeRedirectURL } from '@/utils/cookie-url.utils'
import { STABLE_COINS, ENS_NAME_REGEX } from '@/constants/general.consts'
import { payLinkUrl, shareableUrl } from '@/utils/url.utils'
import { isCapacitor } from '@/utils/capacitor'
import * as Sentry from '@/utils/sentry-lazy'
import type { Address, TransactionReceipt } from 'viem'
import { getAddress, isAddress, erc20Abi } from 'viem'
import * as wagmiChains from 'wagmi/chains'
/*
 * Type-only, so this module does not pull `actions/clients` — and through it
 * viem's ~700-chain registry (596 KB) — into every bundle that imports these
 * utils. `fetchTokenSymbol` below imports the client at call time instead.
 */
import { type ChainId } from '@/app/actions/clients'
import { type ChargeEntry } from '@/services/services.types'
import { NATIVE_TOKEN_ADDRESS, NATIVE_TOKEN_PROXY_ADDRESS } from '@/constants/tokens.consts'
import { toWebAuthnKey } from '@zerodev/passkey-validator'
import { USER_OPERATION_REVERT_REASON_TOPIC } from '@/constants/userop.consts'
import { CHAIN_LOGOS, TOKEN_LOGOS, type ChainName, type TokenName } from '@/constants/rhino.consts'

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

// one-line account identifiers: head + ellipsis + the last 4 characters
// (whitespace ignored) people recognize an account by. no-op when it fits.
export const middleEllipsisAccount = (value: string, max: number): string => {
    if (value.length <= max) return value
    const tail = value.replace(/\s/g, '').slice(-4)
    return `${value.slice(0, max - 7).trimEnd()} … ${tail}`
}

// Address detection patterns (permissive to handle lowercase-stored addresses)
// These are for display purposes, not cryptographic validation
const SOLANA_ADDRESS_REGEX = /^[1-9a-zA-Z]{32,44}$/
const TRON_ADDRESS_REGEX = /^[Tt][0-9a-zA-Z]{33}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Checks if a string is a UUID (v1–v5 shape). Used to detect raw user IDs that
 * leak into the history feed when a peer account has no username (BE falls back
 * to userId for `recipientAccount.identifier`).
 */
export const isUuid = (s: string): boolean => UUID_REGEX.test(s)

/**
 * Checks if a string looks like a Solana address (32-44 alphanumeric characters, no 0)
 * Permissive to handle lowercase-stored addresses
 */
export const isSolanaAddress = (address: string): boolean => {
    return SOLANA_ADDRESS_REGEX.test(address)
}

/**
 * Checks if a string looks like a Tron address (starts with T/t, 34 alphanumeric characters)
 * Permissive to handle lowercase-stored addresses
 */
export const isTronAddress = (address: string): boolean => {
    return TRON_ADDRESS_REGEX.test(address)
}

/**
 * Checks if a string is any valid blockchain address (EVM, Solana, or Tron)
 */
export const isCryptoAddress = (address: string): boolean => {
    return isAddress(address) || isSolanaAddress(address) || isTronAddress(address)
}

export const printableAddress = (address: string, firstCharsLen?: number, lastCharsLen?: number): string => {
    if (!isCryptoAddress(address)) return address
    return shortenStringLong(address, undefined, firstCharsLen, lastCharsLen)
}

/**
 * Renders a peer handle for the activity feed: shortens crypto addresses and
 * UUID-shaped identifiers (e.g. usernameless Peanut users whose `identifier`
 * arrives as a raw userId), and leaves real usernames untouched.
 */
export const printableUserHandle = (handle: string, firstCharsLen?: number, lastCharsLen?: number): string => {
    if (!handle) return handle
    if (isCryptoAddress(handle) || isUuid(handle)) {
        return shortenStringLong(handle, undefined, firstCharsLen, lastCharsLen)
    }
    return handle
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

// Default matches JSON.parse's own return type so legacy untyped call sites keep compiling.

export const saveToLocalStorage = (key: string, data: unknown, expirySeconds?: number): boolean => {
    if (typeof localStorage === 'undefined') return false
    try {
        // Convert the data to a string before storing it in localStorage
        const serializedData = jsonStringify(data)
        localStorage.setItem(key, serializedData)
        if (expirySeconds) {
            localStorage.setItem(`${key}-expiry`, (new Date().getTime() + expirySeconds * 1000).toString())
        } else {
            localStorage.removeItem(`${key}-expiry`)
        }
        // key is passed as an argument (not interpolated into the format string)
        // so a user-controlled key can't act as a console format string (CodeQL).
        console.log('Saved to localStorage:', key, data)
        return true
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error saving to localStorage:', error)
        return false
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

export const isTestnetChain = (chainId: string) => {
    // viem's chains carry a `testnet: true` flag; fall through to default
    // false for unknown chains so prod paths fail closed (treat as mainnet).
    const all = Object.values(wagmiChains as unknown as Record<string, { id: number; testnet?: boolean }>)
    const chain = all.find((c) => c?.id === Number(chainId))
    return chain?.testnet === true
}

export const areEvmAddressesEqual = (address1: string, address2: string): boolean => {
    if (!isAddress(address1) || !isAddress(address2)) return false
    if (address1.toLowerCase() === NATIVE_TOKEN_PROXY_ADDRESS.toLocaleLowerCase()) address1 = NATIVE_TOKEN_ADDRESS
    if (address2.toLowerCase() === NATIVE_TOKEN_PROXY_ADDRESS.toLocaleLowerCase()) address2 = NATIVE_TOKEN_ADDRESS
    // By using getAddress we are safe from different cases
    // and other address formatting
    return getAddress(address1) === getAddress(address2)
}

export const isAddressZero = (address: string): boolean => {
    return areEvmAddressesEqual(address, NATIVE_TOKEN_ADDRESS)
}

export const isNativeCurrency = (address: string) => {
    if (nativeCurrencyAddresses.includes(address.toLowerCase())) {
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
    /** tracks surprise moment claim count for referral CTA copy (rewards v2). 0=first, 1=second, 2+=normal */
    rewards_surprise_claim_count?: number
    /** Carousel CTAs the user has dismissed, with the ISO timestamp of each dismissal.
     *  Read by useHomeCarouselCTAs to apply a per-CTA cooldown before re-showing.
     *  Legacy shape was `string[]` (permanent dismissal); both are accepted on read. */
    dismissedCarouselCTAs?: string[] | Record<string, string>
    /** Last fully-settled spendable total (smart + Rain), in USDC base units as a
     *  string. DISPLAY-only seed so a cold start paints the previous number instead
     *  of $0 while /rain/cards is in flight or failing — see lastKnownSpendable.ts. */
    lastKnownSpendable?: { units: string; at: number }
    /** ISO timestamp of the last "Remind me later" on the app-migration download prompt. */
    migrationPromptSnoozedAt?: string
    /** ISO timestamp the notifications pre-prompt was dismissed — replaces the
     *  legacy permanent `notifModalClosed` so we can re-ask after a cooldown
     *  during the migration window. */
    notifModalClosedAt?: string
    /** App-review nudge budget (see utils/app-review.ts). `moments` counts
     *  qualifying happy moments seen; `requestedAt` holds the ISO timestamps of
     *  past OS review requests, oldest first. */
    reviewNudge?: { moments: number; requestedAt: string[] }
    /** Dismissal fingerprints (`bridgeTaskDismissalKey`: key|requirement|due)
     *  of the pending Bridge verification tasks the user individually
     *  dismissed on /home. A task that turns blocking or changes substance
     *  gets a new fingerprint and re-surfaces; the tasks always stay
     *  reachable under Profile → Unlocked regions. */
    pendingVerificationTasksDismissed?: string[]
    /** ISO timestamp of a Manteca cap-nudge source-of-funds submission this
     *  device made. Optimistic only: the backend stamps `submittedAt` on the
     *  marker a webhook later, and until it does this is the only thing that
     *  knows the document is already in. Deliberately SHORT-LIVED — see
     *  CAP_NUDGE_SUBMITTED_TTL_MS — so a lost webhook re-offers the upload
     *  rather than hiding it forever, and a genuinely new cap block is never
     *  suppressed by a stale local flag. */
    capNudgeSubmittedAt?: string
}

export const updateUserPreferences = (
    userId: string | undefined,
    partialPrefs: Partial<UserPreferences>
): UserPreferences | undefined => {
    if (!userId) return undefined
    try {
        if (typeof localStorage === 'undefined') return undefined

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
        return undefined
    }
}

export const getUserPreferences = (userId: string | undefined): UserPreferences | undefined => {
    if (!userId) return undefined
    try {
        const storedData = getFromLocalStorage(`${userId}:user-preferences`)
        if (!storedData) return undefined
        return storedData as UserPreferences
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error getting user preferences:', error)
        return undefined
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
    const explorers = supportedPeanutChains.find((detail) => detail.chainId === chainId)?.explorers
    // if the explorers array has blockscout, return the blockscout url, else return the first one
    if (explorers?.find((explorer) => explorer.url.includes('blockscout'))) {
        return explorers?.find((explorer) => explorer.url.includes('blockscout'))?.url
    } else {
        return explorers?.[0].url
    }
}

export function formatDate(date: Date | null | undefined): string {
    // Receipts and timeline rows pass dates that may be missing for paths
    // that haven't reached that lifecycle event yet (e.g. cancelledDate on a
    // not-yet-cancelled link). Return em-dash instead of throwing RangeError.
    if (!date || isNaN(date.getTime())) return '—'
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

/** Gets the token decimals for a given token address and chain ID. */
export function getTokenDecimals(tokenAddress: string, chainId: string): number | undefined {
    return peanutTokenDetails
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
    const chainTokens = peanutTokenDetails.find((c) => c.chainId === chainId)?.tokens
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

    const chainTokens = peanutTokenDetails.find((chain) => chain.chainId === chainId)?.tokens
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
            const { getPublicClient } = await import('@/app/actions/clients')
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
    if (chainId === '0') {
        return 'Solana'
    }
    const chain = Object.entries(wagmiChains).find(([, chain]) => chain.id === Number(chainId))?.[1]
    return chain?.name ?? undefined
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
            type?: string
            user?: {
                username?: string | null
            } | null
        }
        recipientAddress: string
        chainId?: string
        tokenAmount?: string
        tokenSymbol?: string
    } & ({ uuid: string; chargeId?: never } | { uuid?: never; chargeId: string })
): string {
    const { recipientAccount, recipientAddress, chainId, tokenAmount, tokenSymbol, uuid, chargeId } = requestData

    // Prefer the Peanut username whenever a user is linked to the
    // recipient account, regardless of `account.type`. The old check
    // coupled username preference to a specific account-type discriminator
    // and broke whenever the BE returned an `EVM_ADDRESS`/`WALLET_SMART`
    // shape for a recipient who happened to be a Peanut user — every
    // shared link rendered the address slug instead of the handle.
    const username = recipientAccount.user?.username
    const recipient = username || recipientAddress
    const chain = !username && chainId ? `@${chainId}` : ''

    let link = payLinkUrl(`/${recipient}${chain}/`)
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

export function getTokenLogo(tokenSymbol: string): string {
    return TOKEN_LOGOS[tokenSymbol.toUpperCase() as TokenName] ?? ''
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

    return CHAIN_LOGOS[name.toUpperCase() as ChainName] ?? ''
}

export function isStableCoin(tokenSymbol: string): boolean {
    return STABLE_COINS.includes(tokenSymbol.toUpperCase())
}

/*
 * An explicit logout must not leave a post-auth destination behind, and
 * clearing the stored redirect is not enough on its own: emptying the user
 * cache re-runs the (mobile-ui) auth gate, which saves the CURRENT path before
 * bouncing to /setup — and the logout button lives on /profile, so the next
 * account created on this device was redirected onto the previous session's
 * page. The latch outlives the logout call (isLoggingOut flips back before the
 * hard nav completes) and is dropped only if the logout itself failed.
 */
let intentionalLogout = false

export const beginIntentionalLogout = () => {
    intentionalLogout = true
}

export const endIntentionalLogout = () => {
    intentionalLogout = false
}

/**
 * Why a post-auth destination was stored. `deep-link` is an intent of the
 * person who will authenticate — they asked for that page and could not have
 * it yet. `session-end` is merely where some session happened to be standing
 * when it collapsed (logout, revocation, token expiry), which is nobody's
 * intent and belongs to an account that is not necessarily the next one.
 */
export type RedirectOrigin = 'deep-link' | 'session-end'

const REDIRECT_KEY = 'redirect'
const REDIRECT_V2_KEY = 'redirect-v2'
/** Generation-key format used by the immediately preceding deployed build. */
const REDIRECT_RECORD_PREFIX = 'redirect-v2-record:'
/** The generation-key format briefly used by the preceding unreleased build. */
const LEGACY_GENERATION_RECORD_PREFIX = 'redirect-record:'
const REDIRECT_V2_CONSUMED_KEY = 'redirect-v2-consumed'
/** Generation-scoped tombstones prevent stale consumers from overwriting each other. */
const REDIRECT_V2_CONSUMED_PREFIX = 'redirect-v2-consumed:'
const REDIRECT_V2_CONSUMED_FALLBACK_PREFIX = 'redirect-v2-consumed-fallback:'
const REDIRECT_V2_CONSUMED_RESERVE_VALUE = '0'
/**
 * Legacy bare-path records cannot be deleted conditionally without the same
 * check/remove race. Remembering their consumed value makes them inert while
 * allowing every new generation (stored through setRedirectUrl) to replace
 * the pointer safely.
 */
const LEGACY_REDIRECT_CONSUMED_KEY = 'redirect-consumed-legacy'

/**
 * `redirect-v2` is the authoritative, self-contained generation payload,
 * while `redirect` remains a v1-readable destination handoff. Publishing the
 * v2 payload is one localStorage write; the v1 mirror is written only after
 * that succeeds. Once a valid v2 payload exists, it has explicit precedence
 * over the legacy mirror, so a failed mirror write cannot make an old value
 * win. Each generation reserves its own primary and fallback consumption
 * slots before publication, and consumed slots for older generations are
 * reclaimed after the pointer moves so the journal stays bounded.
 *
 * A record stored by a version that had no origin (a plain string) reads back
 * as unclassified rather than as intent: see consumePostAuthRedirect for what
 * a brand-new account does with one.
 */
export type StoredRedirect = {
    destination: string
    origin: RedirectOrigin | null
    generationId: string | null
    generationKey?: string
    legacyIdentity?: string
    supersededGenerationId?: string
}

const parseStoredRedirect = (
    stored: unknown,
    generationId: string | null,
    generationKey?: string,
    legacyIdentity?: string
): StoredRedirect | null => {
    if (typeof stored === 'string') {
        return stored.length > 0
            ? {
                  destination: stored,
                  origin: null,
                  generationId,
                  generationKey,
                  legacyIdentity,
              }
            : null
    }
    if (stored && typeof stored === 'object') {
        const { destination, origin } = stored as Partial<StoredRedirect>
        if (typeof destination !== 'string' || destination.length === 0) return null
        return {
            destination,
            origin: origin === 'session-end' || origin === 'deep-link' ? origin : null,
            generationId,
            generationKey,
            legacyIdentity,
        }
    }
    return null
}

const isRedirectGenerationId = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value)

const createRedirectGenerationId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

type RedirectPointer = {
    version: 2
    generationId: string
    destination: string
    origin?: RedirectOrigin
    /** The legacy mirror observed before this generation was published. */
    legacyMirror?: string | null
}

const isRedirectPointer = (stored: unknown): stored is RedirectPointer =>
    !!stored &&
    typeof stored === 'object' &&
    (stored as Partial<RedirectPointer>).version === 2 &&
    isRedirectGenerationId((stored as Partial<RedirectPointer>).generationId) &&
    typeof (stored as Partial<RedirectPointer>).destination === 'string'

const getLegacyIdentity = (stored: unknown): string | undefined =>
    stored === undefined ? undefined : jsonStringify(stored)

const parseLegacyRedirect = (stored: unknown): StoredRedirect | null => {
    if (stored && typeof stored === 'object') {
        const { generationId } = stored as Partial<StoredRedirect>
        if (isRedirectGenerationId(generationId)) {
            for (const prefix of [REDIRECT_RECORD_PREFIX, LEGACY_GENERATION_RECORD_PREFIX]) {
                const generationKey = `${prefix}${generationId}`
                const parsed = parseStoredRedirect(getFromLocalStorage(generationKey), generationId, generationKey)
                if (parsed) return parsed
            }
        }
    }

    const legacyIdentity = getLegacyIdentity(stored)
    if (legacyIdentity && getFromLocalStorage(LEGACY_REDIRECT_CONSUMED_KEY) === legacyIdentity) return null
    return parseStoredRedirect(stored, null, undefined, legacyIdentity)
}

const getStoredRedirectForSnapshot = (): StoredRedirect | null => {
    let pointer = getFromLocalStorage(REDIRECT_V2_KEY)
    while (isRedirectPointer(pointer)) {
        const { generationId, destination } = pointer as RedirectPointer
        let generated: StoredRedirect | null = null

        // Read records from the two transitional generation-key formats so a
        // state written by the preceding build keeps its provenance. Current
        // v2 payloads are self-contained and do not need a secondary read.
        const pointerOrigin = (pointer as Partial<RedirectPointer>).origin
        if (pointerOrigin !== 'session-end' && pointerOrigin !== 'deep-link') {
            for (const prefix of [REDIRECT_RECORD_PREFIX, LEGACY_GENERATION_RECORD_PREFIX]) {
                const generationKey = `${prefix}${generationId}`
                generated = parseStoredRedirect(getFromLocalStorage(generationKey), generationId, generationKey)
                if (generated) break
            }
        }
        generated ??= parseStoredRedirect(pointer, generationId)

        const legacyMirror = (pointer as Partial<RedirectPointer>).legacyMirror
        const hasLegacyMirror = Object.prototype.hasOwnProperty.call(pointer, 'legacyMirror')
        const legacyValue = hasLegacyMirror ? getFromLocalStorage(REDIRECT_KEY) : null
        if (
            hasLegacyMirror &&
            typeof legacyValue === 'string' &&
            legacyValue.length > 0 &&
            legacyValue !== destination &&
            legacyValue !== legacyMirror
        ) {
            const refreshedPointer = getFromLocalStorage(REDIRECT_V2_KEY)
            if (!isRedirectPointer(refreshedPointer)) {
                return parseLegacyRedirect(getFromLocalStorage(REDIRECT_KEY))
            }
            if (refreshedPointer.generationId !== generationId) {
                pointer = refreshedPointer
                continue
            }
            // A pre-deploy v1 tab can still publish a new handoff. The
            // baseline distinguishes that from a stale mirror left behind by
            // a failed v2 -> v1 mirror write.
            const legacy = parseLegacyRedirect(legacyValue)
            if (legacy) return { ...legacy, supersededGenerationId: generationId }
            // This legacy handoff was already consumed. It superseded the
            // v2 generation, so do not resurrect that older destination.
            return null
        }

        const consumed = getFromLocalStorage(REDIRECT_V2_CONSUMED_KEY)
        const generationConsumed = getFromLocalStorage(`${REDIRECT_V2_CONSUMED_PREFIX}${generationId}`)
        const fallbackGenerationConsumed = getFromLocalStorage(`${REDIRECT_V2_CONSUMED_FALLBACK_PREFIX}${generationId}`)
        if (
            generationConsumed === '1' ||
            fallbackGenerationConsumed === '1' ||
            (isRedirectGenerationId(consumed) && consumed === generationId) ||
            (consumed &&
                typeof consumed === 'object' &&
                (consumed as Partial<RedirectPointer>).generationId === generationId)
        ) {
            return null
        }
        return generated
    }

    return parseLegacyRedirect(getFromLocalStorage(REDIRECT_KEY))
}

export const getStoredRedirect = (): StoredRedirect | null => getStoredRedirectForSnapshot()

const reserveRedirectConsumptionCapacity = (generationId: string): boolean => {
    if (typeof localStorage === 'undefined') return false
    const primaryKey = `${REDIRECT_V2_CONSUMED_PREFIX}${generationId}`
    const fallbackKey = `${REDIRECT_V2_CONSUMED_FALLBACK_PREFIX}${generationId}`
    const primaryReserved =
        getFromLocalStorage(primaryKey) !== null || saveToLocalStorage(primaryKey, REDIRECT_V2_CONSUMED_RESERVE_VALUE)
    const fallbackReserved =
        getFromLocalStorage(fallbackKey) !== null || saveToLocalStorage(fallbackKey, REDIRECT_V2_CONSUMED_RESERVE_VALUE)
    return primaryReserved && fallbackReserved
}

const markRedirectConsumed = (generationId: string): boolean => {
    const primaryKey = `${REDIRECT_V2_CONSUMED_PREFIX}${generationId}`
    const fallbackKey = `${REDIRECT_V2_CONSUMED_FALLBACK_PREFIX}${generationId}`
    if (saveToLocalStorage(primaryKey, '1')) return true
    return saveToLocalStorage(fallbackKey, '1')
}

const reclaimRedirectConsumptionSlots = () => {
    if (typeof localStorage === 'undefined') return

    const pointer = getFromLocalStorage(REDIRECT_V2_KEY)
    const initiallyReachableGenerationId = isRedirectPointer(pointer) ? pointer.generationId : null
    const reclaimableGenerationIds = new Set<string>()

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index)
        if (!key) continue

        let generationId: string | null = null
        if (key.startsWith(REDIRECT_V2_CONSUMED_PREFIX)) {
            generationId = key.slice(REDIRECT_V2_CONSUMED_PREFIX.length)
        } else if (key.startsWith(REDIRECT_V2_CONSUMED_FALLBACK_PREFIX)) {
            generationId = key.slice(REDIRECT_V2_CONSUMED_FALLBACK_PREFIX.length)
        }
        if (!generationId || !isRedirectGenerationId(generationId)) continue

        const value = getFromLocalStorage(key)
        if (value === '0' || value === '1') reclaimableGenerationIds.add(generationId)
    }

    const refreshedPointer = getFromLocalStorage(REDIRECT_V2_KEY)
    const refreshedReachableGenerationId = isRedirectPointer(refreshedPointer) ? refreshedPointer.generationId : null
    if (refreshedReachableGenerationId !== initiallyReachableGenerationId) return

    for (const generationId of reclaimableGenerationIds) {
        if (generationId === refreshedReachableGenerationId) continue
        localStorage.removeItem(`${REDIRECT_V2_CONSUMED_PREFIX}${generationId}`)
        localStorage.removeItem(`${REDIRECT_V2_CONSUMED_FALLBACK_PREFIX}${generationId}`)
    }
}

/** The ONLY way to store a post-auth destination. */
export const setRedirectUrl = (destination: string, origin: RedirectOrigin = 'deep-link') => {
    const generationId = createRedirectGenerationId()
    if (!reserveRedirectConsumptionCapacity(generationId)) return
    const previousLegacy = getFromLocalStorage(REDIRECT_KEY)
    const legacyMirror = typeof previousLegacy === 'string' ? previousLegacy : null
    const published = saveToLocalStorage(REDIRECT_V2_KEY, {
        version: 2,
        generationId,
        destination,
        origin,
        legacyMirror,
    })
    // Keep the v1 handoff readable for documents that predate this change, but
    // never publish a mirror that has no authoritative v2 payload behind it.
    if (published) saveToLocalStorage(REDIRECT_KEY, destination)
    reclaimRedirectConsumptionSlots()
}

export const saveRedirectUrl = (origin: RedirectOrigin = 'deep-link') => {
    if (intentionalLogout) return
    const currentUrl = new URL(window.location.href)
    setRedirectUrl(currentUrl.href.replace(currentUrl.origin, ''), origin)
}

export const getRedirectUrl = (): string | null => {
    return getStoredRedirect()?.destination ?? null
}

/** `null` for a record written before the origin existed — unclassified, not intent. */
export const getRedirectOrigin = (): RedirectOrigin | null => {
    return getStoredRedirect()?.origin ?? null
}

/**
 * Clear the stored redirect, optionally only if it is still the snapshot a
 * caller consumed. Current v2 generations are marked consumed instead of
 * removing the shared pointer, so a newer same-origin generation survives.
 * Records from the two transitional generation-key formats are still removed
 * by their immutable key.
 */
export const clearRedirectUrl = (expected?: StoredRedirect | null) => {
    if (typeof localStorage !== 'undefined') {
        const current = expected === undefined ? getStoredRedirect() : expected
        if (!current) return

        if (current.generationKey) {
            localStorage.removeItem(current.generationKey)
        }
        const generationsToConsume = [current.generationId, current.supersededGenerationId].filter(
            (generationId): generationId is string => !!generationId
        )
        for (const generationId of new Set(generationsToConsume)) markRedirectConsumed(generationId)
        if (generationsToConsume.length > 0) reclaimRedirectConsumptionSlots()

        if (current.legacyIdentity) {
            saveToLocalStorage(LEGACY_REDIRECT_CONSUMED_KEY, current.legacyIdentity)
        }
    }
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

/**
 * Canonical invite-code shape: a bare, lowercased username (e.g. `alice`).
 *
 * Single source of truth — use this anywhere an invite code is built for
 * `/invite?code=…` or `acceptInvite`. The legacy `ALICEINVITESYOU610` /
 * `ALICEINVITESYOU` shapes are no longer emitted, but stay fully supported on
 * the backend (peanut-api-ts `extractUsernameFromInvite` uppercases the input
 * and matches the old suffixes), so existing shared links keep working.
 *
 * Also tolerates hand-typed input ("Who invited you?" asks for a username, so
 * people paste `@alice ` or ` Alice`): trims whitespace and strips a leading @.
 */
export { toInviteCode }
export { jsonStringify, jsonParse, saveToCookie, getFromCookie, sanitizeRedirectURL } from '@/utils/cookie-url.utils'

/**
 * invite-flow url for a guest CTA. web routes to the /invite landing page; in
 * the native export that page is pruned (scripts/native-build.js), so write
 * signup directly. Pure URL builder: the caller stashes the invite first via
 * stashInvite (every caller knows the TRUE invite type; this function used to
 * write a code-only cookie, which could leave a stale type behind — Chip
 * review, PR #2949).
 */
export const inviteFlowUrl = (inviteCode: string, redirectUri: string): string => {
    if (!isCapacitor()) return `/invite?code=${inviteCode}&redirect_uri=${redirectUri}`
    return `/setup?step=signup&redirect_uri=${redirectUri}`
}

export const generateInviteCodeLink = (username: string) => {
    const inviteCode = toInviteCode(username)
    const inviteLink = shareableUrl(`/invite?code=${inviteCode}`)
    return { inviteLink, inviteCode }
}

/**
 * Extract invitee name from perk reason string.
 * Perk reasons follow the format: "Username became a Card Pioneer! (payment: uuid)"
 *
 * @param reason - The perk reason string
 * @param fallback - Fallback name if extraction fails (default: 'Your friend')
 * @returns The extracted invitee name or fallback
 */
export const extractInviteeName = (reason: string | undefined | null, fallback = 'Your friend'): string => {
    if (!reason) return fallback
    // Rewards v2: "Alice just used Peanut. You earned $0.66."
    const justUsedMatch = reason.match(/^(.+?) just used Peanut/)
    if (justUsedMatch) return justUsedMatch[1]
    // Legacy: "Alice became a Pioneer"
    const becameMatch = reason.match(/^(.+?) became/)
    if (becameMatch) return becameMatch[1]
    return fallback
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
    return charges
        .map((charge) => {
            // Only a SUCCESSFUL payment makes someone a contributor. Taking the
            // last payment regardless of status surfaced failed payers and
            // inflated the "Contributors (N)" count — the BE collected total
            // counts successful payments only, so this must match.
            const successfulPayment = charge.payments.filter((p) => p.status === 'SUCCESSFUL').at(-1)
            if (!successfulPayment) return null
            // Prefer the Peanut handle whenever the payer has a linked user,
            // regardless of account.type. Falls back to the raw on-chain
            // identifier for anonymous on-chain contributors.
            const payerAccount = successfulPayment.payerAccount
            const username = payerAccount?.user?.username || payerAccount?.identifier
            const isPeanutUser = !!payerAccount?.user?.username

            return {
                uuid: charge.uuid,
                payments: charge.payments,
                amount: charge.tokenAmount,
                username,
                fulfillmentPayment: charge.fulfillmentPayment,
                // FOLLOW-UP (tracked, not in this PR pair): the charges/payments BE flow
                // still returns raw `bridgeKycStatus` on Payment.payerAccount.user. The
                // user endpoints (/users/:userId, /users/username/:username,
                // /users/contacts) all migrated to a BE-computed `isVerified` boolean;
                // bringing the charges flow along requires a focused refactor (project at
                // intentToCharge + fetchPayerAccounts; change mutation patterns in
                // charge/service.ts to immutable response building). Scoped separately.
                isUserVerified: payerAccount?.user?.bridgeKycStatus === 'approved',
                isPeanutUser,
            }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
}
