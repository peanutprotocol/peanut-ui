import { useWeb3Modal } from "@web3modal/react";
import { useState } from "react";
import { useAccount } from "wagmi";

import * as global_components from "@/components/global";

import dropdown_svg from "@/assets/dropdown.svg";

export function ClaimView() {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <>
      <h2 className="my-2 text-3xl lg:text-6xl mb-0">Claim 000 XXX</h2>
      <h3 className="text-md sm:text-lg lg:text-xl mb-8 text-center">CHAIN</h3>
      <button
        type={isConnected ? "submit" : "button"}
        className="block w-full mb-4 px-2 sm:w-2/5 lg:w-1/2 p-5 mx-auto font-black text-2xl cursor-pointer bg-white"
        id="cta-btn"
        onClick={!isConnected ? open : undefined}
      >
        {isLoading ? (
          <div role="status">
            <svg
              aria-hidden="true"
              className="inline w-6 h-6 text-black animate-spin dark:text-black fill-white"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
            <span className="sr-only">Loading...</span>
          </div>
        ) : isConnected ? (
          "Claim"
        ) : (
          "Connect to claim"
        )}
      </button>
      <div
        className="cursor-pointer flex justify-center items-center mt-2"
        onClick={() => {
          setIsDropdownOpen(!isDropdownOpen);
        }}
      >
        <div className="cursor-pointer text-sm bg-white border-none  ">
          manually enter address
        </div>
        <img
          style={{
            transform: isDropdownOpen ? "scaleY(-1)" : "none",
            transition: "transform 0.3s ease-in-out",
          }}
          src={dropdown_svg.src}
          alt=""
          className={"h-6 "}
        />
      </div>
      {isDropdownOpen && (
        <global_components.CardWrapper>
          <label className="block text-xs font-medium text-center">
            If you can't connect, you can also write your address below <br />{" "}
            <span className="italic">
              ⚠️ WARNING: if you enter a wrong address, funds will get lost!!
            </span>
          </label>

          <div className="mt-4 flex flex-row w-11/12 sm:w-3/4 mx-auto brutalborder">
            <input
              type="text"
              className="h-4 w-full px-9 p-4 placeholder:font-light placeholder:text-xs flex-grow border-none"
              placeholder="0x6B37..."
            />
            <div
              className="tooltip h-4 w-1/8 block p-2 cursor-pointer brutalborder-left "
              onClick={() => {
                setIsLoading(true);
              }}
            >
              {isLoading ? (
                <div className="flex text-base font-bold border-none bg-white cursor-pointer h-full items-center">
                  <span className="tooltiptext inline " id="myTooltip">
                    Claiming...
                  </span>
                </div>
              ) : (
                <button className="flex text-base font-bold border-none bg-white cursor-pointer h-full items-center">
                  <span className="tooltiptext inline" id="myTooltip">
                    Claim
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-row h-4 items-center mx-auto mt-2 justify-center">
            <input type="checkbox" className="h-4 w-4" />
            <label className="ml-2 text-xs font-medium">
              This address exists on CHAIN
            </label>
          </div>
        </global_components.CardWrapper>
      )}
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

//todo: add penautman
