import peanutClub from '@/assets/peanut/peanut-club.png'
import { useAuth } from '@/context/authContext'
import { Button } from '../0_Bruddle'
import { useRouter } from 'next/navigation'

import happyPeanut from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'

const HomeWaitlist = () => {
    const { push } = useRouter()
    const { username, isFetchingUser } = useAuth()

    if (isFetchingUser) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center">
                <img src={happyPeanut.src} alt="peanut-club" className="w-[200px] object-cover" />
            </div>
        )
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-between p-8">
            <div className="flex flex-col items-center justify-center">
                <h1 className="font-knerd-filled text-4xl text-black">Peanut Wallet</h1>
                <div className="mt-5 w-full text-center">
                    {username ? (
                        <p className="">
                            Thanks <span className="text-xl font-bold">{username}</span> ! You're all setup, stay tuned
                            for the Peanut Wallet release !{' '}
                        </p>
                    ) : (
                        <Button
                            onClick={() => {
                                push('/setup')
                            }}
                        >
                            Setup now
                        </Button>
                    )}
                </div>
            </div>
            <img src={peanutClub.src} alt="peanut-club" className="w-[200px] object-cover" />
        </div>
    )
}

export default HomeWaitlist
