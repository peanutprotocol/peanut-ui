import * as global_components from '@/components/global'
import smiley from '@/assets/smiley.svg'
import hugo_png from '@/assets/people/hugo0-no-bg.png'
import konrad_png from '@/assets/people/kkonrad-no-bg.png'
import peanutman_cheering from '@/assets/peanutman-cheering.svg'

export function About() {
    return (
        <div>
            <div className="flex-grow bg-lightblue">
                <div className="brutalborder brutalshadow mx-auto mb-8 mt-8 w-5/6 bg-white sm:mb-16 sm:mt-16 ">
                    <h2 className="mx-auto px-4 text-center text-xl font-black text-black lg:text-4xl">
                        <p>
                            Peanut Protocol. Bring currency back to cryptocurrency. Build a world where value flows
                            freely through buttery smooth transactions.{' '}
                        </p>
                    </h2>
                </div>
            </div>
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

            <div>
                <div role="list" className="grid grid-cols-1 gap-0 gap-y-4 bg-white sm:grid-cols-2 lg:grid-cols-3">
                    <div className="brutalborder m-4 flex flex-col bg-yellow p-8 text-center text-black">
                        <div className="flex-grow">
                            <img
                                src={hugo_png.src}
                                alt="picture of bearded man"
                                className="rainbow-border m-2 mx-auto w-1/2 rounded-full bg-white p-4"
                            />

                            <h1 className="mx-auto mt-8 w-3/4 text-2xl font-black uppercase">Hugo Montenegro</h1>
                            <p className="mb-4 text-sm font-black uppercase">Tech Nut</p>
                            <p>
                                Did ML and worked with NLP. Studied CS at Harvard. Interested in decentralized systems
                                and their incentives.
                            </p>
                            <p>
                                He's also very tall and, yes, he likes to play basketball. He's currently doing a keto
                                diet. [Edit: Not anymore.]
                            </p>
                        </div>

                        <div className="center-xy flex-end my-6 flex justify-around gap-12">
                            <p className="mt-4 text-sm font-black uppercase text-black">
                                <a className="text-black underline" href="https://www.twitter.com/uwwgo">
                                    Twitter
                                </a>{' '}
                                |{' '}
                                <a className="text-black underline" href="https://lenster.xyz/u/hugo0.lens">
                                    Lens
                                </a>{' '}
                                |{' '}
                                <a className="text-black underline" href="https://hugomontenegro.com/">
                                    www
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="brutalborder m-4 flex flex-col bg-red p-8 text-center text-black">
                        <div className="flex-grow">
                            <img
                                src={konrad_png.src}
                                alt="handsome polish man"
                                className="rainbow-border m-2 mx-auto w-1/2 rounded-full bg-white p-4"
                            />

                            <h1 className="mx-auto mt-8 w-3/4 text-2xl  font-black uppercase ">Konrad Urban</h1>
                            <p className="mb-4 text-sm font-black uppercase ">Biz Nut</p>
                            <p>
                                Does biz and design. Did academic philosophy at St Andrews but escaped to build stuff.{' '}
                            </p>

                            <p>
                                {' '}
                                Likes to climb and then ski untouched mountains. Very short, does not play basketball.
                            </p>
                        </div>
                        <div className="center-xy flex-end my-6 flex justify-around gap-12">
                            <p className="mt-4 text-sm font-black uppercase">
                                <a className="text-black underline" href="https://www.twitter.com/0xkkonrad">
                                    Twitter
                                </a>{' '}
                                |{' '}
                                <a className="text-black underline" href="https://lenster.xyz/u/kkonrad.lens">
                                    Lens
                                </a>{' '}
                                |{' '}
                                <a className="text-black underline" href="https://kkonrad.com/">
                                    www
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="brutalborder m-4 flex flex-col bg-lightblue p-8 text-center text-black">
                        <div className="flex-grow">
                            <img
                                src={peanutman_cheering.src}
                                alt="Very handsome and happy peanut man"
                                className="rainbow-border m-2 mx-auto w-1/2 rounded-full bg-white p-4"
                            />

                            <h1 className="mx-auto mt-8 w-3/4 text-2xl  font-black uppercase">______ ______</h1>
                            <p className="mb-4 text-sm font-black uppercase ">____ Nut</p>
                            <p>Does ____ and ____. Did ____ but _______. </p>

                            <p> Likes to ______. Sometimes also __________.</p>
                            <p> Got this job after seeing the /about page and then DMing Konrad and Hugo.</p>
                        </div>

                        <div className="center-xy flex-end my-6 flex justify-around gap-12 font-black">
                            <p className="mt-4 text-sm font-black uppercase">
                                <a className="text-black underline" href="https://www.peanut.to/jobs">
                                    dm us
                                </a>{' '}
                                |{' '}
                                <a className="text-black underline" href="/jobs">
                                    jobs
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
