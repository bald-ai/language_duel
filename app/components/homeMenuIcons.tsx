/**
 * Presentation-only SVG icons for the home menu and mock feature shells.
 * These are static design constants extracted from HomePageClient so the page
 * wires the menu rather than carrying ~80 lines of inline SVG.
 */

export const SoloIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export const DuelIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <g transform="rotate(45 12 12)">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
    </g>
    <g transform="rotate(-45 12 12)">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
    </g>
  </svg>
);

export const ThemesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);

export const MockFeaturesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v6M12 9v6M17 14v6" />
  </svg>
);

export const OnlineMockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
  </svg>
);
