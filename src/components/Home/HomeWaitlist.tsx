import peanutClub from '@/assets/peanut/peanut-club.png'

const HomeWaitlist = () => {
    return (
        <div className="flex h-full w-full flex-col items-center justify-between py-8">
            <div className="flex flex-col items-center justify-center">
                <h1 className="font-knerd-filled text-4xl text-white">Peanut Wallet</h1>
                <p className="font-bold">Coming out soon !</p>
            </div>
            <img src={peanutClub.src} alt="peanut-club" className="w-[200px] object-cover" />
        </div>
    )
}

export default HomeWaitlist
