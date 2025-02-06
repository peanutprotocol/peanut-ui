import { ListItemView } from '@/components/Global/ListItemView'
import { formatAmount, getChainName } from '@/utils'

export default function PaymentHistory() {
    return (
        <div className="space-y-3 border-b border-b-black">
            <div className="text-base font-semibold">
                Payment history to <span className="underline">kushagrasarathe.eth</span>
            </div>
            <div>
                {walletDetails.balances.map((balance) => (
                    <ListItemView
                        key={`${balance.chainId}-${balance.symbol}`}
                        id={`${balance.chainId}-${balance.symbol}`}
                        variant="balance"
                        primaryInfo={{ title: balance.symbol }}
                        secondaryInfo={{
                            mainText: `$${Number(balance.value).toFixed(2)}`,
                            subText: getChainName(balance.chainId.toString()),
                        }}
                        metadata={{
                            tokenLogo: balance.logoURI,
                            subText: `${formatAmount(balance.amount)} ${balance.symbol}`,
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
const walletDetails = {
    balances: [
        {
            chainId: 1,
            symbol: 'ETH',
            value: '123',
            logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
            amount: '0.5',
        },
        {
            chainId: 56,
            symbol: 'BNB',
            value: '789',
            logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
            amount: '1.2',
        },
        {
            chainId: 137,
            symbol: 'MATIC',
            value: '456',
            logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
            amount: '300',
        },
        {
            chainId: 250,
            symbol: 'FTM',
            value: '123',
            logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
            amount: '1000',
        },
        {
            chainId: 43114,
            symbol: 'AVAX',
            value: '678',
            logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
            amount: '50',
        },
    ],
}
