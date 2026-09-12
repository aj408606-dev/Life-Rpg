Life RPG – Level Up Your Reality ⚔️
A gamified life-tracking web application that turns daily productivity, workouts, study sessions, and social habits into an engaging RPG experience. Complete quests, gain XP, earn gold, unlock badges, customize a 3D avatar, and compete on the global leaderboard.
🚀 Tech Stack & AI Ecosystem
AI Agents & Development Tools
 OpenAI (ChatGPT): Used for logic architecture, game loop balance calculations, dynamic XP formulas, and initial script generation.
 Google Gemini: Leveraged for advanced debugging, Next.js client/server component isolation, multi-platform OAuth troubleshooting, and Supabase SQL policy design.
 Vercel / Turbopack: Next.js bundling, hot module replacement, and client-side optimization.
Frontend
 Framework: Next.js (App Router, Client Component architecture via ⁠"use client"⁠)
 Language: TypeScript (⁠.tsx⁠)
 Styling: Tailwind CSS with custom glassmorphic panels and CSS 3D Transforms (⁠preserve-3d⁠, perspective projection).
 Typography: Cinzel (Display/Headings) & Outfit (Body UI).
Backend & Authentication
 Backend as a Service: Supabase
 Database: PostgreSQL (with Row Level Security - RLS)
 Authentication Providers:
 Supabase Auth (Native Email/Password with custom SMTP verification)
 OAuth 2.0 Providers (Google, Apple, Meta/Facebook)
 Mailing Service: Custom SMTP integrated via Brevo (Sendinblue) with dynamic OTP / token-based email templates.
⚙️ APIs & SDKs Used
 ⁠@supabase/supabase-js⁠: Supabase JavaScript client for querying database tables (⁠profiles⁠), handling session states, and authenticating users.
 Supabase REST / PostgREST API: Direct client-side calls for leaderboard metrics and profile upserts.
 Google Cloud Identity / OAuth 2.0 API: Redirects and token handshake for Google sign-in.
 Brevo SMTP API: Custom relay configuration for auth email delivery (⁠smtp-relay.brevo.com⁠).
⚠️ Prototype Status & Known Limitations
Note: This project is currently in active prototyping. The following technical flaws and edge cases are documented for transparency and future development:
1. Avatar Equipment Rendering (Apparel Overlay)
 Behavior: When items are purchased and equipped from the shop, helmets, armor, and footwear display as flat visual emojis layered over the 3D cube surfaces rather than true geometric meshes.
 Cause: The avatar is constructed entirely with pure CSS 3D boxes (⁠rotateX⁠, ⁠rotateY⁠, ⁠translateZ⁠) rather than a WebGL/Three.js/Canvas engine. True 3D armor requires ⁠.gltf⁠ / ⁠.obj⁠ 3D modeling and skin-rigging to wrap around character limbs accurately.
2. State Desynchronization on Refresh / Logout
 Behavior: In certain deployment configurations or before completing full SQL migrations, refreshing or logging out can temporarily reset player stats (XP, gold, level, quests) back to starting values (⁠0⁠).
 Cause: If Row Level Security (RLS) policies on the Supabase ⁠profiles⁠ table block incoming ⁠update⁠ or ⁠select⁠ queries, the client falls back to default in-memory state. Full persistent recovery requires matching database schema policies and active session tokens.
3. Asynchronous Database Upserts
 Behavior: Rapidly checking off multiple tasks in quick succession can occasionally drop state updates or cause rate-limiting glitches.
 Cause: Current writes to the database execute via client-side optimistic UI updates. If an update fails over an unstable network, the UI may visually roll back to the previously fetched state on the next mount.
4. Third-Party Provider Constraints
 Apple & Meta OAuth: While buttons and OAuth callback handlers are built into the client code, active authentication requires registered Developer IDs, verified domains, and valid Client Secrets from the Apple Developer Program and Meta for Developers console.
