import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import WritingWorkspace from "@/components/WritingWorkspace";
import BeforeAfter from "@/components/BeforeAfter";
import AIEngineSection, { type EngineStatus } from "@/components/AIEngineSection";
import PersonalVoiceSection from "@/components/PersonalVoiceSection";
import ToolsSection from "@/components/ToolsSection";
import HowItWorks from "@/components/HowItWorks";
import TrustSection from "@/components/TrustSection";
import PricingPreview from "@/components/PricingPreview";
import Footer from "@/components/Footer";
import AuthErrorBanner from "@/components/AuthErrorBanner";
import { AI_MODEL_OPTIONS } from "@/lib/modes";
import { getModelAvailability, isProviderConfigured } from "@/lib/server/model-config";

// Explicit self-referencing canonical. Without this, Next.js emits no
// <link rel="canonical"> at all (metadataBase alone only resolves
// relative OG/Twitter URLs, it does not generate a canonical tag) --
// so search engines have no authoritative-URL signal for this page and
// can end up preferring a stray indexed URL (an old vercel.app preview
// alias, a duplicate from one of the other Vercel projects tied to this
// repo, etc.) over https://nxtiai.com itself.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  // Computed server-side because it depends on server-only env vars
  // (GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY) — never read
  // those from a client component.
  const unavailableModels = AI_MODEL_OPTIONS.filter(
    (model) => !getModelAvailability(model.id)
  ).map((model) => model.id);

  // Same source of truth the workspace's model selector uses — the
  // homepage's "AI engine" section can never claim a provider is active
  // when it isn't actually configured.
  const engines: EngineStatus[] = [
    {
      id: "gemini",
      label: "Gemini",
      description: "Google's Gemini models power every rewrite today.",
      active: isProviderConfigured("gemini"),
    },
    {
      id: "openai",
      label: "OpenAI",
      description: "GPT-based rewriting — the architecture is ready.",
      active: isProviderConfigured("openai"),
    },
    {
      id: "anthropic",
      label: "Claude",
      description: "Anthropic's Claude models — the architecture is ready.",
      active: isProviderConfigured("anthropic"),
    },
  ];

  return (
    <>
      <Navbar />
      <AuthErrorBanner />
      <main className="flex-1">
        <Hero />
        <WritingWorkspace unavailableModels={unavailableModels} />
        <BeforeAfter />
        <AIEngineSection engines={engines} />
        <PersonalVoiceSection />
        <ToolsSection />
        <HowItWorks />
        <TrustSection />
        <PricingPreview />
      </main>
      <Footer />
    </>
  );
}
