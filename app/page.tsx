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
