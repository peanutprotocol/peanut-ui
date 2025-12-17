/**
 * Rhino.fi SDK Service
 *
 * Service for creating and managing smart deposit addresses using the rhino.fi SDK.
 * Smart deposit addresses allow users to bridge assets by making a standard ERC20 transfer.
 *
 * @see https://docs.rhino.fi/sdk/smart-deposits
 */
import { RhinoSdk, SupportedChains } from '@rhino.fi/sdk'

// Initialize the SDK - API key should be set in environment variables
const RHINO_API_KEY = process.env.NEXT_PUBLIC_RHINO_API_KEY || ''

// Singleton SDK instance
let rhinoSdkInstance: ReturnType<typeof RhinoSdk> | null = null

const getRhinoSdk = () => {
    if (!rhinoSdkInstance) {
        if (!RHINO_API_KEY) {
            throw new Error('RHINO_API_KEY is not configured')
        }
        rhinoSdkInstance = RhinoSdk({ apiKey: RHINO_API_KEY })
    }
    return rhinoSdkInstance
}

/**
 * Extracts error message from SDK error response
 *
 * SDK errors are discriminated unions with a `_tag` field as discriminator.
 * Example: { _tag: 'WithdrawLimitReached', token: 'USDT', chain: 'ETHEREUM', ... }
 */
const getErrorMessage = (error: unknown, fallback: string): string => {
    if (!error || typeof error !== 'object') return fallback

    const errorObj = error as Record<string, unknown>

    // Extract _tag (discriminator) and build descriptive message
    const tag = errorObj._tag as string | undefined

    if (!tag) return fallback

    // Build context from additional error fields
    const contextParts: string[] = []

    if ('chain' in errorObj) contextParts.push(`chain: ${errorObj.chain}`)
    if ('chains' in errorObj) contextParts.push(`chains: ${errorObj.chains}`)
    if ('token' in errorObj) contextParts.push(`token: ${errorObj.token}`)

    const context = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : ''

    return `${tag}${context}`
}

export interface RhinoDepositAddress {
    depositAddress: string
    depositChain: string
    destinationChain: string
    destinationAddress: string
    supportedTokens: Array<{
        symbol: string
        address: string
        maxDepositLimitUsd?: number
        minDepositLimitUsd?: number
    }>
    isActive: boolean
}

export interface CreateDepositAddressParams {
    depositChains: string[]
    destinationChain: string
    destinationAddress: string
    addressNote?: string
}

/**
 * Creates a smart deposit address for bridging assets
 */
export const createSmartDepositAddress = async (params: CreateDepositAddressParams): Promise<RhinoDepositAddress[]> => {
    const sdk = getRhinoSdk()

    const result = await sdk.api.depositAddresses.create({
        depositChains: params.depositChains,
        destinationChain: params.destinationChain,
        destinationAddress: params.destinationAddress,
        tokenOut: 'USDC',
        addressNote: params.addressNote,
    })

    // SDK returns { data, error } - extract data or throw on error
    if ('error' in result && result.error) {
        throw new Error(getErrorMessage(result.error, 'Failed to create deposit address'))
    }

    return (result as { data: RhinoDepositAddress[] }).data
}

/**
 * Gets the status of an existing smart deposit address
 */
export const getDepositAddressStatus = async (
    depositAddress: string,
    depositChain: string
): Promise<RhinoDepositAddress> => {
    const sdk = getRhinoSdk()

    const result = await sdk.api.depositAddresses.getStatus({
        depositAddress,
        depositChain,
    })

    // SDK returns { data, error } - extract data or throw on error
    if ('error' in result && result.error) {
        throw new Error(getErrorMessage(result.error, 'Failed to get deposit address status'))
    }

    return (result as { data: RhinoDepositAddress }).data
}

/**
 * Activates a previously deactivated smart deposit address
 */
export const activateDepositAddress = async (depositAddress: string, depositChain: string): Promise<void> => {
    const sdk = getRhinoSdk()

    const result = await sdk.api.depositAddresses.activate({
        depositAddress,
        depositChain,
    })

    // SDK returns { data, error } - throw on error
    if ('error' in result && result.error) {
        throw new Error(getErrorMessage(result.error, 'Failed to activate deposit address'))
    }
}

/**
 * Gets the list of supported chains for smart deposit addresses
 */
export const getSupportedChains = async (): Promise<string[]> => {
    const sdk = getRhinoSdk()
    const result = await sdk.api.depositAddresses.getSupportedChains()

    // SDK returns { data, error } - extract data or throw on error
    if ('error' in result && result.error) {
        throw new Error(getErrorMessage(result.error, 'Failed to get supported chains'))
    }

    return (result as { data: string[] }).data
}

interface ChainConfig {
    name: string
    type: string // "EVM" | "SOLANA" | "TON" | "TRON" | "STARKNET"
    networkId: string
    [key: string]: unknown
}

type BridgeConfig = Record<string, ChainConfig>

/**
 * Gets the list of EVM chains that support smart deposit addresses
 * Filters by type: "EVM" from the bridge config
 */
export const getSupportedEvmChains = async (): Promise<string[]> => {
    const sdk = getRhinoSdk()

    // Fetch both supported chains and bridge config in parallel
    const [supportedChainsResult, bridgeConfigResult] = await Promise.all([
        sdk.api.depositAddresses.getSupportedChains(),
        sdk.api.config.bridge(),
    ])

    // Handle errors
    if ('error' in supportedChainsResult && supportedChainsResult.error) {
        throw new Error(getErrorMessage(supportedChainsResult.error, 'Failed to get supported chains'))
    }
    if ('error' in bridgeConfigResult && bridgeConfigResult.error) {
        throw new Error(getErrorMessage(bridgeConfigResult.error, 'Failed to get bridge config'))
    }

    const supportedChains = (supportedChainsResult as { data: string[] }).data
    const bridgeConfig = (bridgeConfigResult as { data: BridgeConfig }).data

    // Filter to only EVM chains
    const evmChains = supportedChains.filter((chainId) => {
        const chainConfig = bridgeConfig[chainId]
        return chainConfig?.type === 'EVM'
    })

    return evmChains
}

/**
 * Gets the bridge configuration including all supported chains and tokens
 */
export const getBridgeConfig = async () => {
    const sdk = getRhinoSdk()
    const result = await sdk.api.config.bridge()

    // SDK returns { data, error } - extract data or throw on error
    if ('error' in result && result.error) {
        throw new Error(getErrorMessage(result.error, 'Failed to get bridge config'))
    }

    return (result as { data: unknown }).data
}

export interface BridgeTransaction {
    _id: string
    tokenSymbol: string
    tokenAddress: string
    amount: string
    amountUsd: number
    amountWei: string
    sender: string
    txHash: string
    originalErrorTag?: string
    _tag: 'accepted' | 'failed' | 'rejected' | 'pending'
}

export interface DepositAddressHistory {
    depositAddress: string
    depositChain: string
    bridges: BridgeTransaction[]
}

/**
 * Gets the transaction history for a deposit address
 * Returns all accepted, failed, and rejected bridge transactions
 */
export const getDepositAddressHistory = async (
    depositAddress: string,
    depositChain: string
): Promise<DepositAddressHistory> => {
    const sdk = getRhinoSdk()

    const result = await sdk.api.depositAddresses.getHistory({
        depositAddress,
        depositChain,
    })

    // SDK returns { data, error } - extract data or throw on error
    if ('error' in result && result.error) {
        throw new Error(getErrorMessage(result.error, 'Failed to get deposit address history'))
    }

    return (result as { data: DepositAddressHistory }).data
}

// Re-export SupportedChains for convenience
export { SupportedChains }
