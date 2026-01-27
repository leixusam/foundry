# Implementation Plan: Make a website landing page

**Issue**: RSK-46
**Date**: 2026-01-27
**Research**: [thoughts/research/2026-01-27-RSK-46-website-landing-page.md](../research/2026-01-27-RSK-46-website-landing-page.md)
**Specification**: [thoughts/specifications/2026-01-27-RSK-46-website-landing-page.md](../specifications/2026-01-27-RSK-46-website-landing-page.md)
**Status**: Ready for Implementation

## Overview

Build a two-page Astro static website for Foundry that drives npm package installation. The site features a dark theme, custom CSS with design tokens, and a polished developer-focused aesthetic. Pages include a landing page (hero + outcomes) and a "How It Works" page explaining the architecture. The install command with copy-to-clipboard is the primary CTA.

## Success Criteria

- [ ] Website builds successfully with `npm run build` in `website/` directory
- [ ] Landing page renders with hero section, install command block, and outcomes section
- [ ] "How It Works" page renders with architecture diagrams and explanations
- [ ] Copy button copies install command to clipboard and shows "Copied!" feedback
- [ ] Site is fully responsive (mobile, tablet, desktop breakpoints)
- [ ] Dark theme matches specification colors (#0a0a0b background, blue accent)
- [ ] Typography uses Inter and JetBrains Mono as specified
- [ ] All internal navigation links work correctly
- [ ] GitHub link in header works
- [ ] Lighthouse performance score 95+
- [ ] Type check passes (if any TypeScript used)
- [ ] No console errors in browser

## Phases

### Phase 1: Project Setup

**Goal**: Initialize Astro project with correct configuration and directory structure.

**Changes**:
- `website/package.json`: Create package.json with Astro dependencies
- `website/astro.config.mjs`: Configure Astro for static output
- `website/tsconfig.json`: TypeScript configuration (Astro default)
- `website/src/styles/tokens.css`: CSS custom properties for design tokens

**Implementation Details**:

```
website/
├── src/
│   ├── pages/
│   ├── components/
│   ├── layouts/
│   └── styles/
│       └── tokens.css       # Design tokens (colors, spacing, typography)
├── public/
│   └── favicon.svg
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Design tokens to define in `tokens.css`:
```css
:root {
  /* Colors */
  --color-bg: #0a0a0b;
  --color-surface: #141416;
  --color-border: #27272a;
  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-accent: #3b82f6;
  --color-accent-hover: #60a5fa;
  --color-code-text: #e4e4e7;
  --color-success: #22c55e;

  /* Spacing (8px base) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Font sizes */
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 36px;
  --text-4xl: 48px;

  /* Max content width */
  --max-width: 1200px;
}
```

**Verification**:
```bash
cd website
npm install
npm run dev  # Should start dev server without errors
```

### Phase 2: Base Layout and Global Styles

**Goal**: Create the base layout with header, footer, and global styles that all pages will use.

**Changes**:
- `website/src/layouts/BaseLayout.astro`: Base HTML structure with head, fonts, and body wrapper
- `website/src/styles/global.css`: Global styles (reset, base typography, body styles)
- `website/src/components/Header.astro`: Header with logo, "How It Works" link, GitHub link
- `website/src/components/Footer.astro`: Footer with license, GitHub, tagline

**Implementation Details**:

BaseLayout.astro structure:
```astro
---
import '../styles/tokens.css';
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
}

const { title, description = 'AI-powered autonomous development' } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content={description} />
  <title>{title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono&display=swap" rel="stylesheet">
</head>
<body>
  <Header />
  <main>
    <slot />
  </main>
  <Footer />
</body>
</html>
```

Header navigation:
- Logo: "Foundry" text (clean, weight 600)
- Right side: "How It Works" | GitHub icon/link

Footer content:
- "MIT License · GitHub · Made for developers who'd rather not"

**Verification**:
```bash
cd website
npm run dev
# Visit http://localhost:4321 - should see header/footer with correct styling
```

### Phase 3: Code Block with Copy Button

**Goal**: Create reusable CodeBlock component with functional copy-to-clipboard button.

**Changes**:
- `website/src/components/CodeBlock.astro`: Terminal-style code block wrapper
- `website/src/components/CopyButton.astro`: Client-side interactive copy button

**Implementation Details**:

CodeBlock props:
- `code`: String of code to display
- `showLineNumbers`: Boolean (optional, default false)

CopyButton behavior:
- Uses `client:load` directive for client-side JS
- On click: copies code to clipboard via `navigator.clipboard.writeText()`
- Shows "Copy" by default, "Copied!" with checkmark for 2 seconds after click
- Subtle background color change on hover

Styling:
```css
.code-block {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--space-lg);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-code-text);
  position: relative;
}

.copy-button {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  background: var(--color-border);
  border: none;
  border-radius: 4px;
  color: var(--color-text-secondary);
  padding: var(--space-xs) var(--space-sm);
  cursor: pointer;
  font-size: var(--text-sm);
  transition: background 150ms, color 150ms;
}

.copy-button:hover {
  background: var(--color-accent);
  color: var(--color-text-primary);
}

.copy-button.copied {
  background: var(--color-success);
  color: var(--color-text-primary);
}
```

**Verification**:
```bash
cd website
npm run dev
# Create a test page that uses CodeBlock
# Test copy functionality in browser - check clipboard contents
```

### Phase 4: Landing Page (index.astro)

**Goal**: Implement the full landing page with hero and outcomes sections.

**Changes**:
- `website/src/pages/index.astro`: Complete landing page implementation

**Implementation Details**:

**Hero Section (Above the Fold)**:
- Large tagline: "Autonomous development that works on your tickets while you sleep."
- Install command block with 3 lines:
  ```bash
  $ npm install -g @leixusam/foundry
  $ foundry init
  $ foundry
  ```
- Secondary text below: "or install locally: npx foundry init"
- Copy button on the code block

**Outcomes Section (Below the Fold)**:
- Heading: "What happens when you run Foundry:"
- Simple 3-step flow diagram (CSS-styled boxes with arrows):
  - "You create a ticket" → "Foundry works" → "You review code"
- Bullet list of outcomes:
  - Creates a branch for the ticket
  - Researches your codebase
  - Plans the implementation
  - Writes and tests code
  - Updates Linear with progress
  - Opens a PR when done
- Secondary CTA: "Learn how it works →" (links to /how-it-works)

**Responsive behavior**:
- Mobile: Single column, smaller typography (tagline 20px vs 24px)
- Tablet: Same as desktop but slightly narrower
- Desktop: Centered content, max-width 1200px

**Verification**:
```bash
cd website
npm run dev
# Visit http://localhost:4321
# Verify all content renders correctly
# Test copy button functionality
# Check responsive behavior at different viewport widths
```

### Phase 5: How It Works Page

**Goal**: Implement the "How It Works" page with architecture explanations.

**Changes**:
- `website/src/pages/how-it-works.astro`: Full implementation of the explanatory page

**Implementation Details**:

**Header navigation**:
- "← Back to Home" on left
- "How It Works" title centered
- GitHub link on right

**Content sections** (sourced from README.md):

1. **Introduction**
   - "Foundry orchestrates AI agents to turn Linear tickets into shipped code. Here's how the pieces fit together."

2. **Pods, Loops, and Agents**
   - ASCII diagram (styled in code block) showing Pod structure:
     ```
     Pod → Loop 1 → Agent 1 → Agent 2 → Agent 3
           Loop 2 → Agent 1 → Agent 2 → Agent 3
     ```
   - Explanations:
     - Pod: A running instance (unique name like "swift-wyvern")
     - Loop: One complete cycle of work
     - Agent: AI worker handling one part

3. **The Agent Pipeline**
   - Visual representation of: Agent 1 (Reader) → Agent 2 (Worker) → Agent 3 (Writer)
   - Brief explanation of each role

4. **Linear as State Machine**
   - Status flow diagram showing:
     - Needs Research → Needs Spec → Needs Plan → Needs Implement → Needs Validate → Done
   - Explanation of how tickets move through statuses

5. **Ready to try?**
   - Install command block with copy button (same as landing page)

**Verification**:
```bash
cd website
npm run dev
# Visit http://localhost:4321/how-it-works
# Verify all content sections render
# Check navigation links work
# Test copy button
```

### Phase 6: 404 Page and Polish

**Goal**: Add 404 page and polish responsive layouts, spacing, and details.

**Changes**:
- `website/src/pages/404.astro`: Not found page
- `website/public/favicon.svg`: Simple favicon
- Various component tweaks for pixel-perfect alignment

**Implementation Details**:

404 Page:
- "Page not found. Let's get you back on track."
- Link to homepage
- Same dark theme styling

Favicon:
- Simple "F" monogram in blue (#3b82f6) on transparent background
- Or a minimal abstract mark representing "foundry"

Polish items to verify:
- [ ] Consistent spacing across all breakpoints
- [ ] No layout shifts or overflow issues
- [ ] Smooth hover transitions (150ms)
- [ ] Proper focus states for accessibility
- [ ] Code blocks don't overflow on mobile (horizontal scroll if needed)
- [ ] Diagrams readable on mobile

**Verification**:
```bash
cd website
npm run dev
# Visit non-existent URL like /asdf to test 404
# Check favicon appears in browser tab
# Manual review of spacing and alignment
```

### Phase 7: Build and Final Verification

**Goal**: Verify production build works and passes all quality checks.

**Changes**:
- No new files, final verification only

**Verification**:
```bash
cd website

# Build for production
npm run build

# Preview production build
npm run preview

# Run Lighthouse audit (in Chrome DevTools)
# Target: 95+ on Performance, Accessibility, Best Practices, SEO

# Verify all pages work:
# - http://localhost:4321/
# - http://localhost:4321/how-it-works
# - http://localhost:4321/nonexistent (404 page)

# Test in multiple browsers if possible:
# - Chrome
# - Firefox
# - Safari (if on macOS)

# Check for console errors in browser dev tools
# Verify no JavaScript errors
```

## File Summary

All new files to be created in `website/` directory:

```
website/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── CodeBlock.astro
│   │   ├── CopyButton.astro
│   │   ├── Footer.astro
│   │   └── Header.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── pages/
│   │   ├── 404.astro
│   │   ├── how-it-works.astro
│   │   └── index.astro
│   └── styles/
│       ├── global.css
│       └── tokens.css
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

**Estimated file count**: 14 files
**Estimated lines of code**: ~600-800 lines (CSS + Astro components + content)

## Testing Strategy

### Unit Testing
- Not applicable for static site (no business logic)

### Integration Testing
- Verify build completes without errors
- Verify all pages are generated in `dist/` folder

### Visual/Manual Testing
1. **Responsive testing**:
   - Mobile (320px, 375px)
   - Tablet (768px)
   - Desktop (1024px, 1440px)

2. **Interaction testing**:
   - Copy button works on all code blocks
   - Navigation links work
   - GitHub link opens in new tab

3. **Accessibility testing**:
   - Keyboard navigation (Tab through interactive elements)
   - Screen reader compatibility (proper heading hierarchy)
   - Color contrast meets WCAG AA

4. **Performance testing**:
   - Lighthouse audit: 95+ all categories
   - First Contentful Paint < 1.5s

## Rollback Plan

If issues arise after deployment:

1. **Git revert**: Revert the commits adding the `website/` directory
2. **No production impact**: The website is a separate directory from the main CLI tool
3. **Hosting rollback**: If deployed, roll back to previous deployment or remove site

Since this is a new greenfield addition with no integration to existing code, rollback is straightforward.

## Notes

### Content Accuracy
- All install commands and product descriptions should match README.md exactly
- The ASCII diagrams should be simplified versions of README diagrams
- Don't invent features or claims not in the README

### Performance Considerations
- Astro generates zero JS by default; CopyButton is the only client-side JS
- Google Fonts are loaded with `preconnect` for faster loading
- No images to optimize (pure text/CSS site)
- Target bundle size: < 50KB total

### Future Enhancements (Out of Scope)
- Analytics integration
- Dark/light mode toggle
- Documentation section
- Blog or changelog
- Custom domain setup

### Dependencies
- astro: ^5.x (latest stable)
- No other runtime dependencies needed
- Google Fonts loaded via CDN (Inter, JetBrains Mono)
