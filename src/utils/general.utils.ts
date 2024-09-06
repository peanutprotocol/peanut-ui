import * as interfaces from '@/interfaces'
import * as consts from '@/constants'
import peanut, { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { exportTraceState } from 'next/dist/trace'

export const shortenAddress = (address: string) => {
    const firstBit = address.substring(0, 6)

    return firstBit + '..'
}

export const shortenAddressLong = (address: string, chars?: number) => {
    if (!address) return
    if (!chars) chars = 6
    const firstBit = address.substring(0, chars)
    const endingBit = address.substring(address.length - chars, address.length)

    return firstBit + '...' + endingBit
}

export const shortenHash = (address: string) => {
    if (!address) return
    const firstBit = address.substring(0, 8)
    const endingBit = address.substring(address.length - 6, address.length)

    return firstBit + '...' + endingBit
}

export function waitForPromise<T>(promise: Promise<T>, timeoutTime: number = 30000): Promise<T> {
    return new Promise((resolve, reject) => {
        let timeoutId = setTimeout(() => {
            reject('Timeout: 30 seconds have passed without a response from the promise')
        }, timeoutTime)

        promise
            .then((result) => {
                clearTimeout(timeoutId)
                resolve(result)
            })
            .catch((error) => {
                clearTimeout(timeoutId)
                reject(error)
            })
    })
}

export const saveToLocalStorage = (key: string, data: any) => {
    try {
        // Convert the data to a string before storing it in localStorage
        const serializedData = JSON.stringify(data)
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(key, serializedData)
        console.log(`Saved ${key} to localStorage:`, data)
    } catch (error) {
        console.error('Error saving to localStorage:', error)
    }
}

export const getFromLocalStorage = (key: string) => {
    try {
        if (typeof localStorage === 'undefined') return
        const data = localStorage.getItem(key)
        if (data === null) {
            console.log(`No data found in localStorage for ${key}`)
            return null
        }
        const parsedData = JSON.parse(data)
        console.log(`Retrieved ${key} from localStorage:`, parsedData)
        return parsedData
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const delteFromLocalStorage = (key: string) => {
    try {
        if (typeof localStorage === 'undefined') return
        localStorage.removeItem(key)
        console.log(`Removed ${key} from localStorage`)
    } catch (error) {
        console.error('Error removing from localStorage:', error)
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

export const getAllGigalinksFromLocalstorage = ({ address }: { address: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const localStorageData: interfaces.ILocalStorageItem[] = []

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)

            if (key !== null && key?.includes('saving giga-link for address: ' + address)) {
                const value = localStorage.getItem(key)
                if (value !== null) {
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

export function formatAmountWithDecimals({ amount, decimals }: { amount: number; decimals: number }) {
    const divider = 10 ** decimals
    const formattedAmount = amount / divider
    return formattedAmount
}

export function formatAmount(amount: number) {
    return amount.toFixed(2)
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

export function formatMessage(message: string) {
    return message
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !!line)
        .join('\n')
}

export const isMantleInUrl = (): boolean => {
    if (typeof window !== 'undefined') {
        return window.location.origin.includes('mantle') ? true : false
    } else {
        return false
    }
}

export async function resolveFromEnsName(ensName: string): Promise<string | undefined> {
    const provider = await peanut.getDefaultProvider('1')
    const x = await provider.resolveName(ensName)

    return x ? x : undefined
}

export function generateSafeUrl({ currentUrl, chainId }: { currentUrl: string; chainId: number }) {
    return `https://app.safe.global/share/safe-app?appUrl=${encodeURIComponent(currentUrl)}&chain=${chainId}`
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

export const compareTokenAddresses = (address1: string, address2: string) => {
    if (address1.toLowerCase() === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLocaleLowerCase())
        address1 = '0x0000000000000000000000000000000000000000'
    if (address2.toLowerCase() === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLocaleLowerCase())
        address2 = '0x0000000000000000000000000000000000000000'
    return address1.toLowerCase() === address2.toLowerCase()
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

export const saveRequestLinkToLocalStorage = ({ details }: { details: IRequestLinkData }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `request-links`

        let storedData = localStorage.getItem(key)

        let dataArr: IRequestLinkData[] = []

        if (storedData) {
            dataArr = JSON.parse(storedData) as IRequestLinkData[]
        }

        dataArr.push(details)

        localStorage.setItem(key, JSON.stringify(dataArr))

        console.log('Saved request link to localStorage:', details)
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
}

export const getRequestLinksFromLocalStorage = () => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `request-links`

        const storedData = localStorage.getItem(key)

        let data: IRequestLinkData[] = []

        if (storedData) {
            data = JSON.parse(storedData) as IRequestLinkData[]
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const saveRequestLinkFulfillmentToLocalStorage = ({ details }: { details: IRequestLinkData; link: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `request-link-fulfillments`

        let storedData = localStorage.getItem(key)

        let dataArr: IRequestLinkData[] = []

        if (storedData) {
            dataArr = JSON.parse(storedData) as IRequestLinkData[]
        }

        dataArr.push(details)

        localStorage.setItem(key, JSON.stringify(dataArr))

        console.log('Saved request link fulfillment to localStorage:', details)
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
}

export const getRequestLinkFulfillmentsFromLocalStorage = () => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `request-link-fulfillments`

        const storedData = localStorage.getItem(key)

        let data: IRequestLinkData[] = []

        if (storedData) {
            data = JSON.parse(storedData) as IRequestLinkData[]
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const updatePeanutPreferences = ({ chainId, tokenAddress }: { chainId?: string; tokenAddress?: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `peanut-preferences`

        let data = {
            chainId: chainId,
            tokenAddress: tokenAddress,
        }

        localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
}

export const getPeanutPreferences = () => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `peanut-preferences`

        const storedData = localStorage.getItem(key)

        let data = {
            chainId: '',
            tokenAddress: '',
        }

        if (storedData) {
            data = JSON.parse(storedData)
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
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

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`
}

export function getIconName(type: string) {
    switch (type) {
        case 'Link Sent':
            return 'send'
        case 'Direct Sent':
            return 'send'
        case 'Link Received':
            return 'receive'
        case 'Offramp Claim':
            return 'send'
        default:
            return undefined
    }
}

import { SiweMessage } from 'siwe'
import { IRequestLinkData } from '@/components/Request/Pay/Pay.consts'

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
