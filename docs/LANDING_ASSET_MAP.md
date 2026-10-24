# Landing Page Asset Map

This document inventories every artwork, graphic element, texture, and component in the landing page reference design (`design-reference/full-mockup.png`), detailing its source asset, production path in `public/assets/landing/`, dimensions, format, and implementation notes.

Per non-negotiable protocol rules (`AGENTS.md`), all UI cards, metric readouts, buttons, navigation items, simulator sliders, tabs, and charts are **real client-side React components** fed by deterministic on-chain calculators. Graphic assets are used strictly for artistic collage layers.

---

## Asset Inventory Table

| Target Element | Section | Source Origin | Production Asset Path | Format / Size | Implementation Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Statue (David with sunglasses)** | 1. Hero | `design-reference/sources/hero-david.jpg` | `/assets/landing/hero-david.webp` | WebP (1024×575, ~87 KB) | High-res composite layer. Bleeds directly to the right edge and upward toward the header. |
| **Orange Terracotta Arch** | 1. Hero | `design-reference/sources/hero-david.jpg` | `/assets/landing/hero-david.webp` | WebP (integrated) | Part of the high-res hero composite sitting behind David's head. |
| **Florence Skyline & Duomo** | 1. Hero | `design-reference/sources/hero-david.jpg` | `/assets/landing/hero-david.webp` | WebP (integrated) | Sits lower right of statue, bleeding to right edge. |
| **Olive / Laurel Leaves** | 1. Hero | `design-reference/sources/hero-david.jpg` | `/assets/landing/hero-david.webp` | WebP (integrated) | Flanks the statue's left and bottom right. |
| **Postage Stamp & Roma Postmark** | 1. Hero | `design-reference/sources/hero-david.jpg` | `/assets/landing/hero-david.webp` | WebP (integrated) | "ITALIA 50" stamp and circular postmark at upper right corner. |
| **Torn Paper Edges & Texture** | All Sections | Generated CSS / SVG | CSS `clip-path` & SVG displacement filter | SVG / CSS | Reusable torn paper edge displacement utilities and SVG `feTurbulence` grain. |
| **Problem Arch Window (Florence Duomo)** | 2. The Problem | `design-reference/full-mockup.png` (Section 2) | `/assets/landing/problem-arch-duomo.webp` | WebP with alpha (576×498, ~46 KB) | Tuscan stone arch framing Florence Duomo, green leaves, lantern, orange/red torn panels, and dark blue paper piece. Outside curve is transparent. Baked text was eliminated to allow the vector `Handwritten` component to render crisply. |
| **Pointing Hand (Creation of Adam)** | 3. How It Works | `design-reference/sources/pointing-arm.png` | `/assets/landing/pointing-arm.webp` | WebP with alpha (1024×356, ~65 KB) | Isolated classical marble pointing arm entering horizontally from the right edge. |
| **Orange Watercolor Blob** | 3. How It Works | `design-reference/full-mockup.png` (Section 3) | `/assets/landing/orange-blob.webp` | WebP with alpha (120×275, ~7 KB) | Vibrant orange watercolor accent splash positioned at the left viewport edge. |
| **Simulator Colosseum & Columns** | 4. Simulator | `design-reference/sources/terracotta-colosseum.jpg` | `/assets/landing/simulator-colosseum.webp` | WebP (1024×576, ~124 KB) | Classical Roman Colosseum arches with olive branch and column sketch embedded within the deep rust inset panel. |
| **Belief Statue with Orange Fruit** | 5. Our Belief | `design-reference/sources/belief-david-cutout.png` | `/assets/landing/belief-david.webp` | WebP with alpha (1024×682, ~185 KB) | Classical David statue with sunglasses, bright orange fruit, citrus leaves, orange halo, and torn blue paper. Bleeds off left viewport edge. |
| **Belief Right-Side Building Facade** | 5. Our Belief | `design-reference/sources/belief-facade.jpg` | `/assets/landing/belief-facade.webp` | WebP (1024×576, ~64 KB) | Italian terracotta facade with green shuttered windows, black lantern, and torn dark blue paper strip. Bleeds off right viewport edge. |
| **Footer Skyline Architectural Sketch** | 6. Footer | `design-reference/full-mockup.png` (Section 6) | `/assets/landing/footer-skyline.webp` | WebP with alpha (360×272, ~15 KB) | Intricate ink architectural line-sketch of Santa Maria del Fiore sitting at bottom right of the footer. |
| **Handwritten Annotations & Curved Arrows** | Sections 1, 2, 3, 5, 6 | Target design text & vectors | Inline SVG + `<Handwritten />` component | Google Font (Caveat/Patrick Hand) + SVG vectors | Real, accessible text rotated slightly (-4° to -6°) in ember orange (`#CA461E`) paired with precise hand-drawn inline SVG vector arrows and underlines. |
| **Position Card & Simulator Card UI** | Sections 1 & 4 | Native React Components | `apps/web/src/app/page.tsx` | Pure DOM / React / SVG | 100% interactive React components with live mathematical calculations, slider controls, timeframe pills, and interactive SVG area chart. No baked images. |

---

## Production Bundle Verification

- `design-reference/full-mockup.png` is strictly stored outside `public/` in `design-reference/`.
- Total weight of all landing page images combined is **~593 KB**, easily beating the performance target of < 1.5 MB.
- All assets are served as modern, optimized WebP images with transparent alpha channels where required.
