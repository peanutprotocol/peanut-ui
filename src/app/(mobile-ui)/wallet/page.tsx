'use client'

import { ArrowIcon, Button, Card } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { useWallet } from '@/context/walletContext'
import smallPeanut from '@/assets/icons/small-peanut.png'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { HomeLink } from '@/components/Home/HomeLink'

const WalletDetailsPage = () => {
    const { selectedWallet } = useWallet()

    return (
        <div className="flex w-full flex-row justify-center gap-2">
            <div className="flex w-[100%] flex-col gap-4 sm:w-[90%] sm:gap-2 md:w-[70%] lg:w-[35%]">
                <Card shadowSize="4" className="w-full rounded-md py-5">
                    <Card.Content className="flex h-full flex-row items-center justify-evenly">
                        <img src={smallPeanut.src} className="h-15 w-15 object-contain" />
                        <p className="text-xl sm:text-2xl">
                            <span className="font-bold">{selectedWallet?.handle}</span>.peanut.wallet
                        </p>
                    </Card.Content>
                </Card>
                <Card shadowSize="4" className="w-full rounded-md py-10">
                    <Card.Content className="flex h-full flex-row items-center justify-center">
                        <div className="text-5xl">{'$ 420.69'}</div>
                    </Card.Content>
                </Card>
                <div className="flex flex-row gap-2">
                    <Button shadowSize="4">
                        <Link href="/cashout" className="flex flex-row items-center text-nowrap">
                            <div>
                                <Icon name="minus-circle" />
                            </div>
                            Cash out
                        </Link>
                    </Button>
                    <Button shadowSize="4" className="text-nowrap" disabled>
                        <div>
                            <Icon name="plus-circle" />
                        </div>
                        Top Up
                    </Button>
                </div>
                <div className="flex w-full flex-grow flex-row items-center justify-center gap-4 sm:justify-evenly sm:gap-8">
                    <motion.div className="flex flex-col items-center gap-2" whileTap={{ scale: 0.95 }}>
                        <HomeLink href={'/send'}>
                            <ArrowIcon />
                        </HomeLink>
                        <p className="text-base">Send</p>
                    </motion.div>
                    <motion.div className="flex flex-col items-center gap-2" whileTap={{ scale: 0.95 }}>
                        <HomeLink href={'/request/create'}>
                            <ArrowIcon className="rotate-180" />
                        </HomeLink>
                        <p>Recieve</p>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

export default WalletDetailsPage
