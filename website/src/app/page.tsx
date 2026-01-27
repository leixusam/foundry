import { Footer } from '@/components/footer'

export default function HomePage() {
  const installCommands = `npm install -g @anthropics/claude-code
npx @anthropics/claude-code --dangerously-skip-permissions`

  return (
    <div className="min-h-screen bg-hero overflow-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2 text-xl font-bold text-[#fafafa]">
              <span className="text-2xl">*</span>
              <span>Foundry</span>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com/anthropics/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://www.npmjs.com/package/@leixusam/foundry"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-medium bg-[#3b82f6] text-white rounded-xl hover:bg-[#60a5fa] transition-colors"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-[calc(100vh-4rem)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
          <div className="flex flex-col items-center justify-center text-center">
            {/* Eyebrow */}
            <p className="text-sm font-semibold tracking-[0.2em] text-[#3b82f6]/80 uppercase mb-6">
              Autonomous Product Development
            </p>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#fafafa] leading-[1.1] mb-6 max-w-4xl">
              Development that works<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">while you sleep.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-[#a1a1aa] leading-relaxed mb-10 max-w-2xl">
              Foundry works on your Linear tickets autonomously. Create a ticket, go to sleep, wake up to a PR.
            </p>

            {/* Install block */}
            <div className="w-full max-w-lg mb-10">
              <div className="code-block">
                <div className="code-block-header">
                  <div className="code-block-dot bg-[#ff5f56]"></div>
                  <div className="code-block-dot bg-[#ffbd2e]"></div>
                  <div className="code-block-dot bg-[#27c93f]"></div>
                </div>
                <div className="code-block-content">
                  <pre className="whitespace-pre-wrap">{installCommands}</pre>
                </div>
              </div>
              <p className="mt-4 text-sm text-[#71717a]">
                or install locally: <code className="text-[#e4e4e7] bg-[#27272a] px-2 py-1 rounded">npx @leixusam/foundry</code>
              </p>
            </div>

            {/* Feature list */}
            <div className="flex flex-col sm:flex-row gap-6 mb-10">
              <div className="flex items-center gap-3">
                <div className="feature-box-1 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">*</span>
                </div>
                <p className="font-medium text-[#fafafa]">Powered by Claude</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="feature-box-2 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">*</span>
                </div>
                <p className="font-medium text-[#fafafa]">Linear integration</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="feature-box-3 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">*</span>
                </div>
                <p className="font-medium text-[#fafafa]">Ships real code</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        <div className="border-t border-white/10"></div>
      </div>

      {/* How It Works */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-[#fafafa] mb-4">
              How it works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <span className="text-3xl">*</span>
              </div>
              <h3 className="text-xl font-bold text-[#fafafa] mb-3">
                1. Create a ticket
              </h3>
              <p className="text-[#a1a1aa] leading-relaxed">
                Write a Linear ticket describing what you want built. Be as detailed as you like.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <span className="text-3xl">*</span>
              </div>
              <h3 className="text-xl font-bold text-[#fafafa] mb-3">
                2. Foundry works
              </h3>
              <p className="text-[#a1a1aa] leading-relaxed">
                Foundry claims the ticket, researches your codebase, plans the implementation, and writes code.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <span className="text-3xl">*</span>
              </div>
              <h3 className="text-xl font-bold text-[#fafafa] mb-3">
                3. Review the PR
              </h3>
              <p className="text-[#a1a1aa] leading-relaxed">
                Wake up to a pull request ready for review. Foundry updates Linear with progress along the way.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        <div className="border-t border-white/10"></div>
      </div>

      {/* What Foundry Does */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-[#fafafa] mb-4">
              What Foundry does
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              'Creates a branch for the ticket',
              'Researches your codebase',
              'Plans the implementation',
              'Writes and tests code',
              'Updates Linear with progress',
              'Opens a PR when done',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[#fafafa]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="max-w-3xl mx-auto px-6 lg:px-12">
        <div className="border-t border-white/10"></div>
      </div>

      {/* FAQ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-[#fafafa] mb-4">
              FAQ
            </h2>
          </div>

          <div className="space-y-4">
            {/* FAQ 1 */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none py-4 border-b border-white/10">
                <span className="text-lg font-semibold text-[#fafafa]">
                  What is Foundry?
                </span>
                <span className="text-[#71717a] transition-transform group-open:rotate-180">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </summary>
              <p className="text-[#a1a1aa] leading-relaxed py-4">
                Foundry is an autonomous development system that works on your Linear tickets while you sleep. It uses Claude to understand your codebase, plan implementations, write code, and open pull requests.
              </p>
            </details>

            {/* FAQ 2 */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none py-4 border-b border-white/10">
                <span className="text-lg font-semibold text-[#fafafa]">
                  How does it integrate with Linear?
                </span>
                <span className="text-[#71717a] transition-transform group-open:rotate-180">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </summary>
              <p className="text-[#a1a1aa] leading-relaxed py-4">
                Foundry connects to your Linear workspace and monitors for tickets. When it finds work to do, it claims the ticket, updates the status as it works, and comments with progress updates and the final PR link.
              </p>
            </details>

            {/* FAQ 3 */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none py-4 border-b border-white/10">
                <span className="text-lg font-semibold text-[#fafafa]">
                  What kind of tickets can it handle?
                </span>
                <span className="text-[#71717a] transition-transform group-open:rotate-180">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </summary>
              <p className="text-[#a1a1aa] leading-relaxed py-4">
                Foundry works best on well-defined tickets with clear requirements. Bug fixes, new features, refactoring, and documentation updates are all fair game. The more context you provide in the ticket, the better the results.
              </p>
            </details>

            {/* FAQ 4 */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none py-4 border-b border-white/10">
                <span className="text-lg font-semibold text-[#fafafa]">
                  Is my code secure?
                </span>
                <span className="text-[#71717a] transition-transform group-open:rotate-180">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </summary>
              <p className="text-[#a1a1aa] leading-relaxed py-4">
                Foundry runs locally on your machine. Your code stays on your computer and is sent to Claude&apos;s API for processing, subject to Anthropic&apos;s privacy policy. No code is stored on third-party servers.
              </p>
            </details>

            {/* FAQ 5 */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none py-4 border-b border-white/10">
                <span className="text-lg font-semibold text-[#fafafa]">
                  What does it cost?
                </span>
                <span className="text-[#71717a] transition-transform group-open:rotate-180">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              </summary>
              <p className="text-[#a1a1aa] leading-relaxed py-4">
                Foundry itself is free and open source. You&apos;ll need a Claude API key from Anthropic, and you pay for API usage based on Anthropic&apos;s pricing. Most tickets cost a few dollars in API calls.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="max-w-3xl mx-auto px-6 lg:px-12">
        <div className="border-t border-white/10"></div>
      </div>

      {/* Final CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#fafafa] mb-4">
            Ready to ship while you sleep?
          </h2>
          <p className="text-lg text-[#a1a1aa] mb-8">
            Get started in under 5 minutes. Free and open source.
          </p>
          <a
            href="https://www.npmjs.com/package/@leixusam/foundry"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-4 text-lg font-medium bg-[#3b82f6] text-white rounded-2xl hover:bg-[#60a5fa] transition-colors"
          >
            Get Started
          </a>
        </div>
      </section>

      {/* Section Divider */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="border-t border-white/10"></div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}
