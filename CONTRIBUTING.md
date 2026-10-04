# Contributing to Vette

Thank you for helping protect the software supply chain against AI slopsquatting and zero-day malicious packages!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vette-security/vette.git
   cd vette
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the CLI:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## Project Structure

- `src/cli.ts` - Main CLI entry point.
- `src/engine/` - Heuristic rules engine and SlopScore calculator.
- `src/registries/` - Real-time metadata clients for npm and PyPI.
- `src/interceptor/` - Pre-install argument parser and execution runner.
- `src/commands/` - CLI subcommands (`vet`, `scan`, `action`).
- `extension/` - VS Code / Cursor IDE extension source and VSIX bundle.

## Adding New Heuristics

New detection heuristics can be added in `src/engine/heuristics.ts`. Each heuristic should:
1. Have a distinct ID and category.
2. Return a point value (positive penalty for risk, negative bonus for trust).
3. Include an actionable title and description for developer clarity.

## Pull Requests

1. Create a feature branch: `git checkout -b feature/my-new-heuristic`
2. Ensure `npm run build && npm test` passes.
3. Open a Pull Request with a clear description of the threat model addressed.
