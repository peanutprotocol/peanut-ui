import { ARROW_DOWN_CIRCLE, ARROW_UP_CIRCLE, CASHOUT_ICON, Eyes } from '@/assets'
import { Card } from '@chakra-ui/react'
import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface ITryNowCard {
    title: string
    description: string
    icon: string
    href: string
}

const cards: ITryNowCard[] = [
    {
        title: 'Cashout',
        description: 'Cash out your crypto to your bank account',
        icon: CASHOUT_ICON,
        href: '/cashout',
    },
    {
        title: 'Send',
        description: 'Text stablecoins and tokens across chains and to IBANs',
        icon: ARROW_UP_CIRCLE,
        href: '/send',
    },
    {
        title: 'Request',
        description: 'Request payment to your wallet to be paid in any token and any chain.',
        icon: ARROW_DOWN_CIRCLE,
        href: '/request/create',
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
                        className={twMerge(index === 0 ? 'col-span-full' : 'col-span-4 md:col-span-2')}
                    >
                        <Card
                            key={index}
                            rounded={'sm'}
                            className={twMerge(
                                'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-sm px-5 py-6 hover:bg-white/90 md:px-14 md:py-8'
                            )}
                        >
                            <div className="hidden size-16 items-center justify-center rounded-full bg-purple-1 p-2 md:flex">
                                <Image src={card.icon} alt={card.title} className="size-12" />
                            </div>
                            <div className="flex items-center justify-normal gap-3">
                                <div className="flex size-16 min-w-16 items-center justify-center rounded-full bg-purple-1 p-2 md:hidden">
                                    <Image src={card.icon} alt={card.title} className="size-12" />
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
