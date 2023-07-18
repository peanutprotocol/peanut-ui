import React from "react";
import * as views from "./views";

// I always like to use consts files like these, makes it very readable and easy to change

export type SendScreens = "INITIAL" | "SUCCESS";

export interface ISendScreenState {
  screen: SendScreens;
  idx: number;
}

export const INIT_VIEW: ISendScreenState = {
  screen: "INITIAL",
  idx: 0,
};

export const SEND_SCREEN_FLOW: SendScreens[] = ["INITIAL", "SUCCESS"];

export const SEND_SCREEN_MAP: {
  [key in SendScreens]: { comp: React.FC<any> };
} = {
  INITIAL: { comp: views.SendInitialView },
  SUCCESS: { comp: views.SendSuccessView },
};

export interface ISendFormData {
  chainId: number;
  token: string;
  amount: number;
}
