'use client'

import { ARBITRUM_ICON, OTHER_CHAINS_ICON } from '@/assets'
import { Card } from '@/components/0_Bruddle'
import ActionModal from '@/components/Global/ActionModal'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { Slider } from '@/components/Slider'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import React, { Dispatch, SetStateAction, useState } from 'react'

const CryptoMethodDrawer = ({
    isDrawerOpen,
    setisDrawerOpen,
    closeDrawer,
}: {
    isDrawerOpen: boolean
    setisDrawerOpen: Dispatch<SetStateAction<boolean>>
    closeDrawer: () => void
}) => {
    const router = useRouter()
    const [showRiskModal, setShowRiskModal] = useState(false)

    return (
        <>
            <Drawer open={isDrawerOpen} onOpenChange={showRiskModal ? undefined : closeDrawer}>
                <DrawerContent className="p-5 pb-14">
                    <div className="mx-auto space-y-4 md:max-w-2xl">
                        <h2 className="text-base font-bold">Select a deposit method</h2>

                        <Card
                            onClick={() => {
                                setisDrawerOpen(false)
                                setShowRiskModal(true)
                            }}
                            className={'cursor-pointer px-4 py-2 hover:bg-gray-50'}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <div className="flex gap-3">
                                            <div className="font-medium">USDC on Arbitrum</div>
                                            <span
                                                className={
                                                    'flex items-center justify-center whitespace-nowrap rounded-full bg-primary-3 px-4 text-center font-roboto text-[10px] font-semibold text-primary-4'
                                                }
                                            >
                                                FREE
                                            </span>
                                        </div>

                                        <div className={'text-sm text-grey-1'}>Recommended option for deposits</div>
                                    </div>
                                </div>
                                <div className="relative">
                                    <Image src={ARBITRUM_ICON} alt="Arbitrum" width={28} height={28} />
                                    <Image
                                        className="absolute bottom-0 left-3"
                                        src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
                                        alt="USDC"
                                        width={20}
                                        height={20}
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card
                            onClick={() => router.push('/add-money/crypto/direct')}
                            className={'cursor-pointer px-4 py-2 hover:bg-gray-50'}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                        <div className="font-medium">Other Tokens</div>

                                        <div className={'text-sm text-grey-1'}>Deposit with any token you hold</div>
                                    </div>
                                </div>
                                <Image src={OTHER_CHAINS_ICON} alt="Arbitrum" width={60} height={60} />
                            </div>
                        </Card>
                    </div>
                </DrawerContent>
            </Drawer>
            <ActionModal
                visible={showRiskModal}
                onClose={() => {
                    setShowRiskModal(false)
                    setisDrawerOpen(true)
                }}
                icon={'alert'}
                iconContainerClassName="bg-yellow-1"
                modalClassName="z-[9999]"
                title={`Only send USDC on Arbitrum`}
                description={
                    <span className="text-sm">
                        Sending funds via any other network will result in a <b>permanent loss.</b>
                    </span>
                }
                footer={
                    <div className="w-full">
                        <Slider onValueChange={(v) => v && router.push('/add-money/crypto')} />
                    </div>
                }
                ctas={[]}
                modalPanelClassName="max-w-xs"
            />
        </>
    )
}

export default CryptoMethodDrawer
