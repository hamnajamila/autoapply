---
## AutoApply - Full Implementation PR

### Overview
This PR introduces the complete AutoApply system: an autonomous job application agent that connects to multiple remote job portals, scores job fit using a field-agnostic AI pipeline, automates supported application flows, and notifies the user about every important outcome.

### Portals Supported
| Portal | Scraping | Auto-Apply | Auth Method |
|--------|----------|------------|-------------|
| LinkedIn | API | Easy Apply | OAuth 2.0 |
| JobRight.ai | Playwright | Full | Email/Pass |
| Mercor | Playwright | Full with manual skip guards | Email/Pass |
| RemoteOK | Public API | Playwright | None |
| Remotive | Public API | Playwright | None |
| We Work Remotely | Scrape | Playwright | None |
| Himalayas | Public API | Playwright | None |
| Wellfound | Playwright | Full | Email/Pass |
| Greenhouse ATS | Via others | Playwright | None |
| Lever ATS | Via others | Playwright | None |
| Workday ATS | Via others | Partial / complex | None or account wall |
| Remote.co | Scrape | Playwright | None |
| Custom portals | User managed | Stored in product surface | User defined |

### Key Design Decisions
- Field-agnostic matching and form filling so the product works across industries.
- AES-256-GCM encryption for saved credentials and cookies.
- Free-first AI runtime with Ollama first, deterministic fallback second, and optional OpenAI support.
- Queue-based orchestration with durable job storage, retries, and non-crashing worker error handling.
- CAPTCHA detection and manual-required skips rather than risky bypass behavior.
- Before and after screenshots stored for auditing application attempts.

### Setup Instructions
1. `git clone <repo> && cd autoapply`
2. `cp .env.example .env`
3. Configure database, auth, and optional provider keys.
4. `docker-compose up -d postgres redis`
5. `npm install`
6. `npm run prisma:generate`
7. `npm run dev`

### Environment Variables Required
Minimum required values:
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`
- `NEXTAUTH_SECRET`
- SMTP config or `RESEND_API_KEY` for email delivery
- LinkedIn OAuth variables only if LinkedIn auth is enabled

### Known Limitations
- Workday jobs that require account creation are flagged for manual handling.
- CAPTCHA challenges are detected and skipped rather than solved.
- External apply sites may still require manual completion if the form is too dynamic or unmappable.

### Testing
Run from the repo root:
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

### Future Improvements
- Optional mail catcher service for local development
- More portal-specific structured field mappers
- Browser extension support for assisted manual apply flows
- Object storage support for production resume storage
---
