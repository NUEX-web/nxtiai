interface FooterLink {
  label: string;
  href?: string;
  comingSoon?: boolean;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "AI Writer", href: "/?mode=standard#workspace" },
      { label: "Paraphraser", href: "/?mode=standard#workspace" },
      { label: "Humanizer", href: "/?mode=humanize#workspace" },
      { label: "Grammar Checker", comingSoon: true },
      { label: "AI Detector", comingSoon: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", comingSoon: true },
      { label: "Contact", href: "mailto:hello@nxtiai.com" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", comingSoon: true },
      { label: "Guides", comingSoon: true },
      { label: "Help center", comingSoon: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookie Policy", comingSoon: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto bg-contrast-bg">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <span className="text-xl font-medium tracking-tight text-contrast-ink">NXTIAI</span>
            <p className="mt-3 max-w-xs text-sm text-contrast-ink-soft">
              Your AI writing workspace.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-medium text-contrast-ink">{column.title}</h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {column.links.map((link) =>
                  link.comingSoon ? (
                    <li key={link.label} className="flex items-center gap-1.5 text-sm text-contrast-ink-soft/70">
                      {link.label}
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-contrast-ink-soft">
                        Soon
                      </span>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-contrast-ink-soft transition-colors hover:text-contrast-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-contrast-line pt-6 text-xs text-contrast-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} NXTIAI. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
