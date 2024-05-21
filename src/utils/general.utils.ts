import * as interfaces from '@/interfaces'
import * as consts from '@/constants'
import peanut, { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { exportTraceState } from 'next/dist/trace'

export const shortenAddress = (address: string) => {
    const firstBit = address.substring(0, 6)

    return firstBit + '..'
}

export const shortenAddressLong = (address: string) => {
    const firstBit = address.substring(0, 6)
    const endingBit = address.substring(address.length - 4, address.length)

    return firstBit + '...' + endingBit
}

export const shortenHash = (address: string) => {
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
        console.log(localStorageData)
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

// TODO: this is a hacky fix to copy in an iframe where the clipboard API is not supported/blocked
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

export const getClaimedLinksFromLocalStorage = ({ address }: { address: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `${address} - claimed links`

        const storedData = localStorage.getItem(key)

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

export const getCreatedLinksFromLocalStorage = ({ address }: { address: string }) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `${address} - created links`

        const storedData = localStorage.getItem(key)

        let data: interfaces.IExtendedPeanutLinkDetails[] = []
        if (storedData) {
            data = JSON.parse(storedData) as interfaces.IExtendedPeanutLinkDetails[]
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const updateCreatedLinksFromLocalStorage = ({
    address,
    data,
}: {
    address: string
    data: interfaces.IExtendedPeanutLinkDetails[]
}) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `${address} - created links`

        localStorage.setItem(key, JSON.stringify(data))

        console.log('Updated created links in localStorage:', data)
    } catch (error) {
        console.error('Error updating data in localStorage:', error)
    }
}

export const addClaimLinkToLocalstorage = ({
    address,
    linkDetails,
}: {
    address: string
    linkDetails: interfaces.ILinkDetails
}) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `${address} - claimed links`

        const storedData = localStorage.getItem(key)

        let data: interfaces.ILinkDetails[] = []
        if (storedData) {
            data = JSON.parse(storedData) as interfaces.ILinkDetails[]
        }

        data.push(linkDetails)

        localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
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
export const getPeanutAccessCode = () => {
    try {
        const key = `peanut-access-code`
        if (typeof localStorage === 'undefined') return

        const storedData = localStorage.getItem(key)

        let data = {
            accessCode: '',
        }

        if (storedData) {
            data = JSON.parse(storedData)
        }

        return data
    } catch (error) {
        console.error('Error getting data from localStorage:', error)
    }
}

export const updatePeanutAccessCode = (accessCode?: string) => {
    try {
        if (typeof localStorage === 'undefined') return

        const key = `peanut-access-code`

        let data = {
            accessCode: accessCode ? accessCode : '',
        }

        localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
        console.error('Error adding data to localStorage:', error)
    }
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
    if (explorers?.find((explorer) => explorer.name === 'blockscout')) {
        return explorers?.find((explorer) => explorer.name === 'blockscout')?.url
    } else {
        return explorers?.[0].url
    }
}
