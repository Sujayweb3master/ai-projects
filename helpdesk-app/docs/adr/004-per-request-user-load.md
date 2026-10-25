# ADR-004: Load the user on every authenticated request

**Status:** Accepted · **Date:** 2026-09-30

## Context
The access-token JWT contains the role, but an admin may demote or deactivate a user at any time. If we
trusted the token alone, those changes would only apply after the token expired (up to 15 minutes).

## Decision
`authenticate` verifies the JWT, then loads `id, email, name, role, is_active` by primary key.
Authorization uses the **DB role**, not the token claim. Inactive or missing users get 401.

## Consequences
- ✅ Deactivation and role changes take effect on the next request.
- ⚠️ One indexed PK lookup per request. That's negligible at helpdesk scale and could be cached later if needed.
