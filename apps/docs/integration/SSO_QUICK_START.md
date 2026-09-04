# SSO Quick Start Guide

This guide helps you quickly set up and test the Streamline Account SSO integration.

## Prerequisites

- Auth server (streamline-scheduler-webpage) running
- Scheduler backend (Rust) running with SSO support
- Scheduler frontend running

## Setup Steps

### 1. Configure Auth Server

```bash
cd streamline-scheduler-webpage
cp .env.example .env
```

Edit `.env`:
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/streamline_webpage"
BETTER_AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXT_PUBLIC_STREAMLINE_SCHEDULER_URL="http://localhost:3000"
```

Start auth server:
```bash
pnpm db:push
pnpm dev  # Runs on port 3001 by default
```

### 2. Configure Scheduler Frontend

```bash
cd streamline-scheduler/frontend
cp env.example .env.local
```

Edit `.env.local`:
```bash
NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:3001
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:3001
NEXT_PUBLIC_AUTH_SERVER_URL=http://localhost:3001  # Enable SSO!
```

### 3. Configure Scheduler Backend

```bash
cd streamline-scheduler/backend
cp env.example .env
```

Edit `.env`:
```bash
# Add these SSO settings
AUTH_SERVER_URL=http://localhost:3001
ENABLE_SSO=true
```

**⚠️ Important**: Implement the SSO endpoint in the Rust backend!
See `SSO_INTEGRATION.md` for detailed implementation instructions.

### 4. Start All Services

```bash
# Terminal 1: Auth Server (Port 3001)
cd streamline-scheduler-webpage
pnpm dev

# Terminal 2: Scheduler Backend (Port 3001)
cd streamline-scheduler/backend
cargo run

# Terminal 3: Scheduler Frontend (Port 3000)
cd streamline-scheduler/frontend
pnpm dev
```

## Test the Flow

1. **Open scheduler**: `http://localhost:3000/sign-in`
2. **Look for SSO button**: You should see "Sign in with Streamline Account"
3. **Click SSO button**: Redirects to `http://localhost:3001/login`
4. **Login/Register**: Use email and password to authenticate
5. **Auto-redirect**: Should return to scheduler and be logged in

## Verify It's Working

### Check 1: SSO Button Appears
- Open `http://localhost:3000/sign-in`
- Look for "Sign in with Streamline Account" button
- If not visible, check `NEXT_PUBLIC_AUTH_SERVER_URL` in frontend `.env.local`

### Check 2: Redirect Works
- Click SSO button
- Should redirect to auth server login page
- URL should include callback parameter

### Check 3: Callback Receives Token
- After login, check browser URL
- Should see: `http://localhost:3000/auth/sso-callback?token=...`

### Check 4: Token Exchange (⚠️ Requires Backend Implementation)
- Check browser console for errors
- If you see "Failed to exchange SSO token", the backend endpoint needs implementation
- See `SSO_INTEGRATION.md` for backend implementation details

## Common Issues

### Issue: SSO button doesn't appear
**Solution**: 
- Verify `NEXT_PUBLIC_AUTH_SERVER_URL` is set in `frontend/.env.local`
- Restart frontend dev server after env changes

### Issue: Redirect doesn't work
**Solution**:
- Check auth server is running on port 3001
- Verify auth server URL is correct
- Check browser console for CORS errors

### Issue: Token validation fails
**Solution**:
- Ensure auth server `/api/validate-session` endpoint is accessible
- Check network tab in browser dev tools
- Verify token is being passed correctly

### Issue: Token exchange fails (404 or 500)
**Solution**:
- Backend `/auth/sso-exchange` endpoint needs to be implemented
- See `SSO_INTEGRATION.md` Section "Backend Implementation"
- Check backend logs for specific errors

## Port Configuration

Default ports used:
- **Auth Server**: 3001 (Next.js)
- **Scheduler Backend**: 3001 (Rust/Axum)
- **Scheduler Frontend**: 3000 (Next.js)

If you need different ports, update:
- Auth server: `package.json` scripts
- Backend: `.env` or Rust config
- Frontend: All URL references in `.env.local`

## Development Tips

### Enable Debug Logging

Frontend:
```typescript
// In sso-utils.ts, add console.logs
console.log('Validating SSO token:', token);
console.log('Validation response:', validation);
```

Backend:
```rust
// Add debug logging
println!("SSO exchange request: {:?}", payload);
println!("Validated user: {:?}", validated_user);
```

### Test Without Full Setup

You can test parts of the flow independently:

1. **Test redirect only**: Comment out token exchange in callback
2. **Test validation**: Call `/api/validate-session` directly with curl
3. **Test backend**: Use Postman/curl to test `/auth/sso-exchange`

```bash
# Test token validation
curl -X POST http://localhost:3001/api/validate-session \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN_HERE"}'
```

## Next Steps

Once basic SSO is working:

1. **Implement Backend**: See `SSO_INTEGRATION.md` for Rust code
2. **Add Error Handling**: Better error messages for users
3. **Add Loading States**: Improve UX during authentication
4. **Test Edge Cases**: Network failures, expired tokens, etc.
5. **Production Config**: HTTPS, proper CORS, secure cookies

## Need Help?

- **Frontend Issues**: Check `SSO_INTEGRATION.md` "User Flow" section
- **Backend Issues**: Check `SSO_INTEGRATION.md` "Backend Implementation" section
- **Auth Server Issues**: Check `streamline-scheduler-webpage/README.md`

## Quick Links

- Main Documentation: `SSO_INTEGRATION.md`
- Backend Implementation Guide: `SSO_INTEGRATION.md` Section 2
- Auth Server Docs: `../streamline-scheduler-webpage/README.md`
- Integration Guide: `../streamline-scheduler-webpage/INTEGRATION.md`

