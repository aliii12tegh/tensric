# Vercel Firewall & WAF Configuration Guide

These settings **must be configured in the Vercel Dashboard** — they cannot be set through code.

## 1. Bot Management

1. Go to **Vercel Dashboard → Project → Settings → Firewall**
2. Under **Bot Protection**, click **Enable**
3. Set action to **Log** initially, then change to **Challenge** after monitoring for 1 week
4. Review the bot traffic in **Analytics → Firewall** to fine-tune

## 2. WAF Custom Rules

Go to **Vercel Dashboard → Project → Settings → Firewall → Custom Rules** and add:

### Rule 1: AI Endpoints Rate Limit
| Field | Value |
|-------|-------|
| **Name** | AI endpoints rate limit |
| **Condition** | Path starts with `/api/generate` OR Path starts with `/api/enhance` |
| **Action** | Rate Limit → 10 requests per minute per IP |
| **Exceeded action** | Block |

### Rule 2: Checkout Rate Limit
| Field | Value |
|-------|-------|
| **Name** | Checkout rate limit |
| **Condition** | Path equals `/api/checkout` |
| **Action** | Rate Limit → 5 requests per minute per IP |
| **Exceeded action** | Challenge |

### Rule 3: Block Suspicious API Traffic
| Field | Value |
|-------|-------|
| **Name** | Block suspicious API traffic |
| **Condition** | Path starts with `/api/` AND (Country is in sanctioned list OR JA3 fingerprint is known bot) |
| **Action** | Block |

### Rule 4: Webhook IP Allowlist (Optional)
| Field | Value |
|-------|-------|
| **Name** | Stripe webhook IP allowlist |
| **Condition** | Path equals `/api/webhook` AND Source IP is NOT in Stripe IP range |
| **Action** | Block |

> Stripe's webhook IPs: see https://docs.stripe.com/ips

## 3. DDoS Protection

Vercel's DDoS protection is enabled by default on all plans. No configuration needed.

## 4. Monitoring

- Review blocked requests in **Analytics → Firewall**
- Set up alerts in **Settings → Notifications** for high block rates
