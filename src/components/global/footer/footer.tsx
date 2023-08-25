import Link from 'next/link'
import smiley from '@/assets/smiley.svg'

import * as global_components from '@/components/global'
// You can find all social and other links in this const file.
import * as _consts from './footer.consts'

export function Footer({ showMarquee = false }: { showMarquee?: boolean }) {
    return (
        <div>
            {/* {showMarquee && (
        <global_components.MarqueeWrapper backgroundColor="bg-black">
          <div className="italic text-center uppercase mr-2 font-black tracking-wide md:text-4xl md:py-4 py-2 ">
            smiles
          </div>
          <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
        </global_components.MarqueeWrapper>
      )} */}

            <footer>
                <div className="brutalborder my-4 flex w-full flex-col space-y-4 font-bold tracking-widest">
                    <div className="flex justify-center gap-4">
                        {_consts.SOCIALS.map((social) => {
                            return (
                                <Link key={social.name} href={social.url} target="_blank">
                                    <img src={social.logoSrc} className="h-6" alt="twitter" />
                                </Link>
                            )
                        })}
                    </div>
                    <div className="flex justify-center gap-2 sm:gap-4">
                        {_consts.LINKS.map((link) => {
                            return (
                                <Link
                                    key={link.name}
                                    href={link.url}
                                    className=" text-white no-underline hover:underline"
                                >
                                    {link.name}
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </footer>
        </div>
    )
}
