import { createElement, useState } from "react";
import * as global_components from "@/components/global";
import * as _consts from "./send.consts";
import code_snippet from "@/assets/code_snippet.png";
export function Send() {
  const [sendScreen, setSendScreen] = useState<_consts.ISendScreenState>(
    _consts.INIT_VIEW
  );
  const [claimLink, setClaimLink] = useState<string>("");
  const [txReceipt, setTxReceipt] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);

  const handleOnNext = () => {
    const newIdx = sendScreen.idx + 1;
    setSendScreen(() => ({
      screen: _consts.SEND_SCREEN_FLOW[newIdx],
      idx: newIdx,
    }));
  };

  const handleOnCustom = (screen: _consts.SendScreens) => {
    setSendScreen(() => ({
      screen: screen,
      idx: _consts.SEND_SCREEN_FLOW.indexOf(screen),
    }));
  };

  return (
    <>
      <global_components.CardWrapper mt=" mt-16 ">
        {createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp, {
          onNextScreen: handleOnNext,
          onCustomScreen: handleOnCustom,
          claimLink,
          setClaimLink,
          txReceipt,
          setTxReceipt,
          chainId,
          setChainId,
        } as _consts.ISendScreenProps)}
      </global_components.CardWrapper>
      {sendScreen == _consts.INIT_VIEW && (
        <global_components.CardWrapper mb=" mb-8">
          <div className="mt-2 text-center text-black">
            <h2 className="title-font text-3xl lg:text-5xl font-black text-black">
              Integrate Peanut Protocol
            </h2>

            <h3 className="text-lg lg:text-2xl mt-2 font-bold text-black">
              transfer magic✨ in your own app
            </h3>

            <div className="text-base pb-8 w-11/12 lg:w-2/3 mx-auto">
              Want the peanut magic in your own dApp? Just install our{" "}
              <a
                href="https://www.npmjs.com/package/@squirrel-labs/peanut-sdk"
                className="underline text-black"
              >
                npm
              </a>{" "}
              library, and with 2 lines of code, you can create token links to
              send any type of tokens or NFTs!
            </div>
            <img src={code_snippet.src} className="w-11/12 lg:w-2/3 mx-auto" />

            <div className="text-base pt-8 w-11/12 lg:w-2/3 mx-auto">
              Read more{" "}
              <a
                href="https://peanutprotocol.notion.site/Developer-Documentation-b2b0720b7ca64410b468328f8fc02690"
                target="_blank"
                className="underline text-black"
              >
                here
              </a>
            </div>
          </div>
        </global_components.CardWrapper>
      )}
    </>
  );
}
