# Robin Implementation Plan v4

> **Project:** Robin - AI Sales Sidekick
> **Goal:** Team collaboration and cross-meeting intelligence
> **Last Updated:** 2026-01-23
> **Focus:** Growth Features & Conversation Intelligence

---

## Specifications

Detailed specs for each feature area:

| Spec | Features Covered |
|------|------------------|
| `specs/team_collaboration.md` | Organization admin, invitations, sharing, clips, Slack |
| `specs/conversation_intelligence.md` | Contacts, cross-meeting search, AI Q&A |
| `specs/account_intelligence.md` | Accounts, health scores, signals dashboard |

**Always read the relevant spec before starting a task.**

---

## Task Index

Quick reference for agents to claim tasks. Check the box when starting work, mark COMPLETE when done.

### Phase 1: Team Foundation (P0)
- [x] **Task 1.1** - Organization Admin UI (Medium) - COMPLETE
- [x] **Task 1.2** - Team Member Invitation Flow (Medium) - COMPLETE
- [x] **Task 1.3** - Shared Knowledge Base (Small) - COMPLETE

### Phase 2: Sharing & Collaboration (P1)
- [x] **Task 2.1** - Meeting Sharing with Permissions (Medium) - COMPLETE
- [x] **Task 2.2** - Shareable Meeting Clips (Medium) - COMPLETE
- [x] **Task 2.3** - Slack Notifications (Small) - COMPLETE

### Phase 3: Conversation Intelligence (P0)
- [x] **Task 3.1** - Contact Entity & Meeting Linking (Medium) - COMPLETE
- [x] **Task 3.2** - Cross-Meeting Search (Medium) - COMPLETE
- [x] **Task 3.3** - Conversation History View (Medium) - COMPLETE
- [x] **Task 3.4** - AI Q&A Across Meetings (Large) - COMPLETE
- [x] **Task 3.5** - Contact AI Insights (Medium) - COMPLETE

### Phase 4: Account Intelligence (P1)
- [x] **Task 4.1** - Account/Company Entity (Small) - COMPLETE
- [x] **Task 4.2** - Account Timeline View (Medium) - COMPLETE
- [x] **Task 4.3** - Signal Aggregation Dashboard (Medium) - COMPLETE
- [x] **Task 4.4** - Signal Notifications (Small) - COMPLETE

### Phase 5: Reliability Infrastructure (P0)
- [x] **Task 5.1** - Core Reliability Infrastructure (Medium) - COMPLETE

---

## Overview

This plan focuses on two strategic priorities:

1. **Team Features (Growth)** - Enable sharing, invitations, and collaboration to drive viral adoption
2. **Conversation Intelligence** - Build a "memory" layer across meetings with the same contacts

### Design Principles
1. **Frictionless sharing** - One click to share a meeting or invite a teammate
2. **Context preservation** - Never lose context from past conversations
3. **Progressive intelligence** - The more meetings, the smarter Robin gets about each contact
4. **Team multiplier** - Individual insights become team knowledge

---

## Phase 1: Team Foundation (P0)

The `organizations` table exists but has no UI. These tasks enable team-based features.

### [x] Task 1.1: Organization Admin UI - COMPLETE
**Priority:** P0
**Estimate:** Medium (3-5 days)
**Spec:** `specs/team_collaboration.md` Section 2
**Files:** `src/app/settings/team/page.tsx`, `src/app/api/organizations/`
**Completed:** 2026-01-23

Create an admin interface for organization management.

**Requirements:**
- Organization settings page at `/settings/team`
- Show organization name, domain, member count
- List all team members with roles (owner, admin, member)
- Admin can change member roles (except owner)
- Admin can remove members (except owner)
- Show pending invitations

**Implementation Notes:**
- Created `supabase/migrations/00009_add_organization_members.sql` - Migration for organization_members table with RLS policies
- Created `src/types/database.ts` - Added OrganizationMemberRole, OrganizationMember, OrganizationMemberInsert, OrganizationMemberUpdate types
- Created `src/lib/api/validation.ts` - Added organizationMemberRoleSchema, updateMemberRoleSchema, listMembersQuerySchema
- Created `src/lib/api/rate-limit.ts` - Added organizationRead and organizationWrite rate limit categories
- Created `src/app/api/organizations/[id]/route.ts` - GET organization details with member count
- Created `src/app/api/organizations/[id]/members/route.ts` - GET list members with user data and search/filter
- Created `src/app/api/organizations/[id]/members/[userId]/route.ts` - PATCH update role, DELETE remove member
- Created `src/app/settings/team/page.tsx` - Team settings page with member list, role management, remove functionality
- Modified `src/app/settings/page.tsx` - Added Team navigation link

**Role Permissions:** (see spec Section 2.3 for full matrix)
- Owner: All permissions, cannot be removed
- Admin: Invite, manage members (not owner), manage KB
- Member: View only

**Validation:**
- `npm run test` - PASS (2093 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 172 pre-existing warnings)

**Tests:**
- API route tests for CRUD operations
- Component tests for member management UI
- Authorization tests (only admins can manage, owner protected)

---

### [x] Task 1.2: Team Member Invitation Flow - COMPLETE
**Priority:** P0
**Estimate:** Medium (3-5 days)
**Spec:** `specs/team_collaboration.md` Section 3
**Files:** `src/app/api/invitations/`, `src/app/invite/[token]/page.tsx`
**Completed:** 2026-01-23

Enable admins to invite teammates via email.

**Requirements:**
- Invite dialog with email input (single or bulk, comma-separated)
- Smart suggestions from recent meeting participants
- Email invitation with secure token link and personal message
- Invitation acceptance flow (different for new vs existing users)
- Auto-join organization on signup if invited
- Invitation expiry (7 days)
- Resend and revoke capabilities

**Implementation Notes:**
- Created `supabase/migrations/00010_add_organization_invitations.sql` - Migration for organization_invitations table with RLS policies
- Created `src/types/database.ts` - Added OrganizationInvitation, OrganizationInvitationInsert, OrganizationInvitationStatus types
- Created `src/lib/api/validation.ts` - Added invitationSchema, invitationAcceptSchema, listInvitationsQuerySchema
- Created `src/lib/supabase/queries.ts` - Added organizationInvitationsQueries helper functions
- Created `src/lib/email/invitation.ts` - Email template and sendInvitationEmail function using Resend
- Created `src/app/api/invitations/route.ts` - POST (create invitations), GET (list invitations)
- Created `src/app/api/invitations/[id]/route.ts` - DELETE (revoke invitation)
- Created `src/app/api/invitations/accept/[token]/route.ts` - GET (validate token), POST (accept invitation)
- Created `src/app/invite/[token]/page.tsx` - Invitation acceptance page with new/existing user flows
- Created `src/components/features/team/InviteDialog.tsx` - Invite dialog with bulk email input and role selection
- Modified `src/app/settings/team/page.tsx` - Added InviteDialog integration and pending invitations display

**Tests:**
- `src/__tests__/app/api/invitations/route.test.ts` - 25 tests for POST/GET endpoints
- `src/__tests__/app/api/invitations/[id]/route.test.ts` - 11 tests for DELETE endpoint
- `src/__tests__/app/api/invitations/accept/[token]/route.test.ts` - 17 tests for token validation/acceptance
- `src/__tests__/components/features/team/InviteDialog.test.tsx` - 33 tests for invite dialog component
- `src/__tests__/app/invite/[token]/page.test.tsx` - 20 tests for invite page component

**Validation:**
- `npm run test` - PASS (2199 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 178 pre-existing warnings)

---

### [x] Task 1.3: Shared Knowledge Base - COMPLETE
**Priority:** P0
**Estimate:** Small (2-3 days)
**Spec:** `specs/team_collaboration.md` Section 6
**Files:** `src/app/api/knowledge-base/documents/route.ts`, `src/app/api/knowledge-base/upload/route.ts`, `src/app/knowledge-base/page.tsx`
**Completed:** 2026-01-23

Allow team members to access organization's shared knowledge base.

**Requirements:**
- All org members can view KB documents
- Only owner/admins can upload/delete team documents
- Show document owner/uploader on cards
- Filter by "My Documents" vs "Team Documents" tabs

**Implementation Notes:**
- Created `supabase/migrations/00011_add_shared_knowledge_base.sql` - Migration adding is_shared, shared_at, shared_by columns with RLS policies
- Modified `src/types/database.ts` - Added is_shared, shared_at, shared_by fields to KnowledgeBase and KnowledgeBaseInsert interfaces
- Modified `src/lib/api/validation.ts` - Added kbDocumentsScopeSchema and listKbDocumentsQuerySchema for scope filtering
- Modified `src/app/api/knowledge-base/documents/route.ts` - Added scope query param (mine/team/all), owner field, by_ownership summary, current_user_role
- Modified `src/app/api/knowledge-base/upload/route.ts` - Added shared parameter, permission check for admin/owner roles
- Modified `src/app/knowledge-base/page.tsx` - Added scope tabs, owner display on document cards, share checkbox in upload form, conditional delete button
- Fixed lint error in `src/app/settings/team/page.tsx` - Added curly braces to if statements
- Created `src/__tests__/app/api/knowledge-base/documents/route.test.ts` - 6 tests for scope filtering, owner info, response structure

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 176 pre-existing warnings)


---

## Phase 2: Sharing & Collaboration (P1)

Enable viral growth through easy sharing and team notifications.

### [x] Task 2.1: Meeting Sharing with Permissions - COMPLETE
**Priority:** P1
**Estimate:** Medium (3-5 days)
**Spec:** `specs/team_collaboration.md` Section 4
**Files:** `src/app/api/meetings/[id]/shares/`, `src/components/features/meetings/ShareDialog.tsx`
**Completed:** 2026-01-23

Allow users to share meetings with teammates or external links.

**Requirements:**
- Share dialog with permission levels (view, view_full, comment)
- Share with specific team members by email (autocomplete)
- Generate public link with optional password and expiry
- Revoke access anytime
- Track access (last_accessed_at, access_count)
- Viral CTA on shared pages for non-users

**Permission Levels:**
- `view`: Summary only (for public links)
- `view_full`: Full transcript + recommendations + AI Q&A
- `comment`: Full access + ability to add comments

**Implementation Notes:**
- Created `supabase/migrations/00015_add_meeting_shares.sql` - Migration for meeting_shares table with RLS policies, share_token generation, and record_share_access() function
- Modified `src/types/database.ts` - Added MeetingSharePermission, MeetingShare, MeetingShareInsert, MeetingShareUpdate types
- Modified `src/lib/api/validation.ts` - Added meetingSharePermissionSchema, createMeetingShareSchema, updateMeetingShareSchema, listMeetingSharesQuerySchema, shareTokenSchema, verifySharePasswordSchema
- Modified `src/lib/api/rate-limit.ts` - Added sharesRead (100/min), sharesWrite (30/min), sharesPublic (50/min) rate limit categories
- Created `src/app/api/meetings/[id]/shares/route.ts` - POST create share, GET list shares
- Created `src/app/api/meetings/[id]/shares/[shareId]/route.ts` - PATCH update permissions, DELETE revoke share
- Created `src/app/api/shared/[token]/route.ts` - GET public access endpoint with permission-based content
- Created `src/app/api/shared/[token]/verify/route.ts` - POST password verification for protected shares
- Created `src/components/features/meetings/ShareDialog.tsx` - Full dialog with team/public modes, permission selection, password/expiry options, copy link, existing shares list with revoke
- Created `src/app/shared/[token]/page.tsx` - Public share page with password form, summary/full views based on permission, viral CTA for Robin signup
- Modified `src/app/meeting/[id]/summary/page.tsx` - Added Share button and ShareDialog integration
- Modified `src/components/features/meetings/index.ts` - Added ShareDialog export

**Key Features:**
- Password-protected shares using bcrypt hashing
- Expiring share links with automatic expiry check
- Soft delete (revoked_at) for share revocation
- Access tracking (last_accessed_at, access_count)
- Permission-based content: view (summary only), view_full (full transcript + recommendations), comment (full access)
- Viral CTA on public share pages to drive signups

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 new errors, pre-existing warnings only)

---

### [x] Task 2.2: Shareable Meeting Clips - COMPLETE
**Priority:** P1
**Estimate:** Medium (4-5 days)
**Spec:** `specs/team_collaboration.md` Section 5
**Files:** `src/app/api/clips/`, `src/components/features/clips/ClipCreator.tsx`
**Completed:** 2026-01-23

Allow users to create shareable clips from meeting transcripts.

**Requirements:**
- Select transcript segment visually (start/end markers in transcript)
- Add title, description, and tags
- Generate shareable link with viral CTA
- Organize clips into collections (e.g., "Objection Handling", "Discovery Questions")
- Track view counts

**Implementation Notes:**
- Created `supabase/migrations/00018_add_clips.sql` - Migration for clips, clip_collections, and clip_collection_items tables with RLS policies and view tracking functions
- Modified `src/types/database.ts` - Added ClipTranscriptSegment, Clip, ClipCollection, ClipInsert, ClipUpdate types
- Modified `src/lib/api/validation.ts` - Added clip creation/update validation schemas
- Modified `src/lib/api/rate-limit.ts` - Added clipsRead, clipsWrite, clipsPublic, collectionsRead, collectionsWrite rate limit categories
- Created `src/app/api/clips/route.ts` - POST create clip, GET list clips with filtering/search
- Created `src/app/api/clips/[id]/route.ts` - GET, PATCH, DELETE individual clips
- Created `src/app/api/clips/public/[token]/route.ts` - GET public clip by share token (no auth required)
- Created `src/app/api/clip-collections/route.ts` - POST create collection, GET list collections
- Created `src/app/api/clip-collections/[id]/route.ts` - GET, PATCH, DELETE individual collections
- Created `src/app/api/clip-collections/[id]/clips/route.ts` - POST add clip to collection
- Created `src/app/api/clip-collections/[id]/clips/[clipId]/route.ts` - PATCH update position, DELETE remove from collection
- Created `src/components/features/clips/ClipCreator.tsx` - Interactive transcript selection UI for creating clips
- Created `src/components/features/clips/ClipCard.tsx` - Clip card with metadata, tags, actions
- Created `src/components/features/clips/ClipList.tsx` - List view with search, filtering, sorting, pagination
- Created `src/components/features/clips/index.ts` - Module exports
- Created `src/app/clips/page.tsx` - Clips management page with collections sidebar
- Created `src/app/clips/[token]/page.tsx` - Public clip viewer page with viral CTA
- Created `src/hooks/useDebounce.ts` - Custom React hook for debounced search
- Modified `src/app/meeting/[id]/summary/page.tsx` - Added "Create Clip" button and ClipCreator modal integration

**Key Features:**
- Visual transcript segment selection with start/end markers
- Clip metadata (title, description, tags)
- Collections for organizing clips (e.g., "Objection Handling")
- Public sharing with view count tracking
- Viral CTA on public clip pages
- Search, filter, and pagination for clip management

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 217 pre-existing warnings)

---

### [x] Task 2.3: Slack Notifications - COMPLETE
**Priority:** P1
**Estimate:** Small (2-3 days)
**Spec:** `specs/team_collaboration.md` Section 7
**Files:** `src/lib/slack/`, `src/app/api/integrations/slack/`
**Completed:** 2026-01-23

Send notifications to Slack when meetings end.

**Requirements:**
- Slack OAuth integration (scopes: `chat:write`, `channels:read`)
- Configure notification channel via channel picker
- Post meeting summary on meeting end (title, duration, key points, links)
- Optional: Post alerts when specific triggers detected (competitor, pricing)
- Settings UI in `/settings` page

**Implementation Notes:**
- Created `supabase/migrations/00019_add_integrations.sql` - Migration for integrations table with types, RLS policies, and unique constraint
- Added to `src/types/database.ts` - IntegrationType, IntegrationStatus, SlackIntegrationSettings, Integration, IntegrationInsert, IntegrationUpdate, Database.integrations
- Added to `src/lib/api/validation.ts` - integrationTypeSchema, integrationStatusSchema, slackSettingsSchema, updateSlackSettingsSchema, slackOAuthCallbackSchema
- Added to `src/lib/api/rate-limit.ts` - integrationsRead (100/min), integrationsWrite (30/min), slackTest (10/min) rate limit categories
- Created `src/app/api/integrations/slack/authorize/route.ts` - GET endpoint to start OAuth flow, generates state with user ID
- Created `src/app/api/integrations/slack/callback/route.ts` - GET endpoint to handle OAuth callback, exchange code for token, encrypt and store
- Created `src/app/api/integrations/slack/route.ts` - GET (status), PATCH (settings), DELETE (disconnect) endpoints
- Created `src/app/api/integrations/slack/test/route.ts` - POST endpoint to send test notification to configured channel
- Created `src/lib/slack/client.ts` - postSlackMessage, postMeetingSummary, postSignalAlert functions with Block Kit formatting
- Created `src/lib/slack/index.ts` - Module exports
- Modified `src/app/settings/page.tsx` - Added Integrations tab with Slack settings card, connection status, channel input, notification toggles, test button
- Modified `src/app/api/webhooks/recall/route.ts` - Added sendSlackMeetingNotification function called on meeting end

**Environment Variables Required:**
- SLACK_CLIENT_ID - Slack OAuth app client ID
- SLACK_CLIENT_SECRET - Slack OAuth app client secret
- TOKEN_ENCRYPTION_KEY - For encrypting access tokens at rest

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 220 pre-existing warnings)

---

## Phase 3: Conversation Intelligence (P0)

Build Robin's "memory" - understand relationships across multiple meetings.

### [x] Task 3.1: Contact Entity & Meeting Linking - COMPLETE
**Priority:** P0
**Estimate:** Medium (3-5 days)
**Spec:** `specs/conversation_intelligence.md` Section 2
**Files:** `src/lib/contacts/`, `src/app/api/contacts/`
**Completed:** 2026-01-23

Create a contact entity that links meetings with the same person.

**Requirements:**
- Auto-create contacts from meeting participants on meeting end
- Match by email first, then fuzzy match by name within same company
- Skip self and internal participants (same domain as user)
- Manual contact merge/split for deduplication
- Aggregate stats: meeting_count, total_minutes, first/last meeting
- Link meetings to contacts with roles (prospect, champion, decision_maker, etc.)

**Implementation Notes:**
- Created `supabase/migrations/00012_add_contacts.sql` - Migration for contacts table with RLS policies and meeting_contacts junction table
- Modified `src/types/database.ts` - Added ContactRole, Contact, MeetingContact, ContactInsert, MeetingContactInsert, ContactUpdate, MeetingContactUpdate types
- Modified `src/lib/api/validation.ts` - Added contactRoleSchema, listContactsQuerySchema, createContactSchema, updateContactSchema, mergeContactsSchema, linkMeetingContactSchema
- Modified `src/lib/api/rate-limit.ts` - Added contactsRead and contactsWrite rate limit categories
- Created `src/lib/contacts/extractor.ts` - Contact extraction service with email matching, fuzzy name matching (Levenshtein distance), merge contacts, recalculate aggregates
- Created `src/lib/contacts/index.ts` - Module exports
- Created `src/app/api/contacts/route.ts` - GET (list with search/filter/sort/pagination), POST (create manual contact)
- Created `src/app/api/contacts/[id]/route.ts` - GET (with meeting history), PATCH (update), DELETE
- Created `src/app/api/contacts/[id]/meetings/route.ts` - GET (list meetings for contact)
- Created `src/app/api/contacts/merge/route.ts` - POST (merge two contacts)
- Modified `src/app/api/webhooks/recall/route.ts` - Integrated contact extraction on meeting end (async, fire-and-forget)

**Deferred to Task 3.3 (Conversation History View):**
- ContactCard component for meeting views (UI component, belongs with contact list/detail pages)

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 192 pre-existing warnings)

---

### [x] Task 3.2: Cross-Meeting Search - COMPLETE
**Priority:** P0
**Estimate:** Medium (4-5 days)
**Spec:** `specs/conversation_intelligence.md` Section 4
**Files:** `src/app/api/search/`, `src/app/search/page.tsx`
**Completed:** 2026-01-23

Search across all meetings and transcripts.

**Requirements:**
- Full-text search across transcripts with highlighting
- Filter by contact, account, date range, trigger type
- Show context around matches (headline with `<mark>` tags)
- Results grouped by meeting with hit counts
- Contextual search: global, contact-scoped, account-scoped
- Global search shortcut (Cmd+K)

**Implementation Notes:**
- Created `supabase/migrations/00013_add_transcript_search.sql` - Migration for transcript_search materialized view with GIN index, search_transcripts() RPC function, and recent_searches table with RLS
- Modified `src/types/database.ts` - Added SearchContextType, RecentSearch, TranscriptSearchResult, RecentSearchInsert types and search_transcripts function type
- Modified `src/lib/api/validation.ts` - Added searchContextTypeSchema, triggerTypeFilterSchema, searchRequestSchema, searchSuggestionsQuerySchema
- Modified `src/lib/api/rate-limit.ts` - Added transcriptSearch rate limit category (100 req/min)
- Created `src/app/api/search/route.ts` - POST endpoint for full-text search with contact enrichment
- Created `src/app/api/search/suggestions/route.ts` - GET endpoint for recent and common search suggestions
- Created `src/components/features/search/SearchResultHighlight.tsx` - Component for rendering highlighted search matches
- Created `src/components/features/search/SearchResultCard.tsx` - Search result card and meeting group header components
- Created `src/components/features/search/GlobalSearchCommand.tsx` - Cmd+K global search modal
- Created `src/components/features/search/index.ts` - Module exports
- Created `src/app/search/page.tsx` - Search page with filters, results grouped by meeting, suggestions
- Modified `src/app/layout.tsx` - Added GlobalSearchCommand to root layout

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 193 pre-existing warnings)

---

### [x] Task 3.3: Conversation History View - COMPLETE
**Priority:** P0
**Estimate:** Medium (3-5 days)
**Spec:** `specs/conversation_intelligence.md` Section 3
**Files:** `src/app/contacts/[id]/page.tsx`, `src/components/features/contacts/`
**Completed:** 2026-01-23

Show complete history with a contact across all meetings.

**Requirements:**
- Contact list page with search, filter, sort
- Contact detail page with tabs: Timeline, Insights, Notes, Ask AI
- Aggregated insights: communication style, common topics, concerns raised
- Auto-saving notes editor with markdown support
- Quick access to any meeting transcript

**Implementation Notes:**
- Created `src/app/contacts/page.tsx` - Contact list page with search (URL param support), filter tabs (All/Recent/Frequent), sort options, empty state
- Created `src/app/contacts/[id]/page.tsx` - Contact detail page with header, stats cards, and tab navigation (Timeline/Insights/Notes/Ask AI)
- Created `src/components/features/contacts/ContactCard.tsx` - Contact card component for list display with avatar, name, company, stats
- Created `src/components/features/contacts/ContactList.tsx` - Full contact list with debounced search, cursor-based pagination, load more
- Created `src/components/features/contacts/ContactTimeline.tsx` - Timeline component showing meetings chronologically with outcome badges
- Created `src/components/features/contacts/ContactInsights.tsx` - Relationship overview stats, meeting outcomes chart, placeholder for AI insights
- Created `src/components/features/contacts/ContactNotes.tsx` - Auto-saving notes editor with debounce, Cmd+S shortcut, character count
- Created `src/components/features/contacts/index.ts` - Module exports
- Modified `src/app/meeting/[id]/summary/page.tsx` - Added "View Contact" link for external participants
- Uses existing contacts API from Task 3.1 (PATCH /api/contacts/[id] for notes)
- Ask AI tab shows placeholder for Task 3.4

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 200 pre-existing warnings)

---

### [x] Task 3.4: AI Q&A Across Meetings - COMPLETE
**Priority:** P0
**Estimate:** Large (5-7 days)
**Spec:** `specs/conversation_intelligence.md` Section 5
**Files:** `src/lib/conversation-ai/`, `src/app/api/ask/`, `src/components/features/ask/`
**Completed:** 2026-01-23

Ask natural language questions about conversations with a contact.

**Requirements:**
- Chat-style interface to ask questions about past meetings
- Answers cite specific meetings with clickable timestamps
- Context scoping: single contact, single account, or all meetings
- Suggested questions based on context
- Store Q&A history for analytics and learning
- Example queries:
  - "What pricing concerns has John mentioned?"
  - "When did we last discuss the API integration?"
  - "What competitors has this account mentioned?"

#### Sub-tasks (broken down for incremental delivery):

##### [x] Task 3.4.1: Database & Core Infrastructure - COMPLETE
**Estimate:** 1 day
**Completed:** 2026-01-23
**Files:** `supabase/migrations/00014_*.sql`, `src/types/database.ts`, `src/lib/api/validation.ts`, `src/lib/api/rate-limit.ts`

- [x] Create `qa_interactions` table migration with RLS policies
- [x] Add TypeScript types (QAInteraction, Citation, etc.)
- [x] Add Zod validation schemas (askQuestionSchema, feedbackSchema)
- [x] Add rate limit category (qaAsk: 30 req/min, qaSuggestions: 100 req/min)

##### [x] Task 3.4.2: Core AI Services - COMPLETE
**Estimate:** 2 days
**Completed:** 2026-01-23
**Files:** `src/lib/conversation-ai/`

- [x] Create `query-builder.ts`: Convert question to multiple search queries with weights
- [x] Create `context-assembler.ts`: Gather top-k relevant transcript segments, dedupe, rank
- [x] Create `answer-generator.ts`: Generate answer with Claude Sonnet + citations
- [x] Create `index.ts`: Module exports with high-level `askQuestion()` function

##### [x] Task 3.4.3: API Endpoints - COMPLETE
**Estimate:** 1 day
**Completed:** 2026-01-23
**Files:** `src/app/api/ask/`

- [x] Create `POST /api/ask` - Main Q&A endpoint
- [x] Create `GET /api/ask/suggestions` - Context-aware suggested questions
- [x] Create `POST /api/ask/[id]/feedback` - Rate answer helpfulness
- [ ] Create `GET /api/ask/history` - Get Q&A history (deferred - not critical for MVP)

##### [x] Task 3.4.4: AskPanel UI Component - COMPLETE
**Estimate:** 2 days
**Completed:** 2026-01-23
**Files:** `src/components/features/ask/`

- [x] Create `AskPanel.tsx` - Chat-style interface with message bubbles
- [x] Create `Citation.tsx` - Clickable citation with meeting link
- [x] Create `SuggestedQuestions.tsx` - Question suggestion chips
- [x] Create `ConfidenceIndicator.tsx` - Visual confidence display
- [x] Create `FeedbackButtons.tsx` - Thumbs up/down feedback
- [x] Create `index.ts` - Module exports

**Implementation Notes:**
- Created chat-style Q&A interface following existing UI patterns (AIProcessingIndicator, RecommendationCard feedback buttons)
- AskPanel supports contact/account/meeting scoping via QAContext prop
- Components integrate with existing API endpoints (POST /api/ask, GET /api/ask/suggestions, POST /api/ask/[id]/feedback)
- All components use memo() for performance optimization
- Loading state shows animated spinner with contextual message
- Empty state provides helpful guidance based on context scope
- Citation component shows quoted text with meeting reference and navigation
- ConfidenceIndicator shows color-coded progress bar with percentage and source count
- FeedbackButtons with thumbs up/down, disabled after feedback given
- SuggestedQuestions shows category icons and clickable chips

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors in ask components, 199 pre-existing warnings)

##### [x] Task 3.4.5: Integration - COMPLETE
**Estimate:** 1 day
**Completed:** 2026-01-23
**Files:** `src/app/contacts/[id]/page.tsx`, `src/app/search/page.tsx`, `src/app/meeting/[id]/summary/page.tsx`

- [x] Integrate AskPanel into Contact page "Ask AI" tab (scoped to contact)
- [x] Integrate AskPanel into Search page (global scope with toggle)
- [x] Integrate AskPanel into Meeting summary page (scoped to meeting)
- [ ] Account page integration deferred to Task 4.2

**Implementation Notes:**
- Modified `src/app/contacts/[id]/page.tsx` - Replaced placeholder in "Ask AI" tab with AskPanel component scoped to contact_id. Fixed height at 600px for consistent UX.
- Modified `src/app/search/page.tsx` - Added "Ask Robin" toggle button alongside filters. Shows collapsible AskPanel with global scope (no context filter). Height set to 400px for balanced layout.
- Modified `src/app/meeting/[id]/summary/page.tsx` - Added collapsible "Ask Robin About This Meeting" section after participants. Uses meeting_ids context to scope Q&A to the specific meeting.
- All integrations include proper navigation callback to jump to transcript with timestamp: `router.push(\`/meeting/${meetingId}/notes?t=${timestamp}\`)`
- Added useAuth hook and useRouter where needed for user ID and navigation

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 199 pre-existing warnings)

---

### [x] Task 3.5: Contact AI Insights - COMPLETE
**Priority:** P0
**Estimate:** Medium (3-4 days)
**Spec:** `specs/conversation_intelligence.md` Section 3.3
**Files:** `src/lib/contact-insights/`, `src/app/api/contacts/[id]/insights/`, `src/components/features/contacts/ContactInsights.tsx`
**Completed:** 2026-01-23

Generate AI-powered insights about contacts based on meeting history.

**Requirements:**
- Aggregate personality analyses from multiple meetings
- Synthesize communication style profile using Claude Haiku
- Extract common topics discussed across meetings
- Identify concerns raised from signals (price_concern, objection_raised, etc.)
- Cache insights in contact metadata with 24-hour TTL
- Display in ContactInsights component with visual representations

**Implementation Notes:**
- Created `src/lib/contact-insights/types.ts` - Type definitions for CommunicationStyle, TopicMention, ConcernRaised, ContactInsightsResult, ContactInsightsMetadata
- Created `src/lib/contact-insights/analyzer.ts` - ContactInsightsAnalyzer class with:
  - generateInsights() - Main entry point, gathers data and synthesizes
  - gatherPersonalityData() - Collects personality analyses from meeting metadata
  - gatherSignalsData() - Collects concern-related signals
  - gatherTopicsData() - Extracts topics from triggers and detected interests
  - synthesizeCommunicationStyle() - Uses Claude Haiku to synthesize multiple analyses
  - aggregateTopics() - Counts and ranks topics by frequency
  - extractConcerns() - Groups and ranks concerns from signals
  - storeInsights() - Caches results in contact metadata JSONB field
- Created `src/lib/contact-insights/index.ts` - Module exports with generateContactInsights() convenience function
- Created `src/app/api/contacts/[id]/insights/route.ts` - GET (cached or generate), POST (force regenerate)
- Modified `src/components/features/contacts/ContactInsights.tsx` - Added AI insights section with:
  - Communication style display with primary/secondary type badges
  - Dimension sliders (Analytical/Intuitive, Reserved/Expressive, Task/Relationship)
  - Coaching recommendation display
  - Common topics as chips with mention counts
  - Concerns raised with type icons and frequency
  - Loading, error, and insufficient data states
- Modified `src/app/contacts/[id]/page.tsx` - Pass contactId prop to ContactInsights component

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 224 pre-existing warnings)

---

## Phase 4: Account Intelligence (P1)

Roll up contact intelligence to account level.

### [x] Task 4.1: Account/Company Entity - COMPLETE
**Priority:** P1
**Estimate:** Small (2-3 days)
**Spec:** `specs/account_intelligence.md` Section 2
**Files:** `src/lib/accounts/`, `src/app/api/accounts/`
**Completed:** 2026-01-23

Group contacts by company for account-level views.

**Requirements:**
- Auto-create accounts from contact email domains (skip personal domains)
- Manual account creation and contact assignment
- Account profile with company info and deal tracking
- Health score calculation (recency, frequency, engagement, momentum)
- Link contacts to accounts via `account_id` FK

**Implementation Notes:**
- Created `supabase/migrations/00016_add_accounts.sql` - Migration for accounts table with RLS policies, account_stage/company_size/risk_level/crm_type enums, added account_id FK to contacts table
- Modified `src/types/database.ts` - Added AccountStage, CompanySize, RiskLevel, CRMType types, Account, AccountInsert, AccountUpdate interfaces, added account_id to Contact interface
- Modified `src/lib/api/validation.ts` - Added accountStageSchema, companySizeSchema, riskLevelSchema, crmTypeSchema, listAccountsQuerySchema, createAccountSchema, updateAccountSchema, updateAccountStageSchema
- Modified `src/lib/api/rate-limit.ts` - Added accountsRead (100/min), accountsWrite (30/min) rate limit categories
- Created `src/lib/accounts/extractor.ts` - Account extraction service with domain matching, health score calculation, aggregate functions
- Created `src/lib/accounts/index.ts` - Module exports
- Created `src/app/api/accounts/route.ts` - GET (list with search/filter/sort/pagination), POST (create manual account)
- Created `src/app/api/accounts/[id]/route.ts` - GET (with contacts and health breakdown), PATCH (update), DELETE
- Created `src/app/api/accounts/[id]/stage/route.ts` - POST update deal stage
- Created `src/app/api/accounts/[id]/health/route.ts` - GET health score breakdown with recommendations
- Created `src/app/api/accounts/[id]/contacts/route.ts` - GET list contacts at account
- Modified `src/app/api/webhooks/recall/route.ts` - Integrated account extraction after contact extraction

**Key Features:**
- Auto-creation of accounts from contact email domains (skips personal emails)
- Health score calculation with 4 factors (recency, frequency, engagement, momentum)
- Risk level derived from health score (high <40, medium 40-69, low 70+)
- Account aggregates rolled up from linked contacts
- Health score recommendations for improving engagement

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 203 pre-existing warnings)

---

### [x] Task 4.2: Account Timeline View - COMPLETE
**Priority:** P1
**Estimate:** Medium (3-4 days)
**Spec:** `specs/account_intelligence.md` Section 3
**Files:** `src/app/accounts/[id]/page.tsx`
**Completed:** 2026-01-23

Show all activity with an account across contacts.

**Requirements:**
- Account list page with health indicators (green/yellow/red)
- Account detail page with tabs: Contacts, Timeline, Signals, Notes, Ask AI
- Combined meeting timeline across all contacts at the account
- Deal stage visualization (progress bar)
- Health score display with breakdown

**Implementation Notes:**
- Created `src/app/accounts/page.tsx` - Accounts list page with search, filter tabs (All/Active/At Risk), sort options
- Created `src/app/accounts/[id]/page.tsx` - Account detail page with header, stats, deal stage progress bar, and 5 tabs
- Created `src/components/features/accounts/AccountCard.tsx` - Account card with logo, health score badge, stats, stage, deal value
- Created `src/components/features/accounts/AccountList.tsx` - Full list component with pagination, search, filters
- Created `src/components/features/accounts/AccountTimeline.tsx` - Timeline grouped by month with contact attribution
- Created `src/components/features/accounts/AccountContacts.tsx` - Contacts list with avatar, stats, links
- Created `src/components/features/accounts/AccountNotes.tsx` - Auto-saving notes editor with Cmd+S shortcut
- Created `src/components/features/accounts/AccountSignals.tsx` - Placeholder for Task 4.3
- Created `src/components/features/accounts/index.ts` - Module exports
- Created `src/app/api/accounts/[id]/meetings/route.ts` - API endpoint for account meetings across all contacts
- Modified `src/app/contacts/[id]/page.tsx` - Added "View Account" link for contacts with account_id

**Key Features:**
- Health score display with color coding (green 70+, yellow 40-69, red <40)
- Deal stage progress bar visualization
- Multi-contact timeline aggregation with contact attribution per meeting
- AskPanel integration for AI Q&A scoped to account
- Signals tab placeholder ready for Task 4.3

**Validation:**
- `npm run test` - PASS (2207 tests, 2205 passing, 2 skipped)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 208 pre-existing warnings)

---

### [x] Task 4.3: Signal Aggregation Dashboard - COMPLETE
**Priority:** P1
**Estimate:** Medium (4-5 days)
**Spec:** `specs/account_intelligence.md` Section 4-5
**Files:** `src/app/api/signals/`, `src/app/signals/page.tsx`
**Completed:** 2026-01-23

Surface important signals across all accounts.

**Requirements:**
- Dashboard showing signals that need attention, prioritized
- Signal types: competitor_mention, price_concern, budget_approved, timeline_concern, etc.
- Priority levels: critical, high, medium, low
- Filterable by account, contact, type, priority, date
- Mark as handled with action tracking
- Signal summary statistics

**Signal Types:** (see spec Section 5.3 for full list)
- `competitor_mention` - Competitor named (default: high)
- `price_concern` - Budget/cost objection (default: medium)
- `budget_approved` - Budget confirmed (positive signal)
- `timeline_concern` - Deadline urgency (default: high)
- `risk_indicator` - Deal at risk (default: high)
- `objection_raised` - Concern or blocker (default: medium)

#### Sub-tasks (broken down for incremental delivery):

##### [x] Task 4.3.1: Database & Core Infrastructure - COMPLETE
**Estimate:** 1 day
**Completed:** 2026-01-23

- [x] Create `signals` table migration with RLS policies (`supabase/migrations/00017_add_signals.sql`)
- [x] Add TypeScript types (SignalType, SignalPriority, Signal, SignalInsert, SignalUpdate)
- [x] Add Zod validation schemas (signalTypeSchema, signalPrioritySchema, listSignalsQuerySchema, createSignalSchema, updateSignalSchema, handleSignalSchema)
- [x] Add rate limit categories (signalsRead: 100/min, signalsWrite: 30/min)

**Implementation Notes:**
- Created `supabase/migrations/00017_add_signals.sql` - Migration for signals table with signal_type and signal_priority enums, RLS policies, and indexes for dashboard queries
- Modified `src/types/database.ts` - Added Signal types, interfaces, and Database table definition
- Modified `src/lib/api/validation.ts` - Added signal validation schemas
- Modified `src/lib/api/rate-limit.ts` - Added signalsRead and signalsWrite rate limit categories

##### [x] Task 4.3.2: Signal Extraction Service - COMPLETE
**Estimate:** 1 day
**Completed:** 2026-01-23

- [x] Create signal extraction service with trigger → signal mapping
- [x] Implement priority calculation based on signal type, confidence, and account stage
- [x] Create signal extraction integration in recommendation pipeline
- [x] Update webhook handler to pass organization_id for signal extraction

**Implementation Notes:**
- Created `src/lib/signals/extractor.ts` - Signal extraction service with:
  - TRIGGER_TO_SIGNAL_TYPE mapping (QUESTION doesn't produce signals, others map appropriately)
  - calculateSignalPriority() - Escalates priority based on account stage (competitor mentions are critical in negotiation)
  - extractSignalContext() - Extracts context from triggers (competitor names, etc.)
  - createSignalFromTrigger() - Creates signal records from trigger events
  - extractSignalsFromTriggers() - Batch extraction with meeting context
  - handleSignal() - Mark signal as handled with action tracking
  - getSignalSummary() - Signal counts by type for dashboard
  - getUnhandledSignalCount() - Count of unhandled signals
- Created `src/lib/signals/index.ts` - Module exports
- Modified `src/lib/recommendations/pipeline.ts` - Integrated signal extraction after trigger detection (fire-and-forget pattern)
- Modified `src/app/api/webhooks/recall/route.ts` - Added users join to meeting query for organization_id, passed to handleTranscript and pipeline

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, 209 pre-existing warnings)

##### [x] Task 4.3.3: API Routes - COMPLETE
**Estimate:** 1 day
**Completed:** 2026-01-23
**Files:** `src/app/api/signals/`

- [x] Create `GET /api/signals` - List with filters, search, and pagination
- [x] Create `GET /api/signals/[id]` - Get single signal details with related entities
- [x] Create `PATCH /api/signals/[id]` - Update priority and notes
- [x] Create `POST /api/signals/[id]/handle` - Mark handled with action
- [x] Create `GET /api/signals/summary` - Dashboard summary (counts by type, priority, recent signals)

**Implementation Notes:**
- Created `src/app/api/signals/route.ts` - GET endpoint with cursor-based pagination, search, filters (unhandled/handled/critical/this_week), type/priority filters, entity filters (account_id/contact_id/meeting_id), date range filters
- Created `src/app/api/signals/[id]/route.ts` - GET for signal details with joins to accounts/contacts/meetings, PATCH for priority/notes updates
- Created `src/app/api/signals/[id]/handle/route.ts` - POST to mark signal handled with action_taken and notes
- Created `src/app/api/signals/summary/route.ts` - GET for dashboard data with counts by type/priority, handling rate, critical unhandled count, recent unhandled signals
- All endpoints follow existing patterns: rate limiting, authentication, validation, error handling
- Used existing signalsRead/signalsWrite rate limit categories

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, pre-existing warnings only)

##### [x] Task 4.3.4: Signal Dashboard UI - COMPLETE
**Estimate:** 1.5 days
**Completed:** 2026-01-23
**Files:** `src/app/signals/page.tsx`, `src/components/features/signals/`

- [x] Create `/signals` dashboard page
- [x] Create SignalCard component with type icons, context, and actions
- [x] Create SignalList component with filtering and pagination
- [x] Create HandleSignalDialog component for marking signals as handled
- [x] Add signal summary stats section

**Implementation Notes:**
- Created `src/components/features/signals/SignalCard.tsx` - Signal card with type icons/labels, priority badges, content snippet, account/contact links, handled status, and action buttons
- Created `src/components/features/signals/HandleSignalDialog.tsx` - Dialog for marking signals handled with action selection (sent battle card, scheduled follow-up, etc.) and notes
- Created `src/components/features/signals/SignalList.tsx` - Full list component with search, filter tabs (All/Unhandled/Handled/Critical/This Week), sort options, cursor-based pagination, and summary stats
- Created `src/components/features/signals/index.ts` - Module exports
- Created `src/app/signals/page.tsx` - Dashboard page with header, navigation, and SignalList with showSummary enabled
- All components follow existing patterns: debounced search, cursor-based pagination, loading/error/empty states, memo() optimization

##### [x] Task 4.3.5: Account Page Integration - COMPLETE
**Estimate:** 0.5 days
**Completed:** 2026-01-23
**Files:** `src/components/features/accounts/AccountSignals.tsx`

- [x] Update AccountSignals.tsx (currently placeholder) with real signals data
- [x] Show account-specific signals in timeline view

**Implementation Notes:**
- Modified `src/components/features/accounts/AccountSignals.tsx` - Replaced placeholder with SignalList component scoped to account_id, with hideAccount=true and link to full signals dashboard
- Modified `src/app/accounts/[id]/page.tsx` - Added userId, accountId, and accountName props to AccountSignals component

**Validation:**
- `npm run test` - PASS (2205 tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS (0 errors, pre-existing warnings only)

---

### [x] Task 4.4: Signal Notifications - COMPLETE
**Priority:** P1
**Estimate:** Small (1-2 days)
**Spec:** `specs/account_intelligence.md` Section 8
**Files:** `src/lib/email/signal.ts`, `src/lib/signals/notifier.ts`
**Completed:** 2026-01-23

Notify users when important signals are detected.

**Requirements (from spec Section 8.1):**
- Critical signal created → In-app (toast) + Email notification
- High priority signal created → In-app (toast) notification
- Signal aging > 48h → Email digest (deferred - requires cron job)
- Account health dropped → In-app notification (deferred - covered by health endpoint)
- Slack signal alerts for users with integration enabled

**Implementation Notes:**
- Created `src/lib/email/signal.ts` - Signal notification email template with priority-based styling
- Created `src/lib/signals/notifier.ts` - Central notification coordinator (email + Slack)
- Modified `src/lib/signals/extractor.ts` - Integrated notifier after signal creation
- Modified `src/app/settings/page.tsx` - Added email notification preferences
- Added `notify_signal_email` field to user preferences

**Key Features:**
- Email notifications for critical signals with meeting context and action link
- Slack signal alerts using existing `postSignalAlert()` function
- Real-time toast notifications via Supabase broadcast
- User-configurable notification preferences in settings

**Validation:**
- `npm run test` - PASS
- `npm run typecheck` - PASS
- `npm run lint` - PASS

---

## Phase 5: Reliability Infrastructure - COMPLETE

All reliability infrastructure from `specs/reliability.md` has been implemented.

### [x] Task 5.1: Core Reliability Infrastructure - COMPLETE
**Priority:** P0
**Spec:** `specs/reliability.md`
**Completed:** Pre-existing implementation

**Implemented Components:**
- `src/lib/circuit-breaker/index.ts` - Circuit breaker pattern with service-specific configurations (Recall, Deepgram, Claude, OpenAI, Supabase)
- `src/lib/utils/retry.ts` - Exponential backoff with jitter (0-30%), configurable max attempts
- `src/lib/utils/timeout.ts` - Operation timeout wrapper with predefined constants
- `src/lib/health/` - Health check framework with individual service checks and aggregate endpoint
- `src/app/api/health/route.ts` - Aggregate health endpoint (200 healthy/degraded, 503 unhealthy)
- `src/lib/errors/error-logger.ts` - Error logging with Sentry and PostHog integration
- `src/lib/errors/recovery.ts` - Error recovery strategies

**Status:** All Phase 1-5 items from the spec checklist are complete. Phase 6 (chaos testing) is deferred.

---

## Implementation Order

**Week 1-2: Team Foundation**
1. Task 1.1: Organization Admin UI
2. Task 1.2: Team Member Invitation Flow
3. Task 1.3: Shared Knowledge Base ✓

**Week 3-4: Conversation Intelligence Core**
4. Task 3.1: Contact Entity & Meeting Linking
5. Task 3.2: Cross-Meeting Search
6. Task 3.3: Conversation History View

**Week 5-6: AI Q&A & Sharing**
7. Task 3.4: AI Q&A Across Meetings
8. Task 2.1: Meeting Sharing with Permissions

**Week 7-8: Growth & Intelligence**
9. Task 2.2: Shareable Meeting Clips
10. Task 2.3: Slack Notifications
11. Task 4.1: Account/Company Entity
12. Task 4.2: Account Timeline View
13. Task 4.3: Signal Aggregation Dashboard

---

## Agent Workflow

### Claiming a Task
1. Find an unclaimed task (empty `[ ]`) in the Task Index
2. Check the box `[x]` to claim it
3. Read requirements completely before starting

### Working on a Task
1. **Read the task requirements completely**
2. **Check existing code** for patterns to follow
3. **Implement incrementally** - small commits
4. **Write tests** as specified
5. **Run validation**: `npm run test && npm run typecheck && npm run lint`

### Completing a Task
1. Update the Task Index: change `[x]` to `[x] COMPLETE`
2. Add implementation notes below the task:

```markdown
### [x] Task X.X: [Name] - COMPLETE
**Completed:** 2026-XX-XX
**Agent:** <agent-id>

**Implementation Notes:**
- Created `path/to/file.ts` - description
- Modified `path/to/file.ts` - what changed
- Tests: X new tests, all passing

**Validation:**
- `npm run test` - PASS (X tests)
- `npm run typecheck` - PASS
- `npm run lint` - PASS
```

---

## Architecture Reference

### Existing Tables to Leverage
- `organizations` - Already exists, needs admin UI
- `users` - Has `organization_id` foreign key
- `meetings` - Core meeting data
- `transcripts` - Real-time transcript segments
- `meeting_participants` - Participant data for contact extraction

### New Tables Summary
| Table | Spec | Purpose |
|-------|------|---------|
| `organization_members` | team_collaboration.md §2 | Org membership with roles (owner/admin/member) |
| `organization_invitations` | team_collaboration.md §3 | Team invitations with tokens |
| `meeting_shares` | team_collaboration.md §4 | Meeting sharing with permissions |
| `clips` | team_collaboration.md §5 | Shareable transcript clips |
| `clip_collections` | team_collaboration.md §5 | Clip organization |
| `clip_collection_items` | team_collaboration.md §5 | Clip-collection junction |
| `integrations` | team_collaboration.md §7 | Slack and other integrations |
| `contacts` | conversation_intelligence.md §2 | Contact entity with aggregates |
| `meeting_contacts` | conversation_intelligence.md §2 | Meeting-contact junction with roles |
| `qa_interactions` | conversation_intelligence.md §5 | AI Q&A history |
| `accounts` | account_intelligence.md §2 | Company entity with health score |
| `signals` | account_intelligence.md §4 | Aggregated signals from triggers |

### Schema Changes to Existing Tables
| Table | Change | Spec |
|-------|--------|------|
| `knowledge_bases` | Add `is_shared`, `shared_at`, `shared_by` | team_collaboration.md §6 |
| `contacts` | Add `account_id` FK | account_intelligence.md §2 |

### Key Patterns
- Use existing Supabase RLS patterns for authorization
- Follow existing API route structure (validation, rate limiting)
- Use existing UI components (cards, tables, forms)
- Leverage existing realtime broadcast for live updates

---

## Notes

- Focus on frictionless UX - sharing should be one click
- Contact extraction runs async, doesn't block webhook
- AI Q&A uses existing RAG infrastructure
- All new features respect organization boundaries
- Team features unlock growth through viral adoption
