import peanutman_sad from "@/assets/peanutman-sad.svg";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ClaimLinkAlreadyClaimedView() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/");
  }, []);

  return (
    <>
      <h2 className="title-font text-2xl md:text-3xl font-black mb-0 text-center">
        Sorry, this link has been claimed already.
      </h2>

      <h3 className="text-center">
        Generate a payment link yourself to see how it works!
      </h3>

      <button
        className="block w-full mt-4 mb-4 px-2 sm:w-2/5 lg:w-1/2 p-5 mx-auto font-black text-2xl cursor-pointer bg-white"
        id="cta-btn"
        onClick={() => {
          router.push("/");
        }}
      >
        Send Crypto
      </button>

      <p className="mt-4 text-xs text-center">
        Thoughts? Feedback? Use cases? Memes? Hit us up on{" "}
        <a
          href="https://discord.gg/BX9Ak7AW28"
          target="_blank"
          className="underline text-black cursor-pointer"
        >
          Discord
        </a>
        !
      </p>
      <img
        src={peanutman_sad.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-32 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />
    </>
  );
}

//todo: add peanutman
