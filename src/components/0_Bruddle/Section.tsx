import { type HTMLAttributes } from 'react'
import { twMerge } from '@/utils/tw'

// code-only exception: composition recipe with no figma board. owns the
// "section title above a list/card stack" shape so the heading token stops
// being respelled per page (font-bold vs text-heading-card drift).

interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    title?: React.ReactNode
    /** right-aligned action on the title row — a LinkButton, a count, a filter.
     *  Rendered as a SIBLING of the h2, never inside it, so the heading keeps
     *  the title as its accessible name. Without it a section action has to drop
     *  to its own line below the content (token selector "More networks").
     *  With no title it sits alone at the right of the row: the profile
     *  Accounts page, whose page title already names the list, keeps only
     *  the account counter there. */
    trailing?: React.ReactNode
}

const Section = ({ title, trailing, className, children, ...props }: SectionProps) => (
    <section className={twMerge('flex flex-col gap-2', className)} {...props}>
        {/* only the trailing case needs the row wrapper — a title-only Section
            keeps the bare h2 it has always rendered */}
        {trailing ? (
            <div className={twMerge('flex items-center gap-2', title ? 'justify-between' : 'justify-end')}>
                {title && <h2 className="text-heading-card text-foreground-primary">{title}</h2>}
                {trailing}
            </div>
        ) : (
            title && <h2 className="text-heading-card text-foreground-primary">{title}</h2>
        )}
        {children}
    </section>
)

export { Section }
