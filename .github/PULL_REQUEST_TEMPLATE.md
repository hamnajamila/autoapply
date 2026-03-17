---
## AutoApply — Full Implementation PR

### Overview
This PR introduces the complete AutoApply system: an autonomous AI agent 
that connects to multiple remote job portals, scores job fit using a 
field-agnostic LLM pipeline, automatically fills and submits applications, 
and notifies the user via email for every action taken.

### Portals Supported
| Portal | Scraping | Auto-Apply | Auth Method |
|--------|----------|------------|-------------|
| LinkedIn | ✅ API | ✅ Easy Apply | OAuth 2.0 |
| JobRight.ai | ✅ Playwright | ✅ Full | Email/Pass |
| Mercor | ✅ Playwright | ✅ Full | Email/Pass |
| RemoteOK | ✅ Public API | ✅ Playwright | None |
| Remotive | ✅ Public API | ✅ Playwright | None |
| We Work Remotely | ✅ Scrape | ✅ Playwright | None |
| Himalayas | ✅ Public API | ✅ Playwright | None |
| Wellfound | ✅ Playwright | ✅ Full | Email/Pass |
| Greenhouse ATS | ✅ Via others | ✅ Playwright | None |
| Lever ATS | ✅ Via others | ✅ Playwright | None |
| Workday ATS | ✅ Via others | ⚠️ Complex | None/Account |
| Remote.co | ✅ Scrape | ✅ Playwright | None |

### Key Design Decisions
- **Field-Agnostic**: The LLM matching and form-filling never assume 
  any industry. It works for any profession.
- **Privacy**: Portal credentials are encrypted with AES-256-GCM before 
  storage. JWTs expire in 7 days.
- **Resilience**: Every worker job is wrapped in try/catch. Failures are 
  logged and the agent continues. CAPTCHA → skip + email user.
- **Anti-Detection**: Random delays (2-6s), rotating user agents, 
  persistent cookie sessions, rate limits per portal.
- **Audit Trail**: Before/after screenshots stored for every 
  application attempt.

### Setup Instructions
1. `git clone <repo> && cd autoapply`
2. `cp .env.example .env` and fill in your API keys
3. `docker-compose up -d` to start postgres + redis
4. `npm install` (installs all workspaces)
5. `cd apps/api && npx prisma migrate dev --name init`
6. `npm run dev` from root (starts both api and web)
7. Open http://localhost:3000

### Environment Variables Required
See `.env.example` for full list. Minimum required:
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`
- `OPENAI_API_KEY` (for all AI features)
- `RESEND_API_KEY` or SMTP config (for emails)
- `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` (for LinkedIn OAuth)

### Known Limitations
- Workday requires account creation on some jobs — these are flagged 
  for manual application.
- CAPTCHAs are detected but not solved — jobs are skipped with email alert.
- LinkedIn API rate limits apply (use respectfully).
- Portal ToS: Use responsibly and review each portal's terms of service.

### Testing
Run: `npm test` from root
Tests cover: LLM matching (5 different fields), form filling, 
email templates, all API routes.

### Future Improvements
- Add 2captcha/AntiCaptcha integration for CAPTCHA solving
- Add Telegram/Discord notification channel options  
- Add browser extension for manual apply assistance
- Add S3 for file storage in production
- Add Stripe for SaaS billing
---

