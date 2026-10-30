import Sparkle from '@/assets/illustrations/sparkle.svg'
import { Band } from './Band'
import { KnerdTitle } from './KnerdTitle'
import { KnerdWordCircle } from './KnerdWordCircle'
import { PopIn } from './PopIn'
import { BAND_GROUND_KNOCKOUT_CLASS } from './starLp.consts'
import type { CloseFoldProps } from './starLp.types'

/**
 * The closing fold: knerd lockup, one line, the CTA. Two sparkles pop in
 * unless `decoration` replaces them or `circleWord` circles a word instead.
 */
export function CloseFold({ title, line, cta, ground = 'pink', decoration, circleWord, id }: CloseFoldProps) {
    return (
        <Band ground={ground} align="center" id={id}>
            {circleWord
                ? null
                : (decoration ?? (
                      <>
                          <PopIn
                              tilt={-12}
                              className="pointer-events-none absolute top-0 left-2 w-10 md:left-[15%] md:w-14"
                          >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={Sparkle.src} width={Sparkle.width} height={Sparkle.height} alt="" aria-hidden />
                          </PopIn>
                          <PopIn
                              delay={0.2}
                              tilt={10}
                              className="pointer-events-none absolute right-2 bottom-24 w-8 md:right-[15%] md:w-12"
                          >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={Sparkle.src} width={Sparkle.width} height={Sparkle.height} alt="" aria-hidden />
                          </PopIn>
                      </>
                  ))}
            <h2>
                <KnerdTitle
                    text={title}
                    size="hero"
                    mark={
                        circleWord
                            ? {
                                  word: circleWord,
                                  node: <KnerdWordCircle />,
                                  knockoutClassName: BAND_GROUND_KNOCKOUT_CLASS[ground],
                              }
                            : undefined
                    }
                />
            </h2>
            {line && <p className="mx-auto mt-6 max-w-xl text-body-l text-balance">{line}</p>}
            <div className="mx-auto mt-8 w-fit">{cta}</div>
        </Band>
    )
}
