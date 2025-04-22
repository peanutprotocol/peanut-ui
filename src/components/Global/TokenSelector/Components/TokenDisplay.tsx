import * as interfaces from '@/interfaces'
import { formatTokenAmount } from '@/utils'

export const tokenDisplay = (
    tokens: interfaces.IToken[],
    setToken: (symbol: string) => void,
    balances: interfaces.IUserBalance[],
    selectedChainID: string,
    type: 'send' | 'xchain' = 'send'
) => {
    return (
        <ul
            role="list"
            className="max-h-52 divide-y divide-black overflow-auto border border-black dark:divide-white dark:border-white"
        >
            {tokens.map((token) => (
                <li
                    key={token.address + Math.random()}
                    className="flex items-center justify-between gap-x-6 px-4 py-2 hover:bg-n-1/10"
                    onClick={() => {
                        setToken(token.address)
                    }}
                >
                    <div className="flex items-center justify-start gap-x-4">
                        <img className="h-6 w-6" src={token.logoURI} alt="" />
                        <div className="text-h8">{token.name}</div>
                    </div>
                    {type === 'send' && (
                        <p className="text-xs text-grey-1 ">
                            {formatTokenAmount(
                                balances.find(
                                    (balance) =>
                                        balance.address === token.address && balance.chainId === selectedChainID
                                )?.amount,
                                4
                            )}
                        </p>
                    )}
                </li>
            ))}
        </ul>
    )
}
