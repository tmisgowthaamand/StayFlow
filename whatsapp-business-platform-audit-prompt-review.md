# WhatsApp Business Platform Audit Prompt Review

## Verdict

This is a strong audit prompt. It has a broad feature map, a clear status taxonomy, and useful output sections for engineering and roadmap planning.

Recommended score: **8/10**

It is usable as-is, but it should be tightened before using it for a serious repository audit. The main risk is that the prompt may bias the auditor toward accepting prior claims as true. It also needs stricter evidence rules, clearer version checks, and a stronger security checklist.

---

## What Works Well

- The feature map is broad and practical.
- The status categories are clear:
  - Implemented
  - Partial
  - Not implemented
  - Not applicable
- The prompt correctly asks for file, function, and line-level evidence.
- The final output sections are useful:
  - What is built
  - What is missing
  - Priority build list
  - Architecture gaps
- The "what to build next" hypotheses are useful as a roadmap sanity check.
- The prompt explicitly warns against guessing.

---

## Main Issues To Fix

### 1. The baseline section can bias the audit

The current Section 2 says:

```text
KNOWN IMPLEMENTATION STATUS
```

and marks several items as confirmed.

That can lead the auditor to treat claims as evidence. For a strict technical audit, this section should be renamed:

```text
CLAIMS TO VERIFY
```

The auditor should be instructed that these are unverified claims and must not be used as proof.

### 2. "Complete feature surface" is too absolute

WhatsApp Business Platform features change frequently. The prompt should say:

```text
supplied WhatsApp Business Platform feature map
```

instead of:

```text
complete Meta WhatsApp Business Platform feature surface
```

unless the auditor is also verifying live Meta documentation during the audit.

### 3. Implemented vs partial needs stricter rules

The prompt should define what counts as implemented.

For example:

- API client only = partial
- Type/interface only = partial
- Config only = partial
- UI only without backend = partial
- Backend route without caller/webhook wiring = partial
- Reachable production path with valid payloads = implemented

### 4. Add confidence scoring

Each feature should include a confidence value:

- High
- Medium
- Low

This helps distinguish between code that is clearly production-wired and code that merely appears to support a feature.

### 5. Add explicit version checks

The audit should explicitly identify:

- Graph API version used
- Flow JSON version used
- Flow Data API version used
- Webhook verification method
- Template management method
- Deprecated or frozen versions
- Hardcoded API URLs

### 6. Strengthen security requirements

The architecture audit should explicitly check:

- Webhook signature verification
- WhatsApp verify token handling
- Flow endpoint encryption/decryption
- RSA private key handling
- AES-GCM correctness
- Replay protection
- Webhook idempotency
- Access token storage
- Token rotation
- Rate limiting
- PII redaction
- Media URL security
- Admin panel authentication
- Role-based access control
- Secret leakage

### 7. Reduce noisy code quoting

The prompt currently says "Quote code." That can lead to long, noisy output.

Better:

```text
Quote only short relevant snippets when useful. Maximum 5 lines per finding.
Always cite file path, function/component name, and line number.
```

### 8. Require systematic repository scanning

The prompt should require scanning:

- WhatsApp API clients/services
- Message builders/senders
- Webhook routes/controllers
- Flow JSON files
- Flow endpoint handlers
- Encryption utilities
- Template management code
- Media handling code
- Payment/order handling code
- Admin frontend
- Database models
- Environment/config files
- Tests
- Deployment files
- Monitoring/alerting code

---

## Recommended Replacement For Section 2

```md
## Section 2 - Claims To Verify

The following are unverified claims about the repository.

Do not treat these claims as evidence.

The auditor must confirm each claim directly from code before marking any related feature as implemented.

| Claim | Audit Treatment |
|---|---|
| Direct Meta Cloud API, no BSP | Verify from API client/config |
| WhatsApp Flows v7.3 in production | Verify from Flow JSON files |
| Data API mode used | Verify from `data_api_version` and endpoint handlers |
| Flow encryption using RSA + AES-GCM | Verify from encryption/decryption utilities |
| UPI payment retry flows | Verify from payment and Flow code |
| Multiple Flow implementations | Verify from Flow JSON inventory |
| Lead scoring HOT/WARM/COLD | Verify from business logic |
| Agent alerting | Verify from notification code |
| MongoDB persistence | Verify from models/config |
| Cloudinary media handling | Verify from media upload/download code |
| React admin panel | Verify from frontend code |
| Webhook handling for incoming messages and statuses | Verify from webhook routes |
```

---

## Recommended Evidence Rules

```md
## Evidence Rules

Use the following definitions consistently.

### Implemented

Mark a feature as implemented only when:

- Reachable production code exists
- The feature is wired into the application flow
- Required API payloads or handlers are present
- Error handling exists or is operationally reasonable
- File path, function/component name, and line number can be cited

### Partial

Mark a feature as partial when:

- A wrapper/client exists but is unused
- Constants/types/interfaces exist without execution path
- UI exists but backend integration is missing
- Backend exists but no webhook/route/caller wires it in
- Feature exists but lacks required security, validation, or API compliance
- Implementation appears deprecated or version-incomplete

### Not Implemented

Mark a feature as not implemented when:

- No code evidence is found
- Only docs, comments, or plans mention it
- The feature is claimed but not traceable to working code

### Not Applicable

Mark a feature as not applicable only when:

- It does not fit this project's use case
- It would require a different business model, region, vertical, or operating mode
- The reason is explicitly explained
```

---

## Improved Copy-Ready Audit Prompt

```md
# WhatsApp Business Platform - Repository Feature Audit Prompt

> Audit date: June 2026
> Scope: Audit a production WhatsApp automation repository against the supplied WhatsApp Business Platform feature map.

---

## System Role

You are a senior WhatsApp Business Platform architect conducting a precise technical audit of a production WhatsApp automation repository.

You have access to:

1. The complete repository code
2. The supplied WhatsApp Business Platform feature map
3. Any repository documentation, environment examples, tests, and configuration files

Your task is to audit the repository feature-by-feature.

Do not guess.
Do not assume production behavior from comments, docs, or prior claims.
Only mark a feature as implemented when there is code evidence.

---

## Claims To Verify

The following are unverified claims.

Do not treat them as evidence.

The auditor must confirm each claim directly from repository code before marking related features as implemented.

| Claim | Audit Treatment |
|---|---|
| Direct Meta Cloud API, no BSP | Verify from API client/config |
| WhatsApp Flows v7.3 in production | Verify from Flow JSON files |
| Data API mode used | Verify from `data_api_version` and endpoint handlers |
| Flow encryption using RSA + AES-GCM | Verify from encryption/decryption utilities |
| UPI payment retry flows | Verify from payment and Flow code |
| Multiple Flow implementations | Verify from Flow JSON inventory |
| Lead scoring HOT/WARM/COLD | Verify from business logic |
| Agent alerting | Verify from notification code |
| MongoDB persistence | Verify from models/config |
| Cloudinary media handling | Verify from media upload/download code |
| React admin panel | Verify from frontend code |
| Webhook handling for incoming messages and statuses | Verify from webhook routes |

---

## Evidence Rules

### Implemented

Mark a feature as implemented only when:

- Reachable production code exists
- The feature is wired into the application flow
- Required API payloads or handlers are present
- Error handling exists or is operationally reasonable
- File path, function/component name, and line number can be cited

### Partial

Mark a feature as partial when:

- A wrapper/client exists but is unused
- Constants/types/interfaces exist without execution path
- UI exists but backend integration is missing
- Backend exists but no webhook/route/caller wires it in
- Feature exists but lacks required security, validation, or API compliance
- Implementation appears deprecated or version-incomplete

### Not Implemented

Mark a feature as not implemented when:

- No code evidence is found
- Only docs, comments, or plans mention it
- The feature is claimed but not traceable to working code

### Not Applicable

Mark a feature as not applicable only when:

- It does not fit this project's use case
- It would require a different business model, region, vertical, or operating mode
- The reason is explicitly explained

---

## Required Repository Search Areas

Inspect at minimum:

- WhatsApp API client/service files
- Message senders/builders
- Webhook routes/controllers
- Flow JSON files
- Flow endpoint handlers
- Encryption/decryption utilities
- Template management code
- Media upload/download code
- Payment/order handling code
- Admin panel/frontend code
- Database models/schemas
- Environment/config files
- Tests
- Deployment/server files
- Logs/monitoring/alerting integrations
- README/docs/scripts

---

## Required Version Checks

Explicitly identify:

| Area | Required Check |
|---|---|
| Graph API | Graph API version used in URLs/config |
| Flow JSON | JSON version used, especially v7.3 vs older versions |
| Flow Data API | Data API version used, especially v3.0 vs v4.0 |
| Webhooks | Verification method and subscribed fields |
| Templates | Whether templates are manually managed or API-managed |
| Messaging | Whether payloads match current WhatsApp Cloud API objects |
| Deprecated patterns | Any frozen/deprecated versions or payload formats |

Flag deprecated or risky patterns.

---

## Required Security Checks

Audit and report on:

- Webhook signature verification
- WhatsApp verify token handling
- Flow endpoint encryption/decryption
- RSA private key handling
- AES-GCM handling
- Replay protection
- Idempotency for webhook retries
- Access token storage
- Token rotation strategy
- Long-lived token handling
- Rate limiting
- Error logging hygiene
- PII redaction in logs
- Media URL security
- Admin panel authentication
- Role-based access controls
- Environment variable exposure
- Production secret leakage

---

## Feature-By-Feature Audit

For every item in the supplied feature map, produce a table with:

| # | Feature | Status | Evidence | Notes | Confidence |
|---|---|---|---|---|---|

Status must be one of:

- Implemented
- Partial
- Not implemented
- Not applicable

Confidence must be one of:

- High
- Medium
- Low

Evidence format:

```text
/path/to/file.js:123 - functionName()
```

Only quote short snippets when useful. Maximum 5 lines per finding.

---

## Required Output

After the feature-by-feature audit, produce the following sections.

### A. What Is Built

Summarize confirmed capabilities.

Include:

- Messaging capabilities
- Interactive messaging capabilities
- Flow capabilities
- Webhook capabilities
- Persistence/storage capabilities
- Admin/dashboard capabilities
- Payment or commerce capabilities
- Operational maturity notes

Do not include unverified claims.

### B. What Is Missing

Group missing or incomplete items into:

- Critical gaps
- High-value additions
- Nice-to-have

### C. Priority Build List

Rank the top 10 next features to implement.

For each item include:

| Rank | Feature | Why It Matters | Business Impact | Effort | Platform Maturity | Dependencies |
|---|---|---|---|---|---|---|

Business Impact:

- High
- Medium
- Low

Effort:

- Low
- Medium
- High

Platform Maturity:

- Stable
- New but usable
- Beta / limited
- Unclear

### D. Architecture Gaps

Identify issues that should be fixed before scaling.

Cover:

- Security
- Error handling
- Retry/idempotency
- Rate limits
- Token management
- Webhook verification
- Flow endpoint reliability
- Observability
- Data model weaknesses
- Admin panel risks
- Deployment/config risks

Use file references where possible.

### E. Deprecated Or Risky Patterns

Call out:

- Old Flow JSON versions
- Old Flow Data API versions
- Deprecated payload formats
- Hardcoded Graph API versions
- Manual template workflows where API management is needed
- Missing webhook fields
- Unused or dead feature code
- Any platform feature that appears unstable or gated

### F. Final Recommendation

Conclude with:

1. Overall implementation maturity score out of 10
2. Production readiness score out of 10
3. Top 3 urgent fixes
4. Top 3 revenue/product opportunities
5. Whether the repo is ready for:
   - single-client production
   - multi-client production
   - SaaS/multi-tenant operation

---

## Context - WhatsApp Business Platform Feature Map

Paste the full supplied feature map here.

Do not treat the feature map as proof that the repository implements anything.

```text
[PASTE SECTION 1 FEATURE MAP HERE]
```

---

## Begin Audit

Start by scanning the repository structure.

Then audit every feature in the supplied feature map.

Remember:

- Be specific
- Cite code
- Do not guess
- Baseline claims are not evidence
- If evidence cannot be found, mark the feature as not implemented
```

---

## Final Recommendation

Use the improved prompt above instead of the original prompt.

The original prompt is good for a directional review, but the improved version is better for a serious technical audit because it:

- Prevents baseline-claim bias
- Makes evidence standards explicit
- Separates partial scaffolding from real implementation
- Forces version and security checks
- Adds confidence scoring
- Produces a cleaner roadmap

