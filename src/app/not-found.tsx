import Link from 'next/link'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import PEANUTMAN_CRY from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif'
import Image from 'next/image'

export default function NotFound() {
    return (
        <PageContainer className="min-h-[100dvh]">
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <div className="shadow-4 flex w-full flex-col items-center space-y-2 border border-n-1 bg-white p-4">
                    <h1 className="text-3xl font-extrabold">Not found</h1>
                    <Image src={PEANUTMAN_CRY.src} className="" alt="Peanutman crying 😭" width={96} height={96} />
                    <p>Woah there buddy, you're not supposed to be here.</p>
                    <Link href="/" className="btn btn-purple btn-medium shadow-4">
                        Take me home, I'm scared
                    </Link>
                </div>
            </div>
        </PageContainer>
    )
}
