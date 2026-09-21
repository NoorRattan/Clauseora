# Clauseora frontend refinement brief

This is a surgical refinement of the existing premium interface, not a redesign. Preserve the current visual identity, copy, section order, spatial composition, interactions, and animation intent. Do not replace it with a template, generic cards, or a new design system.

## Measurable acceptance criteria

- Lighthouse on the deployed landing page: Performance, Accessibility, Best Practices, and SEO each at least 95 on a consistent mobile run.
- Largest Contentful Paint at most 2.5 seconds, Total Blocking Time below 200 milliseconds, and Cumulative Layout Shift below 0.1.
- No browser console errors, CSP violations, accessibility violations, or hydration warnings.
- Keyboard navigation, visible focus, `prefers-reduced-motion`, and screen-reader labels must work.
- Visual regression screenshots at 390×844, 768×1024, and 1440×900 must match the approved interface apart from intentional contrast corrections.

## Work required

### 1. Keep the hero; reduce its execution cost

The landing page currently spends most of its main-thread time in the Three.js/React Three Fiber hero and animation bundle. Preserve the same composition and perceived motion while changing its loading and rendering strategy in `src/app/components/landing/HeroArtwork.tsx` and related landing components.

- Keep the same hero artwork, color palette, depth, pointer response, timing, and premium feel.
- Render an immediate, lightweight first frame so the hero is visually complete before the interactive engine loads.
- Load the interactive 3D layer after the primary headline and call-to-action have painted; do not put the WebGL bundle on the critical path.
- Pause the render loop when the hero is offscreen or the tab is hidden. Render on demand when idle instead of running continuously where possible.
- Cap device pixel ratio adaptively, reduce particle/geometry complexity on constrained devices, and avoid expensive post-processing on mobile.
- Honor `prefers-reduced-motion` with an elegant static or slow ambient version rather than removing the artwork.
- If an SVG/CSS/canvas recreation is visually indistinguishable, it is acceptable and preferable. Do not simplify the visible result merely to improve the metric.

### 2. Remove avoidable animation cost without changing animation design

Audit `src/app/components/landing/LandingMotion.tsx`, `src/app/page.tsx`, and `src/app/page.module.css`.

- Avoid shipping both GSAP and Framer Motion for effects that can be expressed by one runtime or CSS.
- Preserve the current easing, stagger, reveal order, parallax feel, hover states, and smooth scrolling.
- Use transforms and opacity; avoid layout-triggering properties in scroll and pointer handlers.
- Use passive listeners, coalesce pointer work into `requestAnimationFrame`, and remove all listeners/observers on cleanup.
- Do not animate content before it becomes visible and do not create one observer per element when a shared observer works.

### 3. Correct the known accessibility defects invisibly

Raise only the affected muted text colors enough to meet WCAG AA; keep typography, hierarchy, spacing, and palette character unchanged.

- Landing capability label: current contrast approximately 4.26:1; target at least 4.5:1.
- Evidence eyebrow and evidence copy: approximately 3.91:1.
- Evidence principle text: approximately 3.29:1.
- Preview eyebrow: approximately 3.13:1.
- Source label and preview footer text/link: approximately 3.9–4.04:1.
- Privacy-detail labels: approximately 3.85:1.
- Workspace provider/detail and footer labels using `text-slate-500`: approximately 3.55–3.86:1.
- In `src/app/components/AnalysisWorkspace.tsx`, fix the home-link accessible name so it contains the complete visible label instead of overriding it with `aria-label="Clauseora Home"`.

Use automated axe checks plus keyboard and screen-reader spot checks. Do not globally brighten every muted token; change only failing uses or introduce an accessible muted token.

### 4. Preserve the font appearance

Inter and JetBrains Mono are now self-hosted through `next/font`, eliminating the previous CSP-blocked Google Fonts request. Keep those families, weights, line wrapping, and typographic scale. Do not reintroduce an external font stylesheet.

### 5. Prove the result

Before merging, attach:

- before/after screenshots at all three target viewports;
- a bundle comparison showing that the 3D/animation code is no longer on the initial critical path;
- mobile Lighthouse reports meeting the budgets above;
- an axe report with zero serious or critical violations;
- a keyboard checklist for navigation, tabs, upload controls, evidence drawers, and modal/drawer focus return.

Do not change API contracts, legal-boundary copy, evidence behavior, analysis modes, or the deployed submission form as part of this frontend task.
