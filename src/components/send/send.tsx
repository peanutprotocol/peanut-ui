import { createElement, useState } from "react";
import { useForm } from "react-hook-form";

import * as _consts from "./send.consts";

export function Send() {
  const [sendScreen, setSendScreen] = useState<_consts.ISendScreenState>(
    _consts.INIT_VIEW
  );

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
    <div>
      {createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp, {
        onNextScreen: handleOnNext,
        onCustomScreen: handleOnCustom,
      } as _consts.ISendScreenProps)}
    </div>
  );
}
