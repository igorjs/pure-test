# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.4.x (latest) | Yes |
| < 0.4 | No |

Only the latest minor version receives security patches. Upgrade to the latest version before reporting.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability, email: **oss@mail.igorjs.io**

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Impact assessment (what can an attacker do?)
- Suggested fix (if you have one)

### What to expect

- **Acknowledgement** within 48 hours
- **Assessment** within 7 days (severity, affected scope, fix plan)
- **Fix and disclosure** within 30 days for critical issues, 90 days for others

If the report is accepted, you will be credited in the release notes (unless you prefer anonymity).

If the report is declined (not a vulnerability, or out of scope), you will receive an explanation and may open a public issue.

### Scope

The following are in scope:
- Test isolation failures (state leakage between tests)
- Code execution vulnerabilities in the test runner
- Mock/spy lifecycle issues that could mask real failures
- Denial of service via crafted test input

The following are out of scope:
- Vulnerabilities in dependencies (there are none)
- Issues requiring physical access to the machine
- Social engineering attacks
- Security of code under test (that is the user's responsibility)

## Security Design Principles

- **Zero dependencies** eliminates supply chain risk
- **Isolated test execution** prevents state leakage between test cases
- **No eval, no dynamic require** in production code
- **Cross-runtime compatibility** with no runtime-specific privileged APIs
