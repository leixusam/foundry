export function Footer() {
  return (
    <footer className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717a]">
          <div className="flex items-center gap-2">
            <span className="text-base">*</span>
            <span>&copy; 2025 Foundry</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/anthropics/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@leixusam/foundry"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              npm
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
