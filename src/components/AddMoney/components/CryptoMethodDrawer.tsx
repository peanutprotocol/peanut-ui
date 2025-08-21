'use client'

import { ARBITRUM_ICON, OTHER_CHAINS_ICON } from '@/assets'
import { Card } from '@/components/0_Bruddle'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import React from 'react'

const CryptoMethodDrawer = ({ isDrawerOpen, closeDrawer }: { isDrawerOpen: boolean; closeDrawer: () => void }) => {
    const router = useRouter()
    return (
        <Drawer open={isDrawerOpen} onOpenChange={closeDrawer}>
            <DrawerContent className="p-5">
                <div className="mx-auto space-y-4 md:max-w-2xl">
                    <h2 className="text-base font-bold">Select a deposit method</h2>

                    <Card className={'cursor-pointer px-4 py-2 hover:bg-gray-50'}>
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
    )
}

export default CryptoMethodDrawer
