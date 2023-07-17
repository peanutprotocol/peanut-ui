import * as global_components from "@/components/global";
import smiley from "@/assets/black-smiling-face.svg";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-green min-h-screen w-screen flex flex-col scrollbar-hide">
      <global_components.Header />
      <div className="bg-yellow min-h-screen">{children}</div>
      <global_components.Footer />
    </div>
  );
}
