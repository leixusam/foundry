# Research: Make a website landing page

**Issue**: RSK-46
**Date**: 2026-01-27
**Status**: Complete

## Summary

Create a polished, modern landing page for Foundry that encourages users to install the package. The website will have two pages: a main landing page focused on outcomes with prominent install commands, and a separate "How It Works" page explaining the system. The design should be futuristic but subtle, simple and understated.

## Requirements Analysis

### Primary Goal
Get users to install the `@leixusam/foundry` npm package by clearly communicating the value proposition.

### Design Requirements
From the issue description:
- **Simple and highly polished** - Not cluttered, professional quality
- **Not generic/default Tailwind CSS** - Custom styling that doesn't look template-driven
- **Futuristic but subtle** - Modern aesthetic without being over-the-top
- **Not cringy or over the top** - Understated, tasteful design
- **Simple and modern** - Clean lines, good typography, minimal visual noise

### Content Requirements
1. **Landing Page (Main)**:
   - Focus on outcomes (what does Foundry do for you?)
   - Prominent install commands as the primary call-to-action
   - Users should NOT need to visit GitHub to understand what to do

2. **How It Works Page**:
   - Explain the system architecture
   - Pods, Loops, and Agents concept
   - The Linear state machine workflow

3. **Navigation**:
   - Links to GitHub repository
   - Navigation between the two pages

### Key Product Details (from README.md)
- Package: `@leixusam/foundry` (npm)
- Install commands:
  ```bash
  # Global (recommended)
  npm install -g @leixusam/foundry
  foundry init
  foundry

  # Local
  npm install --save-dev @leixusam/foundry
  npx foundry init
  npx foundry
  ```
- GitHub: `https://github.com/leixusam/foundry`
- Key value proposition: AI-powered autonomous development that works on Linear tickets without human intervention

## Codebase Analysis

### Relevant Files
- `README.md` - Contains all product documentation, features, and workflow diagrams (source of truth for content)
- `package.json` - Package name, version, and metadata
- No existing website or frontend code exists

### Existing Patterns
This project is a Node.js CLI tool with no frontend. A new `website/` directory should be created at the project root to house the landing page code.

### Dependencies
The website will need:
- A frontend framework (recommendation: Astro or Next.js for static site generation)
- Custom CSS or a styling solution (avoiding generic Tailwind)
- No runtime dependencies on the CLI tool itself

## Implementation Considerations

### Approach Options

**Option 1: Astro (Recommended)**
- Pros: Fast, zero-JS by default, great for static content sites, modern DX
- Cons: Newer framework, smaller ecosystem

**Option 2: Next.js Static Export**
- Pros: Well-established, large ecosystem, familiar to React developers
- Cons: Heavier than needed for 2 static pages

**Option 3: Plain HTML/CSS**
- Pros: Simplest, no build step, fastest load
- Cons: Harder to maintain, less DX, no component reuse

**Recommendation**: Astro is ideal for this use case - it's designed for content-focused sites, produces fast static output, and supports component-based development.

### Directory Structure
```
foundry/
├── website/                  # NEW - Landing page
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.astro   # Main landing page
│   │   │   └── how-it-works.astro
│   │   ├── components/       # Reusable components
│   │   ├── layouts/          # Page layouts
│   │   └── styles/           # Custom CSS
│   ├── public/               # Static assets
│   ├── astro.config.mjs
│   └── package.json
├── src/                      # Existing CLI code
├── ...
```

### Styling Approach
To avoid "generic Tailwind" look:
1. Custom CSS variables for colors, spacing, typography
2. Subtle gradients and shadows for depth
3. Modern typography (Inter, JetBrains Mono for code)
4. Animated elements (subtle, performant)
5. Consider a dark theme (fits "futuristic" aesthetic)

### Deployment
- GitHub Pages (free, integrated with repo)
- Vercel (easy Astro deployment)
- Netlify (alternative)

### Risks
1. **Design execution risk**: "Futuristic but not cringy" is subjective - may need iterations
2. **Content clarity**: Balancing brevity with sufficient explanation
3. **Framework choice**: Decision affects long-term maintenance

### Testing Strategy
1. Visual review across devices (mobile, tablet, desktop)
2. Lighthouse audit for performance
3. Accessibility testing (WCAG compliance)
4. Link testing (GitHub, install commands)
5. Browser compatibility (Chrome, Firefox, Safari, Edge)

## Specification Assessment

This feature **requires a UX specification** because:

1. **Entirely new user-facing product**: Creating a website from scratch
2. **Subjective design requirements**: "Futuristic but subtle", "modern, not cringy" need specific design decisions
3. **Multiple interaction patterns**: Navigation, install command copying, responsive layouts
4. **Content strategy needed**: What outcomes to highlight, how to structure explanations
5. **Design polish is critical**: The requirement explicitly states it must be "highly polished"

The specification phase should define:
- Visual design language (colors, typography, spacing)
- Page layouts and component hierarchy
- Content structure and copy
- Responsive behavior
- Interaction patterns (hover states, animations)

**Needs Specification**: Yes

## Questions for Human Review

1. **Framework preference**: Is Astro acceptable, or is there a preference for Next.js/other?
2. **Hosting**: GitHub Pages, Vercel, or other?
3. **Dark/Light mode**: Should the site support both, or pick one? (Dark seems to fit "futuristic")
4. **Content length**: How much detail on "How It Works" - summary or full technical deep-dive?
5. **Additional pages**: Any other pages needed beyond landing + how it works? (e.g., Docs, FAQ)
6. **Analytics**: Should we integrate any analytics (e.g., Plausible, Google Analytics)?

## Next Steps

Ready for specification phase. The Specification Worker should:
1. Define the visual design language
2. Create wireframes/mockups for both pages
3. Write the actual copy/content
4. Specify responsive breakpoints
5. Define interactions and animations
