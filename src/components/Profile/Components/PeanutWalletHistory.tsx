import { IProfileTableData } from '@/interfaces'
import { MobileTableComponent } from './MobileTableComponent'

// todo: use acutal data after context to redux migration is done for walletContext
const mockData: IProfileTableData[] = [
    {
        itemKey: '1',
        primaryText: 'Link Sent',
        secondaryText: '- $ 50',
        tertiaryText: 'To 0xC7f...36e07',
        quaternaryText: 'Quaternary Text 1',
        address: '0xC7f...36e07',
        type: 'history',
        avatar: { avatarUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040' },
        dashboardItem: {
            link: 'https://example.com/link1',
            type: 'Link Sent',
            amount: '100',
            date: '2024-01-01',
            chain: 'Arbitrum One',
            tokenSymbol: 'USDC',
            address: '0xC7f63e80c47fd2274663f6901E2FA65F32836e07',
            status: 'pending',
            message: 'Transaction pending',
            attachmentUrl: 'https://example.com/attachment1.png',
            points: 10,
            txHash: '0x1234567890abcdef',
        },
    },
    {
        itemKey: '2',
        primaryText: 'Link Sent',
        secondaryText: '- $ 50',
        tertiaryText: 'To 0xC7f...36e07',
        quaternaryText: 'Quaternary Text 1',
        address: '0xC7f...36e07',
        type: 'history',
        avatar: { avatarUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=040' },
        dashboardItem: {
            link: 'https://example.com/link1',
            type: 'Link Sent',
            amount: '100',
            date: '2024-01-01',
            chain: 'Arbitrum One',
            tokenSymbol: 'USDC',
            address: '0xC7f63e80c47fd2274663f6901E2FA65F32836e07',
            status: 'pending',
            message: 'Transaction pending',
            attachmentUrl: 'https://example.com/attachment1.png',
            points: 10,
            txHash: '0x1234567890abcdef',
        },
    },
]

const PeanutWalletHistory = () => {
    return (
        <div className="space-y-3 pb-4">
            <div>History</div>
            <div className="border-b border-n-1">
                {mockData.map((data) => (
                    <div key={(data.itemKey ?? '') + Math.random()}>
                        <MobileTableComponent
                            itemKey={(data.itemKey ?? '') + Math.random()}
                            primaryText={data.primaryText}
                            secondaryText={data.secondaryText}
                            tertiaryText={data.tertiaryText}
                            quaternaryText={data.quaternaryText}
                            address={data.address}
                            type={data.type}
                            avatar={data.avatar}
                            dashboardItem={data.dashboardItem}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default PeanutWalletHistory
