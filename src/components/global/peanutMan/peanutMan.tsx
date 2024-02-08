'use client'
import peanutman_sad from '@/assets/peanutman-sad.svg'
import peanutman_presenting from '@/assets/peanutman-presenting.svg'
import peanutman_cheering from '@/assets/peanutman-cheering.svg'
import peanutman_redpacket from '@/assets/peanutman-redpacket.svg'
import peanutman_mantle from '@/assets/peanut-holding-mantle-logo.svg'
import { useEffect, useState } from 'react'

export function PeanutMan({ type }: { type: string }) {
    const [peanutmanSvg, setSvg] = useState(peanutman_presenting)

    useEffect(() => {
        switch (type) {
            case 'cheering': {
                setSvg(peanutman_cheering)
                break
            }
            case 'sad': {
                setSvg(peanutman_sad)
                break
            }
            case 'presenting': {
                setSvg(peanutman_presenting)
                break
            }
            case 'redpacket': {
                setSvg(peanutman_redpacket)
                break
            }
            case 'mantle': {
                setSvg(peanutman_mantle)
                break
            }
            default: {
                setSvg(peanutman_cheering)
                break
            }
        }
    }, [type])

    return (
        <img
            src={peanutmanSvg.src}
            className="z-index-100 absolute -bottom-40 -left-32 hidden h-[450px] w-2/3 w-[375] scale-100 sm:-bottom-48 sm:-left-32 sm:w-1/2 md:-bottom-56 md:-left-48 md:block 2xl:-bottom-80 2xl:-left-80 2xl:-mb-4 2xl:-ml-8"
        />
    )
}
{
    /* 

    <img
              src={peanutman_sad.src}
              // className="w-1/3 scale-100 absolute z-index-100 -bottom-24 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
              className="w-1/2 sm:w-2/5 scale-100 absolute z-index-100 -bottom-64 left-0 sm:left-auto sm:right-16 sm:-bottom-32 -top-32 "
              id="peanutman-presenting"
            />


<img
        src={peanutman_presenting.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-32 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />

       <img
        src={peanutman_sad.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-32 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />

       <img
        src={peanutman_cheering.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-32 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />

      <img
        src={peanutman_sad.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-32 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />

      <img
        src={peanutman_presenting.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-24 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />

       <img
        src={peanutman_cheering.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-24 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-64 2xl:-left-72"
        id="peanutman-presenting"
      />

            */
}
