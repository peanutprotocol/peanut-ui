import peanutClub from '@/assets/peanut/peanut-club.png'
import { useAuth } from '@/context/authContext'
import { Button } from '../0_Bruddle'
import { useRouter } from 'next/navigation'

import happyPeanut from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import Divider from '../0_Bruddle/Divider'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'

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
            <div className="flex h-full flex-col items-center justify-between">
                <h1 className="font-knerd-filled text-4xl text-black">Peanut Wallet</h1>
                <p className="text-center text-lg">
                    Thanks <span className="text-xl font-bold">{username}</span> !
                </p>
                <img src={peanutClub.src} alt="peanut-club" className="w-[200px] object-cover" />
                <div className="mt-5 w-full text-center">
                    {username ? (
                        <div className="flex flex-col items-center">
                            <p className="text-center text-lg">
                                You're all set up. Stay tuned for the Peanut Wallet release!
                            </p>
                            <p className="mt-2 text-center">
                                You are number <span className="font-bold">{user?.pwQueue.userPosition ?? 0}</span> of{' '}
                                <span className="font-bold">{user?.pwQueue.totalUsers}</span> in the waitlist.
                            </p>
                        </div>
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
