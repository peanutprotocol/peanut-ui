import { createElement, useState } from "react";
import * as global_components from "@/components/global";
import * as _consts from "./send.consts";

export function Send() {
  const [sendScreen, setSendScreen] = useState<_consts.ISendScreenState>(
    _consts.INIT_VIEW
  );
  const [claimLink, setClaimLink] = useState<string>("");
  const [txReceipt, setTxReceipt] = useState<string>("");

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
    <global_components.CardWrapper>
      {createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp, {
        onNextScreen: handleOnNext,
        onCustomScreen: handleOnCustom,
        claimLink,
        setClaimLink,
        txReceipt,
        setTxReceipt,
      } as _consts.ISendScreenProps)}
    </global_components.CardWrapper>
  );
}
