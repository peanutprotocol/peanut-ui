import * as interfaces from '@/interfaces'

export const simpleTokenDisplay = (tokens: interfaces.IToken[], setToken: (symbol: string) => void) => {
    return (
        <div className="grid w-max grid-cols-3 gap-4">
            {tokens.slice(0, 6).map((token) => (
                <div
                    key={token.address + Math.random()}
                    className="flex w-max cursor-pointer items-center justify-start gap-1 border border-n-1 px-2 py-1 hover:bg-n-1/10 dark:border-white"
                    onClick={() => setToken(token.address)}
                >
                    <img src={token.logoURI} alt={token.symbol} className="h-6 w-6" />
                    <div className="text-h8">{token.symbol}</div>
                </div>
            ))}
        </div>
    )
}
