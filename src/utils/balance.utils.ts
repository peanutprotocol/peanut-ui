import { isAddressZero, areEvmAddressesEqual } from '@/utils'
import { IUserBalance, ChainValue } from '@/interfaces'

export async function fetchWalletBalances(
    address: string
): Promise<{ balances: IUserBalance[]; totalBalance: number }> {
    try {
        const apiResponse = await fetch('/api/walletconnect/fetch-wallet-balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ address }),
        })

        if (!apiResponse.ok) {
            throw new Error('API request failed')
        }

        const apiResponseJson = await apiResponse.json()

        const processedBalances = apiResponseJson.balances
            .filter((balance: any) => balance.value > 0.009)
            .map((item: any) => ({
                chainId: item?.chainId ? item.chainId.split(':')[1] : '1',
                address: item?.address ? item.address.split(':')[2] : '0x0000000000000000000000000000000000000000',
                name: item.name,
                symbol: item.symbol,
                decimals: parseInt(item.quantity.decimals),
                price: item.price,
                amount: parseFloat(item.quantity.numeric),
                currency: 'usd',
                logoURI: item.iconUrl,
                value: item.value.toString(),
            }))
            .map((balance: any) =>
                balance.chainId === '8508132'
                    ? { ...balance, chainId: '534352' }
                    : balance.chainId === '81032'
                      ? { ...balance, chainId: '81457' }
                      : balance.chainId === '59160'
                        ? { ...balance, chainId: '59144' }
                        : balance
            )
            .sort((a: any, b: any) => {
                const valueA = parseFloat(a.value)
                const valueB = parseFloat(b.value)

                if (valueA === valueB) {
                    if (isAddressZero(a.address)) return -1
                    if (isAddressZero(b.address)) return 1
                    return b.amount - a.amount
                }
                return valueB - valueA
            })

        const totalBalance = processedBalances.reduce((acc: number, balance: any) => acc + Number(balance.value), 0)

        return {
            balances: processedBalances,
            totalBalance,
        }
    } catch (error) {
        console.error('Error fetching wallet balances:', error)
        return { balances: [], totalBalance: 0 }
    }
}

export function balanceByToken(
    balances: IUserBalance[],
    chainId: string,
    tokenAddress: string
): IUserBalance | undefined {
    if (!chainId || !tokenAddress) return undefined
    return balances.find(
        (balance) => balance.chainId === chainId && areEvmAddressesEqual(balance.address, tokenAddress)
    )
}

export function calculateValuePerChain(balances: IUserBalance[]): ChainValue[] {
    let result: ChainValue[] = []

    try {
        const chainValueMap: { [key: string]: number } = {}
        balances.forEach((balance) => {
            const chainId = balance?.chainId ? balance.chainId.split(':')[1] : '1'
            if (!chainValueMap[chainId]) {
                chainValueMap[chainId] = 0
            }
            if (balance.value) chainValueMap[chainId] += Number(balance.value)
        })

        result = Object.keys(chainValueMap).map((chainId) => ({
            chainId,
            valuePerChain: chainValueMap[chainId],
        }))

        result.sort((a, b) => b.valuePerChain - a.valuePerChain)
    } catch (error) {
        console.log('Error calculating value per chain: ', error)
    }
    return result
}
