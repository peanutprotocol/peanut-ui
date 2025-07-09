import {
    ARROW_UP_CIRCLE,
    CASHOUT_ICON,
    Eyes,
    STAR_OUTLINE_ICON,
    SMILEY_ICON,
    TRIANGLE_ICON,
    GITBOOK_ICON,
} from '@/assets'
import { Card } from '@chakra-ui/react'
import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface ITryNowCard {
    title: string
    description: string
    icon: string
    href: string
    isExternal?: boolean
}

const cards: ITryNowCard[] = [
    {
        title: 'TRY NEW VERSION',
        description: 'Be one of the first users on the alpha version of the Peanut wallet.',
        icon: STAR_OUTLINE_ICON,
        href: 'https://peanut.me/',
        isExternal: true,
    },
    {
        title: 'Cashout',
        description: 'Cash out your crypto to your bank account',
        icon: CASHOUT_ICON,
        href: '/cashout',
    },
    {
        title: 'Send (legacy)',
        description: 'Text stablecoins and tokens across chains and to IBANs',
        icon: ARROW_UP_CIRCLE,
        href: '/send',
    },
    {
        title: 'Raffle (legacy)',
        description: 'Create crypto raffles and distribute tokens to winners',
        icon: STAR_OUTLINE_ICON,
        href: '/raffle/create',
    },
    {
        title: 'Batch Send (legacy)',
        description: 'Send tokens to multiple recipients at once',
        icon: SMILEY_ICON,
        href: '/batch/create',
    },
    {
        title: 'Refund (legacy)',
        description: 'Refund unclaimed peanut links back to sender',
        icon: TRIANGLE_ICON,
        href: '/refund',
    },
    {
        title: 'Docs (legacy)',
        description: 'Learn about Peanut Protocol and its features',
        icon: GITBOOK_ICON,
        href: 'https://docs.peanut.to/',
        isExternal: true,
    },
]

const TryNow = () => {
    return (
        <div className="mx-auto space-y-4 p-6 md:max-w-3xl md:space-y-6 md:p-0">
            <div className="grid grid-cols-4 gap-4">
                {cards.map((card, index) => (
                    <Link
                        key={index}
                        href={card.href}
                        target={card.isExternal ? '_blank' : '_self'}
                        rel={card.isExternal ? 'noreferrer noopener' : ''}
                        className={twMerge(
                            index === 0 ? 'col-span-full' : 'col-span-4 md:col-span-2',
                            'border border-black'
                        )}
                    >
                        <Card
                            key={index}
                            rounded={'sm'}
                            className={twMerge(
                                'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-sm px-5 py-6 hover:bg-white/90 md:px-14 md:py-8'
                            )}
                        >
                            <div
                                className={twMerge(
                                    'hidden size-16 items-center justify-center rounded-full bg-purple-1 md:flex',
                                    index === 0 ? 'p-4' : 'p-2'
                                )}
                            >
                                <Image
                                    src={card.icon}
                                    alt={card.title}
                                    className={twMerge('size-12', index === 5 && '-mt-2')}
                                />
                            </div>
                            <div className="flex items-center justify-normal gap-3">
                                <div
                                    className={twMerge(
                                        'flex size-16 min-w-16 items-center justify-center rounded-full bg-purple-1 md:hidden',
                                        index === 0 ? 'p-4' : 'p-2'
                                    )}
                                >
                                    <Image
                                        src={card.icon}
                                        alt={card.title}
                                        className={twMerge('size-12', index === 5 && '-mt-1')}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <h2 className="text-lg font-extrabold md:text-center">{card.title}</h2>
                                    <p className="text-sm font-semibold text-gray-1 md:text-center">
                                        {card.description}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <Image src={Eyes} alt="eyes" className="size-6" />
                <Link
                    href={'https://docs.peanut.to'}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="min-w-fit text-sm hover:underline"
                >
                    What is Peanut Protocol?
                </Link>
            </div>
        </div>
    )
}

export default TryNow
