import * as interfaces from '@/interfaces'

export const shortenAddress = (address: string) => {
    const firstBit = address.substring(0, 6)
    const endingBit = address.substring(address.length - 4, address.length)

    return firstBit + '..'
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
    } catch (error) {
        console.error('Error saving to localStorage:', error)
    }
}

// use this functions to save multiple links into localStorage
// for e.g. importing a backup file
export const saveLinksToLocalStorage = ({ address, links}: { address: string, links:{hash: string, link: string }[]}) => {
    const allLinks = getAllLinksFromLocalStorage({ address });

    links.forEach((saveLink) => {
        // avoid duplicates during import
        if(!allLinks.find((item) => item.link === saveLink.link))

        allLinks.push({
            hash: saveLink.hash,
            link: saveLink.link,
        });
    })

    saveToLocalStorage(address, allLinks);
}

// save link to localStorage in new format
// "address":[{hash, link}]
export const saveLinkToLocalStorage = ({ address, hash, link }: { address: string, hash: string, link: string }) => {
    const allLinks = getAllLinksFromLocalStorage({ address });

    allLinks.push({
        hash, link
    });

    saveToLocalStorage(address, allLinks);
}

export const getAllLinksFromLocalStorage = ({ address }: { address: string }) => {
    try {
        if(localStorage.getItem(address) === null) {
            localStorage.setItem(address, JSON.stringify([]))
        }

        const localStorageData: interfaces.ILocalStorageItem[] = []

        const allLinks = JSON.parse(localStorage.getItem(address) || "[]")

        allLinks.forEach((item) => localStorageData.push({ address: address, hash: item.hash, link: item.link}))

        return localStorageData
    } catch (error) {
        console.error('Error getting data from localStorage:', error, localStorage.getItem(address))
    }
}

// to keep all previously created links
// we need to call that function to re-save old links into new format
// possible to remove it later (created at 24 Aug 2023)
export const migrateAllLinksFromLocalStorageV2 = ({ address }: { address: string }) => {
    try {
        const linksV2 = getAllLinksFromLocalStorage({ address });
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)

            if (key !== null && key?.includes(`${address} -`)) {
                const value = localStorage.getItem(key)
                if (value !== null) {
                    const x = {
                        address: key.split('-')[0].trim(),
                        hash: key.split('-')[1].trim(),
                        link: value.replaceAll('"', ''),
                    }
                    if(!linksV2.find((item) => item.link === x.link)) {
                        saveLinkToLocalStorage({ address: x.address, hash: x.hash, link: x.link});
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error migrating to localstorage v2', error)
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
