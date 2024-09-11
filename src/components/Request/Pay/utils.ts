import { ethers, AddressZero } from 'ethers'

async function getTokenPrice({ tokenAddress, chainId }: { tokenAddress: string; chainId: string | number }) {
    const response = await fetch(
        'https://api.0xsquid.com/v1/token-price?' + new URLSearchParams({ tokenAddress, chainId: chainId.toString() })
    )
    const data = await response.json()
    return data.price
}

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

interface TokenData {
    chainId: string
    address: string
    decimals: number
}

export enum EPeanutLinkType {
    native,
    erc20,
}

export async function getFromAmount({
    fromToken,
    toAmount,
    toToken,
    slippagePercentage = 1.5,
}: {
    fromToken: TokenData
    toToken: TokenData
    toAmount: string
    slippagePercentage?: number
}): Promise<string | null> {
    if (slippagePercentage < 0) {
        console.error('Invalid slippagePercentage: Cannot be negative.')
        return null
    }
    if (fromToken.address === ADDRESS_ZERO) {
        fromToken.address = NATIVE_TOKEN_ADDRESS
    }
    if (toToken.address === ADDRESS_ZERO) {
        toToken.address = NATIVE_TOKEN_ADDRESS
    }
    try {
        // Get usd prices for both tokens
        const [fromTokenPrice, toTokenPrice] = await Promise.all([
            getTokenPrice({
                chainId: fromToken.chainId,
                tokenAddress: fromToken.address,
            }),
            getTokenPrice({
                chainId: toToken.chainId,
                tokenAddress: toToken.address,
            }),
        ])

        // Normalize prices to account for different decimal counts between tokens.
        // This ensures calculations are consistent and prevents issues with scientific notation
        // that could arise from small price values or different token decimals.
        const normalizedDecimalCount = Math.max(fromToken.decimals, toToken.decimals)
        const fromTokenPriceBN = ethers.utils.parseUnits(fromTokenPrice.toString(), normalizedDecimalCount)
        const toTokenPriceBN = ethers.utils.parseUnits(toTokenPrice.toString(), normalizedDecimalCount)
        const toAmountBN = ethers.utils.parseUnits(toAmount, normalizedDecimalCount)
        const fromAmountBN = toTokenPriceBN.mul(toAmountBN).div(fromTokenPriceBN)

        // Slippage percentage is multiplied by 1000 to convert it into an integer form that represents the fraction.
        // because BigNumber cannot handle floating points directly.
        const slippageFractionBN = ethers.BigNumber.from(Math.floor(slippagePercentage * 1000))

        // For example, a 10.5% slippage is represented here as 10,500 (after scaling),
        // and dividing by 100,000 effectively applies the 10.5% to the fromAmountBN.
        const slippageBN = fromAmountBN.mul(slippageFractionBN).div(100000)

        const totalFromAmountBN = fromAmountBN.add(slippageBN)

        return ethers.utils.formatUnits(totalFromAmountBN, fromToken.decimals)
    } catch (error) {
        console.error('Failed to calculate fromAmount:', error)
        return null
    }
}
