import { Card } from '@/components/0_Bruddle'
import { ArrowIcon } from '@/components/0_Bruddle'
import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import PeanutWalletIcon from '@/assets/icons/peanut-wallet.png'

const Home = () => {
    return (
        <div className="flex h-full w-full flex-col gap-8">
            <div className="">
                <div className="lg:text-center">
                    <div className="relative mb-2.5 h-21 w-21 self-center lg:mx-auto">
                        <img
                            className="rounded-full object-cover"
                            src="https://avatars.githubusercontent.com/u/36443340?v=4"
                            alt="Avatar"
                        />
                    </div>
                    <div className="text-h4">nezzar.eth</div>
                    <div className="text-sm">nezz0746@gmail.com</div>
                </div>
            </div>
            <Card
                className="flex w-full max-w-[300px] flex-col gap-4 rounded-md bg-purple-1 text-white sm:mx-auto"
                shadowSize="6"
            >
                <Card.Content className="flex flex-col gap-2">
                    <Image src={PeanutWalletIcon} alt="" />
                    <p className="text-4xl font-black sm:text-5xl">$40.00</p>
                    <div className="flex flex-col">
                        <p>peanut.me/</p>
                        <p className="font-bold">kkonrad</p>
                    </div>
                </Card.Content>
            </Card>
            <div className="flex w-full flex-row items-center justify-center gap-4 sm:gap-8">
                <div className="flex flex-col items-center gap-2">
                    <Link href={'/send'}>
                        <Card
                            shadowSize="4"
                            className="flex h-24 w-24 flex-row items-center justify-center rounded-full text-center sm:h-30 sm:w-30"
                        >
                            <ArrowIcon />
                        </Card>
                    </Link>
                    <p className="text-base">Send</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Link href={'/request/create'}>
                        <Card
                            shadowSize="4"
                            className="flex h-24 w-24 flex-row items-center justify-center rounded-full text-center sm:h-30 sm:w-30"
                        >
                            <ArrowIcon className="rotate-180" />
                        </Card>
                    </Link>
                    <p>Recieve</p>
                </div>
            </div>
        </div>
    )
}

export default Home
