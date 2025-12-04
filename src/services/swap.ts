'use server'
import type { Address, Hash, Hex } from 'viem'
import { parseUnits, formatUnits, encodeFunctionData, erc20Abi } from 'viem'

import { fetchTokenPrice, estimateTransactionCostUsd } from '@/app/actions/tokens'
import { getPublicClient, type ChainId } from '@/app/actions/clients'
import { fetchWithSentry, isNativeCurrency, areEvmAddressesEqual } from '@/utils'
import { SQUID_API_URL, USDT_IN_MAINNET, SQUID_INTEGRATOR_ID, SQUID_INTEGRATOR_ID_WITHOUT_CORAL } from '@/constants'

type TokenInfo = {
    address: Address
    tokenAddress: Address
    chainId: string
}

type RouteParams = {
    from: TokenInfo
    to: TokenInfo
} & (
    | {
          fromAmount: bigint
          toAmount?: undefined
          fromUsd?: undefined
          toUsd?: undefined
      }
    | {
          fromAmount?: undefined
          toAmount: bigint
          fromUsd?: undefined
          toUsd?: undefined
      }
    | {
          fromAmount?: undefined
          toAmount?: undefined
          fromUsd: string
          toUsd?: undefined
      }
    | {
          fromAmount?: undefined
          toAmount?: undefined
          fromUsd?: undefined
          toUsd: string
      }
)

type SquidGetRouteParams = {
    fromChain: string
    fromToken: string
    fromAmount: string
    fromAddress: string
    toAddress: string
    toChain: string
    toToken: string
}

// options for route fetching behaviour
type RouteOptions = {
    /**
     * when true, we will fetch a route using a non-Coral Squid integrator id.
     * coral (rfq) routes have a very short expiry which is problematic for
     * external-wallet Add Money flows that require approval + swap.  Setting
     * this flag disables coral by switching the integrator key.
     */
    disableCoral?: boolean
}

type SquidCall = {
    chainType: string
    callType: number
    target: Address
    callData: Hex
    value: string
    payload: {
        tokenAddress: Address
        inputPos: number
    }
    estimatedGas: string
}

type SquidAction = {
    type: 'swap' | 'rfq'
    chainType: string
    data: {
        liquidityProvider: string
        provider: string
        type: string
        fillerAddress: Address
        expiry: string
        logoURI: string
        calls: SquidCall[]
    }
    fromChain: string
    toChain: string
    fromToken: SquidToken
    toToken: SquidToken
    fromAmount: string
    toAmount: string
    toAmountMin: string
    exchangeRate: string
    priceImpact: string
    stage: number
    provider: string
    logoURI: string
    description: string
    orderHash: Hash
}

type SquidToken = {
    id: string
    symbol: string
    address: Address
    chainId: string
    name: string
    decimals: number
    coingeckoId: string
    type: string
    logoURI: string
    axelarNetworkSymbol: string
    subGraphOnly: boolean
    subGraphIds: string[]
    enabled: boolean
    active: boolean
    visible: boolean
    usdPrice: number
}

type SquidFeeCost = {
    amount: string
    amountUsd: string
    description: string
    gasLimit: string
    gasMultiplier: number
    name: string
    token: SquidToken
    logoURI: string
}

type SquidGasCost = {
    type: string
    token: SquidToken
    amount: string
    gasLimit: string
    amountUsd: string
}

type SquidRouteResponse = {
    route: {
        estimate: {
            actions: SquidAction[]
            fromAmount: string
            toAmount: string
            toAmountMin: string
            exchangeRate: string
            aggregatePriceImpact: string
            fromAmountUSD: string
            toAmountUSD: string
            toAmountMinUSD: string
            aggregateSlippage: number
            fromToken: SquidToken
            toToken: SquidToken
            isBoostSupported: boolean
            feeCosts: SquidFeeCost[]
            gasCosts: SquidGasCost[]
            estimatedRouteDuration: number
        }
        transactionRequest: {
            type: string
            target: Address
            data: Hex
            value: string
            gasLimit: string
            lastBaseFeePerGas: string
            maxFeePerGas: string
            maxPriorityFeePerGas: string
            gasPrice: string
            requestId: string
            expiry: string
            expiryOffset: string
        }
        params: SquidGetRouteParams
        quoteId: string
    }
}

/**
 * Check current allowance for a token
 */
async function checkTokenAllowance(
    tokenAddress: Address,
    ownerAddress: Address,
    spenderAddress: Address,
    chainId: string
): Promise<bigint> {
    const client = getPublicClient(Number(chainId) as ChainId)

    const allowance = await client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [ownerAddress, spenderAddress],
    })

    return allowance
}

/**
 * Create an approve transaction
 */
function createApproveTransaction(
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint
): { to: Address; data: Hex; value: string } {
    const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [spenderAddress, amount],
    })

    return {
        to: tokenAddress,
        data,
        value: '0',
    }
}

/**
 * Estimate gas cost for approve transaction in USD
 */
async function estimateApprovalCostUsd(
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    fromAddress: Address,
    chainId: string
): Promise<number> {
    const estimateCost = await estimateTransactionCostUsd(
        fromAddress,
        tokenAddress,
        encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [spenderAddress, amount],
        }),
        chainId
    )
    return estimateCost
}

/**
 * Fetch the route from the squid API.
 * We use this when we fetch the route several times while finding the optimal fromAmount.
 */
async function getSquidRouteRaw(params: SquidGetRouteParams, options: RouteOptions = {}): Promise<SquidRouteResponse> {
    const response = await fetchWithSentry(`${SQUID_API_URL}/v2/route`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // use alternative integrator id when coral must be disabled
            'x-integrator-id': options.disableCoral
                ? SQUID_INTEGRATOR_ID_WITHOUT_CORAL || SQUID_INTEGRATOR_ID
                : SQUID_INTEGRATOR_ID,
        },
        body: JSON.stringify(params),
    })

    if (!response.ok) {
        let errorMessage = `Failed to get route: ${response.status}`
        try {
            const errorData = await response.json()
            if (errorData.message) {
                // Use Squid's error message directly (e.g., "Low liquidity, please reduce swap amount and try again")
                errorMessage = errorData.message
            }
            console.error('Squid route request failed:', errorData)
        } catch {
            console.error(`Failed to get route: ${response.status}`)
        }
        throw new Error(errorMessage)
    }

    const data = await response.json()
    return data as SquidRouteResponse
}

/**
 * Calculate overage percentage between received and target amounts
 */
function calculateOverage(receivedAmount: bigint, targetAmount: bigint): number {
    if (receivedAmount < targetAmount) return -1 // Indicates undershoot

    const diff = receivedAmount - targetAmount
    const target = targetAmount

    if (diff <= Number.MAX_SAFE_INTEGER && target <= Number.MAX_SAFE_INTEGER) {
        return Number(diff) / Number(target)
    } else {
        // Handle very large numbers with careful scaling
        return Number(diff / (target / 1_000_000_000_000_000_000n)) / 1e18
    }
}

/**
 * Find the optimal fromAmount for a given target amount of tokens.
 *
 * Uses hybrid approach: linear interpolation to set realistic bounds,
 * then binary search within those bounds for precision.
 */
async function findOptimalFromAmount(
    params: Omit<SquidGetRouteParams, 'fromAmount'>,
    targetToAmount: bigint,
    _toTokenPrice?: { price: number; decimals: number },
    options: RouteOptions = {}
): Promise<SquidRouteResponse> {
    // Only fetch if not provided
    const [toTokenPrice, fromTokenPrice] = await Promise.all([
        _toTokenPrice ? Promise.resolve(_toTokenPrice) : fetchTokenPrice(params.toToken, params.toChain),
        fetchTokenPrice(params.fromToken, params.fromChain),
    ])
    if (!toTokenPrice) throw new Error('Could not fetch to token price')
    if (!fromTokenPrice) throw new Error('Could not fetch from token price')

    const targetUsd = Number(formatUnits(targetToAmount, toTokenPrice.decimals)) * toTokenPrice.price
    const initialFromAmount = parseUnits((targetUsd / fromTokenPrice.price).toString(), fromTokenPrice.decimals)
    console.info('findOptimalFromAmount', { params, targetToAmount, toTokenPrice, targetUsd })

    // Dynamic tolerances based on USD amount
    let maxOverage: number
    if (targetUsd < 0.3) {
        maxOverage = 0.05 // 5%
    } else if (targetUsd < 1) {
        maxOverage = 0.01 // 1%
    } else if (targetUsd < 10) {
        maxOverage = 0.005 // 0.5%
    } else if (targetUsd < 1000) {
        maxOverage = 0.003 // 0.3%
    } else {
        maxOverage = 0.001 // 0.1%
    }

    const testResponse = await getSquidRouteRaw(
        {
            ...params,
            fromAmount: initialFromAmount.toString(),
        },
        options
    )

    const actualReceived = BigInt(testResponse.route.estimate.toAmountMin)

    // Step 2: Check if initial test is already good enough
    const initialOverage = calculateOverage(actualReceived, targetToAmount)
    if (initialOverage >= 0 && initialOverage <= maxOverage) {
        return testResponse
    }

    // Step 3: Use linear interpolation to calculate realistic bounds
    const ratio = Number(targetToAmount) / Number(actualReceived)
    const linearEstimate = (initialFromAmount * BigInt(Math.floor(ratio * 1000))) / 1000n

    // Set tight bounds around the linear estimate (±2% range)
    const boundRange = linearEstimate / 50n // 2% of linear estimate
    let lowBound = linearEstimate - boundRange
    let highBound = linearEstimate + boundRange

    // Ensure bounds are positive
    if (lowBound <= 0n) lowBound = linearEstimate / 2n

    let bestResult: { response: SquidRouteResponse; overage: number } | null = null
    let iterations = 0
    const maxIterations = 2 // Only 2 more calls since bounds are accurate
    const minBoundDifference = linearEstimate / 1000n // 0.1% to prevent infinite loops

    // Step 4: Binary search within the realistic bounds
    while (iterations < maxIterations && highBound > lowBound && highBound - lowBound > minBoundDifference) {
        const midPoint = (lowBound + highBound) / 2n
        const testParams = { ...params, fromAmount: midPoint.toString() }

        try {
            const response = await getSquidRouteRaw(testParams, options)
            const receivedAmount = BigInt(response.route.estimate.toAmountMin)

            const overage = calculateOverage(receivedAmount, targetToAmount)

            if (overage >= 0) {
                // We have enough tokens
                if (overage <= maxOverage) {
                    return response
                }

                bestResult = { response, overage }
                highBound = midPoint - 1n
            } else {
                // Not enough tokens, need more input
                lowBound = midPoint + 1n
            }
            iterations++
        } catch (error) {
            console.warn('Error fetching route:', error)
            lowBound = midPoint + 1n
            iterations++
        }
    }

    // Step 5: Return best result found, or fallback to initial test
    if (bestResult) {
        return bestResult.response
    }

    return testResponse
}

export type PeanutCrossChainRoute = {
    expiry: string
    type: 'swap' | 'rfq'
    fromAmount: string
    transactions: {
        to: Address
        data: Hex
        value: string
    }[]
    feeCostsUsd: number
    rawResponse: SquidRouteResponse
    error?: string // Error message if route failed
}

/**
 * Get the route for a given amount of tokens from one chain to another.
 *
 * Accepts any specified amount either in tokens or USD, specifying send or receive amount.
 *
 * Returns the route with the less slippage..
 */
export async function getRoute(
    { from, to, ...amount }: RouteParams,
    options: RouteOptions = {}
): Promise<PeanutCrossChainRoute> {
    try {
        let fromAmount: string
        let response: SquidRouteResponse

        console.info('getRoute', { from, to }, amount)

        if (amount.fromAmount) {
            fromAmount = amount.fromAmount.toString()
            response = await getSquidRouteRaw(
                {
                    fromChain: from.chainId,
                    fromToken: from.tokenAddress,
                    fromAmount: fromAmount,
                    fromAddress: from.address,
                    toAddress: to.address,
                    toChain: to.chainId,
                    toToken: to.tokenAddress,
                },
                options
            )
        } else if (amount.fromUsd) {
            // Convert USD to token amount
            const fromTokenPrice = await fetchTokenPrice(from.tokenAddress, from.chainId)
            if (!fromTokenPrice) throw new Error('Could not fetch from token price')

            const tokenAmount = Number(amount.fromUsd) / fromTokenPrice.price
            fromAmount = parseUnits(tokenAmount.toFixed(fromTokenPrice.decimals), fromTokenPrice.decimals).toString()

            response = await getSquidRouteRaw(
                {
                    fromChain: from.chainId,
                    fromToken: from.tokenAddress,
                    fromAmount,
                    fromAddress: from.address,
                    toAddress: to.address,
                    toChain: to.chainId,
                    toToken: to.tokenAddress,
                },
                options
            )
        } else if (amount.toAmount) {
            // Use binary search to find optimal fromAmount
            response = await findOptimalFromAmount(
                {
                    fromChain: from.chainId,
                    fromToken: from.tokenAddress,
                    fromAddress: from.address,
                    toAddress: to.address,
                    toChain: to.chainId,
                    toToken: to.tokenAddress,
                },
                amount.toAmount,
                undefined /* _toTokenPrice */,
                options
            )
        } else if (amount.toUsd) {
            // Convert target USD to token amount, then use binary search
            const toTokenPrice = await fetchTokenPrice(to.tokenAddress, to.chainId)
            if (!toTokenPrice) throw new Error('Could not fetch to token price')

            const targetToAmount = parseUnits(
                (parseFloat(amount.toUsd) / toTokenPrice.price).toFixed(toTokenPrice.decimals),
                toTokenPrice.decimals
            )

            response = await findOptimalFromAmount(
                {
                    fromChain: from.chainId,
                    fromToken: from.tokenAddress,
                    fromAddress: from.address,
                    toAddress: to.address,
                    toChain: to.chainId,
                    toToken: to.tokenAddress,
                },
                targetToAmount,
                toTokenPrice, // Pass the already-fetched price
                options
            )
        } else {
            throw new Error('No amount specified')
        }

        const route = response.route

        let feeCostsUsd = [...route.estimate.feeCosts, ...route.estimate.gasCosts].reduce(
            (sum, cost) => sum + Number(cost.amountUsd),
            0
        )

        const transactions: {
            to: Address
            data: Hex
            value: string
        }[] = []

        // Check if approval is needed for non-native tokens
        if (!isNativeCurrency(from.tokenAddress)) {
            const fromAmount = BigInt(route.estimate.fromAmount)
            const spenderAddress = route.transactionRequest.target

            try {
                let currentAllowance = await checkTokenAllowance(
                    from.tokenAddress,
                    from.address,
                    spenderAddress,
                    from.chainId
                )

                const isUsdtInMainnet = from.chainId === '1' && areEvmAddressesEqual(from.tokenAddress, USDT_IN_MAINNET)
                // USDT in mainnet is not an erc20 token and needs to have the
                // allowance reseted to 0 before using it.
                if (isUsdtInMainnet && currentAllowance > 0n) {
                    transactions.push(createApproveTransaction(from.tokenAddress, spenderAddress, 0n))
                    currentAllowance = 0n
                }

                // If current allowance is insufficient, create approve transaction
                if (currentAllowance < fromAmount) {
                    // Add approval transaction to the transactions array
                    transactions.push(createApproveTransaction(from.tokenAddress, spenderAddress, fromAmount))

                    // Add approval cost to fee costs
                    const approvalCostUsd = await estimateApprovalCostUsd(
                        from.tokenAddress,
                        spenderAddress,
                        fromAmount,
                        from.address,
                        from.chainId
                    )
                    feeCostsUsd += approvalCostUsd
                }
            } catch (error) {
                console.error('Error checking allowance:', error)
                // Continue without approval transaction if there's an error
            }
        }

        // Add the main swap transaction
        transactions.push({
            to: route.transactionRequest.target,
            data: route.transactionRequest.data,
            value: route.transactionRequest.value,
        })

        const xChainRoute = {
            expiry: route.transactionRequest.expiry,
            type: route.estimate.actions[0].type,
            fromAmount: route.estimate.fromAmount,
            transactions,
            feeCostsUsd,
            rawResponse: response,
        }

        console.info('xChainRoute', xChainRoute)
        console.info('xChainRoute created with expiry:', route.transactionRequest.expiry)

        return xChainRoute
    } catch (error) {
        // Return error as data - Next.js Server Actions strip thrown error messages in production
        const message = error instanceof Error ? error.message : 'Failed to get route'
        return { error: message } as PeanutCrossChainRoute
    }
}
