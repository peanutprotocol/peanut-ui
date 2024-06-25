import * as consts from '@/constants'
import * as utils from '@/utils'
export function LinkPreviewImg({
    amount,
    chainId,
    tokenAddress,
    tokenSymbol,
}: {
    amount: string
    chainId: string
    tokenAddress: string
    tokenSymbol: string
}) {
    console.log(consts.peanutTokenDetails.find((detail) => detail.chainId === chainId)?.tokens)
    const tokenImage = consts.peanutTokenDetails
        .find((detail) => detail.chainId === chainId)
        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, tokenAddress))?.logoURI
    const chainImage = consts.supportedPeanutChains.find((chain) => chain.chainId === chainId)?.icon.url

    console.log('tokenImage: ', tokenImage)
    console.log('chainImage: ', chainImage)
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '800px',
                width: '1600px',
                borderRadius: '64px',
                borderWidth: '16px',
                borderColor: 'black',
                backgroundImage:
                    'radial-gradient(circle at top right, #FF90E8, transparent), radial-gradient(circle at bottom left, #23A094, transparent)',
                backgroundColor: '#FAF4F0',
            }}
        >
            <label style={{ fontSize: '128px', fontWeight: 'bolder', color: 'black' }}>
                {utils.formatTokenAmount(parseFloat(amount), 2)} {tokenSymbol}
            </label>
            <div
                style={{
                    display: 'flex',
                    position: 'absolute',
                    bottom: '40px',
                    right: '60px',
                    height: '160px',
                    width: '160px',
                }}
            >
                {chainImage && (
                    <img
                        src={chainImage ?? ''}
                        alt="Chain Image"
                        style={{
                            height: '150px',
                            width: '150px',
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
                            right: '-40px',
                            top: '-40px',
                            height: '100px',
                            width: '100px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                        }}
                    />
                )}
            </div>
        </div>
    )
}
