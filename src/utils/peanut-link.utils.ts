/** Pure utilities lifted from `@squirrel-labs/peanut-sdk` — keccak + URL parsing.
 *  No network, no ethers, identical bytes out. */

import { keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'

/** Mirror of SDK `generateKeysFromString(s)` — keccak256(utf8(s)) is the
 *  private key; address derives from it. Used by the send-link flow to
 *  derive the deterministic claim keypair from the link's `#p=` password. */
export function generateKeysFromString(input: string): { address: `0x${string}`; privateKey: Hex } {
	const privateKey = keccak256(toBytes(input))
	const address = privateKeyToAccount(privateKey).address
	return { address, privateKey }
}

export interface PeanutLinkParams {
	chainId: string
	contractVersion: string
	password: string
	depositIdx: number
	trackId: string
}

/** Mirror of SDK `getParamsFromLink(link)`. */
export function getParamsFromLink(link: string): PeanutLinkParams {
	const url = new URL(link)
	const params = url.searchParams
	const chainId = params.get('c') ?? ''
	const contractVersion = params.get('v') ?? ''
	const trackId = params.get('t') ?? ''
	const indices = params.get('i') ?? '0'
	// Multi-link form `(1,2),(3,4)` — first integer.
	const depositIdx = parseInt(indices.replace(/[()]/g, '').split(',')[0] ?? '0', 10)
	const password = (url.hash || '').replace(/^#p=/, '')
	return { chainId, contractVersion, password, depositIdx, trackId }
}

/** Mirror of SDK `getLinkFromParams`. */
export function getLinkFromParams(
	chainId: string,
	contractVersion: string,
	depositIdx: number | string,
	password: string,
	baseUrl = 'https://peanut.to/claim',
	trackId = ''
): string {
	const t = trackId ? `&t=${trackId}` : ''
	return `${baseUrl}?c=${chainId}&v=${contractVersion}&i=${depositIdx}${t}#p=${password}`
}
