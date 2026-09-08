import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AIDetectorTool from "@/components/AIDetectorTool";

export const metadata: Metadata = {
  title: "AI Detector — NXTIAI",
  description: "Estimate how likely a piece of text is to be AI-generated.",
  alternates: { canonical: "/ai-detector" },
};

export default function AIDetectorPage() {
  return (
    <>
      <Navbar />
      <AIDetectorTool />
      <Footer />
    </>
  );
}
