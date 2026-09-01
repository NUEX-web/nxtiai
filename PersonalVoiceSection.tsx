"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import CustomVoiceModal from "./CustomVoiceModal";
import AuthModal from "./AuthModal";
import { Plus } from "lucide-react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

const VOICE_PROFILES = ["Professional", "Academic", "Casual", "Business", "Custom Persona"];

export default function PersonalVoiceSection() {
  const { user } = useAuth();
  const [customVoiceModalOpen, setCustomVoiceModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  const handleCreateVoice = () => {
    if (user) {
      setCustomVoiceModalOpen(true);
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <>
      <section id="personal-voice" className="border-y border-line bg-mint">
        <div ref={ref} className={`${className} mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:gap-16 md:py-24`}>
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink md:text-4xl">
              AI that sounds like you.
            </h2>
            <p className="mt-4 max-w-md text-ink-soft">
              Create a personal writing profile so NXTIAI can follow your
              preferred tone, vocabulary, sentence style and level of
              formality.
            </p>
            <button
              type="button"
              onClick={handleCreateVoice}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
            >
              <Plus className="h-4 w-4" />
              Create Your Voice
            </button>
          </div>

          <ul className="flex flex-col gap-px self-center overflow-hidden rounded-xl border border-accent-soft-line bg-accent-soft-line">
            {VOICE_PROFILES.map((profile) => (
              <li
                key={profile}
                className="flex items-center justify-between bg-surface px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  <span className="text-sm font-medium text-ink">{profile}</span>
                </div>
                {profile === "Custom Persona" && (
                  <span className="text-[11px] font-semibold text-accent-strong bg-accent-soft px-2 py-0.5 rounded-full">
                    Dynamic DB
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CustomVoiceModal
        isOpen={customVoiceModalOpen}
        onClose={() => setCustomVoiceModalOpen(false)}
        onVoiceCreated={() => {
          // Scroll to workspace to try voice
          window.location.hash = "#workspace";
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="signup"
      />
    </>
  );
}
