'use client'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import Image, { StaticImageData } from 'next/image'
import { useRouter } from 'next/navigation'

interface CryptoDepositQRProps {
    tokenName: string
    chainName: string
    depositAddress: string
    onBack: () => void
    tokenIcon: StaticImageData | string
    chainIcon: StaticImageData | string
}

export const CryptoDepositQR = ({
    tokenName,
    chainName,
    depositAddress,
    onBack,
    tokenIcon,
    chainIcon,
}: CryptoDepositQRProps) => {
    const router = useRouter()

    return (
        <div className="flex w-full flex-col justify-start space-y-8 pb-5 md:pb-0">
            <NavHeader title={'Add Money'} onPrev={onBack} />

            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                <Card position="single" className="p-4">
                    <div className="flex items-center gap-3">
                        <AvatarWithBadge size="extra-small" className="bg-yellow-400" icon="wallet-outline" />

                        <div className="flex flex-col">
                            <div className="inline-flex items-center gap-1 text-sm font-semibold md:text-base">
                                <h3 className="inline">Deposit</h3>
                                <Image src={tokenIcon} alt={tokenName} width={18} height={18} />
                                <span>{tokenName} on</span>
                                <Image src={chainIcon} alt={chainName} width={18} height={18} />
                                <span>{chainName}</span>
                            </div>
                            <p className="text-xs text-grey-1">Other tokens or networks will be lost</p>
                        </div>
                    </div>
                </Card>

                <div className="flex items-center justify-center">
                    <QRCodeWrapper url={depositAddress} />
                </div>

                <div className="flex flex-col gap-2">
                    <label htmlFor="deposit-address" className="text-sm font-bold text-black">
                        Your deposit address
                    </label>
                    <Card className="flex items-center justify-between px-4 py-3 text-xs text-grey-1">
                        <p className="text-xs md:text-sm md:font-semibold">{depositAddress}</p>

                        <CopyToClipboard textToCopy={depositAddress} className="text-black" iconSize={'4'} />
                    </Card>
                    <Button
                        variant="purple"
                        onClick={() => router.push('/home')}
                        className="mt-4 w-full"
                        shadowSize="4"
                    >
                        I did it!
                    </Button>
                </div>
            </div>
        </div>
    )
}
