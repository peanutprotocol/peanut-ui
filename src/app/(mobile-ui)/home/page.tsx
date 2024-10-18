import { ArrowUpButtonIcon } from '@/components/0_Bruddle/arrow-icon'
import Link from 'next/link'
import React from 'react'

const Home = () => {
    return (
        <div className="flex h-full w-full flex-row items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-2">
                <Link href={'/send'}>
                    <ArrowUpButtonIcon />
                </Link>
                <p className="text-base">Send</p>
            </div>
            <div className="flex flex-col items-center gap-2">
                <Link href={'/request'}>
                    <ArrowUpButtonIcon />
                </Link>
                <p>Recieve</p>
            </div>
        </div>
    )
}

export default Home
