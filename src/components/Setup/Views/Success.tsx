import { Button } from '@/components/0_Bruddle'
import { useRouter } from 'next/navigation'
import { getFromLocalStorage } from '@/utils'

const SetupSuccess = () => {
    const router = useRouter()
    const localStorageRedirect = getFromLocalStorage('redirect')
    const redirect = localStorageRedirect ? localStorageRedirect : '/home'

    return (
        <Button
            shadowSize="4"
            onClick={() => {
                router.push(redirect)
            }}
        >
            {`Let's go`}
        </Button>
    )
}

export default SetupSuccess
