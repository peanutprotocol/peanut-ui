import { Toaster } from "react-hot-toast";

import * as global_components from "@/components/global";

export function PageWrapper({
  children,
  bgColor = "bg-teal",
  showMarquee = true,
}: {
  children: React.ReactNode;
  bgColor?: string;
  showMarquee?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col scrollbar-hide">
      <global_components.Header showMarquee={showMarquee} />
      <div className={" min-h-screen sm:pt-24 pt-8 " + bgColor}>{children}</div>
      <global_components.Footer showMarquee={showMarquee} />
      <Toaster />
    </div>
  );
}
