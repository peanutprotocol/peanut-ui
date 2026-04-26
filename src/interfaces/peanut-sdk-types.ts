/** Local replacements for `@squirrel-labs/peanut-sdk`'s `interfaces` namespace.
 *  Lifted byte-for-byte from the SDK's `dist/index.d.ts` so consumers swap
 *  imports without behaviour change. New code should not extend these — the
 *  Squid-shaped pieces are kept only so the cross-chain UI surface compiles
 *  while it's being migrated to Rhino. */

export interface IPeanutLinkDetails {
	chainId: string
	tokenAmount: number | string
	tokenType?: EPeanutLinkType
	tokenAddress?: string
	tokenId?: number
	tokenDecimals?: number
	baseUrl?: string
	trackId?: string
}

export interface IPeanutUnsignedTransaction {
	from?: string
	to?: string
	data?: string
	value?: BigInt
}

export enum EPeanutLinkType {
	native = 0,
	erc20 = 1,
	erc721 = 2,
	erc1155 = 3,
	inflationarytokens = 4,
}

export enum EClaimLinkStatusCodes {
	ERROR = 0,
}

export enum ECreateLinkStatusCodes {
	ERROR_PREPARING_TX = 0,
	ERROR_SIGNING_AND_SUBMITTING_TX = 1,
	ERROR_GETTING_LINKS_FROM_TX = 2,
}

export enum EGetLinkFromTxStatusCodes {
	ERROR_GETTING_TX_RECEIPT_FROM_HASH = 0,
}

export enum EPrepareCreateTxsStatusCodes {
	ERROR_VALIDATING_LINK_DETAILS = 0,
	ERROR_GETTING_DEFAULT_PROVIDER = 1,
	ERROR_GETTING_TX_COUNT = 2,
	ERROR_PREPARING_APPROVE_ERC20_TX = 3,
	ERROR_PREPARING_APPROVE_ERC721_TX = 4,
	ERROR_PREPARING_APPROVE_ERC1155_TX = 5,
	ERROR_SETTING_FEE_OPTIONS = 6,
	ERROR_ESTIMATING_GAS_LIMIT = 7,
	ERROR_MAKING_DEPOSIT = 8,
	ERROR_RESOLVING_ENS_NAME = 9,
}

export enum ESignAndSubmitTx {
	ERROR_BROADCASTING_TX = 0,
	ERROR_SETTING_FEE_OPTIONS = 1,
	ERROR_INSUFFICIENT_NATIVE_TOKEN = 2,
}

export interface SDKStatus {
	code: number
	extraInfo?: unknown
}

/** Squid types — kept until the cross-chain UI surface is migrated to Rhino. */
export interface ISquidChain {
	chainId: string
	axelarChainName: string
	chainType: string
	chainIconURI: string
}

export interface ISquidToken {
	active: boolean
	chainId: string
	address: string
	decimals: number
	name: string
	symbol: string
	logoURI: string
	usdPrice: number
}
