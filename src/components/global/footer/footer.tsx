import twitter_logo from "@/assets/twitter-logo.svg";
import discord_logo from "@/assets/discord-logo.svg";
import Link from "next/link";
import smiley from "@/assets/black-smiling-face.png";
import * as global_components from "@/components/global";

export function Footer() {
  return (
    <div>
      <global_components.MarqueeSdk backgroundColor="bg-black">
        <h1 className="italic text-center uppercase"> smiles</h1>
        {/* replaced the smiley emoticon with an actual svg, this makes it the same on every device (android, ios, mac, windows ...) */}
        <img src={smiley.src} alt="logo" className="h-8 " />
      </global_components.MarqueeSdk>
      <footer>
        <div className="my-4 w-full tracking-widest font-bold brutalborder flex flex-col space-y-4">
          {/* make map out of socials */}
          <div className="flex justify-center">
            <Link
              href="https://twitter.com/peanutprotocol"
              target="_blank"
              className="mx-4"
            >
              <img src={twitter_logo.src} className="h-6" alt="twitter" />
            </Link>
            <Link
              href="https://discord.gg/BX9Ak7AW28"
              target="_blank"
              className="mx-4"
            >
              <img src={discord_logo.src} className="h-6" alt="discord" />
            </Link>
          </div>
          {/* make map of these links */}
          {/* make  uniform style for link */}
          <div className="flex justify-center">
            <Link
              href="/docs"
              className="mx-2 text-white no-underline hover:text-lightblue"
            >
              Docs
            </Link>
            <Link
              href="/about"
              className="mx-2 text-white no-underline hover:text-lightblue"
            >
              About
            </Link>
            <Link
              href="/blog"
              className="mx-2 text-white no-underline hover:text-teal"
            >
              Blog
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              className="mx-2 text-white no-underline hover:text-yellow"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              target="_blank"
              className="mx-2 text-white no-underline hover:text-red"
            >
              Terms
            </Link>
            <Link
              href="/jobs"
              target="_blank"
              className="mx-2 text-white no-underline hover:text-fuchsia"
            >
              Jobs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
