import * as interfaces from '@/interfaces'
import { peanut } from '@squirrel-labs/peanut-sdk'
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
        maximumFractionDigits: 4,
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

export const sendNotification = async ({
    notificationRecipient,
    linkDetails,
}: {
    notificationRecipient: string
    linkDetails: interfaces.ILinkDetails
}) => {
    //TODO: move to .env
    const account = 'eip155:1:' + notificationRecipient
    console.log(account)
    console.log(linkDetails)
    const body = 'your ' + linkDetails.tokenAmount + ' ' + linkDetails.tokenSymbol + ' link has been claimed!'
    const response = await fetch('https://notify.walletconnect.com/6b12debabfec7d3971d2befb5a2e36fd/notify', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer 1ad9fc39-f513-4382-be29-e591d1ac5fd7',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            notification: {
                type: '2aee6e5f-091d-444e-96cd-868ba2ddd0e7', // Notification type ID copied from Cloud
                title: 'Link claimed!',
                body,
                icon: 'https://raw.githubusercontent.com/peanutprotocol/peanut-ui/w3i/src/assets/peanutman-cheering.png', // optional
            },
            accounts: [account],
        }),
    })
    //todo: do smt with response
}

export const getSenderAddress = async ({
    chainId,
    contractVersion,
    depositIdx,
}: {
    chainId: string
    contractVersion: string
    depositIdx: number
}) => {
    const contract = await peanut.getContract(chainId, null, contractVersion)
    const deposits = await contract.getAllDeposits()
    const senderAddress = deposits[depositIdx].senderAddress
    return senderAddress
}

export const getSenderAddressAndSendNotification = async ({
    chainId,
    contractVersion,
    depositIdx,
    linkDetails,
}: {
    chainId: string
    contractVersion: string
    depositIdx: number
    linkDetails: interfaces.ILinkDetails
}) => {
    const senderAddress = await getSenderAddress({ chainId, contractVersion, depositIdx })
    await sendNotification({ notificationRecipient: senderAddress, linkDetails })
    return senderAddress
}
