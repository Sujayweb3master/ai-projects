# ADR-002: Serve SPA and API from one origin via an nginx reverse proxy

**Status:** Accepted · **Date:** 2026-09-30

## Context
The refresh token lives in an httpOnly cookie. On Azure Container Apps, each app gets its own
`*.azurecontainerapps.io` host, and that domain is on the Public Suffix List. So two apps are different
*sites*, and a `SameSite=Strict/Lax` cookie would not be sent from the SPA to the API.

## Options considered
1. **Two public origins + `SameSite=None` cookie + CORS with credentials.** Works, but it weakens CSRF
   protection, depends on third-party-cookie behaviour, and exposes the API to the internet.
2. **Custom domain with shared parent (app.example.com / api.example.com).** Needs a domain and
   DNS/TLS setup, which is extra cost and complexity for a beginner.
3. **nginx in the web container proxies `/api` to the API (chosen).**

## Decision
The frontend container (nginx) serves the static SPA and reverse-proxies `/api/*` to the API app, which
has **internal-only ingress**. Locally, the Vite dev server proxies the same way.

## Consequences
- ✅ The cookie can be `SameSite=Strict` and CORS is effectively unused (still configured with an allowlist).
- ✅ The API isn't reachable from the internet at all.
- ⚠️ nginx is one more hop. `TRUST_PROXY_HOPS` (default 0) must be set to the real number of proxies
  in each environment so rate limiting sees real client IPs without trusting spoofed headers.
