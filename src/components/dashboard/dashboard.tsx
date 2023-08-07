import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import * as global_components from "@/components/global";
import * as utils from "@/utils";
import * as interfaces from "@/interfaces";
export function Dashboard() {
  const { address, isConnected } = useAccount();
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
  }, []);
  return (
    <global_components.CardWrapper>
      <div className="flex flex-col gap-2">
        <div className="text-xl font-bold">
          A list of all the links you have created.
        </div>
        {isConnected ? (
          <table className=" w-full border-2 border-white table-fixed border-separate border-spacing-y-4">
            <thead className="bg-black text-white ">
              <tr>
                <th className="py-2">Link</th>
              </tr>
            </thead>
            <tbody>
              {localStorageData.map((item) => (
                <tr key={item.hash}>
                  <td className="brutalborder-bottom ">{item.link}</td>
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
