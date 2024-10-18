import { Card } from '@/components/0_Bruddle'
import { ArrowIcon } from '@/components/0_Bruddle'
import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import PeanutWalletIcon from '@/assets/icons/peanut-wallet.png'

const Home = () => {
    return (
        <div className="grid h-full w-full grid-cols-2 items-center justify-center gap-4 px-7">
            <div className="col-span-2 sm:col-span-1">
                <div className="mb-8 md:mb-6 lg:text-center">
                    <div className="relative mb-2.5 h-21 w-21 self-center lg:mx-auto">
                        <img
                            className="rounded-full object-cover"
                            src="https://avatars.githubusercontent.com/u/36443340?v=4"
                            alt="Avatar"
                        />
                    </div>
                    <div className="text-h4">nezzar.eth</div>
                    <div className="mb-4 text-sm">nezz0746@gmail.com</div>
                    <div className="mb-3 text-xs"></div>
                    <div className="label-stroke min-w-[5.125rem]">Designer</div>
                </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
                <Card
                    className="mx-auto flex w-full flex-col gap-4 rounded-md bg-purple-1 p-6 text-white"
                    shadowSize="6"
                >
                    <Image src={PeanutWalletIcon} alt="" />
                    <p className="text-4xl font-black sm:text-6xl">$40.00</p>
                    <div className="flex flex-col">
                        <p>peanut.me/</p>
                        <p className="font-bold">kkonrad</p>
                    </div>
                </Card>
            </div>
            <div className="col-span-2 grid w-full grid-cols-2">
                <div className="flex flex-col items-center gap-2">
                    <Link href={'/send'}>
                        <Card className="flex h-30 w-30 flex-row items-center justify-center rounded-full text-center">
                            <ArrowIcon />
                        </Card>
                    </Link>
                    <p className="text-base">Send</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <Link href={'/request/create'}>
                        <Card className="flex h-30 w-30 flex-row items-center justify-center rounded-full text-center">
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
