import PEANUTMAN_CRY from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif'
import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

function ValidationErrorView() {
    const { user } = useAuth()
    const router = useRouter()
    return (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-lg text-center">
            <Image src={PEANUTMAN_CRY.src} alt="Peanutman crying 😭" width={96} height={96} />
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">Invalid Payment URL!</h3>
                <h3 className="text-sm font-normal md:max-w-xs">
                    They payment you are trying to access is invalid. Please check the URL and try again.
                </h3>
            </div>
            <Button
                onClick={() => {
                    if (!!user) {
                        router.push('/home')
                    } else {
                        router.push('/signin')
                    }
                }}
                size="medium"
                shadowSize="4"
                variant="purple"
                className="w-fit"
            >
                {user ? 'Go to home' : 'Create your Peanut Wallet'}
            </Button>
        </div>
    )
}

export default ValidationErrorView
