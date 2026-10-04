# 🛡️ Vette: AI Slopsquatting & Package Guard for VS Code & Cursor

Real-time inline diagnostics and hover alerts for AI-hallucinated packages, slopsquatting, and zero-day malicious dependencies.

## Features
- **Inline Diagnostics**: Red/yellow squigglies directly under hallucinated or suspicious packages in `package.json` and `requirements.txt`.
- **Hover Inspection**: Hover over any package name to view its **SlopScore (0-100)**, age, weekly download volume, author, and detected security signals.
- **AI Hallucination Alert**: Catches unregistered packages hallucinated by ChatGPT/Claude/Cursor before attackers can register them.
