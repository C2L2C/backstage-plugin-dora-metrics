# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **security@c2l2c.dev** with:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept

You will receive a response within 72 hours. Once confirmed, we will coordinate a fix and disclose the issue responsibly.

## Scope

This plugin runs entirely in the browser and makes authenticated calls to the GitHub REST API using the user's existing OAuth token. It stores no credentials and has no backend component.

Common areas of concern:
- Token leakage via network requests or logging
- XSS via unsanitised GitHub API response data rendered in the UI
