import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry, jsonParse } from '@/utils'
import { claimSendLink } from '@/app/actions/claimLinks'
import Cookies from 'js-cookie'
import { getParamsFromLink, generateKeysFromString } from '@squirrel-labs/peanut-sdk'

export enum ESendLinkStatus {
    creating = 'creating',
    completed = 'completed',
    CLAIMING = 'CLAIMING',
    CLAIMED = 'CLAIMED',
    CANCELLED = 'CANCELLED',
    FAILED = 'FAILED',
}

type SendLinkStatus = `${ESendLinkStatus}`

export type SendLink = {
    pubKey: string
    depositIdx: number
    chainId: string
    contractVersion: string
    textContent?: string
    fileUrl?: string
    status: SendLinkStatus
    createdAt: Date
    senderAddress: string
    amount: bigint
    tokenAddress: string
    sender: {
        userId: string
        username: string
        fullName: string
        accounts: {
            identifier: string
        }[]
    }
    claim?: {
        amount: string
        txHash: string
        tokenAddress: string
        recipientAddress?: string
        recipient?: {
            username: string
            fullName: string
            accounts: {
                identifier: string
            }[]
        }
    }
    events: {
        timestamp: Date
        status: SendLinkStatus
    }[]
}

export type ClaimLinkData = SendLink & { link: string; password: string; tokenSymbol: string; tokenDecimals: number }

type CreateLinkBody = {
    pubKey: string
    reference?: string
    attachment?: any
    mimetype?: string
    filename?: string
    txHash?: string
    chainId?: string
    depositIdx?: number
    contractVersion?: string
}

type UpdateLinkBody = {
    pubKey: string
    txHash: string
    chainId: string
    depositIdx: number
    contractVersion: string
}

export const sendLinksApi = {
    create: async (sendLink: CreateLinkBody): Promise<SendLink> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links`, {
            method: 'POST',
            body: JSON.stringify(sendLink),
            headers: {
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                'Content-Type': 'application/json',
            },
        })
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: SendLink = jsonParse(await response.text())
        return data
    },

    update: async (sendLink: UpdateLinkBody): Promise<SendLink> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links/${sendLink.pubKey}`, {
            method: 'PATCH',
            body: JSON.stringify(sendLink),
            headers: {
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
                'Content-Type': 'application/json',
            },
        })
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: SendLink = jsonParse(await response.text())
        return data
    },

    get: async (link: string): Promise<SendLink> => {
        const params = getParamsFromLink(link)
        const pubKey = generateKeysFromString(params.password).address
        const url = `${PEANUT_API_URL}/send-links/${pubKey}?c=${params.chainId}&v=${params.contractVersion}&i=${params.depositIdx}`
        const response = await fetchWithSentry(url, {
            method: 'GET',
        })
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: SendLink = jsonParse(await response.text())
        return data
    },

    getByPubKey: async (pubKey: string): Promise<SendLink> => {
        const url = `${PEANUT_API_URL}/send-links/${pubKey}`
        const response = await fetchWithSentry(url, {
            method: 'GET',
        })
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: SendLink = jsonParse(await response.text())
        return data
    },

    /**
     * Claim a send link
     *
     * @param recipient - The recipient's address or username
     * @param link - The link to claim
     * @returns The claim link data
     */
    claim: async (recipient: string, link: string): Promise<SendLink> => {
        const params = getParamsFromLink(link)
        const pubKey = generateKeysFromString(params.password).address
        return await claimSendLink(pubKey, recipient, params.password)
    },
}
