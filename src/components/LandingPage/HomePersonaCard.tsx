import Image from 'next/image'
import { avatarSrc } from '@/components/Avatar/avatar.utils'
import { twMerge } from '@/utils/tw'
import type { HomePersonaCardProps } from './homePersona.types'

/** One earner as a white sticker card: avatar, trade and city, then their line. PersonaFold's card, without a pill. */
export function HomePersonaCard({ persona, withAvatar = true, className }: HomePersonaCardProps) {
    return (
        <article
            className={twMerge(
                'flex w-full flex-col gap-4 rounded-card border-2 border-border-default bg-background-default p-6 shadow-4',
                className
            )}
        >
            <header className="flex items-center gap-3">
                {withAvatar && (
                    <Image
                        src={avatarSrc(persona.avatar)!}
                        alt=""
                        width={176}
                        height={176}
                        unoptimized
                        className="size-12 shrink-0 object-contain"
                    />
                )}
                <p className="text-body-s-semibold text-foreground-secondary">{persona.who}</p>
            </header>
            <p className="text-heading-xs lg:text-heading-s">{persona.line}</p>
        </article>
    )
}
