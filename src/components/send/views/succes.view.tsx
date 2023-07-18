import Link from "next/link";
import { useState } from "react";

import { useWeb3Modal } from "@/context/Web3ModalContext";
import * as consts from "@/consts";

import * as _consts from "../send.consts";

export function SendSuccessView() {
  const [denomination, setDenomination] = useState("USD");
  const { isConnected, connect } = useWeb3Modal();

  return <></>;
}
