import * as consts from '@/constants'
import * as utils from '@/utils'

export function LinkPreviewImg({
    amount,
    chainId,
    tokenAddress,
    tokenSymbol,
    senderAddress,
    tokenPrice,
}: {
    amount: string
    chainId: string
    tokenAddress: string
    tokenSymbol: string
    senderAddress: string
    tokenPrice?: number
}) {
    const tokenImage = consts.peanutTokenDetails
        .find((detail) => detail.chainId === chainId)
        ?.tokens.find((token) => utils.areTokenAddressesEqual(token.address, tokenAddress))?.logoURI
    const chainImage = consts.supportedPeanutChains.find((chain) => chain.chainId === chainId)?.icon.url

    const bgImageUrl = 'https://peanut.to/bg.svg'
    const peanutImageUrl = 'https://peanut.to/peanutman-logo.svg'
    console.log('6', Date.now())
    return (
        <div
            style={{
                position: 'relative',
                height: '200px',
                width: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'white',
                padding: '8px',
                border: '1px solid black',
            }}
        >
            <div
                style={{
                    position: 'relative',
                    display: 'flex',
                    height: '100%',
                    width: '100%',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: 'transparent',
                    border: '2px solid black',
                    borderRadius: '4px',
                }}
            >
                <img
                    src={bgImageUrl}
                    alt="Background"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        zIndex: -1,
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
                    <label style={{ fontSize: '16px', fontWeight: 'bold', color: 'black', zIndex: 1 }}>
                        {utils.printableAddress(senderAddress)} sent you
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
                                zIndex: 1,
                                position: 'relative',
                            }}
                        >
                            {tokenImage && (
                                <img
                                    src={tokenImage ?? ''}
                                    alt="Chain Image"
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
                                    alt="Token Image"
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
                                zIndex: 1,
                            }}
                        >
                            {utils.formatTokenAmount(parseFloat(amount), 2)} {tokenSymbol}
                        </label>
                    </div>

                    {tokenPrice && (
                        <label style={{ fontSize: '16px', color: 'black', zIndex: 1 }}>
                            ${utils.formatTokenAmount(parseFloat(amount) * tokenPrice, 2)}
                        </label>
                    )}
                </div>

                <img
                    src={peanutImageUrl}
                    alt="ddee"
                    style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        width: '40px',
                        height: '40px',
                        objectFit: 'cover',
                        zIndex: 1,
                    }}
                />
            </div>
        </div>
    )
}
