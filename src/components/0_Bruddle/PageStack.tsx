import { type HTMLAttributes } from 'react'
import { twMerge } from '@/utils/tw'

// code-only exception: layout recipe with no figma board. codifies the page
// shell from /dev/ds/patterns/layouts (NavHeader + vertical stack, centered
// content, pinned footer) so pages stop hand-rolling it. spacing tokens only.

interface PageStackProps extends HTMLAttributes<HTMLDivElement> {
    /** vertical gap between page regions. 8 is the page default, 6 the dense variant. */
    gap?: '6' | '8'
}

const PageStack = ({ gap = '8', className, children, ...props }: PageStackProps) => (
    <div
        className={twMerge('flex min-h-[inherit] w-full flex-col', gap === '8' ? 'gap-8' : 'gap-6', className)}
        {...props}
    >
        {children}
    </div>
)

/** vertically-centered content block. must be a direct child of PageStack. */
const Center = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('my-auto flex flex-col gap-6', className)} {...props}>
        {children}
    </div>
)

/** pinned bottom region (CTAs). must be the last child of PageStack. */
const Footer = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={twMerge('mt-auto flex flex-col gap-3', className)} {...props}>
        {children}
    </div>
)

PageStack.Center = Center
PageStack.Footer = Footer

export { PageStack }
