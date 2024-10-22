import * as consts from '@/constants'
import * as utils from '@/utils'
import { headers } from 'next/headers'

export enum PreviewType {
    CLAIM = 'claim',
    REQUEST = 'request',
}

type PreviewTypeData = {
    message: string
}

const PREVIEW_TYPES: Record<PreviewType, PreviewTypeData> = {
    [PreviewType.CLAIM]: { message: 'sent you' },
    [PreviewType.REQUEST]: { message: 'is requesting' },
}

export function LinkPreviewImg({
    amount,
    chainId,
    tokenAddress,
    tokenSymbol,
    address,
    previewType,
}: {
    amount: string
    chainId: string
    tokenAddress: string
    tokenSymbol: string
    address: string
    previewType: PreviewType
}) {
    const tokenImage = consts.peanutTokenDetails
        .find((detail) => detail.chainId === chainId)
        ?.tokens.find((token) => utils.areTokenAddressesEqual(token.address, tokenAddress))?.logoURI
    const chainImage = consts.supportedPeanutChains.find((chain) => chain.chainId === chainId)?.icon.url

    let host = headers().get('host') || 'peanut.to'
    host = `${process.env.NODE_ENV === 'development' ? 'http://' : 'https://'}${host}`
    const previewBg = `${host}/preview-bg.png`
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
                    {utils.printableAddress(address)} {PREVIEW_TYPES[previewType].message}
                </label>
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
                    <div
                        style={{
                            display: 'flex',
                            height: '52px',
                            width: '52px',
                            position: 'relative',
                        }}
                    >
                        {tokenImage && (
                            <img
                                src={tokenImage ?? ''}
                                alt="Token Image"
                                height="50px"
                                width="50px"
                                style={{
                                    height: '50px',
                                    width: '50px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    position: 'absolute',
                                }}
                            />
                        )}

                        {chainImage && (
                            <img
                                src={chainImage ?? ''}
                                alt="Chain Image"
                                height="32px"
                                width="32px"
                                style={{
                                    position: 'absolute',
                                    right: '-12px',
                                    top: '-12px',
                                    width: '37px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                }}
                            />
                        )}
                    </div>
                    <label
                        style={{
                            fontSize: '49px',
                            fontWeight: 'bold',
                            textShadow: '1px 1px 1px rgba(0,0,0,0.3)',
                            color: 'black',
                        }}
                    >
                        {utils.formatTokenAmount(parseFloat(amount), 2)} {tokenSymbol}
                    </label>
                </div>
            </div>
        </div>
    )
}
