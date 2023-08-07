import { Toaster } from "react-hot-toast";

import * as global_components from "@/components/global";

export function PageWrapper({
  children,
  bgColor = "bg-teal",
}: {
  children: React.ReactNode;
  bgColor?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col scrollbar-hide">
      <global_components.Header />
      <div className={" min-h-screen sm:pt-24 pt-8 " + bgColor}>{children}</div>
      <global_components.Footer />
      <Toaster />
    </div>
  );
}
