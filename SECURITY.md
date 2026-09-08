# Security Policy

## Supported Versions

Currently, only the `main` branch deployed to production is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of ClassFlow seriously. If you believe you have found a security vulnerability, please report it immediately.

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, please email the project maintainers directly. You should receive a response within 48 hours acknowledging receipt of your vulnerability.

### What to include in your report

*   A description of the vulnerability.
*   Steps to reproduce the vulnerability (including any necessary configuration or code snippets).
*   The potential impact of the vulnerability.
*   Any suggestions for mitigation.

### Incident Response

If a severe vulnerability (such as exposed credentials, IDOR, or RLS bypass) is verified:
1. We will issue a patch to resolve the vulnerability.
2. If credentials (like Gemini API keys or Supabase secrets) were compromised, they will be immediately rotated.
3. We will post a post-mortem detailing the root cause, impact, and remediation steps.

## Bug Bounties
Currently, this project does not offer a bug bounty program. However, we deeply appreciate responsible disclosure.
