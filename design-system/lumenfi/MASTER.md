# LumenFi design system

This file is the source of truth for future LumenFi UI work.

## Design direction

- Product: Arc Testnet DeFi workspace
- Audience: DeFi users, technical reviewers, and hackathon judges
- Mode: redesign overhaul with routes, content hierarchy, brand mark, and functionality preserved
- Visual language: institutional market console, calm, credible, compact
- Design variance: 5/10
- Motion intensity: 3/10
- Visual density: 7/10
- Reference synthesis:
  - Astryx: app-shell clarity, restrained surfaces, accessibility, and predictable component anatomy
  - 21st.dev: focused interaction patterns and readable AI planning traces
  - Magic UI: use only for rare feedback moments, never as a decorative layer across the app

## Foundations

- Stack: React, TypeScript, and native CSS
- Theme: dark only unless a future brief explicitly requests dual mode
- Typography: IBM Plex Sans Variable for interface copy and IBM Plex Mono for financial data
- Primary accent: muted mint `#6bd6b6`
- Background: off-black graphite `#090d12`
- Surfaces: cool graphite `#0e141b` and `#121a23` with `#202c37` borders
- Shape rules: 8px controls, 12-14px modules, 18px page containers
- Icons: Lucide only, using a consistent 1.5 stroke width
- Data: use tabular figures and keep precise values readable
- Accent use: active navigation, primary actions, focus, and semantic live state only
- Avoid: purple gradients, neon glow, repeated pills, glass panels, equal three-card rows, and decorative status dots

## Layout

- App-shell max width: 1320px
- Content max width: 1260px
- Desktop gutter: 24px minimum
- Mobile gutter: 14px
- Breakpoints: 760px and 1040px
- Every multi-column layout must explicitly collapse below 760px
- No page-level horizontal scrolling
- Data tables may scroll inside their own labeled container
- Touch targets must be at least 44px high and wide

## Interaction

- Use 150-300ms feedback for hover, focus, pressed, and state changes
- Animate only transform and opacity
- Respect `prefers-reduced-motion`
- Show loading, empty, error, disabled, and transaction states in context
- Only the mounted market tab may run RPC reads
- Quote requests from typed input must be debounced
- Agent responses use a 21st.dev-inspired planning trace: show completed, active, partial, and pending evidence reads before recommendations
- Keep the planning trace semantic and lightweight with native React/CSS; do not add Tailwind, shadcn, or Motion solely for this pattern
- Buttons and inputs use 180ms feedback; perpetual motion is limited to active loading or evidence reads
- Use borders and spacing for hierarchy before creating another card

## Accessibility

- Keep visible keyboard focus rings
- Provide labels for icon-only buttons
- Keep body text at least 16px on mobile
- Do not use color as the only status signal
- Maintain a logical heading order and a skip link
- Normal text should meet WCAG AA contrast

## Content

- Use specific claims that can be verified
- Avoid generic phrases such as "seamless", "next-gen", and "smartest"
- Keep the hero value proposition short
- Put technical proof below the primary hero message
- Keep one primary action per screen
- Use sentence case for headings and labels
- Do not use unsupported performance claims, fake precision, or generic AI marketing language

## Performance

- Lazy-load market modules and optional bridge integrations
- Reserve space for loading content to avoid layout shift
- Keep inactive modules unmounted
- Use resilient Arc RPC fallbacks for public reads
- Verify desktop and 390px mobile layouts before release
