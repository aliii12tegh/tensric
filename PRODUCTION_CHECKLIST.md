# Production Security Checklist — Nexus AI

## Pre-Deploy

- [ ] **Set all env vars** in Vercel Dashboard → Settings → Environment Variables:
  - `JWT_SECRET` (64+ char random string)
  - `OPENAI_API_KEY`
  - `REPLICATE_API_TOKEN`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_PRO`
  - `STRIPE_PRICE_ENTERPRISE`
  - `APP_URL`
  - `REQUEST_TOKEN_SECRET` (32+ char random string)
- [ ] **No secrets in NEXT_PUBLIC_** — verify no env var starts with `NEXT_PUBLIC_`
- [ ] **Run security tests**: `node --test tests/security.test.js`
- [ ] **Review `.gitignore`** — `.env*`, `.data/`, `node_modules/` all listed

## Post-Deploy

- [ ] **Bundle audit** — open DevTools → Sources → search for API keys, `JWT_SECRET`, `sk_`
- [ ] **Security headers** — check Network tab for: HSTS, CSP, X-Frame-Options, nosniff, Permissions-Policy
- [ ] **Source maps disabled** — verify no `.map` files served in production
- [ ] **Configure Vercel Firewall** — follow `VERCEL_FIREWALL_GUIDE.md`
- [ ] **Test Stripe webhook** — use `stripe listen --forward-to` or send test events from Stripe Dashboard
- [ ] **Rate limit test** — send 6+ rapid requests to `/api/generate` and verify 429 response
- [ ] **Auth test** — call `/api/generate` without token and verify 401

## Ongoing

- [ ] Rotate `JWT_SECRET` and `REQUEST_TOKEN_SECRET` quarterly
- [ ] Monitor Vercel Firewall analytics weekly
- [ ] Review Stripe webhook logs for failed deliveries
- [ ] Update dependencies monthly (`npm audit`)
