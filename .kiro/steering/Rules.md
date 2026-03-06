# Development Rules

## Documentation Organization

**All documentation must be saved to the `docs/` folder, except for `README.md`**

- Project-level README.md stays in the root directory
- All other documentation files (.md, guides, summaries) go in `docs/`
- App-specific READMEs stay in their respective app folders (e.g., `apps/web/README.md`)
- Summary files, guides, and reference documents belong in `docs/`

## Documentation Creation Policy

**Only create documentation for major updates or fixes**

- Do NOT create documentation for every small change or fix
- Do NOT create multiple summary/guide files for the same feature
- Only document when:
  - It's a major feature addition
  - It's a significant architectural change
  - It's a critical bug fix that users need to know about
  - The user explicitly requests documentation
- Keep documentation minimal and focused
- Update existing docs rather than creating new ones when possible

## Simplicity First

**Keep it simple, stupid (KISS)** - When planning, editing, creating, or fixing any code:

- Choose the simplest solution that solves the problem
- Avoid over-engineering and premature optimization
- Prefer straightforward implementations over clever abstractions
- Write code that's easy to read, understand, and maintain
- Don't add features or complexity until they're actually needed (YAGNI)

## Code Quality Guidelines

- **Readability over cleverness** - Code is read more often than it's written
- **Single responsibility** - Each function/class should do one thing well
- **Minimal dependencies** - Only add external libraries when they provide clear value
- **Test the essentials** - Focus testing on core functionality, not edge cases
- **Refactor incrementally** - Make small improvements rather than large rewrites

## When to Add Complexity

Only increase complexity when:
- The simple solution has proven insufficient through actual use
- Performance requirements demand optimization
- The added complexity significantly improves user experience
- Technical debt is causing real maintenance problems

Remember: It's easier to add complexity later than to remove it.
