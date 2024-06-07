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
    const tokenImage = consts.peanutTokenDetails
        .find((detail) => detail.chainId === chainId)
        ?.tokens.find((token) => utils.compareTokenAddresses(token.address, tokenAddress))?.logoURI
    const chainImage = consts.supportedPeanutChains.find((chain) => chain.chainId === chainId)?.icon.url

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                width: '400px',
                borderRadius: '8px',
                borderWidth: '4px',
                borderColor: 'white',
                backgroundImage: 'linear-gradient(to bottom right, #FAF4F0, #FF90E8)',
            }}
        >
            <label style={{ fontSize: '32px', fontWeight: 'bold', color: 'black' }}>
                {utils.formatTokenAmount(parseFloat(amount), 2)} {tokenSymbol}
            </label>
            <div
                style={{
                    display: 'flex',
                    position: 'absolute',
                    bottom: '20px',
                    right: '30px',
                    height: '40px',
                    width: '40px',
                }}
            >
                <img
                    src={chainImage ?? ''}
                    alt="Chain Image"
                    style={{ height: '100%', width: '100%', objectFit: 'cover', position: 'absolute' }}
                />
                <img
                    src={tokenImage ?? ''}
                    alt="Token Image"
                    style={{
                        position: 'absolute',
                        right: '-10px',
                        top: '-10px',
                        height: '25px',
                        width: '25px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                    }}
                />
            </div>
        </div>
    )
}
