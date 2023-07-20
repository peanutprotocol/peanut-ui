import * as global_components from "@/components/global";
import { Toaster } from "react-hot-toast";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col scrollbar-hide">
      <global_components.Header />
      <div className="bg-teal min-h-screen">{children}</div>
      <global_components.Footer />
      <Toaster />
    </div>
  );
}
