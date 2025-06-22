'use server'
import type { Address, Hash, Hex } from 'viem'
import { parseUnits, formatUnits, encodeFunctionData, erc20Abi } from 'viem'

import { fetchTokenPrice, estimateTransactionCostUsd } from '@/app/actions/tokens'
import { getPublicClient, type ChainId } from '@/app/actions/clients'
import { fetchWithSentry, isNativeCurrency } from '@/utils'
import { SQUID_API_URL } from '@/constants'

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
    const client = await getPublicClient(Number(chainId) as ChainId)

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
async function getSquidRouteRaw(params: SquidGetRouteParams): Promise<SquidRouteResponse> {
    const response = await fetchWithSentry(`${SQUID_API_URL}/v2/route`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-integrator-id': process.env.SQUID_INTEGRATOR_ID!,
        },
        body: JSON.stringify(params),
    })

    if (!response.ok) {
        throw new Error(`Failed to get route: ${response.status}`)
    }

    const data = await response.json()
    return data as SquidRouteResponse
}

/**
 * Find the optimal fromAmount for a given target amount of tokens.
 *
 * Uses binary search to find the optimal fromAmount for a given target amount of tokens.
 * This is done by calling the squid API with different fromAmount values until the
 * overage is below a certain threshold.
 */
async function findOptimalFromAmount(
    params: Omit<SquidGetRouteParams, 'fromAmount'>,
    targetToAmount: bigint,
    _toTokenPrice?: { price: number; decimals: number }
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
    // This is needed because for different quantities the slippage is different
    // for example 0.4% of 10 USD is different than 0.4% of 1000 USD
    let maxOverage: number
    let rangeMultiplier: { low: number; high: number }
    if (targetUsd < 0.3) {
        // Really small amounts, mainly used for testing
        maxOverage = 0.05 // 5%
        rangeMultiplier = { low: 0.945, high: 1.15 }
    } else if (targetUsd < 1) {
        maxOverage = 0.01 // 1%
        rangeMultiplier = { low: 0.985, high: 1.03 }
    } else if (targetUsd < 10) {
        maxOverage = 0.005 // 0.5%
        rangeMultiplier = { low: 0.9925, high: 1.015 }
    } else if (targetUsd < 1000) {
        maxOverage = 0.003 // 0.3%
        rangeMultiplier = { low: 0.995, high: 1.009 }
    } else {
        maxOverage = 0.001 // 0.1%
        rangeMultiplier = { low: 0.995, high: 1.01 }
    }

    let lowBound = (initialFromAmount * BigInt(Math.floor(rangeMultiplier.low * 10000))) / 10000n
    let highBound = (initialFromAmount * BigInt(Math.floor(rangeMultiplier.high * 10000))) / 10000n

    let bestResult: { response: SquidRouteResponse; overage: number } | null = null
    let iterations = 0
    const maxIterations = 3 // Avoid too many calls to squid API!

    // Binary search to find the optimal fromAmount
    while (iterations < maxIterations && highBound > lowBound) {
        const midPoint = (lowBound + highBound) / 2n
        const testParams = { ...params, fromAmount: midPoint.toString() }

        try {
            const response = await getSquidRouteRaw(testParams)
            const receivedAmount = BigInt(response.route.estimate.toAmountMin)
            console.log('fromAmount', midPoint)
            console.log('receivedAmount', receivedAmount)
            console.log('targetToAmount', targetToAmount)
            if (receivedAmount >= targetToAmount) {
                iterations++
                const diff = receivedAmount - targetToAmount
                const target = targetToAmount

                let overage: number
                if (diff <= Number.MAX_SAFE_INTEGER && target <= Number.MAX_SAFE_INTEGER) {
                    overage = Number(diff) / Number(target)
                } else {
                    // Handle very large numbers with careful scaling
                    overage = Number(diff / (target / 1_000_000_000_000_000_000n)) / 1e18
                }

                if (overage <= maxOverage) {
                    return response
                }

                bestResult = { response, overage }
                highBound = midPoint - 1n
            } else {
                lowBound = midPoint + 1n
            }
        } catch (error) {
            console.warn('Error fetching route:', error)
            lowBound = midPoint + 1n
            iterations++
        }
    }

    // Return best result found, or make one final call with high bound
    if (bestResult) {
        return bestResult.response
    }

    // Fallback call
    return await getSquidRouteRaw({ ...params, fromAmount: highBound.toString() })
}

export type PeanutCrossChainRoute = {
    expiry: string
    type: 'swap' | 'rfq'
    fromAmount: string
    transactions: {
        to: Address
        data: Hex
        value: string
        feeOptions: {
            gasLimit: string
            maxFeePerGas: string
            maxPriorityFeePerGas: string
            gasPrice: string
        }
    }[]
    feeCostsUsd: number
    rawResponse: SquidRouteResponse
}

/**
 * Get the route for a given amount of tokens from one chain to another.
 *
 * Accepts any specified amount either in tokens or USD, specifying send or receive amount.
 *
 * Returns the route with the less slippage..
 */
export async function getRoute({ from, to, ...amount }: RouteParams): Promise<PeanutCrossChainRoute> {
    let fromAmount: string
    let response: SquidRouteResponse

    console.info('getRoute', { from, to }, amount)

    if (amount.fromAmount) {
        fromAmount = amount.fromAmount.toString()
        response = await getSquidRouteRaw({
            fromChain: from.chainId,
            fromToken: from.tokenAddress,
            fromAmount: fromAmount,
            fromAddress: from.address,
            toAddress: to.address,
            toChain: to.chainId,
            toToken: to.tokenAddress,
        })
    } else if (amount.fromUsd) {
        // Convert USD to token amount
        const fromTokenPrice = await fetchTokenPrice(from.tokenAddress, from.chainId)
        if (!fromTokenPrice) throw new Error('Could not fetch from token price')

        fromAmount = parseUnits(
            (Number(amount.fromUsd) / fromTokenPrice.price).toString(),
            fromTokenPrice.decimals
        ).toString()

        response = await getSquidRouteRaw({
            fromChain: from.chainId,
            fromToken: from.tokenAddress,
            fromAmount,
            fromAddress: from.address,
            toAddress: to.address,
            toChain: to.chainId,
            toToken: to.tokenAddress,
        })
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
            amount.toAmount
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
            toTokenPrice // Pass the already-fetched price
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
        feeOptions: {
            gasLimit: string
            maxFeePerGas: string
            maxPriorityFeePerGas: string
            gasPrice: string
        }
    }[] = []

    // Check if approval is needed for non-native tokens
    if (!isNativeCurrency(from.tokenAddress)) {
        const fromAmount = BigInt(route.estimate.fromAmount)
        const spenderAddress = route.transactionRequest.target

        try {
            const currentAllowance = await checkTokenAllowance(
                from.tokenAddress,
                from.address,
                spenderAddress,
                from.chainId
            )

            // If current allowance is insufficient, create approve transaction
            if (currentAllowance < fromAmount) {
                const approveTransaction = createApproveTransaction(from.tokenAddress, spenderAddress, fromAmount)

                // Add approval transaction to the beginning of transactions array
                transactions.push({
                    ...approveTransaction,
                    feeOptions: {
                        gasLimit: route.transactionRequest.gasLimit,
                        maxFeePerGas: route.transactionRequest.maxFeePerGas,
                        maxPriorityFeePerGas: route.transactionRequest.maxPriorityFeePerGas,
                        gasPrice: route.transactionRequest.gasPrice,
                    },
                })

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
        feeOptions: {
            gasLimit: route.transactionRequest.gasLimit,
            maxFeePerGas: route.transactionRequest.maxFeePerGas,
            maxPriorityFeePerGas: route.transactionRequest.maxPriorityFeePerGas,
            gasPrice: route.transactionRequest.gasPrice,
        },
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
}
