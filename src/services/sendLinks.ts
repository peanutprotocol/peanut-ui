// Removed claimSendLink import - no longer used (was insecure)
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry, jsonParse, jsonStringify } from '@/utils'
import { generateKeysFromString, getParamsFromLink } from '@squirrel-labs/peanut-sdk'
import Cookies from 'js-cookie'
import type { SendLink } from '@/services/services.types'

export { ESendLinkStatus } from '@/services/services.types'
export type { SendLinkStatus, SendLink } from '@/services/services.types'
export { getParamsFromLink } from '@squirrel-labs/peanut-sdk'

export type ClaimLinkData = SendLink & { link: string; password: string }

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
    amount?: bigint
    tokenAddress?: string
}

type UpdateLinkBody = {
    pubKey: string
    txHash: string
    chainId: string
    depositIdx: number
    contractVersion: string
    amount: bigint
    tokenAddress: string
}

export const sendLinksApi = {
    create: async (sendLink: CreateLinkBody): Promise<SendLink> => {
        let requestBody: FormData | string
        const headers: HeadersInit = {
            Authorization: `Bearer ${Cookies.get('jwt-token')}`,
        }

        // check if attachment is a File or Blob object
        if (sendLink.attachment && (sendLink.attachment instanceof File || sendLink.attachment instanceof Blob)) {
            requestBody = new FormData()

            requestBody.append(
                'attachment',
                sendLink.attachment,
                sendLink.filename || (sendLink.attachment as File).name
            )

            // append other properties from sendLink to FormData
            // exclude 'attachment', its already handled above
            for (const key in sendLink) {
                if (sendLink.hasOwnProperty(key) && key !== 'attachment') {
                    const value = sendLink[key as keyof CreateLinkBody]
                    if (value !== undefined && value !== null) {
                        // convert numbers, bigints, booleans to string for FormData
                        if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'boolean') {
                            requestBody.append(key, value.toString())
                        } else if (typeof value === 'string') {
                            requestBody.append(key, value)
                        }
                    }
                }
            }
        } else {
            // no file, or attachment is not a File/Blob, send as JSON
            // if attachment exists but is not a file (e.g. just a reference string), it will be stringified.
            requestBody = jsonStringify(sendLink)
            headers['Content-Type'] = 'application/json'
        }

        const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links`, {
            method: 'POST',
            body: requestBody,
            headers: headers,
        })

        if (!response.ok) {
            const errorText = await response.text()
            try {
                // attempt to parse backend error if JSON
                const errorJson = jsonParse(errorText)
                console.error('API Error:', errorJson)
                throw new Error(
                    `HTTP error! status: ${response.status}, message: ${errorJson.message || errorJson.error || errorText}`
                )
            } catch (e) {
                // fallback to plain text error
                console.error('API Error Text:', errorText)
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
            }
        }
        const responseText = await response.text()
        const data: SendLink = jsonParse(responseText)
        return data
    },

    update: async (sendLink: UpdateLinkBody): Promise<SendLink> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links/${sendLink.pubKey}`, {
            method: 'PATCH',
            body: jsonStringify(sendLink),
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

    /**
     * Get send link by query parameters (chainId, depositIdx, contractVersion)
     * Does NOT require password - useful for SSR/metadata generation
     * Uses backend's belt-and-suspenders logic (DB + blockchain fallback)
     */
    getByParams: async (params: {
        chainId: string
        depositIdx: number | string
        contractVersion: string
    }): Promise<SendLink> => {
        const url = `${PEANUT_API_URL}/send-links?c=${params.chainId}&v=${params.contractVersion}&i=${params.depositIdx}`
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

    // REMOVED: claim() and autoClaimLink() methods
    // These methods were INSECURE as they sent passwords to the backend.
    // All claims now use SDK's claimLinkGasless() which signs client-side
    // and only sends signatures to /claim-v2 endpoint.

    /**
     * associates a logged-in user with a claim transaction.
     * this is called after an external wallet claim is successful.
     * it helps the backend link the claim to the user's history.
     * @param txhash - the transaction hash of the successful claim.
     */
    associateClaim: async (txHash: string): Promise<void> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links/claim/${txHash}/associate-user`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${Cookies.get('jwt-token')}`,
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Failed to associate user with claim:', errorText)
            // not throwing error because the claim itself was successful.
        }
    },
}
