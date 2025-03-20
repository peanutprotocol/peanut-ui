import { formatAmount, printableAddress } from '@/utils'
import { isAddress } from 'viem'

export enum PreviewType {
    CLAIM = 'claim',
    REQUEST = 'request',
}

type PreviewTypeData = {
    message: string
    emptyAmountMessage?: string
}

const PREVIEW_TYPES: Record<PreviewType, PreviewTypeData> = {
    [PreviewType.CLAIM]: { message: 'is sending you' },
    [PreviewType.REQUEST]: { message: 'is requesting', emptyAmountMessage: 'is requesting funds' },
}

function formatDisplayAddress(address: string): string {
    if (address.startsWith('0x')) {
        if (isAddress(address)) {
            return printableAddress(address)
        }
        return address
    }
    return address
}

export function LinkPreviewImg({
    amount,
    tokenSymbol,
    address,
    previewType,
}: {
    amount: string
    tokenSymbol?: string
    address: string
    previewType: PreviewType
}) {
    const previewBg = `${
        process.env.NEXT_PUBLIC_VERCEL_URL
            ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
            : process.env.NEXT_PUBLIC_BASE_URL
    }/social-preview-bg.png`

    const isEmptyAmount = !amount || parseFloat(amount) === 0
    const showEmptyAmountMessage = previewType === PreviewType.REQUEST && isEmptyAmount

    return (
        <div
            style={{
                display: 'flex',
                height: '100%',
                width: '100%',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'transparent',
            }}
        >
            <img
                src={previewBg}
                alt="Background"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
            />

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                }}
            >
                <label style={{ fontSize: '16px', fontWeight: 'bold', color: 'black' }}>
                    {formatDisplayAddress(address)}{' '}
                    {showEmptyAmountMessage
                        ? PREVIEW_TYPES[previewType].emptyAmountMessage
                        : PREVIEW_TYPES[previewType].message}
                </label>
                {!showEmptyAmountMessage && (
                    <div
                        style={{
                            display: 'flex',
                            gap: '16px',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginLeft: '-8px',
                            marginTop: '1px',
                        }}
                    >
                        <label
                            style={{
                                fontSize: '49px',
                                fontWeight: 'bold',
                                color: 'black',
                            }}
                        >
                            {!tokenSymbol && '$'} {formatAmount(amount)} {tokenSymbol && tokenSymbol}
                        </label>
                    </div>
                )}
            </div>
        </div>
    )
}
