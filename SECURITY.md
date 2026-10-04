# Security Policy

## Supported Versions

We provide active security fixes for the latest release:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability in Vette

If you discover a security vulnerability in the Vette CLI, IDE extension, or scoring engine:
1. **DO NOT** create a public GitHub issue.
2. Please open a [GitHub Private Vulnerability Report](https://github.com/vette-security/vette/security/advisories/new) or email `security@vette.dev`.
3. We acknowledge reports within 24 hours and issue patches within 72 hours.

## Reporting a Poisoned / Slopsquatted Package

If you have discovered an active AI-hallucinated package registered on npm or PyPI:
- Please use our [Report Slopsquatted Package](https://github.com/vette-security/vette/issues/new?template=report_slopsquat.yml) issue template.
- Include the prompt or LLM that generated the name, the registry URL, and any detected payloads.
- We will integrate the pattern into our heuristic ruleset immediately.
