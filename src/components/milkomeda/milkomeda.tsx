import * as global_components from '@/components/global'
import smiley from '@/assets/smiley.svg'
import peanutman_happy from '@/assets/peanutman-happy.svg'

// needs a bit of cleanup but it's taking me too long to do because i am not that familiar with this
// 1. reduce top gap

export function Milkomeda() {
    return (
        <div className="mt-16 flex h-full min-h-[80vh] flex-col  ">
            {/* columns */}
            <section className="text-black  lg:divide-y" id="hero">
                <div className="relative mx-auto">
                    <div className="border-2 border-black lg:grid lg:grid-flow-col-dense lg:grid-cols-2 ">
                        {/* left column */}
                        <div className="brutalborder bg-yellow py-16 text-center sm:px-6 lg:mx-0 lg:max-w-none lg:px-0">
                            <h1 className="mx-auto my-8 w-3/4 text-5xl font-black">Join the Raffle!</h1>
                            <div className="m-4 mx-auto w-3/4 p-2 text-xl">
                                Yay! We ar nowe on Milkomeda. Send mAda easily. Welcome Peanut Protocol to the Milkomeda
                                community by joining the raffle. Here is how:
                                <ul className="text-left text-base ">
                                    <li>
                                        Every{' '}
                                        <a href="/" target="_blank" className="text-black">
                                            Peanut
                                        </a>{' '}
                                        tx that uses some mAda is a ticket to a raffle.
                                    </li>
                                    <li>There will be 3 prizes of 100 USDC each.</li>
                                    <li>The raffle will be drawn on Sep 1st.</li>
                                    <li>
                                        Join our{' '}
                                        <a
                                            href="https://discord.com/channels/972435984954302464/1144240875464036392"
                                            target="_blank"
                                            className="text-black"
                                        >
                                            Milkomeda Discord channel
                                        </a>{' '}
                                        to get live updates.
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-8 flex justify-center space-x-4 p-2">
                                <a
                                    href="/"
                                    id="cta-btn"
                                    className="mb-2 block bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                                >
                                    Join Raffle
                                </a>

                                <a
                                    href="https://peanut.to/docs"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-5 text-2xl font-black text-black hover:underline"
                                >
                                    About Peanut →
                                </a>
                            </div>
                        </div>

                        {/* right column */}
                        <div className="center-xy brutalborder relative overflow-hidden  border-2 border-black bg-fuchsia py-3 lg:border-l-0 lg:pb-16 lg:pt-32">
                            <img
                                src={peanutman_happy.src}
                                className="absolute top-10 duration-200 hover:rotate-12"
                                alt="Peanutman Cheering"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <global_components.MarqueeWrapper backgroundColor="bg-black">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                        GO
                    </div>
                    <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                        NUTS
                    </div>
                    <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </global_components.MarqueeWrapper>
        </div>
    )
}
