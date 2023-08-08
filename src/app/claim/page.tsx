"use client";

import * as global_components from "@/components/global";
import * as components from "@/components";
import { useSearchParams } from "next/navigation";

export default function ClaimPage() {
  const params = useSearchParams();

  return (
    <global_components.PageWrapper>
      <components.Claim link={params.toString()} />
    </global_components.PageWrapper>
  );
}
