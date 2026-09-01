"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  LogOut,
  Sparkles,
  ChevronDown,
  User2,
  Gauge,
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "./AuthProvider";

interface ProductLink {
  label: string;
  description: string;
  href?: string;
  comingSoon?: boolean;
}

// Each entry maps to a real writing mode already supported by the editor
// (see lib/modes.ts) except the two marked comingSoon — those aren't real
// capabilities yet, so they render as a disabled row instead of a link
// that goes nowhere.
const PRODUCT_LINKS: ProductLink[] = [
  { label: "AI Writer", description: "Draft and rewrite from any prompt", href: "/?mode=standard#workspace" },
  { label: "Paraphraser", description: "Rephrase text while keeping the meaning", href: "/?mode=standard#workspace" },
  { label: "Humanizer", description: "Make AI-generated text read naturally", href: "/?mode=humanize#workspace" },
  { label: "Grammar Checker", description: "Catch grammar and punctuation issues", comingSoon: true },
  { label: "AI Detector", description: "Check whether text reads as AI-written", comingSoon: true },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const { user, profile, signOut, openAuthModal } = useAuth();

  const handleOpenAuth = (mode: "login" | "signup") => {
    openAuthModal(mode);
    setIsMenuOpen(false);
  };

  const getInitial = () => {
    if (profile?.full_name) return profile.full_name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "U";
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-[13px] font-semibold text-canvas">
              N
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink">NXTIAI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            <div
              className="relative"
              onMouseEnter={() => setProductOpen(true)}
              onMouseLeave={() => setProductOpen(false)}
            >
              <button
                type="button"
                onClick={() => setProductOpen((open) => !open)}
                aria-expanded={productOpen}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
              >
                Product
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {productOpen && (
                <div className="absolute left-0 top-full w-72 pt-2">
                  <div className="animate-fade-in overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
                    {PRODUCT_LINKS.map((item) =>
                      item.comingSoon ? (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 opacity-50"
                        >
                          <div>
                            <p className="text-sm font-medium text-ink">{item.label}</p>
                            <p className="text-xs text-ink-faint">{item.description}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                            Soon
                          </span>
                        </div>
                      ) : (
                        <Link
                          key={item.label}
                          href={item.href!}
                          onClick={() => setProductOpen(false)}
                          className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-accent-soft"
                        >
                          <p className="text-sm font-medium text-ink">{item.label}</p>
                          <p className="text-xs text-ink-faint">{item.description}</p>
                        </Link>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <a href="#pricing" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink">
              Pricing
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-2.5 pr-3.5 text-sm font-medium text-ink transition-colors hover:border-line-strong"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-surface">
                    {getInitial()}
                  </span>
                  <span className="max-w-[120px] truncate">
                    {profile?.full_name || user.email?.split("@")[0]}
                  </span>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-strong">
                    {profile?.plan_tier || "Free"}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-lg animate-fade-in z-50">
                    <div className="border-b border-line px-3 py-2">
                      <p className="truncate text-xs font-medium text-ink">{user.email}</p>
                      <p className="text-[11px] capitalize text-ink-faint">Plan: {profile?.plan_tier || "Free"}</p>
                    </div>

                    <a
                      href="#workspace"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-accent-soft"
                    >
                      <Sparkles className="h-4 w-4 text-accent" />
                      Writing workspace
                    </a>
                    <Link
                      href="/account"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink hover:bg-accent-soft"
                    >
                      <User2 className="h-4 w-4 text-accent" />
                      Profile
                    </Link>
                    <div
                      className="flex cursor-not-allowed items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink-faint"
                      title="Usage tracking is coming soon"
                    >
                      <span className="flex items-center gap-2">
                        <Gauge className="h-4 w-4" />
                        Usage
                      </span>
                      <span className="rounded-full bg-line px-1.5 py-0.5 text-[9px] font-semibold uppercase">Soon</span>
                    </div>
                    <div
                      className="flex cursor-not-allowed items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink-faint"
                      title="A full dashboard is coming soon"
                    >
                      <span className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </span>
                      <span className="rounded-full bg-line px-1.5 py-0.5 text-[9px] font-semibold uppercase">Soon</span>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        setUserDropdownOpen(false);
                        await signOut();
                      }}
                      className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-line px-3 py-2 pt-2.5 text-xs font-medium text-danger hover:bg-danger-soft"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("login")}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAuth("signup")}
                  className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
                >
                  Get started
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink md:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isMenuOpen && (
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className="border-t border-line bg-canvas px-6 py-4 md:hidden"
          >
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Product</p>
            <ul className="flex flex-col gap-0.5">
              {PRODUCT_LINKS.map((item) =>
                item.comingSoon ? (
                  <li key={item.label} className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-ink-faint">
                    {item.label}
                    <span className="rounded-full bg-line px-1.5 py-0.5 text-[9px] font-semibold uppercase">Soon</span>
                  </li>
                ) : (
                  <li key={item.label}>
                    <Link
                      href={item.href!}
                      className="block rounded-lg px-2 py-2.5 text-sm text-ink-soft hover:bg-accent-soft hover:text-ink"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              )}
              <li>
                <a
                  href="#pricing"
                  className="block rounded-lg px-2 py-2.5 text-sm text-ink-soft hover:bg-accent-soft hover:text-ink"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Pricing
                </a>
              </li>
            </ul>

            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              {user ? (
                <>
                  <Link
                    href="/account"
                    className="rounded-full border border-line px-4 py-2 text-center text-sm font-medium text-ink"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMenuOpen(false);
                      await signOut();
                    }}
                    className="rounded-full border border-line px-4 py-2 text-sm font-medium text-danger"
                  >
                    Sign out ({user.email})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenAuth("login")}
                    className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink"
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAuth("signup")}
                    className="rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-white"
                  >
                    Get started
                  </button>
                </>
              )}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
