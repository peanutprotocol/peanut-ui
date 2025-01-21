import * as assets from '@/assets'
import { SmileStars } from '@/assets'
import { MarqueeComp } from '../Global/MarqueeWrapper'

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
        bg: 'bg-primary-1',
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
        bg: 'bg-secondary-1',
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
        bg: 'bg-primary-1',
    },
]

export function About() {
    return (
        <div>
            <div className="mx-auto my-8 w-5/6 tracking-wide sm:my-16 sm:w-2/3 lg:max-w-4xl ">
                <h2 className="text-center text-xl text-black lg:text-4xl lg:leading-[1.2]">
                    Peanut Protocol. Bring currency back to cryptocurrency. Build a world where value flows freely
                    through buttery smooth transactions.
                </h2>
            </div>

            <MarqueeComp message="Go Nuts" imageSrc={SmileStars.src} imageAnimationClass="animation-faceSpin" />

            <div>
                <div
                    role="list"
                    className="grid grid-cols-1 gap-2 gap-y-4 px-8 pb-6 pt-8 md:grid-cols-3 md:px-12 md:pb-10 md:pt-12"
                >
                    {listItems.map((item, idx) => listItem(item, idx))}
                </div>
            </div>
        </div>
    )
}

const listItem = (item: any, idx: number) => {
    const bg = idx % 2 === 0 ? 'md:-rotate-2 md:mt-6' : 'md:rotate-3 z-[9]'

    return (
        <div
            className={`panel panel-sm flex w-full flex-col text-center ${bg} ${idx === 0 ? 'z-10' : ''}`}
            key={item.imgUrl}
        >
            <div className="w-full">
                <img
                    src={item.imgUrl}
                    alt="picture of bearded man"
                    className="rainbow-border m-2 mx-auto w-1/2 rounded-full bg-white p-4"
                />

                <h1 className="mt-8 font-display text-2xl uppercase md:text-3xl">{item.name}</h1>
                <p className="mb-4 text-sm font-black uppercase">{item.name}</p>
                <div dangerouslySetInnerHTML={{ __html: item.description }} />
            </div>

            <div className="my-6 space-y-1 text-sm uppercase">
                {item.socials.map((social: any, idx: number) => (
                    <div key={social.name}>
                        <a className="text-link" href={social.url}>
                            {social.name}
                        </a>
                    </div>
                ))}
            </div>
        </div>
    )
}
