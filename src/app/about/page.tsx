"use client";
import * as global_components from "@/components/global";
import * as components from "@/components";
export default function AboutPage() {
  return (
    <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
      <components.About />
    </global_components.PageWrapper>
  );
}
