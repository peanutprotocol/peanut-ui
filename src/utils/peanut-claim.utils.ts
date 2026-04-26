/** Inlined `signWithdrawalMessage` + vault address lookup, replacing the
 *  same-named exports from `@squirrel-labs/peanut-sdk`.
 *
 *  Only the v4.x EIP-712 path (Arb mainnet 42161 + Arb Sepolia 421614)
 *  is supported — older versions and non-Arb chains were dropped in
 *  decomplexify "multi-chain → Arb-only".
 */

import { keccak256, encodePacked, toBytes, type Abi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Address, Hex } from 'viem'

const PEANUT_SALT: Hex = '0x70adbbeba9d4f0c82e28dd574f15466f75df0543b65f24460fc445813b5d94e0'
const ANYONE_WITHDRAWAL_MODE: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000'
const ONLY_RECIPIENT_MODE: Hex = '0x2bb5bef2b248d3edba501ad918c3ab524cce2aea54d4c914414e1c4401dc4ff4'

const VAULT_ADDRESSES: Partial<Record<number, Partial<Record<string, Address>>>> = {
	42161: {
		'v4.3': '0x43B90099a203957F1adf35Dde15ac88b3e323e75',
		'v4.4': '0xe8A4c1DC1E30E01b7D9471FE0422A60beE3fa36c',
	},
	421614: {
		'v4.3': '0x7520510631f865b3b1166a4ba7f8646debeaa8e6',
	},
}

export function getContractAddress(chainId: string, version: string): Address {
	const addr = VAULT_ADDRESSES[Number(chainId)]?.[version]
	if (!addr) throw new Error(`No Peanut vault for chainId=${chainId} version=${version}`)
	return addr
}

/** Latest deployed Peanut vault version per chain. v4.4 on mainnet (newest);
 *  v4.3 on Sepolia (only version we deployed there). */
export function getLatestContractVersion(opts: { chainId: string; type?: string }): string {
	const versions = VAULT_ADDRESSES[Number(opts.chainId)]
	if (!versions) throw new Error(`No Peanut vault chain ${opts.chainId}`)
	if (versions['v4.4']) return 'v4.4'
	if (versions['v4.3']) return 'v4.3'
	throw new Error(`No supported version for chain ${opts.chainId}`)
}

/** Cryptographically-random alphanumeric string. Replaces SDK `getRandomString`. */
export async function getRandomString(length = 16): Promise<string> {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	const buf = new Uint8Array(length)
	crypto.getRandomValues(buf)
	let out = ''
	for (let i = 0; i < length; i++) out += alphabet[buf[i] % alphabet.length]
	return out
}

/** Minimal v4.x vault ABI — `makeDeposit`, `getDepositCount`, plus the
 *  `DepositEvent` shape. Both v4.3 and v4.4 share this surface. */
export const peanutVaultAbi: Abi = [
	{
		type: 'function',
		name: 'makeDeposit',
		inputs: [
			{ name: '_tokenAddress', type: 'address' },
			{ name: '_contractType', type: 'uint8' },
			{ name: '_amount', type: 'uint256' },
			{ name: '_tokenId', type: 'uint256' },
			{ name: '_pubKey20', type: 'address' },
		],
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'payable',
	},
	{
		type: 'function',
		name: 'getDepositCount',
		inputs: [],
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
	},
	{
		type: 'event',
		name: 'DepositEvent',
		inputs: [
			{ name: '_index', type: 'uint256', indexed: true },
			{ name: '_contractType', type: 'uint8', indexed: true },
			{ name: '_amount', type: 'uint256', indexed: false },
			{ name: '_senderAddress', type: 'address', indexed: true },
		],
		anonymous: false,
	},
]

/** `peanut.getContractAbi(version)` shim — version-agnostic now (only one
 *  shape we use), but keep the parameter for callsite parity. */
export function getContractAbi(_version: string): Abi {
	return peanutVaultAbi
}

/** Mirror of SDK `prepareRequestLinkFulfillmentTransaction`. Builds the
 *  unsigned tx the user signs to fulfil a request — native send or ERC-20
 *  transfer. */
export function prepareRequestLinkFulfillmentTransaction(opts: {
	recipientAddress: Address
	tokenAddress: Address
	tokenAmount: string | number
	tokenDecimals: number
	tokenType: number
}): { unsignedTx: { to: Address; data?: Hex; value?: bigint; from?: Address } } {
	const { encodeFunctionData, parseUnits } = require('viem') as typeof import('viem')
	const amount = parseUnits(String(opts.tokenAmount), opts.tokenDecimals)
	if (opts.tokenType === 0) {
		// Native — send to recipient with no calldata.
		return { unsignedTx: { to: opts.recipientAddress, value: amount, data: '0x' as Hex } }
	}
	// ERC-20 transfer.
	const data = encodeFunctionData({
		abi: [
			{
				type: 'function',
				name: 'transfer',
				inputs: [
					{ name: 'to', type: 'address' },
					{ name: 'value', type: 'uint256' },
				],
				outputs: [{ name: '', type: 'bool' }],
				stateMutability: 'nonpayable',
			},
		] as const,
		functionName: 'transfer',
		args: [opts.recipientAddress, amount],
	})
	return { unsignedTx: { to: opts.tokenAddress, data: data as Hex, value: 0n } }
}

/** Mirror of SDK `signWithdrawalMessage(version, chainId, contract, idx,
 *  recipient, privateKey, onlyRecipientMode)`. v4.x EIP-712 path only —
 *  returns `[depositIdx, recipientAddress, signature]` ready to forward
 *  to POST /claim. */
export async function signWithdrawalMessage(
	_version: string,
	chainId: string,
	contractAddress: Address,
	depositIdx: number,
	recipientAddress: Address,
	privateKey: Hex,
	onlyRecipientMode = false
): Promise<[number, Address, Hex]> {
	const mode = onlyRecipientMode ? ONLY_RECIPIENT_MODE : ANYONE_WITHDRAWAL_MODE
	const messageHash = keccak256(
		encodePacked(
			['bytes32', 'uint256', 'address', 'uint256', 'address', 'bytes32'],
			[PEANUT_SALT, BigInt(chainId), contractAddress, BigInt(depositIdx), recipientAddress, mode]
		)
	)
	const account = privateKeyToAccount(privateKey)
	const signature = await account.signMessage({ message: { raw: toBytes(messageHash) } })
	return [depositIdx, recipientAddress, signature]
}
