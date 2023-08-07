import Link from "next/link";
import smiley from "@/assets/black-smiling-face.png";

import * as global_components from "@/components/global";
// You can find all social and other links in this const file.
import * as _consts from "./footer.consts";

export function Footer() {
  return (
    <div>
      <global_components.MarqueeWrapper backgroundColor="bg-black">
        <div className="italic text-center uppercase mr-2 text-base md:text-4xl md:py-4 py-2 ">
          smiles
        </div>
        {/* replaced the smiley emoticon with an actual svg, this makes it the same on every device (android, ios, mac, windows ...) */}
        <img src={smiley.src} alt="logo" className="h-8 mr-1" />
      </global_components.MarqueeWrapper>
      <footer>
        <div className="my-4 tracking-widest w-full font-bold brutalborder flex flex-col space-y-4">
          <div className="flex justify-center gap-4">
            {_consts.SOCIALS.map((social) => {
              return (
                <Link key={social.name} href={social.url} target="_blank">
                  <img src={social.logoSrc} className="h-6" alt="twitter" />
                </Link>
              );
            })}
          </div>
          <div className="flex justify-center gap-2 sm:gap-4">
            {_consts.LINKS.map((link) => {
              return (
                <Link
                  key={link.name}
                  href={link.url}
                  className=" text-white no-underline hover:text-yellow"
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}
