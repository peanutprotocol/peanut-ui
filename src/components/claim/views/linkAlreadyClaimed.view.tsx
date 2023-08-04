export function ClaimLinkAlreadyClaimedView() {
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
        onClick={() => {}}
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
    </>
  );
}

//todo: add peanutman
