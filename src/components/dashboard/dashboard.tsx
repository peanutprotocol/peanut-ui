import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import * as global_components from "@/components/global";
import * as utils from "@/utils";
import * as interfaces from "@/interfaces";
import * as store from "@/store";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

export function Dashboard() {
  const [chainDetails] = useAtom(store.defaultChainDetailsAtom);
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [localStorageData, setLocalStorageData] = useState<
    interfaces.ILocalStorageItem[]
  >([]);

  useEffect(() => {
    if (address) {
      const data = utils.getAllLinksFromLocalStorage({
        address: address.toString(),
      });
      data && setLocalStorageData(data);
    }
    router.prefetch("/");
  }, []);
  return (
    <global_components.CardWrapper>
      <div className="flex flex-col gap-2">
        <div className="flex w-full align-center justify-between">
          <div className="text-xl font-bold text-center">
            A list of all the links you have created.
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              className="inline-flex items-center justify-center brutalborder px-4 py-2 text-sm font-medium text-white hover:text-black bg-black hover:bg-white sm:w-auto cursor-pointer"
              onClick={() => {
                router.push("/");
              }}
            >
              CREATE
              <svg
                className="ml-2 -mr-0.5 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -2 15 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
        {isConnected ? (
          <table className=" w-full border-2 border-white table-fixed border-separate border-spacing-y-4 ">
            <thead className="bg-black text-white ">
              <tr>
                <th className="py-2 w-1/4">Chain</th>
                <th className="py-2 w-3/4">Link</th>
              </tr>
            </thead>
            <tbody>
              {localStorageData.map((item) => (
                <tr key={item.hash}>
                  <td className="brutalborder-bottom h-8 overflow-hidden overflow-ellipsis break-all whitespace-nowrap cursor-pointer">
                    {
                      chainDetails.find(
                        (chain) =>
                          chain.chainId.toString() ===
                          item.link.match(/c=(\d+)/)?.[1]
                      )?.name
                    }
                  </td>

                  <td
                    className="brutalborder-bottom h-8 overflow-hidden overflow-ellipsis break-all whitespace-nowrap cursor-pointer"
                    onClick={() => {
                      navigator.clipboard.writeText(item.link);
                    }}
                  >
                    {item.link}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          "Connect your wallet to view your deposits"
        )}
      </div>
    </global_components.CardWrapper>
  );
}
