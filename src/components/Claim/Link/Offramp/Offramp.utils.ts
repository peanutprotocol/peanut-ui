import * as _consts from '../../Claim.consts'
import * as utils from '@/utils'
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

export async function getUserLinks(formData: _consts.IOfframpForm) {
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

    if (type === 'tos' && !tosLinkOpened) {
        window.open(link, '_blank')
        setTosLinkOpened(true)
    } else if (type === 'kyc' && !kycLinkOpened) {
        window.open(link, '_blank')
        setKycLinkOpened(true)
    }

    while (status !== 'approved') {
        const statusData = await getStatus(userId, type)
        status = statusData[`${type}_status`]
        console.log(`Current ${type.toUpperCase()} status:`, status)

        if (status !== 'approved') {
            await new Promise((resolve) => setTimeout(resolve, 5000)) // wait 5 seconds before checking again
        }
    }

    console.log(`${type.toUpperCase()} completion complete.`)
}

async function createExternalAccount(
    customerId: string,
    accountType: 'iban' | 'us',
    accountDetails: any,
    address: any,
    accountOwnerName: string
) {
    try {
        const response = await fetch(`/api/bridge/external-account/create-external-account?customerId=${customerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                accountType,
                accountDetails,
                address,
                accountOwnerName,
            }),
        })

        if (!response.ok) {
            throw new Error('Failed to create external account')
        }

        const data = await response.json()
        return data
    } catch (error) {
        console.error('Error:', error)
    }
}

export const validateAccountFormData = (formData: any, setAccountFormError: any) => {
    let isValid = true
    if (!formData.accountNumber) {
        setAccountFormError('accountNumber', { type: 'required', message: 'Account number is required' })
        console.log('Account number is required')
        isValid = false
    }
    if (!formData.street) {
        setAccountFormError('street', { type: 'required', message: 'Street is required' })
        console.log('Street is required')
        isValid = false
    }
    if (!formData.city) {
        setAccountFormError('city', { type: 'required', message: 'City is required' })
        console.log('City is required')
        isValid = false
    }
    if (!formData.country) {
        setAccountFormError('country', { type: 'required', message: 'Country is required' })
        console.log('Country is required')
        isValid = false
    }
    if (!formData.postalCode) {
        setAccountFormError('postalCode', { type: 'required', message: 'Postal code is required' })
        console.log('Postal code is required')
        isValid = false
    }
    if (!formData.state) {
        setAccountFormError('state', { type: 'required', message: 'State is required' })
        console.log('State is required')
        isValid = false
    }
    if (formData.type === 'iban') {
        if (!formData.BIC) {
            setAccountFormError('BIC', { type: 'required', message: 'BIC is required' })
            console.log('BIC is required')
            isValid = false
        }
    } else if (formData.type === 'us') {
        if (!formData.routingNumber) {
            setAccountFormError('routingNumber', { type: 'required', message: 'Routing number is required' })
            console.log('Routing number is required')
            isValid = false
        }
    }

    return isValid
}

export const getTransferDetails = async (
    externalAccountId: string,
    type: 'iban' | 'us',
    chainId: string,
    tokenAddress: string,
    customerId: string,
    tokenAmount: string
) => {
    const payload = {
        source: {
            currency: _consts.tokenArray
                .find((chain) => chain.chainId === chainId)
                ?.tokens.find((token) => utils.compareTokenAddresses(token.address, tokenAddress))
                ?.token.toLowerCase(),
            payment_rail: _consts.chainDictionary.find((chain) => chain.chainId === chainId)?.chain,
            from_address: '0x04B5f21facD2ef7c7dbdEe7EbCFBC68616adC45C',
        },
        destination: {
            currency: type === 'iban' ? 'eur' : 'usd',
            payment_rail: type === 'iban' ? 'sepa' : 'ach', // TODO: update ach
            external_account_id: externalAccountId,
        },
        on_behalf_of: customerId,
        amount: tokenAmount,
    }

    const response = await fetch('/api/bridge/transfer/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })

    if (!response.ok) {
        throw new Error('Failed to create transfer')
    }

    const data = await response.json()

    return data
}
