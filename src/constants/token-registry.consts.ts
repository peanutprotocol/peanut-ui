import chainDetailsJson from '@/constants/chain-details.json'
import tokenDetailsJson from '@/constants/token-details.json'
import { type IPeanutChainDetails, type IPeanutTokenDetail } from '@/interfaces/interfaces'

/*
 * Chain and token metadata — 189 KB of JSON.
 *
 * Split out of general.consts because that module holds small things every
 * route needs (API URLs, base URL) and is imported by the root layout, so this
 * catalog was landing in every page's bundle including the marketing site,
 * which never renders a token or a chain.
 */
const CHAIN_DETAILS = chainDetailsJson as unknown as Record<string, IPeanutChainDetails>
const TOKEN_DETAILS = tokenDetailsJson as unknown as IPeanutTokenDetail[]

export const supportedPeanutChains: IPeanutChainDetails[] = Object.keys(CHAIN_DETAILS).map(
    (key) => CHAIN_DETAILS[key as keyof typeof CHAIN_DETAILS]
)

export const peanutTokenDetails: IPeanutTokenDetail[] = TOKEN_DETAILS
