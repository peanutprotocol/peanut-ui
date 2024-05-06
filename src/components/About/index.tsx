import * as assets from '@/assets'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'

const listItems = [
    {
        name: 'Hugo Montenegro',
        imgUrl: assets.HUGO_PERSON.src,
        role: 'Tech Nut',
        description: `<p>
        Did ML and worked with NLP. Studied CS at Harvard. Interested in decentralized systems
        and their incentives.
    </p>
    <p>
        He's also very tall and, yes, he likes to play basketball. He's currently doing a keto
        diet. [Edit: Not anymore.]
    </p>`,
        socials: [
            { name: 'twitter', url: 'https://www.twitter.com/uwwgo' },
            { name: 'Lens', url: 'https://lenster.xyz/u/hugo0.lens' },
            { name: 'www', url: 'https://hugomontenegro.com/' },
        ],
        bg: 'bg-purple-1',
    },
    {
        name: 'Konrad Urban',
        imgUrl: assets.KONRAD_PERSON.src,
        role: 'Biz Nut',
        description: ` <p>
        Does biz and design. Did academic philosophy at St Andrews but escaped to build stuff.
    </p>
    <p>
        Likes to climb and then ski untouched mountains. Very short, does not play basketball.
    </p>`,
        socials: [
            { name: 'twitter', url: 'https://www.twitter.com/0xkkonrad' },
            { name: 'Lens', url: 'https://lenster.xyz/u/kkonrad.lens' },
            { name: 'www', url: 'https://kkonrad.com/' },
        ],
        bg: 'bg-yellow-1',
    },
    {
        name: '______ ______',
        imgUrl: assets.PEANUTMAN_CHEERING.src,
        role: '____ Nut',
        description: `<p>Does ____ and ____. Did ____ but _______. </p>

        <p> Likes to ______. Sometimes also __________.</p>
        <p> Got this job after seeing the /about page and then DMing Konrad and Hugo.</p>`,
        socials: [
            { name: 'dm us', url: 'https://www.peanut.to/jobs' },
            { name: 'jobs', url: '/jobs' },
        ],
        bg: 'bg-pink-1',
    },
]

export function About() {
    return (
        <div>
            <div className="bg-lightblue flex-grow">
                <div className="brutalborder shadow-primary-4 mx-auto mb-8 mt-8 w-5/6 bg-white px-2 px-4 py-4 tracking-wide sm:mb-16 sm:mt-16 sm:w-2/3 md:py-8 lg:w-1/2 ">
                    <h2 className="mx-auto px-4 text-center text-xl font-black text-black lg:text-4xl">
                        <p>
                            Peanut Protocol. Bring currency back to cryptocurrency. Build a world where value flows
                            freely through buttery smooth transactions.{' '}
                        </p>
                    </h2>
                </div>
            </div>
            <MarqueeWrapper backgroundColor="bg-black">
                <>
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        GO
                    </div>
                    <img src={assets.SMILEY_ICON.src} alt="logo" className=" mr-1 h-5 md:h-8" />
                    <div className="mr-2 py-2 text-center font-black uppercase italic tracking-wide text-white md:py-4 md:text-4xl">
                        NUTS
                    </div>
                    <img src={assets.SMILEY_ICON.src} alt="logo" className="mr-1 h-5 md:h-8" />
                </>
            </MarqueeWrapper>

            <div>
                <div role="list" className="grid grid-cols-1 gap-0 gap-y-4 md:grid-cols-3">
                    {listItems.map((item, idx) => listItem(item))}
                </div>
            </div>
        </div>
    )
}

const listItem = (item: any) => {
    return (
        <div
            className={`brutalborder mx-4 mt-4 flex w-full flex-col p-8 text-center text-black ${item.bg}`}
            key={item.imgUrl}
        >
            <div className="w-full">
                <img
                    src={item.imgUrl}
                    alt="picture of bearded man"
                    className="rainbow-border m-2 mx-auto w-1/2 rounded-full bg-white p-4"
                />

                <h1 className="mx-auto mt-8 w-3/4 text-2xl font-black uppercase">{item.name}</h1>
                <p className="mb-4 text-sm font-black uppercase">{item.name}</p>
                <div dangerouslySetInnerHTML={{ __html: item.description }} />
            </div>

            <div className="center-xy flex-end my-6 flex justify-around gap-12">
                <p className="mt-4 text-sm font-black uppercase text-black">
                    {item.socials.map((social: any, idx: number) => (
                        <div key={social.name}>
                            <a className="text-black underline" href={social.url}>
                                {social.name}
                            </a>
                            {idx < item.socials.length - 1 ? ' | ' : ''}
                        </div>
                    ))}
                </p>
            </div>
        </div>
    )
}
