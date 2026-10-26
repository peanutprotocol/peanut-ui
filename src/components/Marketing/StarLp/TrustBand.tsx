import { Fragment } from 'react'
import { PopIn } from './PopIn'
import type { TrustBandProps } from './starLp.types'

/**
 * The black one-line trust strip. Never on a page that shows or names the
 * card (security.md: no non-custodial claims about the card). The "\n" break
 * applies from xs; under it the line is balanced instead, so 320 never strands a word.
 */
export function TrustBand({ text }: TrustBandProps) {
    const parts = text.split('\n')
    return (
        <section className="bg-gray-950 px-6 py-8 text-center text-foreground-inverse md:px-4 md:py-12">
            <PopIn>
                <p className="font-roboto-flex-extrabold text-heading-s text-balance uppercase md:text-heading-l">
                    {parts.map((part, i) => (
                        <Fragment key={i}>
                            {i > 0 && (
                                <>
                                    {' '}
                                    <br className="hidden xs:inline" />
                                </>
                            )}
                            {part}
                        </Fragment>
                    ))}
                </p>
            </PopIn>
        </section>
    )
}
