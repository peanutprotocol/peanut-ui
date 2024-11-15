import { useAuth } from '@/context/authContext'
import { Button, Card } from '../0_Bruddle'
import { useRouter } from 'next/navigation'

import Divider from '../0_Bruddle/Divider'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import happyPeanut from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import Title from '../0_Bruddle/Title'
import RollingNumber from '../0_Bruddle/RollingNumber'

const HomeWaitlist = () => {
    const { push } = useRouter()
    const { username, isFetchingUser, user } = useAuth()
    const { handleLogin, isLoggingIn } = useZeroDev()

    if (isFetchingUser) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center">
                <img src={happyPeanut.src} alt="peanut-club" className="w-[200px] object-cover" />
            </div>
        )
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-between p-8">
            <div className="flex h-full w-full flex-col items-center justify-between sm:w-1/2">
                <Title text="Home" className="text-8xl" />
                {username && (
                    <Card>
                        <Card.Header className="border-none">
                            <Card.Title className="border-none">Thanks {username}!</Card.Title>
                        </Card.Header>
                    </Card>
                )}
                <img src={happyPeanut.src} alt="peanut-club" className="w-[200px] object-cover" />
                <div className="mt-5 w-full text-center">
                    {username ? (
                        <Card>
                            <Card.Header className="text-center">
                                <Card.Title className="w-full text-center">You're all set up !</Card.Title>
                                <Card.Description className="w-full text-center">
                                    Stay tuned for the release
                                </Card.Description>
                            </Card.Header>
                            <Card.Content>
                                <div className="flex flex-col items-center gap-2">
                                    <p>Your position in the waitlist:</p>
                                    <RollingNumber
                                        number={user?.pwQueue.userPosition ?? 0}
                                        total={user?.pwQueue.totalUsers ?? 0}
                                        className="text-4xl font-bold"
                                    />
                                </div>
                            </Card.Content>
                        </Card>
                    ) : (
                        <div className="flex flex-col items-center justify-center">
                            <Button
                                onClick={() => {
                                    push('/setup')
                                }}
                                shadowSize="4"
                            >
                                Register
                            </Button>
                            <Divider text="or" />
                            <Button
                                loading={isLoggingIn}
                                disabled={isLoggingIn}
                                onClick={() => {
                                    handleLogin()
                                }}
                                variant="stroke"
                            >
                                Login
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default HomeWaitlist
