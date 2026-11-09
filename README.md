# TAFE — Training And Future Excellence

Existing React/TypeScript/Vite application using Supabase project ydfmjhosuqabtgbksrsg.

## Run and verify

- npm ci
- npm run typecheck
- npm test
- npm run build

Serve dist as static assets. Student routes use #/student/dashboard, #/student/tests, #/student/results, #/student/ai, #/student/library and #/student/profile. Independent administrator routes start at #/admin/overview. The Sites identity is retained in .openai/hosting.json.

All canonical migration versions are tracked in supabase/migrations and match the remote migration history. tests/platform.sql runs transactional assertions and ends with ROLLBACK. scripts/test-database.mjs replays all migrations against isolated PostgreSQL with local Auth and Storage schema contracts, then runs the same assertions. Auth email delivery, storage HTTP uploads and LLM calls are not simulated as application functionality by these tests.

## Implemented

- Independent admin layout and route guard, backed by server-side checks on administrative RPCs and RLS on direct table operations.
- User search, sorting, filters, pagination, history, permitted name editing, suspension/reactivation, reversible account deletion, subscription grants/extensions/cancellation and audit records.
- Visual test builder, draft/publish, passage text and optional image, 15 question types, accepted answer variants, points, question duplication/grouping/reordering and student preview. No manual JSON input is required.
- Server-authoritative attempt timing, immutable question/material snapshots, deterministic grading, answer autosave, resume, navigation, flags and completed-attempt review.
- Private document, cover and avatar buckets with upload size/MIME restrictions and access policies. Library cards, search, filters, details and signed reading links.
- Database-configured plan permissions and daily/monthly test and AI limits. Expired or cancelled grants fall back to the configured default plan. Student-owned subscription and payment history are readable, while entitlement writes require administrator authority.
- TAFE AI conversations, history migration, renaming, deletion guard, Markdown, tables, code, KaTeX math, retry, request/token/error tracking and optional explicitly shared learning context. Generated practice is validated before saving a response.
- Profile sections for personal details, security, appearance, notification preferences, billing and privacy/data export/deletion requests.

Account deletion uses a reversible status change. It retains related learning history and logs the administrator action. Protected database actions and AI quota checks reject suspended/deleted accounts. Test and AI limits count accepted requests/attempts and are enforced on the backend, including direct API calls.

## External configuration

Supabase built-in URL/service-role secrets stay on the server. No service-role, private EmailJS or Gemini key belongs in frontend code.

Edge Function secrets:
- EMAILJS_PRIVATE_KEY for EmailJS strict mode.
- EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY (existing public-identifier defaults are supported).
- TAFE_ALLOWED_ORIGINS (optional comma-separated browser origins for email verification, defaults to the production TAFE origin).
- GEMINI_API_KEY.
- GEMINI_MODEL (optional model override).

Deploy supabase/functions/emailjs-registration and supabase/functions/tafe-ai to the existing Supabase project. Both functions implement request authentication/verification themselves where applicable. Email registration verifies native Supabase OTPs transported by EmailJS, with an additional 15-minute application deadline and server-side attempts/resend limits. EmailJS templates use to_email, passcode and time. Templates in supabase/templates are prepared but must be applied in the provider dashboards. The code length returned by the server controls the input field. Both six-digit legacy and eight-digit Supabase codes are accepted by server format validation and must still match the stored challenge and pass native Supabase verification. Configure native Supabase OTP expiry to 900 seconds. Global Auth configuration was not available through the connector. Supabase's leaked-password protection was disabled at the last inspection.

Administrator Settings controls the public contact address, enabled AI state, model preference and system prompt. Plan settings control limits and feature permissions.

## Verification boundaries and remaining integrations

TypeScript and production builds pass. The transaction suite passed locally and on the existing Supabase database. It covers advanced grading, idempotency, resume, quotas, expired/cancelled subscriptions, suspension/restoration, soft deletion, completed-result key access, role restrictions, cross-user isolation and chat deletion while a response is pending.

Browser QA observed the public landing and the unauthenticated admin route's login guard. Authenticated admin/student journeys, real file uploads, all device sizes and a live Gemini response have not been verified in this session. The prior Gemini provider returned 503, so a successful live answer remains an acceptance check.

Live payment processing requires a chosen provider and its credentials/webhook configuration. Payment status cannot be set by an ordinary user or administrator frontend. Current payment screens show actual saved records and the unconfigured-provider state. Paid prices remain unset until configured.

Notification preferences are persisted, but scheduled reminder delivery is not active. AI responses are non-streaming and do not currently expose a generation-cancellation control. Written response grading uses administrator-supplied accepted variants, with no subjective or official AI scoring. User-created tests, resources and other authored content retain their source language. Hard account purging is not implemented.
