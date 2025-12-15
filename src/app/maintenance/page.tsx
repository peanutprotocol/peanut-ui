'use client'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { Button } from '@/components/0_Bruddle/Button'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

const MaintenancePage = () => {
    const router = useRouter()
    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 p-6">
            <Image src={chillPeanutAnim.src} alt="Maintenance" width={250} height={250} />
            <h1 className="text-3xl font-bold text-black">Under Maintenance</h1>
            <p className="text-center text-lg text-gray-1">
                We are currently going through maintenance. We should be back online shortly. Sorry for the
                inconvenience.
            </p>
            <p className="text-center text-gray-1">Thank you for your patience.</p>

            <Button
                variant="transparent"
                onClick={() => router.push('/support')}
                className="h-5 w-fit p-0 underline underline-offset-2"
            >
                Contact Support?
            </Button>
        </div>
    )
}

export default MaintenancePage
