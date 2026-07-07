# Security Policy

## Supported versions

ozDNA is in early release. Security fixes are applied to the latest release on the default branch.

| Version | Supported |
|---------|-----------|
| `main` (latest) | Yes |
| `v0.1.x` | Yes — best-effort backports for critical issues |
| Older / unmaintained forks | No |

Hosted API availability and patch rollout for `api.ozdna.com` and `api.sandbox.ozdna.com` are tracked on the [status page](https://ozdna.com/status/).

---

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report privately to:

**[security@ozdna.com](mailto:security@ozdna.com)**

Include:

1. Description of the vulnerability and affected component (API, gateway, site, etc.)
2. Steps to reproduce
3. Impact assessment (data exposure, privilege escalation, denial of service, etc.)
4. Proof of concept if available
5. Your contact information for follow-up

We aim to acknowledge reports within **3 business days**.

---

## Disclosure policy

We follow **coordinated disclosure**:

- Work with you to understand and reproduce the issue
- Provide a remediation timeline based on severity
- Notify you when a fix is deployed or released
- Request that you **do not publicly disclose** until we have had reasonable time to remediate — typically **90 days**, sooner for critical issues once patched

Good-faith security research that respects user privacy and avoids service disruption is welcome.

### Out of scope

The following are generally **not** accepted as vulnerabilities unless they demonstrate concrete impact:

- Missing best-practice headers on the static marketing site with no exploitable chain
- Social engineering against ozDNA staff or users
- Denial-of-service against production without prior coordination
- Issues in third-party services (OpenAI, Netlify, etc.) — report to those vendors directly
- Theoretical issues without a working proof of concept

---

## Security architecture

Technical controls (encryption, authentication, rate limiting, logging, backups) are documented on the public [Security page](https://ozdna.com/security/).

Machine-readable contact file (RFC 9116):

```
https://ozdna.com/.well-known/security.txt
```

---

## Recognition

We maintain a security acknowledgments section on the Security page. Researchers who follow this policy may be credited with permission after remediation.

---

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service degradation
- Report vulnerabilities only to **security@ozdna.com**
- Allow reasonable time for remediation before public disclosure

---

## Contact

| Purpose | Email |
|---------|-------|
| Vulnerability reports | [security@ozdna.com](mailto:security@ozdna.com) |
| General security questions | [security@ozdna.com](mailto:security@ozdna.com) |
| Other inquiries | [hello@ozdna.com](mailto:hello@ozdna.com) |
