# Spike: Admin Auth Design for Epic 6

**Date:** 2026-04-18
**Owner:** Winston (Architect)
**Status:** Complete
**Purpose:** Define admin access model for internal app. Design data model and route protection strategy.

---

## Current State

The project has a **complete auth system** built on `fastapi-users` v13:

| Component | Status | Location |
|-----------|--------|----------|
| User model (DB) | Implemented | `app/models.py` (extends `SQLAlchemyBaseUserTableUUID`) |
| JWT auth backend | Implemented | `app/users.py` (Bearer + JWT, 1hr expiry) |
| Login/Register/Reset | Implemented | Auto-generated via `fastapi_users` |
| `current_active_user` dependency | Implemented | `app/users.py` |
| `is_superuser` field | Exists but **unused** | On User model (from fastapi-users base) |
| Frontend auth pages | Implemented | `/login`, `/register`, `/password-recovery` |
| Frontend route protection | **Missing** | No `middleware.ts` |
| RBAC / roles | **Missing** | Only `is_superuser` boolean |

### Key Finding: `is_superuser` Already Exists

The `fastapi-users` `SQLAlchemyBaseUserTableUUID` base class includes:
- `is_superuser: bool` (default `False`)

This field is present in the database but **never checked in any route or middleware**. It is the simplest path to admin access.

---

## Design Decision: Internal App Admin Auth

Given that:
1. The app is **internal-only** (no external deployment planned yet)
2. Epic 6 has exactly **2 stories** requiring admin access
3. `is_superuser` already exists on the User model
4. `fastapi-users` provides `fastapi_users.current_user(active=True, superuser=True)` out of the box

### Recommendation: Use `is_superuser` Flag (No New Tables)

**Rationale:**
- Zero migration cost — field already exists
- `fastapi-users` has built-in `current_superuser` dependency
- Internal app doesn't need granular RBAC (admin vs non-admin is sufficient)
- Can be extended to full RBAC later without breaking changes

---

## Implementation Plan

### Backend Changes

#### 1. Create `current_superuser` Dependency

**File:** `app/users.py` — add one line:

```python
current_superuser = fastapi_users.current_user(active=True, superuser=True)
```

This is provided by `fastapi-users` out of the box. It returns 403 if user is not superuser.

#### 2. Create Admin Router with Superuser Guard

**New file:** `app/routes/admin.py`

```python
from fastapi import APIRouter, Depends
from app.users import current_superuser
from app.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/dashboard")
async def admin_dashboard(user: User = Depends(current_superuser)):
    return {"message": "admin access granted"}
```

All admin endpoints use `Depends(current_superuser)`.

#### 3. Register Admin Router in `main.py`

```python
from app.routes.admin import router as admin_router
app.include_router(admin_router)
```

#### 4. Seed Admin User

**Update:** `seed_test_user.py` — add admin user creation:

```python
# Create admin user
admin_user = await user_db.create({
    "email": "admin@trade.dev",
    "password": "AdminPass1!",
    "is_superuser": True,
    "is_active": True,
})
```

Or provide a CLI command / script to promote existing user to admin.

### Frontend Changes

#### 5. Add `middleware.ts` for Admin Route Protection

**New file:** `nextjs-frontend/middleware.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("accessToken")?.value;
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");

  if (isAdminRoute && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin role check happens server-side via API calls
  // (frontend middleware can't decode JWT claims reliably)
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

Note: JWT-based admin check on frontend is cosmetic. Real protection is backend `current_superuser` dependency. Frontend middleware only redirects unauthenticated users.

#### 6. Admin Layout with Auth Check

**New file:** `nextjs-frontend/app/admin/layout.tsx`

```typescript
// Server component that calls GET /api/admin/me (admin-only endpoint)
// If 403, redirect to /dashboard with "not authorized" message
// If 200, render admin layout with sidebar
```

---

## Security Considerations (Internal App)

| Concern | Mitigation |
|---------|------------|
| No RBAC granularity | Acceptable for internal app. `is_superuser` is binary: admin or not |
| No token blacklisting | Acceptable for internal. 1hr JWT expiry limits exposure |
| No login rate limiting | Should add for production. Low priority for internal |
| `FIXED_QA_TOKEN` in WebSocket | Already documented. Ensure env var is empty in internal deployment |
| Frontend route protection is cosmetic | Backend `current_superuser` is the real guard. Frontend redirect is UX only |

---

## Data Model: No Schema Changes Required

The `users` table already has `is_superuser`. No new tables, no migration needed.

```sql
-- Existing field (no change needed)
ALTER TABLE users ALTER COLUMN is_superuser SET DEFAULT false;

-- To promote a user to admin:
UPDATE users SET is_superuser = true WHERE email = 'admin@trade.dev';
```

---

## API Surface for Epic 6

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/admin/me` | GET | superuser | Verify admin access + return user info |
| `/api/admin/debates` | GET | superuser | List all debates with metadata |
| `/api/admin/hallucination-logs` | GET | superuser | List hallucination/sanitization events |
| `/api/admin/guardian-analyses` | GET | superuser | List guardian analysis results |
| `/api/admin/agent-config` | GET | superuser | Get current agent strategy config |
| `/api/admin/agent-config` | PATCH | superuser | Update agent strategy config |

---

## Risks and Open Questions

| Risk | Severity | Mitigation |
|------|----------|------------|
| `is_superuser` is too coarse for future needs | Low | Can migrate to role-based model later. Binary flag is fine for 2 stories |
| No admin UI for user promotion | Low | Use SQL script or seed script for now. Admin user management UI is a future story |
| Frontend middleware can't decode JWT claims | Low | Backend is the source of truth. Frontend admin check is a server-side API call |

---

## Conclusion

**Admin auth requires zero new infrastructure.** The `is_superuser` field already exists, `fastapi-users` provides the `current_superuser` dependency, and the only code changes are:
1. One new dependency in `users.py`
2. One new admin router file
3. One frontend middleware file
4. Admin user seed script update

**Estimated scope:** Trivial backend, small frontend. No migration, no new tables.
