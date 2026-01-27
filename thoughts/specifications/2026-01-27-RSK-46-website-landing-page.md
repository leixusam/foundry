# Specification: Website Landing Page

**Issue**: RSK-46
**Date**: 2026-01-27
**Research**: [thoughts/research/2026-01-27-RSK-46-website-landing-page.md](../research/2026-01-27-RSK-46-website-landing-page.md)
**Status**: Complete

## Executive Summary

Create a two-page marketing website for Foundry that communicates value and drives npm package installation. Users will land on a clean, focused page that shows what Foundry does and how to install it, then optionally explore a "How It Works" page for deeper understanding. The experience should feel modern, calm, and technical—like good developer documentation, not a SaaS landing page.

## User Experience Goals

### Primary Goal
Get developers to install `@leixusam/foundry` by clearly showing the value and making installation effortless.

### Experience Principles
- **Simplicity**: One clear path to installation. No feature comparisons, pricing tables, or newsletter signups. Just "here's what it does, here's how to get it."
- **Delight**: Smooth micro-interactions, crisp typography, code blocks that beg to be copied. The ASCII diagram from the README, animated subtly to show the flow.
- **Polish**: Every detail considered—spacing, color, hover states. No placeholder text, no broken responsive layouts, no generic stock imagery.

## User Flows

### Happy Path
1. User lands on homepage from GitHub/search/word of mouth
2. Immediately sees: tagline explaining value + install command
3. Scans brief outcome statements (what Foundry does for them)
4. Clicks "Copy" on install command
5. Optionally clicks "How It Works" for deeper explanation
6. Leaves page confident about what to do next

### Edge Cases
| Scenario | User Experience |
|----------|-----------------|
| Mobile user | Responsive layout, install commands remain prominent and copyable |
| No JavaScript | Static content renders fully, copy buttons fall back to selectable text |
| Screen reader | Semantic HTML, proper headings, alt text for diagrams |
| User wants more info | "How It Works" page and GitHub link satisfy curiosity |

### Error States
| Error | User Message | Recovery Path |
|-------|--------------|---------------|
| 404 page | "Page not found. Let's get you back on track." | Link to homepage |
| (No other errors expected for static site) | — | — |

## Interface Specifications

### Page 1: Landing Page

#### Above the Fold (Hero)
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  [Logo: "Foundry" in clean sans-serif]         [How It Works] [GitHub →]  │
│                                                                     │
│                                                                     │
│           Autonomous development                                    │
│           that works on your tickets                                │
│           while you sleep.                                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  $ npm install -g @leixusam/foundry                     │ [Copy] │
│  │  $ foundry init                                         │       │
│  │  $ foundry                                              │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│                     or install locally: npx foundry init            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Tagline: Large, confident, readable. No buzzwords.
- Install block: Dark terminal aesthetic, monospace font, prominent copy button
- Secondary install option is muted but present

#### Below the Fold: Outcomes Section
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  What happens when you run Foundry:                                 │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│  │    You      │    │  Foundry    │    │    You      │             │
│  │   create    │───▶│   works     │───▶│   review    │             │
│  │  a ticket   │    │             │    │    code     │             │
│  └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                     │
│  • Creates a branch for the ticket                                  │
│  • Researches your codebase                                         │
│  • Plans the implementation                                         │
│  • Writes and tests code                                            │
│  • Updates Linear with progress                                     │
│  • Opens a PR when done                                             │
│                                                                     │
│                    [Learn how it works →]                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Simple 3-step flow diagram
- Bullet points are outcomes, not features
- Single secondary CTA

#### Footer
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  MIT License · GitHub · Made for developers who'd rather not       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Page 2: How It Works

#### Structure
```
┌─────────────────────────────────────────────────────────────────────┐
│  [← Back to Home]           How It Works           [GitHub →]        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Pods, Loops, and Agents                                            │
│  ─────────────────────────                                          │
│  [ASCII diagram showing Pod → Loops → Agents]                       │
│  [Brief explanation paragraph]                                       │
│                                                                     │
│  The Agent Pipeline                                                 │
│  ─────────────────────                                              │
│  Agent 1: Reader → Agent 2: Worker → Agent 3: Writer                │
│  [Brief explanation of each]                                         │
│                                                                     │
│  Linear as State Machine                                            │
│  ───────────────────────                                            │
│  [Status flow diagram]                                              │
│  [Explanation of workflow statuses]                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  Ready to try?                                           │       │
│  │  $ npm install -g @leixusam/foundry                      │ [Copy] │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Content source**: Pull from README.md, simplify where needed.

### Visual Design Language

#### Colors
```
Background:     #0a0a0b (near-black, not pure black)
Surface:        #141416 (subtle lift for cards/code blocks)
Border:         #27272a (zinc-800, subtle separation)
Text Primary:   #fafafa (zinc-50)
Text Secondary: #a1a1aa (zinc-400)
Accent:         #3b82f6 (blue-500, for links and CTAs)
Accent Hover:   #60a5fa (blue-400)
Code Text:      #e4e4e7 (zinc-200)
Success:        #22c55e (green-500, for copy confirmation)
```

**Rationale**: Dark theme fits "futuristic" requirement. Near-black (not pure black) is easier on the eyes. Blue accent is universally professional and readable on dark. No gradients on backgrounds—keep it flat and clean. Gradients only on subtle elements like CTA buttons.

#### Typography
```
Headings:       Inter, weight 600, sizes: 48/36/24/20/18px
Body:           Inter, weight 400, size 16px, line-height 1.6
Code:           JetBrains Mono, weight 400, size 14px
Tagline:        Inter, weight 500, size 24px (on mobile 20px)
```

**Rationale**: Inter is clean, modern, and web-optimized. JetBrains Mono is the gold standard for code. No custom fonts that require loading—both are available on Google Fonts.

#### Spacing System (8px base)
```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
3xl: 64px
```

#### Breakpoints
```
Mobile:  < 640px   (single column, slightly smaller typography)
Tablet:  640-1024px (some two-column layouts)
Desktop: > 1024px  (full layout, max content width 1200px)
```

### Copy/Messaging

**Tagline** (hero):
> Autonomous development that works on your tickets while you sleep.

**Alternative (if shorter needed)**:
> AI that ships your Linear tickets.

**Outcomes (landing page)**:
- Creates a branch for the ticket
- Researches your codebase
- Plans the implementation
- Writes and tests code
- Updates Linear with progress
- Opens a PR when done

**Installation instruction**:
> Install globally and run in any project.

**How It Works intro**:
> Foundry orchestrates AI agents to turn Linear tickets into shipped code. Here's how the pieces fit together.

### Interactions

#### Code Block Copy Button
- Hover: Background lightens slightly, cursor pointer
- Click: Text changes from "Copy" to "Copied!" with checkmark icon
- Reset: After 2 seconds, reverts to "Copy"
- Whole block click: Does NOT copy (only button)

#### Navigation Links
- Hover: Color shifts to accent-hover, subtle underline appears
- No transitions longer than 150ms

#### Page Transitions
- None. Standard browser navigation. Keep it simple.

#### Scroll Behavior
- Smooth scroll when clicking anchor links (if any)
- No parallax, no scroll-triggered animations. Static content, fast loading.

### Feedback

#### Copy Confirmation
- "Copied!" text + checkmark replaces "Copy" button text
- Optional: Subtle green flash on button background

#### Loading States
- None needed (static site)

#### Success States
- Not applicable (no forms)

## Technical Decisions

### Framework: Astro
- Static site generation, zero JavaScript by default
- Ideal for content-focused sites
- Fast build, fast load
- Can add interactive islands if needed (copy button)

### Styling: CSS Variables + Utility Classes
- Not Tailwind (avoids "generic Tailwind" look)
- Custom CSS with design tokens as variables
- Keeps bundle size minimal
- Full control over aesthetic

### Hosting: GitHub Pages (recommended) or Vercel
- Free
- Custom domain support
- Automatic deployments from `website/` folder

### Directory Structure
```
website/
├── src/
│   ├── pages/
│   │   ├── index.astro
│   │   └── how-it-works.astro
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── CodeBlock.astro
│   │   └── CopyButton.astro (client-side JS)
│   ├── layouts/
│   │   └── BaseLayout.astro
│   └── styles/
│       └── global.css
├── public/
│   └── (favicon, og-image if needed)
├── astro.config.mjs
└── package.json
```

## Success Metrics

How do we know the UX is successful?
- **Primary**: Users can complete installation flow (measure via GitHub stars, npm downloads—out of scope for this spec but the CTA is optimized for this)
- **Qualitative**: Site feels polished, professional, not generic. Would be proud to share on Hacker News.
- **Performance**: Lighthouse 95+ on all metrics
- **Accessibility**: WCAG AA compliant

## Out of Scope

- Analytics integration (can add later)
- Dark/light mode toggle (dark only for v1)
- Documentation section (README is sufficient)
- Blog or changelog
- Contact form or newsletter signup
- Animation library (keep it simple)
- Multiple framework options (Astro only)

## Open Questions

None blocking. The following are conscious decisions:

1. **Framework**: Astro chosen. If rejected, Next.js static export is the fallback.
2. **Hosting**: GitHub Pages recommended, but deployer can choose.
3. **Dark mode only**: Fits aesthetic, simplifies implementation.
4. **Content depth**: "How It Works" pulls from README—enough to understand, not a full docs site.

## Simplification Opportunities

1. **Removed pricing/comparison**: Developer tools don't need this. Just show value and let people try it.
2. **Single CTA**: Install command. No competing actions.
3. **Two pages only**: Landing + How It Works. No bloated marketing site.
4. **No animations**: Static content loads instantly. Micro-interactions only where functional (copy button).
5. **No newsletter/signup**: Reduces complexity, respects users.
6. **No custom fonts beyond Inter/JetBrains Mono**: Fast loading, proven choices.
