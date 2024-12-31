import { Button } from '@/components/0_Bruddle'
import { useRouter } from 'next/navigation'

const SetupSuccess = () => {
    const router = useRouter()

    return (
        <Button
            shadowSize="4"
            onClick={() => {
                router.push('/home')
            }}
        >
            {`Let's go`}
        </Button>
    )
}

export default SetupSuccess
