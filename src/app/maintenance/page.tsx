'use client'
import { PeanutCrying } from '@/assets/mascot'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Image from 'next/image'

const MaintenancePage = () => {
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-6">
            <Image src={PeanutCrying.src} unoptimized alt="Maintenance" width={250} height={250} />
            <h1 className="text-3xl font-bold text-black">Under Maintenance</h1>
            <p className="text-center text-lg text-gray-1">
                We are currently going through maintenance. We should be back online shortly. Sorry for the
                inconvenience.
            </p>
            <p className="text-center text-gray-1">Thank you for your patience.</p>

            <LinkButton href="/support">Contact Support?</LinkButton>
        </div>
    )
}

export default MaintenancePage
