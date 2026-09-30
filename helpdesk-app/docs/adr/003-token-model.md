# ADR-003: Short-lived access JWT + rotating, hashed refresh tokens

**Status:** Accepted · **Date:** 2026-09-30

## Context
Requirements: JWT auth, the access token kept in memory on the client, a rotating refresh token in an
httpOnly cookie, and only hashed refresh tokens in the DB.

## Decision
- **Access token:** a JWT signed with HS256 that lasts 15 minutes. Its claims are `sub` and `role`, plus a fixed
  issuer and audience. Verification pins the algorithm.
- **Refresh token:** 32 random bytes (base64url), valid for 7 days. Only its **SHA-256** hash is stored,
  which is enough for a high-entropy random value; argon2 is reserved for passwords.
- **Rotation:** every `/auth/refresh` atomically revokes the presented token
  (`UPDATE … WHERE revoked_at IS NULL RETURNING`) and issues a new one in the same `family_id`.
- **Reuse detection:** presenting an already-revoked token revokes the whole family and forces a new login.
- **Cookie:** `hd_rt`; `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.

## Consequences
- ✅ A stolen refresh token has a short useful life, and replaying it logs out the attacker *and* the victim.
- ✅ A DB leak doesn't expose usable refresh tokens.
- ⚠️ Two browser tabs refreshing at the same moment can trigger reuse detection. The SPA must serialise
  refreshes (single-flight), which is planned in Phase 3.
- ⚠️ HS256 means one shared secret. Rotating it logs everyone out.
