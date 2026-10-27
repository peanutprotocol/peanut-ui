/** One real post on the wall, verbatim from content/_system/generated/testimonials.json. */
export interface WallOfLovePost {
    url: string
    author: string
    handle: string
    content: string
    avatar?: string
}

export interface HomeWallOfLoveProps {
    /** The h2, e.g. "Wall of love.". The posts stay in their own language. */
    heading: string
    /** The rotation control's label while the wall cycles, and once it is paused. */
    pauseLabel: string
    playLabel: string
    posts: readonly WallOfLovePost[]
}

export interface WallOfLoveAvatarProps {
    post: WallOfLovePost
}

export interface WallOfLoveCardProps {
    post: WallOfLovePost
}

export interface WallOfLoveCycleState {
    /** Callback ref for the wall: the cycle runs only while it is on screen. */
    ref: (node: HTMLElement | null) => void
    /** The shown post's index within each slot. */
    active: number[]
}
