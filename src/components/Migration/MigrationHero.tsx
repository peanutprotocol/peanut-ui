import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { PEANUTMAN_MOBILE } from '@/assets/mascot'
import starImage from '@/assets/icons/star.png'

const STARS = [
    'left-[8%] top-[18%] size-8',
    'right-[12%] top-[14%] size-9',
    'right-[14%] bottom-[16%] size-7',
    'left-[12%] bottom-[14%] size-7',
] as const

// periwinkle mascot hero shared by the sunset block and the /app smart link
export default function MigrationHero({ className }: { className?: string }) {
    return (
        <section
            className={twMerge(
                'relative flex w-full items-center justify-center overflow-hidden bg-secondary-3 px-6',
                className
            )}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            {STARS.map((pos) => (
                <Image key={pos} src={starImage.src} alt="" width={38} height={38} className={`absolute z-10 ${pos}`} />
            ))}
            <Image
                src={PEANUTMAN_MOBILE}
                alt="Peanut"
                width={200}
                height={200}
                className="z-0 h-44 w-auto object-contain md:h-56"
            />
        </section>
    )
}
