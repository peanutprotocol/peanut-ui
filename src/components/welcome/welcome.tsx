import * as global_components from '@/components/global'
import smiley from '@/assets/smiley.svg'
import peanutman_happy from '@/assets/peanutman-happy.svg'
import orest_image from '@/assets/people/orest.jpg'
import mydas_image from '@/assets/people/mydas.jpg'
import steven_image from '@/assets/people/Steven.jpg'
import sbf_image from '@/assets/people/sbf.jpeg'
export function Welcome() {
    return (
        <div className="mt-0 flex h-full min-h-[100vh] flex-col  ">
            {/* Hero in columns */}
            <section className="text-black  lg:divide-y" id="hero">
                <div className="relative mx-auto">
                    <div className="border-2 border-black lg:grid lg:grid-flow-col-dense lg:grid-cols-2 ">
                        {/* left column */}
                        <div className="brutalborder bg-white py-16 text-center sm:px-6 lg:mx-0 lg:max-w-none lg:px-0">
                            <h1 className="mx-auto my-8 w-3/4 text-5xl font-black">Send Tokens with a Link</h1>
                            <div className="m-4 mx-auto w-3/4 p-2 text-xl">
                                Forget chains and wallet addresses. Send tokens with a trustless payment link, no matter
                                whether the recipient has a wallet.
                            </div>

                            <div className="mt-8 flex justify-center space-x-4 p-2">
                                <a
                                    href="/send"
                                    id="cta-btn"
                                    className="mb-2 block bg-white p-5 text-2xl font-black md:w-3/5 lg:w-1/3"
                                >
                                    Try Now
                                </a>

                                <a
                                    href="https://docs.peanut.to"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-5 text-2xl font-black text-black hover:underline"
                                >
                                    Integrate →
                                </a>
                            </div>
                        </div>

                        {/* right column */}
                        <div className="center-xy brutalborder relative overflow-hidden  bg-fuchsia py-3 lg:border-l-0 lg:pb-16 lg:pt-32">
                            <img
                                src={peanutman_happy.src}
                                className="absolute top-10 duration-200 hover:rotate-12"
                                alt="Peanutman Cheering"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* seperator */}
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

            {/* Use Cases: SDK, app, marketing */}

            <section id="use-cases" className="bg-white">
                <div role="list" className="grid grid-cols-1 gap-5 p-5 text-black sm:grid-cols-2 lg:grid-cols-3">
                    {/* Integrate */}
                    <div className="brutalborder flex flex-col border-2 border-black bg-teal p-12 px-16" id="SDK">
                        <h3 className="text-5xl font-black">Integrate</h3>
                        <p className="mt-1 block text-2xl leading-loose">
                            Let your product go viral by your users sharing token links with their friends, who will get
                            onboarded onto your product easily. Ideal for wallets, DEXes and dApps.
                        </p>
                        <div className="flex-grow"></div>
                        <div className="center-xy flex-end my-6 flex justify-around">
                            <a href="https://docs.peanut.to">
                                <button className="brutalborder brutalshadow p-4 px-4 text-2xl font-black hover:invert">
                                    Start Now
                                </button>
                            </a>

                            <a
                                href="https://peanutprotocol.notion.site/Eco-Beam-Link-Case-Study-0df5cf9b5d544cb48e209cbcbcd63bdb?pvs=4"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-4 border-none bg-none p-5 text-2xl font-normal text-black no-underline hover:underline"
                            >
                                Case Study →
                            </a>
                        </div>
                    </div>
                    {/* App */}
                    <div className="brutalborder flex flex-col border-2 border-black bg-red p-12 px-16 " id="app">
                        <h3 className="text-5xl font-black">Use App</h3>
                        <p className="mt-1 block text-2xl leading-loose">
                            See how easy it can be to send tokens. Simply generate a link using the Peanut app and pop
                            into a chat with your friend.
                        </p>
                        <div className="flex-grow"></div>
                        <div className="center-xy flex-end my-6 flex justify-around">
                            <a href="/send">
                                <button className="brutalborder brutalshadow p-4 px-4 text-2xl font-black hover:invert">
                                    Start Now
                                </button>
                            </a>
                        </div>
                    </div>
                    {/* Physical */}
                    <div
                        className="brutalborder flex flex-col border-2 border-black bg-lightblue p-12 px-16"
                        id="physical"
                    >
                        <h3 className="text-5xl font-black">Get Physical</h3>
                        <p className="mt-1 block text-2xl leading-loose">
                            Are you planning an IRL event? Boost the conversion of swag and booths 20X. Get users on the
                            spot, just put stickers on your swag or flyers. Become irresistible.
                        </p>
                        <div className="flex-grow"></div>
                        <div className="center-xy flex-end my-6 flex justify-around">
                            <a href="/send">
                                <button className="brutalborder brutalshadow p-4 px-4 text-2xl font-black hover:invert">
                                    Start Now
                                </button>
                            </a>

                            <a
                                href="https://twitter.com/AmbireWallet/status/1641088818114641920"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-4 border-none bg-none p-5 text-2xl font-normal text-black no-underline hover:underline"
                            >
                                Testimonial →
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* seperator */}
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

            {/* Features  */}
            <section className="lg:divide-y" id="features">
                <div className="relative mx-auto text-black">
                    <div className="lg:grid lg:grid-flow-col-dense lg:grid-cols-2">
                        {/* Left column */}
                        <div className="center-xy relative overflow-hidden bg-fuchsia py-3 outline-black lg:border-l-0 lg:pb-16 lg:pt-32 ">
                            <img
                                src={peanutman_happy.src}
                                className="absolute top-10 duration-200 hover:rotate-12"
                                alt="Peanutman Cheering"
                            />
                            <div></div>
                        </div>

                        {/* Right column */}
                        {/* // --
// Features:
// noncustodial
// permissionless
// brandable
// noob-friendly
 */}
                        <div className=" bg-white text-center sm:px-6 lg:mx-0 lg:max-w-none lg:px-0 lg:py-8">
                            <div className="inline-block w-4/5 text-left">
                                <h2 className="text-4xl">Non-custodial</h2>
                                <p className="text-normal">
                                    Funds securely stored in a vault contract and can be only claimed with a secret that
                                    is contained in the link.{' '}
                                    <a href="/docs" target="_blank" className="text-black">
                                        Read more.
                                    </a>{' '}
                                </p>

                                <h2 className="text-4xl">Permissionless</h2>
                                <p className="text-normal">
                                    There are no API keys, simply use our SDK or build your own way to interact with the
                                    smart contracts directly.{' '}
                                    <a href="/docs" target="_blank" className="text-black">
                                        Read more.
                                    </a>
                                </p>

                                <h2 className="text-4xl">Brandable</h2>
                                <p className="text-normal">
                                    Customize token and claim page to match your branding with logo and colors. Or even
                                    better, have the users claim the tokens on your own domain or app!{' '}
                                    <a href="/docs" target="_blank" className="text-black">
                                        Read more.
                                    </a>
                                </p>

                                <h2 className="text-4xl">Noob-friendly onboarding</h2>
                                <p className="text-normal">
                                    Fully customizable guided wallet setup for first-time crypto users, no advance
                                    address needed!{' '}
                                    <a href="/docs" target="_blank" className="text-black underline ">
                                        Read more.
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* seperator */}
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

            {/* customise */}
            <section className="h-full w-full bg-white py-12 text-black">
                <div className="center-xy mx-auto flex w-11/12 items-center bg-white lg:w-3/5">
                    <div className="text-center">
                        <h2 className="title-font text-3xl font-black text-black lg:text-7xl">Make your own</h2>

                        <div className="mx-auto w-4/5 p-5 text-xl lg:w-2/3">
                            Do you want a custom onboarding flow? Collect email addresses? Make users download a
                            specific app or claim with a specific wallet? We've got your covered.
                        </div>

                        <a href="https://t.me/peanutprotocol" target="_blank" rel="noopener noreferrer">
                            <button id="cta-btn" className="cta m-10 bg-white px-3 text-2xl font-black hover:underline">
                                Talk to an expert →
                            </button>
                        </a>
                    </div>
                </div>
            </section>

            {/* seperator */}
            <global_components.MarqueeWrapper backgroundColor="bg-black">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                        FRENS
                    </div>
                    <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide md:py-4 md:text-4xl">
                        FRENS
                    </div>
                    <img src={smiley.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </global_components.MarqueeWrapper>

            {/* testimonials */}

            <section id="testimonials" className="justify-center bg-white text-black sm:px-2 sm:py-2">
                <div role="list" className="grid grid-cols-2 gap-0 sm:gap-y-4 lg:grid-cols-4">
                    {[
                        {
                            imageSrc: orest_image.src,
                            altText: 'picture of bearded man',
                            comment: 'How did this not exist before?! Great UX!',
                            name: 'Orest Tarasiuk',
                            detail: 'Scroll.io',
                            bgColorClass: 'bg-yellow',
                        },
                        {
                            imageSrc: mydas_image.src,
                            altText: 'picture of rasta NFT',
                            comment: 'Love this! Will help in mass crypto adoption.',
                            name: 'Mydas.eth',
                            detail: 'University of Nicosia',
                            bgColorClass: 'bg-fuchsia',
                        },
                        {
                            imageSrc: steven_image.src,
                            altText: 'picture of smiling man',
                            comment: 'Very buttery experience!',
                            name: 'Steven Robinson',
                            detail: 'Arkn Ventures',
                            bgColorClass: 'bg-lightblue',
                        },
                        {
                            imageSrc: sbf_image.src,
                            altText: 'picture of pixel art SBF',
                            comment: 'I have a peanut allergy. Help!',
                            name: 'CEx CEO',
                            detail: 'Probably FTX',
                            bgColorClass: 'bg-red',
                        },
                    ].map((testimonial, index) => (
                        <div
                            key={index}
                            className={`${testimonial.bgColorClass} brutalborder m-2 p-2 text-center`}
                            id="frens"
                        >
                            <img
                                //@ts-ignore
                                src={testimonial.imageSrc}
                                alt={testimonial.altText}
                                className="rainbow-border mx-auto w-1/2 rounded-full bg-white p-1"
                            />
                            <h1 className="mx-auto mt-2 py-2 text-base font-normal italic lg:text-lg">
                                {testimonial.comment}
                            </h1>
                            <p className="mb-4 text-base font-black uppercase">
                                {testimonial.name}
                                <span className="text-xs font-normal">
                                    {' '}
                                    <br /> {testimonial.detail}{' '}
                                </span>
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/*  */}
        </div>
    )
}
