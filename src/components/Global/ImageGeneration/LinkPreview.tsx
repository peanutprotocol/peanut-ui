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
        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, tokenAddress))?.logoURI
    const chainImage = consts.supportedPeanutChains.find((chain) => chain.chainId === chainId)?.icon.url

    const bgImageUrl = `https://peanut.to/bg.svg`
    const peanutImageUrl = 'https://peanut.to/peanutman-logo.svg'
    return (
        <div
            style={{
                position: 'relative',
                height: '800px',
                width: '1600px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'transparent',
                padding: '16px',
                border: '4px solid black',
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
                    <label style={{ fontSize: '64px', fontWeight: 'bold', color: 'black', zIndex: 1 }}>
                        {utils.shortenAddress(senderAddress)} sent you
                    </label>
                    <div
                        style={{
                            display: 'flex',
                            gap: '48px',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                height: '210px',
                                width: '210px',
                                zIndex: 1,
                                position: 'relative',
                            }}
                        >
                            {chainImage && (
                                <img
                                    src={chainImage ?? ''}
                                    alt="Chain Image"
                                    style={{
                                        height: '200px',
                                        width: '200px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        position: 'absolute',
                                    }}
                                />
                            )}

                            {tokenImage && (
                                <img
                                    src={tokenImage ?? ''}
                                    alt="Token Image"
                                    style={{
                                        position: 'absolute',
                                        right: '-50px',
                                        top: '-50px',
                                        width: '150px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                    }}
                                />
                            )}
                        </div>
                        <label
                            style={{
                                fontSize: '196px',
                                fontWeight: 'bold',
                                textShadow: '4px 4px 4px rgba(0,0,0,0.3)',
                                color: 'black',
                                zIndex: 1,
                            }}
                        >
                            {utils.formatTokenAmount(parseFloat(amount), 2)} {tokenSymbol}
                        </label>
                    </div>

                    {tokenPrice && (
                        <label style={{ fontSize: '64px', color: 'black', zIndex: 1 }}>
                            ${utils.formatTokenAmount(parseFloat(amount) * tokenPrice, 2)}
                        </label>
                    )}
                </div>

                <img
                    src={peanutImageUrl}
                    alt="ddee"
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        width: '120px',
                        height: '120px',
                        objectFit: 'cover',
                        zIndex: 1,
                    }}
                />
            </div>
        </div>
    )
}
