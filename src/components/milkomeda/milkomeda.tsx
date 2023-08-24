import * as global_components from '@/components/global'
import smiley from '@/assets/smiley.svg'
import peanutman_happy from '@/assets/peanutman-happy.svg'


// needs a bit of cleanup but it's taking me too long to do because i am not that familiar with this
// 1. reduce top gap




export function Milkomeda() {
    return (
        <div>

            {/* columns */}
            <section className="lg:divide-y  text-black" id="hero">
                <div className="relative mx-auto">
                    <div className="lg:grid lg:grid-flow-col-dense lg:grid-cols-2 border-black border-2 ">
                        {/* left column */}
                        <div className="sm:px-6 lg:mx-0 lg:max-w-none py-16 lg:px-0 bg-yellow brutalborder text-center">
                            <h1 className="my-8 text-5xl font-black w-3/4 mx-auto">
                                Join the Raffle
                            </h1>
                            <p className="m-4 p-2 w-3/4 text-xl mx-auto">

                                Yay! We are on Milkomeda. Welcome Peanut Protocol to the Milkomeda community by joining the raffle. Here is how it works:

                                <ul className='text-base text-left '>
                                    <li>Every Peanut tx that uses some mAda is a ticket to a raffle.</li>
                                    <li>There will be 3 prizes of 100 USDC each.</li>
                                    <li>The raffle will be drawn on Sep 1st.</li>
                                    <li>Follow <a href="https://twitter.com/PeanutProtocol" target='_blank'>@PeanutProtocol</a> to get live updates.</li>
                                </ul>
                            </p>


                            <div className="flex justify-center p-2 mt-8 space-x-4">
                                <a href="/send" id="cta-btn" className="block md:w-3/5 lg:w-1/3 p-5 font-black text-2xl mb-2 bg-white">
                                    Join Raffle
                                </a>

                                <a href="https://peanut.to/docs" target="_blank" rel="noopener noreferrer" className="p-5 text-2xl font-black hover:underline">
                                    About Peanut →
                                </a>
                            </div>
                        </div>

                        {/* right column */}
                        <div
                            className="center-xy bg-fuchsia border-black border-2  brutalborder py-3 lg:pt-32 lg:pb-16 lg:border-l-0 overflow-hidden relative">
                            <img src={peanutman_happy.src}
                                className="absolute top-10 hover:rotate-12 duration-200" alt="Peanutman Cheering" />
                        </div>
                    </div>
                </div>
            </section >


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
        </div >
    )
}
