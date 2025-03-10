import PEANUTMAN_CRY from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif'
import { Button } from '@/components/0_Bruddle'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export type ValidationErrorViewProps = {
    title: string
    message: string
    buttonText: string
    redirectTo: string
}

function ValidationErrorView({ title, message, buttonText, redirectTo }: ValidationErrorViewProps) {
    const router = useRouter()
    return (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-lg text-center">
            <Image src={PEANUTMAN_CRY.src} alt="Peanutman crying 😭" width={96} height={96} />
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">{title}</h3>
                <h3 className="text-sm font-normal md:max-w-xs">{message}</h3>
            </div>
            <Button
                onClick={() => {
                    router.push(redirectTo)
                }}
                size="medium"
                shadowSize="4"
                variant="purple"
                className="w-fit"
            >
                {buttonText}
            </Button>
        </div>
    )
}

export default ValidationErrorView
