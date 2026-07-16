import { jsonParse, jsonStringify, getFromLocalStorage, saveToLocalStorage } from '@/utils/general.utils'
import { generateKeysFromString, getParamsFromLink } from '@/utils/peanut-link.utils'
import type { SendLink } from '@/services/services.types'
import { serverFetch } from '@/utils/api-fetch'
import { getAuthHeaders, authReady } from '@/utils/auth-token'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { isDemoMode } from '@/utils/demo'

export { ESendLinkStatus } from '@/services/services.types'
export type { SendLinkStatus, SendLink } from '@/services/services.types'
export { getParamsFromLink } from '@/utils/peanut-link.utils'

export type ClaimLinkData = SendLink & { link: string; password: string }

const CLAIM_LINK_SLOT_PREFIX = 'claim-link-slot'
// KYC review between opening a link and returning to claim can span days.
const CLAIM_LINK_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * Resolve the link used to fetch + claim a send link, hardened against the
 * auth/KYC redirect mangling the URL's `#p=` password fragment (TASK-20193).
 *
 * The recipient opens `/claim?c=&v=&i=#p=<password>`; the password derives the
 * deterministic pubKey the backend is keyed on. The guest → /setup → KYC →
 * /claim flow fully remounts the page, and across that multi-hop redirect the
 * fragment can come back corrupted while the `c/v/i` query survives — so the
 * remounted page derives the WRONG pubKey and gets a 404 "Send link not found",
 * dead-ending the claim.
 *
 * Fix: key the pristine link by its deposit slot (chain:version:index, which
 * the redirect preserves) in localStorage when the link is first opened.
 * First write wins, so the correct password stays authoritative even if a
 * later remount arrives with a broken fragment.
 */
export const resolveClaimLink = (currentLink: string): string => {
    if (typeof window === 'undefined') return currentLink
    let params: ReturnType<typeof getParamsFromLink>
    try {
        params = getParamsFromLink(currentLink)
    } catch {
        return currentLink
    }
    // Without a real deposit slot we can't key the link — leave it untouched.
    if (!params.chainId || Number.isNaN(params.depositIdx)) return currentLink

    const key = `${CLAIM_LINK_SLOT_PREFIX}::${params.chainId}:${params.contractVersion}:${params.depositIdx}`
    const stored = getFromLocalStorage(key)
    if (typeof stored === 'string' && stored) return stored // pristine link wins
    if (params.password) saveToLocalStorage(key, currentLink, CLAIM_LINK_TTL_SECONDS)
    return currentLink
}

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
    // Set only for collateral-funded ("mixed") links: the Rain prepare intent
    // id (`intentId` from useSpendBundle). Lets the backend adopt that intent as
    // the canonical SEND_LINK instead of creating a duplicate.
    preparationId?: string
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
        // This call bypasses callApi (multipart upload), so the demo interceptor
        // is invoked explicitly here. Lazy import keeps the demo module out of
        // this service's module graph on web/tests.
        if (isDemoMode()) {
            const { demoRespond } = await import('@/utils/demo-api')
            return jsonParse(await (await demoRespond('/send-links', { method: 'POST' })).text())
        }

        let requestBody: FormData | string
        const headers: Record<string, string> = {}

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
            requestBody = jsonStringify(sendLink)
            headers['Content-Type'] = 'application/json'
        }

        await authReady()
        Object.assign(headers, getAuthHeaders())
        const response = await fetchWithSentry(`${PEANUT_API_URL}/send-links`, {
            method: 'POST',
            body: requestBody,
            headers,
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
            } catch {
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
        const response = await serverFetch(`/send-links/${sendLink.pubKey}`, {
            method: 'PATCH',
            body: jsonStringify(sendLink),
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
        // Add timestamp to prevent caching of 404s during DB replication lag
        const cacheBuster = Date.now()
        const response = await serverFetch(
            `/send-links/${pubKey}?c=${params.chainId}&v=${params.contractVersion}&i=${params.depositIdx}&_=${cacheBuster}`,
            {
                method: 'GET',
            }
        )
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
        const response = await serverFetch(
            `/send-links?c=${params.chainId}&v=${params.contractVersion}&i=${params.depositIdx}`,
            {
                method: 'GET',
            }
        )
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: SendLink = jsonParse(await response.text())
        return data
    },

    getByPubKey: async (pubKey: string): Promise<SendLink> => {
        const response = await serverFetch(`/send-links/${pubKey}`, {
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
    // and only sends signatures to /claim endpoint.

    /**
     * associates a logged-in user with a claim transaction.
     * this is called after an external wallet claim is successful.
     * it helps the backend link the claim to the user's history.
     * @param txhash - the transaction hash of the successful claim.
     */
    associateClaim: async (txHash: string): Promise<void> => {
        // Fastify's body-parser rejects PATCH with no body as "Pass a valid json".
        // Send an empty JSON object so the request makes it past the parser.
        const response = await serverFetch(`/send-links/claim/${txHash}/associate-user`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Failed to associate user with claim:', errorText)
            // not throwing error because the claim itself was successful.
        }
    },
}
