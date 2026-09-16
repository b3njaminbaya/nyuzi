# Nyuzi — Case Study

**A circular-fashion marketplace for Kenya, built solo end-to-end: product,
full-stack engineering, security, and go-to-market thinking.**

Live demo: https://nyuzi.vercel.app
Built and owned by Benjamin Mweri Baya.

---

## The problem

Kenya is one of the world's largest importers of secondhand clothing —
hundreds of thousands of tonnes arrive every year, and a meaningful share
of it is unsellable by the time it gets here. What doesn't move through
the mitumba markets is often burned or dumped, because there's no
straightforward, trusted channel to give it a second life instead.

## The product

Nyuzi connects three groups around that gap:

- **Donors** list clothing, shoes, and accessories they no longer need,
  with an optional pickup request.
- **Upcycling partners** turn unsellable items into new products rather
  than letting them become waste.
- **Buyers** shop those products with a real traceability story — where
  applicable, a product page shows exactly which donation(s) it was made
  from and when they came in, not a vague sustainability label.

Checkout runs on M-Pesa (Safaricom's Daraja API), with guest checkout
supported throughout — nobody has to create an account to donate or buy.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite, Tailwind/shadcn UI, React
  Router with route-level code splitting, React Hook Form + Zod for
  validation, packaged for iOS/Android via Capacitor.
- **Backend**: entirely Supabase — Postgres with row-level security as
  the primary access-control layer (not an application-level permission
  check bolted on top), Supabase Auth, Supabase Storage for product and
  donation photos, and Deno edge functions for M-Pesa payment handling
  and transactional email.
- **Schema**: 26 sequential, self-documented SQL migrations. Every
  non-obvious design decision — why a function is `security definer`,
  why a policy is scoped the way it is — is explained in a comment
  directly above it in the migration itself, not in a separate doc that
  drifts out of sync with the code.

## Engineering decisions worth highlighting

**Inventory correctness under concurrency.** Checkout runs inside a
single atomic Postgres function that row-locks each product, checks
stock, and decrements it in the same transaction — two customers can't
both win the last unit of a one-of-a-kind item. If a payment later fails,
a trigger returns the reserved stock automatically. Direct table writes
that would bypass this are revoked at the database grant level, not just
hidden in the UI.

**Privacy-boundary crossings are narrow and explicit.** Wherever a
feature needs to read across an ownership boundary — a guest looking up
their own order by ID with no session, a buyer seeing which donations
built a product without ever seeing donor identity, an admin seeing a
user's email without a blanket grant on the users table — that crossing
happens through a small, purpose-built, security-definer SQL function
rather than loosening the underlying table's row-level security policy.
The blast radius of any one exposure stays small by construction.

**A real security audit, not a hypothetical one.** I ran a full
audit of my own system before treating it as production-ready, and
fixed what it found rather than filing it away:
- A payment-integrity issue where checkout trusted client-supplied
  pricing instead of re-deriving it server-side — closed by making the
  database the sole source of truth for price at checkout time.
- A payment-webhook authentication gap — closed with a shared-secret
  requirement and idempotency guards so a replayed or forged callback
  can't resurrect a cancelled order.
- A pre-existing privilege-escalation path in role management (a missing
  `WITH CHECK` clause that would have let a signed-in user promote
  themselves to admin) — found and closed.
- Added IP-based rate limiting on the payment-initiation endpoint and
  scoped its CORS policy, after identifying it could otherwise be used
  to spam arbitrary phone numbers with unwanted payment prompts.

**Willing to cut a feature the data didn't support.** An earlier version
shipped an on-device AI model (TensorFlow.js + MobileNet) to suggest a
donation category from a photo. On review, it added a 650KB+ download for
users on mobile data, the category field was still required either way
so it saved at most one click, and its accuracy on the actual 4-category
task was never validated. I removed it rather than keep it for the sake
of having shipped it — a smaller, more honest product beat a more
"impressive-sounding" one.

**Impact numbers are disclosed, not asserted.** Every donation's
estimated water/CO₂/landfill impact is calculated from a documented
methodology citing WWF and WRAP research, shown directly on the impact
page — rather than presenting a number with no explanation of where it
came from, which is how sustainability claims quietly become
greenwashing.

## Product judgment, not just code

Beyond the build itself, this project went through a deliberate
self-review pass: an audit of which features were actually earning their
place versus which merely looked good in a demo. That review cut the AI
classifier, rewrote the impact methodology, and — most substantively —
closed a real gap in the donor experience: guest donors previously had no
contact information collected at all, meaning the platform's own "we'll
follow up with you" promise was structurally impossible to keep. The fix
threads through the whole stack: a new required field on the donation
form, a database migration, updated email logic, and copy changes across
four separate pages that all needed to agree with the new reality.

I also researched direct competitors (including Africa Collect Textiles,
an operating circular-textile business in Kenya) before making product
and positioning decisions, rather than guessing at what the market
already does well.

## Where it stands

The product is feature-complete against its own roadmap, with one
deliberate exception: a WhatsApp donation channel, scoped but not built,
because it depends on a Meta Business Account only a business owner can
set up. M-Pesa is fully implemented but not activated in production. The
codebase is closed-source and proprietary.

## What this demonstrates

Full-stack ownership from schema design through deployment; a
security-first default rather than a security-afterthought; the
judgment to remove a feature that wasn't earning its keep instead of
defending a sunk cost; and a three-sided marketplace model with a real,
researched market problem behind it (Kenya's secondhand-textile waste
volume) and a genuine technical differentiator (donation-to-product
traceability) rather than a generic resale-app clone.

I'm not currently operating Nyuzi as a business. I'd welcome a
conversation with anyone interested in acquiring it, investing in it, or
partnering to take it into real operation.
