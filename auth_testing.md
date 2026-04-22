# Auth Testing Playbook (CRM SaaS)

Two auth methods coexist:
1. JWT email/password (cookies: access_token + refresh_token)
2. Emergent Google OAuth (cookie: session_token)

Admin: admin@acme.com / admin123 (company: Acme Inc, role: admin)

## API Tests
```
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Login
curl -c cookies.txt -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"admin123"}'

# Me
curl -b cookies.txt "$API/api/auth/me"

# Dashboard stats
curl -b cookies.txt "$API/api/dashboard/stats"
```

## Emergent OAuth
- Frontend: Click "Continue with Google" → redirects to `https://auth.emergentagent.com/?redirect=...`
- After Google auth, user lands at `/dashboard#session_id=...`
- AuthCallback page posts session_id to `/api/auth/google/session`
- Backend calls `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with X-Session-ID
- Stores in user_sessions collection, sets session_token httpOnly cookie
