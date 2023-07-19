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

  const sendForm = useForm<_consts.ISendFormData>({
    mode: "onChange",
    defaultValues: {
      chainId: 1,
      amount: 0,
      token: "eth",
    },
  });

  return (
    <div>
      {createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp, {
        onNextScreen: handleOnNext,
      } as _consts.ISendScreenProps)}
    </div>
  );
}
