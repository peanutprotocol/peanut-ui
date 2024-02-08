import * as interfaces from '@/interfaces'
import { peanut } from '@squirrel-labs/peanut-sdk'
import { providers } from 'ethers'
import { WalletClient } from 'wagmi'
export const shortenAddress = (address: string) => {
    const firstBit = address.substring(0, 6)
    const endingBit = address.substring(address.length - 4, address.length)

    return firstBit + '..'
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
        localStorage.setItem(key, serializedData)
        console.log(`Saved ${key} to localStorage:`, data)
    } catch (error) {
        console.error('Error saving to localStorage:', error)
    }
}

export const delteFromLocalStorage = (key: string) => {
    try {
        localStorage.removeItem(key)
        console.log(`Removed ${key} from localStorage`)
    } catch (error) {
        console.error('Error removing from localStorage:', error)
    }
}

export const getAllLinksFromLocalStorage = ({ address }: { address: string }) => {
    try {
        const localStorageData: interfaces.ILocalStorageItem[] = []

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)

            if (key !== null && key?.includes(address)) {
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

export function formatTokenAmount(amount: number) {
    const formattedAmount = amount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
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

export function walletClientToSigner(walletClient: WalletClient) {
    const { account, chain, transport } = walletClient
    const network = {
        chainId: chain.id,
        name: chain.name,
        ensAddress: chain.contracts?.ensRegistry?.address,
    }
    const provider = new providers.Web3Provider(transport, network)
    const signer = provider.getSigner(account.address)
    return signer
}

export function formatMessage(message: string) {
    return message
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => !!line)
        .join('\n')
}

export async function sendDiscordNotification(message: string) {
    const _message = formatMessage(message)
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL

        if (!webhookUrl) throw new Error('DISCORD_WEBHOOK not found in env')
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: _message,
            }),
        })
        if (!response.ok) throw response.text()
    } catch (error) {
        console.error(`======== Error sending Notification Push message: ${error}`)
    }
}

export const isMantleInUrl = (): boolean => {
    return window.location.origin.includes('mantle') ? false : true
}
