import { IRequestLinkData } from '@/components/Request/Pay/Pay.consts'
import * as consts from '@/constants'
import { infuraApiKey } from '@/constants'
import * as interfaces from '@/interfaces'
import { JustaName, sanitizeRecords } from '@justaname.id/sdk'
import peanut from '@squirrel-labs/peanut-sdk'
import chroma from 'chroma-js'
import { ethers } from 'ethers'
import { SiweMessage } from 'siwe'
import * as wagmiChains from 'wagmi/chains'

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

export const backgroundColorFromAddress = (address: string): string => {
    // Hash the Ethereum address to a number
    const hash = Array.from(address).reduce((acc, char) => acc + char.charCodeAt(0), 0)

    const choices = Object.values(colorMap)

    // Generate color with a lightness range to avoid dark colors
    const colorScale = chroma.scale(choices).mode('lab').domain([0, 255])

    // Get color from scale
    return colorScale(hash % 255).hex()
}

export const shortenAddress = (address?: string) => {
    if (!address) return ''
    const firstBit = address.substring(0, 6)

    return firstBit + '..'
}

export const shortenAddressLong = (address?: string, chars?: number): string => {
    if (!address) return ''
    if (!chars) chars = 6
    const firstBit = address.substring(0, chars)
    const endingBit = address.substring(address.length - chars, address.length)

    return firstBit + '...' + endingBit
}

export const printableAddress = (address: string): string => {
    if (validateEnsName(address)) return address
    return shortenAddressLong(address)
}

export const validateEnsName = (ensName: string = ''): boolean => {
    return /(?:^|[^a-zA-Z0-9-_.])(([^\s.]{1,63}\.)+[^\s.]{2,63})/.test(ensName)
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

export const saveToLocalStorage = (key: string, data: any) => {
    if (typeof localStorage === 'undefined') return
    try {
        // Convert the data to a string before storing it in localStorage
        const serializedData = jsonStringify(data)
        localStorage.setItem(key, serializedData)
        console.log(`Saved ${key} to localStorage:`, data)
    } catch (error) {
        console.error('Error saving to localStorage:', error)
    }
}

export const getFromLocalStorage = (key: string) => {
    if (typeof localStorage === 'undefined') return
    try {
        const data = localStorage.getItem(key)
        if (data === null) {
            console.log(`No data found in localStorage for ${key}`)
            return null
        }
        const parsedData = jsonParse(data)
        console.log(`Retrieved ${key} from localStorage:`, parsedData)
        return parsedData
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const getAllLinksFromLocalStorage = ({ address }: { address: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const localStorageData: interfaces.ILocalStorageItem[] = []

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)

            if (key === `${address} - created links` || key === `${address} - claimed links`) {
            } else if (key !== null && key?.includes(address)) {
                const value = localStorage.getItem(key)
                if (
                    value !== null &&
                    !key.includes('- raffle -') &&
                    !key.includes('saving giga-link for address:') &&
                    !key.includes('saving temp') &&
                    value.includes('/claim')
                ) {
                    const x = {
                        address: key.split('-')[0].trim(),
                        hash: key.split('-')[1]?.trim() ?? '',
                        idx: key.split('-')[2]?.trim() ?? '',
                        link: value.replaceAll('"', ''),
                    }
                    localStorageData.push(x)
                }
            }
        }
        return localStorageData
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const getAllRaffleLinksFromLocalstorage = ({ address }: { address: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const localStorageData: interfaces.ILocalStorageItem[] = []

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)

            if (key === `${address} - created links` || key === `${address} - claimed links`) return
            if (key !== null && key?.includes(address)) {
                const value = localStorage.getItem(key)

                if (
                    value !== null &&
                    (key.includes('- raffle -') ||
                        value.includes('/packet') ||
                        key.includes('giga-link') ||
                        key.includes('gigalink')) &&
                    !key.includes('saving giga-link for address:') &&
                    !key.includes('saving temp')
                ) {
                    if (key.includes('- raffle - ')) {
                        localStorageData.push({
                            address: key.split('-')[0].trim(),
                            hash: key.split('-')[2]?.trim() ?? '',
                            idx: '0',
                            link: value.replaceAll('"', ''),
                        })
                    } else if (key.includes('giga-link')) {
                        const startIndex = key.indexOf('0x')
                        if (startIndex === -1) {
                            return
                        }

                        let endIndex = key.indexOf(' ', startIndex)
                        if (endIndex === -1) {
                            endIndex = key.length
                        }
                        const address = key.substring(startIndex, endIndex)

                        localStorageData.push({
                            address: address,
                            hash: '',
                            idx: '0',
                            link: value.replaceAll('"', ''),
                        })
                    } else if (key.includes('gigalink')) {
                        const v = JSON.parse(value)

                        if (v.completed) {
                            localStorageData.push({
                                address: key.split('-')[0].trim(),
                                hash: key.split('-')[2]?.trim() ?? '',
                                idx: '0',
                                link: v.finalLink,
                            })
                        }
                    } else if (value.includes('/packet')) {
                        const x = {
                            address: key.split('-')[0].trim(),
                            hash: key.split('-')[1]?.trim() ?? '',
                            idx: '',
                            link: value.replaceAll('"', ''),
                        }
                        localStorageData.push(x)
                    }
                }
            }
        }
        return localStorageData
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export function formatAmountWithDecimals({ amount, decimals }: { amount: number; decimals: number }) {
    const divider = 10 ** decimals
    const formattedAmount = amount / divider
    return formattedAmount
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
    let fractionDigits = Math.floor(Math.log10(1 / amount)) + significantDigits
    fractionDigits = fractionDigits < 0 ? 0 : fractionDigits
    return amount.toFixed(fractionDigits)
}

export function formatTokenAmount(amount?: number, maxFractionDigits?: number) {
    if (amount === undefined) return undefined
    maxFractionDigits = maxFractionDigits ?? 6

    // Convert number to string to count significant digits
    const amountString = amount.toFixed(maxFractionDigits)
    const significantDigits = amountString.replace(/^0+\./, '').replace(/\.$/, '').replace(/0+$/, '').length

    // Calculate the number of fraction digits needed to have at least two significant digits
    const fractionDigits = Math.max(2 - significantDigits, 0)

    // Format the number with the calculated fraction digits
    const formattedAmount = amount.toLocaleString('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: maxFractionDigits,
    })
    return formattedAmount
}

export const formatAmountWithoutComma = (input: string) => {
    const numericValue = input.replace(/,/g, '.')
    const regex = new RegExp(`^[0-9]*\\.?[0-9]*$`)
    if (numericValue === '' || regex.test(numericValue)) {
        return numericValue
    } else return ''
}

export async function resolveFromEnsNameAndProviderUrl(
    ensName: string,
    providerUrl?: string
): Promise<string | undefined> {
    try {
        const records = await JustaName.init().subnames.getRecords({
            ens: ensName,
            chainId: 1,
            providerUrl,
        })

        return sanitizeRecords(records).ethAddress.value
    } catch (error) {
        return undefined
    }
}

export async function resolveFromEnsName(ensName: string): Promise<string | undefined> {
    const mainProviderUrl = 'https://mainnet.infura.io/v3/' + infuraApiKey
    const fallbackProviderUrl = 'https://rpc.ankr.com/eth'

    try {
        const records = await JustaName.init().subnames.getRecords({
            ens: ensName,
            chainId: 1,
            providerUrl: mainProviderUrl,
        })

        return records?.records?.coins?.find((coin) => coin.id === 60)?.value
    } catch (error) {
        console.error('Error resolving ENS name with main provider:', error)
        try {
            const records = await JustaName.init().subnames.getRecords({
                ens: ensName,
                chainId: 1,
                providerUrl: fallbackProviderUrl,
            })

            return records?.records?.coins?.find((coin) => coin.id === 60)?.value
        } catch (fallbackError) {
            console.error('Error resolving ENS name with fallback provider:', fallbackError)
            return undefined
        }
    }
}

export async function copyTextToClipboardWithFallback(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text)
            return
        } catch (err) {
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
    if (address1.toLowerCase() === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLocaleLowerCase())
        address1 = ethers.constants.AddressZero
    if (address2.toLowerCase() === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLocaleLowerCase())
        address2 = ethers.constants.AddressZero
    // By using ethers.getAddress we are safe from different cases
    // and other address formatting
    return ethers.utils.getAddress(address1) === ethers.utils.getAddress(address2)
}

export const isAddressZero = (address: string): boolean => {
    return areEvmAddressesEqual(address, ethers.constants.AddressZero)
}

export const isNativeCurrency = (address: string) => {
    if (consts.nativeCurrencyAddresses.includes(address.toLowerCase())) {
        return true
    } else return false
}

export const saveClaimedLinkToLocalStorage = ({
    address,
    data,
}: {
    address: string
    data: interfaces.IExtendedLinkDetails
}) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `${address} - claimed links`

        const storedData = localStorage.getItem(key)

        let dataArr: interfaces.IExtendedLinkDetails[] = []
        if (storedData) {
            dataArr = JSON.parse(storedData) as interfaces.IExtendedLinkDetails[]
        }

        dataArr.push(data)

        localStorage.setItem(key, JSON.stringify(dataArr))

        console.log('Saved claimed link to localStorage:', data)
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
}

export const saveOfframpLinkToLocalstorage = ({ data }: { data: interfaces.IExtendedLinkDetailsOfframp }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `offramped links`

        const storedData = localStorage.getItem(key)

        let dataArr: interfaces.IExtendedLinkDetailsOfframp[] = []
        if (storedData) {
            dataArr = JSON.parse(storedData) as interfaces.IExtendedLinkDetailsOfframp[]
        }

        dataArr.push(data)

        localStorage.setItem(key, JSON.stringify(dataArr))

        console.log('Saved claimed link to localStorage:', data)
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
}

export const getClaimedLinksFromLocalStorage = ({ address = undefined }: { address?: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        let storedData
        if (address) {
            const key = `${address} - claimed links`
            storedData = localStorage.getItem(key)
        } else {
            const partialKey = 'claimed links'
            const matchingItems = []

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.includes(partialKey)) {
                    const item = localStorage.getItem(key)
                    if (!item) break
                    const value = JSON.parse(item)
                    matchingItems.push(...value)
                }
            }
            storedData = JSON.stringify(matchingItems)
        }

        let data: interfaces.IExtendedLinkDetails[] = []
        if (storedData) {
            data = JSON.parse(storedData) as interfaces.IExtendedLinkDetails[]
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const saveCreatedLinkToLocalStorage = ({
    address,
    data,
}: {
    address: string
    data: interfaces.IExtendedPeanutLinkDetails
}) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `${address} - created links`

        const storedData = localStorage.getItem(key)

        let dataArr: interfaces.IExtendedPeanutLinkDetails[] = []
        if (storedData) {
            dataArr = JSON.parse(storedData) as interfaces.IExtendedPeanutLinkDetails[]
        }

        dataArr.push(data)

        localStorage.setItem(key, JSON.stringify(dataArr))

        console.log('Saved created link to localStorage:', data)
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
}

export const getCreatedLinksFromLocalStorage = ({ address = undefined }: { address?: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        let storedData
        if (address) {
            const key = `${address} - created links`
            storedData = localStorage.getItem(key)
        } else {
            const partialKey = 'created links'
            const matchingItems = []

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.includes(partialKey)) {
                    const item = localStorage.getItem(key)
                    if (!item) break
                    const value = JSON.parse(item)
                    matchingItems.push(...value)
                }
            }
            storedData = JSON.stringify(matchingItems)
        }

        let data: interfaces.IExtendedPeanutLinkDetails[] = []
        if (storedData) {
            data = JSON.parse(storedData) as interfaces.IExtendedPeanutLinkDetails[]
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const saveDirectSendToLocalStorage = ({
    address,
    data,
}: {
    address: string
    data: interfaces.IDirectSendDetails
}) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `${address} - direct sends`

        const storedData = localStorage.getItem(key)

        let dataArr: interfaces.IDirectSendDetails[] = []
        if (storedData) {
            dataArr = JSON.parse(storedData) as interfaces.IDirectSendDetails[]
        }

        dataArr.push(data)

        localStorage.setItem(key, JSON.stringify(dataArr))

        console.log('Saved direct send to localStorage:', data)
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
}

export const getDirectSendFromLocalStorage = ({ address = undefined }: { address?: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        let storedData
        if (address) {
            const key = `${address} - direct sends`
            storedData = localStorage.getItem(key)
        } else {
            const partialKey = 'direct sends'
            const matchingItems = []

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.includes(partialKey)) {
                    const item = localStorage.getItem(key)
                    if (!item) break
                    const value = JSON.parse(item)
                    matchingItems.push(...value)
                }
            }
            storedData = JSON.stringify(matchingItems)
        }

        let data: interfaces.IDirectSendDetails[] = []
        if (storedData) {
            data = JSON.parse(storedData) as interfaces.IDirectSendDetails[]
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const getOfframpClaimsFromLocalStorage = () => {
    try {
        if (typeof localStorage === 'undefined') return

        let storedData

        const key = `offramped links`
        storedData = localStorage.getItem(key)

        let data: interfaces.IExtendedLinkDetailsOfframp[] = []
        if (storedData) {
            data = JSON.parse(storedData) as interfaces.IExtendedLinkDetailsOfframp[]
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export type UserPreferences = {
    lastUsedToken?: {
        chainId: string
        address: string
        decimals: number
    }
    lastSelectedWallet?: {
        address: string
    }
    lastFocusedWallet?: {
        address: string
    }
    balanceHidden?: boolean
}

export const updateUserPreferences = (partialPrefs: Partial<UserPreferences>): UserPreferences | undefined => {
    try {
        if (typeof localStorage === 'undefined') return

        const currentPrefs = getUserPreferences() || {}
        const newPrefs: UserPreferences = {
            ...currentPrefs,
            ...partialPrefs,
        }

        localStorage.setItem('user-preferences', JSON.stringify(newPrefs))
        return newPrefs
    } catch (error) {
        console.error('Error updating user preferences:', error)
    }
}

export const getUserPreferences = (): UserPreferences | undefined => {
    try {
        if (typeof localStorage === 'undefined') return

        const storedData = localStorage.getItem('user-preferences')
        if (!storedData) return undefined

        return JSON.parse(storedData) as UserPreferences
    } catch (error) {
        console.error('Error getting user preferences:', error)
    }
}

export const checkifImageType = (type: string) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
    if (imageTypes.includes(type)) return true
    else return false
}

export const estimateStableCoin = (tokenPrice: number) => {
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

export const shareToEmail = (email: string, link: string, usdAmount?: string) => {
    if (usdAmount) usdAmount = formatTokenAmount(parseFloat(usdAmount), 2)
    const encodedSubject = encodeURIComponent('Money inside!')
    const encodedBody = encodeURIComponent(
        usdAmount
            ? `You have received $${usdAmount}! Click the link to claim: ${link}`
            : `You received money! Click the link to claim: ${link}`
    )
    const mailtoUrl = `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`
    if (typeof window !== 'undefined') {
        window.location.href = mailtoUrl
    }
}

export const shareToSms = (phone: string, link: string, usdAmount?: string) => {
    if (usdAmount) usdAmount = formatTokenAmount(parseFloat(usdAmount), 2)
    const message = encodeURIComponent(
        usdAmount
            ? `You have received $${usdAmount}! Click the link to claim: ${link}`
            : `You received money! Click the link to claim: ${link}`
    )
    const sms = `sms:${phone}?body=${message}`
    if (typeof window !== 'undefined') {
        window.location.href = sms
    }
}

export function isNumeric(input: string): boolean {
    const numericRegex = /^[0-9]+$/
    return numericRegex.test(input)
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

export async function rankAddressesByInteractions(portfolios: Portfolio[]) {
    const addressInteractions: any = {}

    portfolios.forEach((portfolio) => {
        portfolio.assetActivities.forEach((activity) => {
            const { to, from, type } = activity.details
            const { timestamp } = activity

            if (!addressInteractions[to]) {
                addressInteractions[to] = { count: 0, mostRecentInteraction: timestamp }
            }
            addressInteractions[to].count += 1
            if (timestamp > addressInteractions[to].mostRecentInteraction) {
                addressInteractions[to].mostRecentInteraction = timestamp
            }
        })
    })

    const rankedAddresses = Object.entries(addressInteractions) //@ts-ignore
        .map(([address, { count, mostRecentInteraction }]) => ({ address, count, mostRecentInteraction }))
        .sort((a, b) => b.mostRecentInteraction - a.mostRecentInteraction)

    return rankedAddresses
}

export function formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0') // JavaScript months are zero-indexed
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`
}

export const createSiweMessage = ({ address, statement }: { address: string; statement: string }) => {
    const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement,
        uri: window.location.origin,
        version: '1',
        chainId: 1,
    })

    return message.prepareMessage()
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
            throw new Error('Error switching network.')
        }
    }
}

/**
 * Gets the token symbol for a given token address and chain ID.
 *
 * From the sdk token list, if you need to be sure to get a token symbol you
 * should use the {@link fetchTokenSymbol} function.
 *
 * @returns The token symbol, or undefined if not found.
 */
export function getTokenSymbol(tokenAddress: string, chainId: string): string | undefined {
    return consts.peanutTokenDetails
        .find((chain) => chain.chainId === chainId)
        ?.tokens.find((token) => areEvmAddressesEqual(token.address, tokenAddress))
        ?.symbol?.toUpperCase()
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
            const contract = await peanut.getTokenContractDetails({
                address: tokenAddress,
                provider: await peanut.getDefaultProvider(chainId),
            })
            tokenSymbol = contract?.symbol?.toUpperCase()
        } catch (error) {
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
    return consts.pathTitles[pathname] || 'Peanut Protocol' // default title if path not found
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
export const formatExtendedNumber = (amount: string | number): string => {
    // Handle null/undefined/invalid inputs
    if (!amount && amount !== 0) return '0'

    // Validate input type and convert to number
    const num = typeof amount === 'string' ? parseFloat(amount) : amount

    // Check for NaN values
    if (isNaN(num)) return '0'

    // Count total digits by removing decimal point and negative sign
    const totalDigits = amount.toString().replace(/[.-]/g, '').length

    // If 6 or fewer digits, just use formatAmount
    if (totalDigits <= 6) {
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
