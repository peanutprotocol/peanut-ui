import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card } from '../0_Bruddle'

import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { useZeroDev } from '@/hooks/useZeroDev'
import RollingNumber from '../0_Bruddle/RollingNumber'
import Title from '../0_Bruddle/Title'

const HomeWaitlist = () => {
    const { push } = useRouter()
    const { username, isFetchingUser, user } = useAuth()
    const { handleLogin, isLoggingIn } = useZeroDev()

    useEffect(() => {
        if (!isFetchingUser && !username) {
            push('/setup')
        }
    }, [username, isFetchingUser, push])

    if (isFetchingUser) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center">
                <img src={chillPeanutAnim.src} alt="peanut-club" className="w-[300px] object-cover" />
            </div>
        )
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-between p-8">
            <div className="flex h-full w-full flex-col items-center justify-between sm:w-1/2">
                <Title text="Home" className="text-8xl" />
                {username && (
                    <Card>
                        <Card.Header className="mx-auto border-none">
                            <Card.Title className="border-none text-center">Yay {username}!!!</Card.Title>
                        </Card.Header>
                    </Card>
                )}
                <img src={chillPeanutAnim.src} alt="peanut-club" className="w-[300px] object-cover" />
                <div className="mt-5 w-full text-start">
                    {username && (
                        <Card>
                            <Card.Header>
                                <Card.Title className="w-full text-center">You're all set up!</Card.Title>
                                <Card.Description className="w-full text-center">
                                    Join the group at{' '}
                                    <a
                                        href="https://t.me/clubpeanut"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                    >
                                        t.me/clubpeanut
                                    </a>
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
                    )}
                    {/* removed regiser/login components. Should be in diff page. */}
                    {/* : (
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
                        </div> */}
                </div>
            </div>
        </div>
    )
}

export default HomeWaitlist
