import { Band } from '@/components/Marketing/StarLp/Band'
import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import type { HomeWallOfLoveProps } from './homeWallOfLove.types'
import { WallOfLoveAvatar } from './WallOfLoveAvatar'

/** Resting tilts, repeating per row, so the wall reads as stickers and not a table. */
const TILTS = [-1.5, 1, -0.5] as const

/**
 * Real posts about Peanut as white sticker cards on pink, the PersonaFold card
 * on a 3x2 wall from md. Phones get the first three as a stack: nothing hides
 * off-screen and nothing scrolls by itself. Each card opens its post on X.
 */
export function HomeWallOfLove({ heading, posts }: HomeWallOfLoveProps) {
    return (
        <Band ground="pink" id="wall-of-love">
            <SectionTitle className="text-center">{heading}</SectionTitle>
            <ul className="mt-10 grid gap-6 md:mt-14 md:grid-cols-3 md:gap-x-8 md:gap-y-10">
                {posts.map((post, i) => (
                    <li key={post.url} className={i > 2 ? 'hidden md:flex' : 'flex'}>
                        <PopIn delay={(i % 3) * 0.1} tilt={TILTS[i % TILTS.length]} className="flex w-full">
                            <a
                                href={post.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full flex-col gap-4 rounded-card border-2 border-border-default bg-background-default p-6 text-foreground-primary shadow-4 transition-transform duration-instant active:translate-x-1 active:translate-y-1 active:shadow-none"
                            >
                                <span className="flex items-center gap-3">
                                    <WallOfLoveAvatar post={post} />
                                    <span className="grid min-w-0">
                                        <span className="truncate text-label-l">{post.author}</span>
                                        <span className="text-body-xs text-foreground-secondary">{post.handle}</span>
                                    </span>
                                    {/* the X mark says where the post lives */}
                                    <svg
                                        aria-hidden
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="ml-auto size-4 shrink-0 opacity-40"
                                    >
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </span>
                                <span className="text-body-m lg:text-body-l">{post.content}</span>
                            </a>
                        </PopIn>
                    </li>
                ))}
            </ul>
        </Band>
    )
}
