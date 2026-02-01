# Podcast Publishing Automation - Task Breakdown

This document outlines the vision and tasks for automating the programmier.bar podcast publishing workflow. The goal is to reduce manual labor through AI-powered automation while maintaining quality through human review checkpoints.

---

## Implementation Progress

> Last updated: 2026-02-01

### Completed Phases

#### Phase 1: CMS Schema & Calendar Views ✅
- **1.1** Planning fields added to Podcast collection (`recording_date`, `planned_publish_date`, `publishing_status`)
- **1.2** Recording calendar view created in Directus
- **1.3** Publishing calendar view created in Directus
- **1.4** Speaker portal fields added (`portal_token`, `portal_token_expires`, `portal_submission_status`, etc.)

#### Phase 2: Transcription Pipeline (Partial)
- **2.1** ✅ Transcription services researched (Deepgram, AssemblyAI evaluated)
- Transcript upload workflow implemented via Directus hook for manual Riverside transcript uploads
- Automatic transcription from audio not yet implemented

#### Phase 3: AI Content Generation ✅
- **3.1** ✅ Shownotes style analyzed
- **3.2** ✅ Shownotes generation prompt designed
- **3.3** ✅ `podcast_generated_content` collection created with fields:
  - `podcast_id`, `content_type`, `generated_text`, `status`, `generated_at`, `llm_model`, `prompt_version`
  - Status simplified to two states: `generated` and `approved`
- **3.4** ✅ Social media post prompts designed (LinkedIn, Instagram, Bluesky, Mastodon)
- **3.5** ✅ Content generation implemented as Directus hook (`content-generation`) using Google Gemini API
  - Triggers when `publishing_status` changes to `transcript_ready`
  - Generates shownotes and social media posts from transcript
- **3.6** ✅ Content review interface: O2M relation allows viewing/editing generated content directly in podcast edit page
- **3.7** ✅ Approval workflow implemented as Directus hook (`content-approval`):
  - Copies approved shownotes to podcast `description` field
  - Updates podcast `publishing_status` to `approved` when all content is approved

#### Phase 5: Speaker Self-Service Portal ✅
- **5.2** ✅ Token generation flow implemented
- **5.3** ✅ Speaker portal frontend page created (`/speaker-portal`)
- **5.4** ✅ Email notification hook implemented (`speaker-portal-notifications`)
  - Sends invitation email when token is generated
  - Sends confirmation email to speaker upon submission
  - Sends admin notification when speaker submits
- **5.5** ✅ Portal submission endpoint complete (`/api/speaker-portal/submit`)
- **5.7** ✅ Deadline reminder system implemented
  - Scheduled task runs daily at 9:00 AM
  - Sends reminders 3 days and 1 day before deadline

#### Phase 7: Heise.de Integration ✅
- **7.1** ✅ Heise fields added to Podcast collection
- **7.2** ✅ Heise document specification created (`directus-cms/docs/heise_document_spec.md`)
- **7.3** ✅ Document generation hook implemented (`heise-integration`)
  - Triggers when `heise_eligible` is set to true AND shownotes are approved
  - Generates HTML document from podcast data
  - Stores document in `podcast_generated_content` collection
- **7.5** ✅ Email sending hook implemented
  - Triggers when `heise_document_status` changes to `approved`
  - Sends formatted HTML email to Heise contact
  - Updates status to `sent` and records timestamp

### Key Files Created/Modified

**Directus Extension Hooks:**
- `directus-cms/extensions/.../src/content-generation/index.ts` - AI content generation from transcripts
- `directus-cms/extensions/.../src/content-approval/index.ts` - Approval workflow automation
- `directus-cms/extensions/.../src/podcast-transcript/index.ts` - Transcript upload handling
- `directus-cms/extensions/.../src/speaker-portal-notifications/index.ts` - Speaker portal email notifications
- `directus-cms/extensions/.../src/speaker-portal-notifications/emailTemplates.ts` - Email HTML templates
- `directus-cms/extensions/.../src/speaker-portal-notifications/sendEmail.ts` - SMTP email utility
- `directus-cms/extensions/.../src/heise-integration/index.ts` - Heise document generation and email hook
- `directus-cms/extensions/.../src/heise-integration/documentGenerator.ts` - Heise document template generator
- `directus-cms/extensions/.../src/heise-integration/sendEmail.ts` - SMTP email utility for Heise

**Documentation:**
- `directus-cms/docs/heise_document_spec.md` - Heise document format specification

**Utility Scripts:**
- `directus-cms/utils/setup-flows.mjs` - Sets up Directus flows and presets
- `directus-cms/utils/setup-generated-content-relation.mjs` - Creates O2M relation for content review
- `directus-cms/utils/cleanup-old-flow.mjs` - Removes deprecated flow data

**Environment Variables Required:**
- `GEMINI_API_KEY` - For AI content generation (add to Directus .env)
- `EMAIL_SMTP_HOST` - SMTP server hostname (e.g., `smtp.gmail.com`)
- `EMAIL_SMTP_PORT` - SMTP port (default: `465`)
- `EMAIL_SMTP_USER` - SMTP username
- `EMAIL_SMTP_PASSWORD` - SMTP password
- `EMAIL_SMTP_SECURE` - Use TLS (default: `true`)
- `EMAIL_FROM` - Sender email address (default: `programmier.bar <noreply@programmier.bar>`)
- `WEBSITE_URL` - Base URL for links (default: `https://programmier.bar`)
- `ADMIN_NOTIFICATION_EMAIL` - Admin email for notifications (default: `podcast@programmier.bar`)
- `HEISE_CONTACT_EMAIL` - Heise.de editorial contact email (required for Heise integration)

### Remaining Work

- **Phase 2**: Automatic transcription from audio upload (currently manual transcript upload)
- **Phase 4**: Social media publishing automation
- **Phase 5**: Admin review interface (Directus panel for approving/rejecting speaker submissions)
- **Phase 6**: Asset production pipeline (background removal, image generation)
- **Phase 7**: Heise review interface (Directus panel for previewing/editing documents before sending)
- **Phase 8**: Hook migration and documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Recommendations](#architecture-recommendations)
3. [Phase 1: CMS Schema & Calendar Views](#phase-1-cms-schema--calendar-views)
4. [Phase 2: Transcription Pipeline](#phase-2-transcription-pipeline)
5. [Phase 3: AI Content Generation](#phase-3-ai-content-generation)
6. [Phase 4: Social Media Publishing](#phase-4-social-media-publishing)
7. [Phase 5: Speaker Self-Service Portal](#phase-5-speaker-self-service-portal)
8. [Phase 6: Asset Production Pipeline](#phase-6-asset-production-pipeline)
9. [Phase 7: Heise.de Integration](#phase-7-heisede-integration)
10. [Phase 8: Migration & Cleanup](#phase-8-migration--cleanup)

---

## Overview

### Current State

- Directus CMS manages podcast content
- Monday.com used for planning (to be retired)
- Audio files uploaded to Directus, then to Buzzsprout via hooks
- Manual transcription with speaker assignment
- Manual shownotes and social media post creation
- Manual email to Heise.de for selected episodes
- Speaker information collected manually

### Target State

- All planning happens in Directus with calendar views
- Audio upload triggers automated transcription with speaker detection
- AI generates shownotes and social media posts from transcript
- Social media posts published directly from CMS with scheduling
- Speaker self-service portal for guest information collection
- Automated asset generation from speaker images
- Automated Heise.de document generation and email sending

---

## Architecture Recommendations

### Suggested Approach: Directus Flows + External Services

**Why Directus Flows:**

- Native integration with your data model
- Visual workflow builder for non-developers to understand/modify
- Event-driven triggers (e.g., "on audio file upload")
- Built-in approval workflows via status fields
- Reduces external dependencies

**External Services (Minimal Set):**

- **Transcription**: Deepgram or AssemblyAI (both have excellent German support and speaker diarization)
- **LLM**: Gemini API (since team is familiar with it) or Claude API
- **Background Removal**: Nano Banana Pro for full asset generation pipeline
- **Social Media**: Direct platform APIs where possible, browser automation (Playwright) for LinkedIn tagging if needed
- **Email**: Existing email service or Directus mail

**Alternative: Separate Microservice**
If Flows become too complex, consider a Node.js service that:

- Listens to Directus webhooks
- Orchestrates the AI pipeline
- Writes results back to Directus via API

---

## Phase 1: CMS Schema & Calendar Views

### Context

Monday.com is being retired. Directus needs new fields and views to support podcast planning and scheduling workflows.

### Tasks

#### 1.1 Add Planning Fields to Podcast Collection

**Fields to add:**

- `recording_date` (datetime) - When the episode will be/was recorded
- `planned_publish_date` (datetime) - Target publication date
- `publishing_status` (dropdown) - Workflow status for the publishing pipeline

**Publishing Status Options:**

- `planned` - Episode is scheduled but not recorded
- `recorded` - Audio recorded, awaiting processing
- `transcribing` - Transcription in progress
- `transcript_ready` - Transcript complete, awaiting content generation
- `content_review` - Shownotes/social posts ready for review
- `approved` - Content approved, ready for publishing
- `published` - Episode is live

**Implementation Notes:**

- Use Directus schema migration or admin UI
- Update `schema.json` after changes
- These status values will drive Flows automation

#### 1.2 Create Recording Calendar View

**Requirements:**

- Calendar/timeline view showing episodes by `recording_date`
- Color-coded by `publishing_status`
- Quick access to episode details
- Ability to drag-drop reschedule (if Directus supports)

**Implementation:**

- Directus collection view with calendar option

#### 1.3 Create Publishing Calendar View

**Requirements:**

- Calendar view showing episodes by `planned_publish_date`
- Filter by status (e.g., show only "approved" episodes)
- Visual indication of episodes missing required content

#### 1.4 Update Speaker Collection Schema

**Current fields:** Academic Title, First Name, Last Name, Occupation, Bio, Profile Image, Action Image, Website URL, Twitter, Bluesky, LinkedIn, Instagram, YouTube, GitHub URL

**Fields to add:**

- `portal_token` (string, unique) - Token for self-service portal access
- `portal_token_expires` (datetime) - Token expiration
- `portal_submission_status` (dropdown) - `pending`, `submitted`, `approved`
- `portal_submission_deadline` (datetime) - Deadline for speaker to submit info

**Fields to consider splitting:**

- `Occupation` → `job_title` + `company` (separate fields for better social media tagging)

---

## Phase 2: Transcription Pipeline

### Context

When an audio file is uploaded to a podcast episode, the system should automatically generate a transcript with speaker detection. The transcript is used for the interactive website feature and as input for AI content generation.

### Current Behavior

- Audio uploaded to Directus
- Hook uploads to Buzzsprout
- Transcript created via separate service through hook

### Target Behavior

- Audio upload triggers transcription Flow
- High-accuracy German transcription generated
- Speakers detected and matched to host profiles (members collection)
- Guest speaker labeled (manually assigned beforehand)
- Transcript stored in Directus, ready for content generation

### Tasks

#### 2.1 Research & Select Transcription Service

**Requirements:**

- Excellent German language accuracy
- Speaker diarization (distinguishing different speakers)
- Timestamp support (for interactive transcript)
- Reasonable cost for ~1-2 hour episodes
- API access

**Candidates to evaluate:**

- **Deepgram**: Known for accuracy, has German support, speaker diarization
- **AssemblyAI**: Strong German model, speaker labels, good API
- **OpenAI Whisper** (via API or self-hosted): Excellent accuracy, but no native diarization
- **Google Speech-to-Text**: Good German support, speaker diarization available

**Evaluation approach:**

- Test each service with a sample German podcast episode
- Compare accuracy, especially for technical terms
- Compare speaker diarization quality
- Compare pricing

**Possible hybrid approach:**

- Use Whisper for highest accuracy transcript
- Use Deepgram/AssemblyAI for speaker diarization timestamps
- Merge results

#### 2.3 Implement Speaker Identification Logic

**Goal:** Match detected speaker labels (speaker_0, speaker_1, etc.) to actual speaker records.

**Approach:**

1. Episode has assigned hosts and guest (relations to member and speaker collection)
2. Hosts are members, guests are speakers
3. Use voice fingerprinting OR simple heuristics:
   - Option A: Voice embedding service (e.g., Pyannote, Resemblyzer) to match voices
   - Option B: LLM-based matching using context (names mentioned, introduction)
   - Option C: Manual assignment in review step (fallback)

**Recommended approach:**

- Start with Option C (manual) as baseline
- Implement Option B (LLM context matching) as enhancement
- Consider Option A only if accuracy is insufficient

**LLM matching prompt concept:**

```
Given this podcast transcript and the following speakers:
- Hosts: [Fabi, Jojo, Sebi, ...]
- Guest: [Guest Name]

The transcript has speakers labeled as speaker_0, speaker_1, etc.
Based on context clues (introductions, names mentioned, speaking patterns),
match each speaker label to the correct person.
```

#### 2.4 Create Transcription Flow in Directus

**Trigger:** Audio file uploaded to podcast episode

**Flow steps:**

1. Detect new/changed audio file on podcast
2. Update `publishing_status` to `transcribing`
3. Send audio to transcription service via HTTP request
4. Store job ID, poll for completion (or use webhook callback)
5. On completion, parse response and create transcript record
6. Run speaker identification logic
7. Update `publishing_status` to `transcript_ready`
8. On failure, set status to `failed` and log error

**Error handling:**

- Retry logic for transient failures
- Notification to admin on persistent failure
- Manual retry option

#### 2.5 Update Interactive Transcript on Website

**Context:** The Nuxt frontend displays an interactive transcript. Ensure it works with the new service.

**Tasks:**

- Review current transcript display implementation
- Update to use new `podcast_transcripts` collection
- Ensure speaker names display correctly (not "speaker_0")
- Test timestamp synchronization with audio player

---

## Phase 3: AI Content Generation

### Context

Once a transcript is available, AI should generate shownotes and social media posts. All generated content requires human review before use.

### Tasks

#### 3.1 Analyze Existing Shownotes Style

**Goal:** Create a style guide for AI to follow.

**Tasks:**

- Review 10-20 existing podcast descriptions in Directus
- Document patterns:
  - Length (word count range)
  - Structure (intro, bullet points, outro?)
  - Tone and voice
  - Technical term handling
  - Link formatting
  - Call-to-action patterns
- Create a reference document or system prompt

**Output:** `shownotes_style_guide.md` with examples and rules

**Alternative:** Instead of using a .md file, we could create a collection and fields in Directus, so that the prompts can be edited and versioned.

#### 3.2 Design Shownotes Generation Prompt

**Input:**

- Full transcript text
- Episode title
- Guest information (name, company, bio)
- Host names
- Episode type (Deep Dive, News, etc.)

**Output:**

- Episode description matching existing style
- Key topics covered (bullet points)
- Timestamps for major sections
- Mentioned resources/links (if detectable)

**Prompt engineering tasks:**

- Create base system prompt with style guide
- Create user prompt template with placeholders
- Test with various episode types
- Iterate based on quality review

#### 3.3 Create Content Generation Data Model

**New collection: `podcast_generated_content`**

- `id` (primary key)
- `podcast_id` (relation)
- `content_type` (dropdown) - `shownotes`, `social_linkedin`, `social_instagram`, `social_bluesky`, `social_mastodon`, `heise_document`
- `generated_text` (text) - AI-generated content
- `edited_text` (text) - Human-edited version (if modified)
- `status` (dropdown) - `generated`, `approved`, `rejected`, `published`
- `generated_at` (datetime)
- `approved_at` (datetime)
- `approved_by` (relation to users)
- `llm_model` (string) - Which model was used
- `prompt_version` (string) - For tracking prompt iterations

#### 3.4 Design Social Media Post Prompts

**Platforms:** LinkedIn, Instagram, Bluesky, Mastodon

**Per-platform considerations:**

- **LinkedIn:** Professional tone, can tag people/companies, longer form OK, hashtags
- **Instagram:** Visual-first (caption for image post), hashtags important, emojis acceptable
- **Bluesky:** Twitter-like, concise, character limit considerations
- **Mastodon:** Similar to Bluesky, hashtags for discoverability

**Input for prompts:**

- Shownotes/description
- Guest info (for tagging/mentioning)
- Episode link
- Key topics

**Output per platform:**

- Post text (within character limits)
- Suggested hashtags
- People/companies to tag (LinkedIn handles, usernames)
- Suggested posting time (based on platform best practices)

#### 3.5 Implement Content Generation Flow

**Trigger:** `publishing_status` changes to `transcript_ready`

**Flow steps:**

1. Fetch transcript and episode metadata
2. Call LLM API with shownotes prompt
3. Store generated shownotes in `podcast_generated_content`
4. Call LLM API for each social platform
5. Store each social post in `podcast_generated_content`
6. Update `publishing_status` to `content_review`
7. (Optional) Send notification to reviewers

**LLM API integration:**

- Use Gemini API (team familiarity) or Claude API
- Handle rate limits and errors gracefully
- Log token usage for cost monitoring

#### 3.6 Create Content Review Interface

**Requirements:**

- View all generated content for an episode
- Side-by-side comparison with transcript
- Edit capability (store as `edited_text`)
- Approve/reject buttons per content piece
- Bulk approve option
- Preview how post will look on each platform

**Implementation options:**

- Custom Directus panel extension
- Directus native interface with custom display components
- External review app (if Directus UI too limiting)

#### 3.7 Implement Approval Workflow

**Flow trigger:** Content status changed to `approved`

**Behavior:**

- When shownotes approved → Copy to podcast `description` field
- When all required content approved → Update `publishing_status` to `approved`
- Track who approved and when

---

## Phase 4: Social Media Publishing

### Context

Approved social media posts should be scheduled and published directly from the CMS. LinkedIn requires special handling for tagging.

### Tasks

#### 4.1 Research Platform APIs

**For each platform, document:**

- API availability and authentication
- Post creation endpoint
- Scheduling capability (native or via delay)
- Tagging/mentioning support
- Media upload (for images)
- Rate limits

**LinkedIn:**

- Uses OAuth 2.0, requires app approval
- Posting API available
- Tagging requires person/company URNs (need to look up from URLs)
- May need Marketing API for scheduling
- **Challenge:** Tagging may require finding URN from profile URL

**Instagram:**

- Requires Facebook Business account
- Use Instagram Graph API via Facebook
- Feed posts supported
- Scheduling available via Content Publishing API

**Bluesky:**

- AT Protocol, open API
- Direct posting supported
- Mentions use DID (decentralized identifier)

**Mastodon:**

- Standard Mastodon API
- Posting straightforward
- Instance-specific (need to know which instance)

#### 4.2 Design Social Media Scheduling Data Model

**New collection: `social_media_posts`**

- `id` (primary key)
- `podcast_id` (relation)
- `generated_content_id` (relation to `podcast_generated_content`)
- `platform` (dropdown) - `linkedin`, `instagram`, `bluesky`, `mastodon`
- `post_text` (text) - Final post text
- `media_assets` (relation to files) - Images to include
- `scheduled_for` (datetime) - When to publish
- `status` (dropdown) - `draft`, `scheduled`, `publishing`, `published`, `failed`
- `platform_post_id` (string) - ID returned by platform after publishing
- `platform_post_url` (string) - Link to published post
- `error_message` (text) - If failed
- `tags` (JSON) - People/companies to tag with platform-specific identifiers

#### 4.3 Implement LinkedIn URN Lookup

**Challenge:** LinkedIn tagging requires URN, but we store profile URLs.

**Options:**

1. **Manual URN storage:** Add `linkedin_urn` field to speaker collection, look up once manually
2. **API lookup:** Use LinkedIn API to resolve URL → URN (may have limitations)
3. **Browser automation:** Use Playwright to look up URN from profile page

**Recommended:** Option 1 (manual) for hosts, Option 3 (automation) for guests if needed

**Tasks:**

- Add `linkedin_urn` field to speaker collection
- Document process for finding URN manually
- Implement automation fallback if needed

#### 4.4 Implement Publishing Flow per Platform

**For each platform, create a Directus Flow:**

**Trigger:** `social_media_posts` record with `status: scheduled` and `scheduled_for <= now`

**Flow steps:**

1. Fetch post details and media assets
2. Authenticate with platform API
3. Upload media if needed
4. Create post with text and tags
5. Update record with `platform_post_id` and `platform_post_url`
6. Set `status: published`
7. On error, set `status: failed` and store `error_message`

**Scheduling mechanism:**

- Directus Flows don't have native cron triggers
- Options:
  - External cron job that triggers Flow via webhook
  - Directus extension for scheduled tasks
  - Separate scheduler service

#### 4.5 Implement LinkedIn Browser Automation (if needed)

**Context:** If LinkedIn API doesn't support tagging well enough.

**Approach:**

- Use Playwright (headless browser)
- Authenticate via stored session
- Navigate to post creation
- Fill in post text
- Add tags by typing @ and selecting
- Submit post

**Considerations:**

- Fragile (LinkedIn UI changes break it)
- May violate LinkedIn ToS
- Use as last resort

**Implementation:**

- Separate Node.js service
- Called via HTTP from Directus Flow
- Robust error handling and logging

#### 4.6 Create Scheduling Interface

**Requirements:**

- View all scheduled posts across platforms
- Calendar view of upcoming posts
- Drag-drop rescheduling
- Quick edit for post text
- Preview post appearance
- Manual publish now option

**Implementation:**

- Directus Insights dashboard
- Custom panel extension if needed

#### 4.7 Platform Account Configuration

**Store in Directus settings or environment:**

- LinkedIn: OAuth tokens, company page ID
- Instagram: Facebook app credentials, Instagram account ID
- Bluesky: Handle and app password
- Mastodon: Instance URL and access token

**Security:**

- Use Directus environment variables for secrets
- Document token refresh procedures

---

## Phase 5: Speaker Self-Service Portal

### Context

External guests should be able to provide their information and assets through a self-service portal. This reduces manual data collection and ensures we get the right image assets for the production pipeline.

### Tasks

#### 5.1 Design Portal User Flow

**Flow:**

1. New speaker record created in Directus (minimal info: name, email)
2. System generates unique portal token
3. Email sent to speaker with portal link
4. Speaker accesses portal via link (e.g., `https://programmier.bar/speaker-portal?token=xxx`)
5. Speaker fills out form with their information
6. Speaker uploads profile image and action/random shot
7. Speaker submits form
8. Data saved to Directus, status set to `submitted`
9. Admin reviews and approves/requests changes
10. On approval, asset pipeline triggered

#### 5.2 Implement Token Generation Flow

**Trigger:** New speaker record created (or manual trigger for existing speakers)

**Flow steps:**

1. Generate secure random token (UUID or similar)
2. Set token expiration (e.g., 14 days from now)
3. Store token and expiration in speaker record
4. Set `portal_submission_status: pending`
5. Trigger email notification (see 5.4)

#### 5.3 Create Speaker Portal Frontend

**Location:** New page in Nuxt app (e.g., `/speaker-portal`)

**Features:**

- Token validation (check exists and not expired)
- Pre-filled fields if data exists
- Form fields:
  - Academic Title (optional dropdown: Dr., Prof., etc.)
  - First Name (required)
  - Last Name (required)
  - Job Title (required)
  - Company (required)
  - Bio (required, textarea with character guidance)
  - Website URL (optional)
  - LinkedIn URL (optional, but encouraged)
  - Twitter/X URL (optional)
  - Bluesky handle (optional)
  - Instagram URL (optional)
  - YouTube URL (optional)
  - GitHub URL (optional)
- Image uploads:
  - Profile Image (required, min 800px, guidance on good photos)
  - Action/Random Shot (required, min 800px, guidance)
- Submission deadline display
- Save draft capability (optional)
- Submit button

**Validation:**

- Image minimum resolution check (client-side)
- Required field validation
- URL format validation for social links
- File type validation (JPG, PNG)

**UX considerations:**

- Mobile-friendly (speakers may use phone)
- Clear instructions for image requirements
- Example images showing good vs bad photos
- Progress indicator if multi-step

#### 5.4 Implement Portal Email Notification

**Trigger:** Token generated for speaker

**Email content:**

- Personalized greeting
- Explanation of what we need and why
- Clear deadline
- Portal link with token
- Image requirements summary
- Contact for questions

**Implementation:**

- Use Directus email or existing email service
- HTML email template
- Track email sent status

#### 5.5 Create Portal Submission Endpoint

**API route:** `POST /api/speaker-portal/submit`

**Input:**

- Token (for authentication)
- All form fields
- Uploaded images (multipart form or pre-uploaded to Directus)

**Processing:**

1. Validate token
2. Validate all required fields
3. Upload images to Directus if not already
4. Update speaker record with all data
5. Set `portal_submission_status: submitted`
6. Clear/invalidate token
7. Trigger notification to admin

**Security:**

- Rate limiting
- File size limits
- Image type verification (not just extension)

#### 5.6 Create Admin Review Interface

**Requirements:**

- List of speakers with `portal_submission_status: submitted`
- View all submitted information
- Preview uploaded images
- Approve button → sets status to `approved`, triggers asset pipeline
- Request changes button → allows sending email back to speaker
- Edit capability for minor fixes

**Implementation:**

- Directus native interface may suffice
- Custom panel extension for better UX if needed

#### 5.7 Handle Deadline Reminders

**Flow:** Scheduled check for speakers with approaching deadlines

**Actions:**

- 3 days before deadline: Send reminder email
- 1 day before deadline: Send urgent reminder
- After deadline: Notify admin of non-submission

**Implementation:**

- External cron job or scheduled Flow
- Email templates for reminders

---

## Phase 6: Asset Production Pipeline

### Context

From speaker-provided images, automatically generate various assets needed for episode promotion: cover images, portraits, social media graphics, and Heise.de banners.

### Tasks

#### 6.1 Document Asset Specifications

**Collect from design team:**

- Episode cover: dimensions, layout rules, where speaker image goes
- Speaker portrait: dimensions, cropping rules
- Heise.de banner: dimensions, layout
- Social media formats:
  - LinkedIn post image
  - Instagram feed image
  - Story format (if used later)
- File formats (JPG, PNG, WebP)
- Quality/compression settings

**Create specification document:** `asset_specifications.md`

#### 6.2 Implement Background Removal

**Purpose:** Create cutout of speaker from profile image for use in covers

**Options:**

- **remove.bg API:** High quality, paid per image
- **rembg (self-hosted):** Open source, free, good quality
- **PhotoRoom API:** Similar to remove.bg
- **Cloudinary:** Has background removal add-on
- **Nano Banana Pro** Directly prompt an LLM to generate either the transparent image or with a template the final episode cover.

**Recommended:** Start with remove.bg API (simple, high quality), consider rembg for cost optimization later

**Implementation:**

- Service/function that takes image URL/file
- Returns image with transparent background
- Store result in Directus files

#### 6.3 Design Template System

**Approach options:**

**Option A: HTML/CSS to Image**

- Create HTML templates matching Figma designs
- Use Puppeteer/Playwright to render and screenshot
- Flexible, easy to iterate
- Libraries: puppeteer, playwright, or html-to-image services

**Option B: Canvas/Sharp (Node.js)**

- Programmatically compose images using Sharp or node-canvas
- More control, no browser dependency
- More code to write

**Option C: Gen-AI Image Service (Nano Banana Pro)**

- API to generate images with variables
- Paid service, less flexibility

**Recommended:** Option A (HTML to image) for flexibility and Figma parity

**Tasks:**

- Set up Puppeteer/Playwright rendering service
- Create HTML templates for each asset type
- Support variable injection (speaker name, title, image, colors)
- Test output quality matches Figma designs

#### 6.4 Create Asset Templates

**For each asset type, create:**

- HTML template file
- CSS styles (inline or embedded for portability)
- Placeholder variables documented
- Test fixtures

**Templates needed:**

- Episode cover
- Speaker portrait (formatted/cropped)
- Heise.de banner
- LinkedIn post image
- Instagram post image
- (Future: other formats as needed)

#### 6.5 Implement Asset Generation Flow

**Trigger:** Speaker `portal_submission_status` changes to `approved`

**Flow steps:**

1. Fetch speaker record with images
2. Call background removal service on profile image
3. Store cutout image
4. For each asset type:
   a. Prepare template variables
   b. Call rendering service
   c. Store generated asset in Directus
   d. Link asset to speaker record
5. Update speaker record with generated assets
6. Notify admin of completion

**Asset storage:**

- New fields on speaker collection for generated assets, OR
- Related collection `speaker_assets` with type field

#### 6.6 Create Asset Preview Interface

**Requirements:**

- View all generated assets for a speaker
- Download individual assets
- Regenerate option (if source images updated)
- Manual upload option (for custom/override assets)

**Implementation:**

- Directus interface showing related assets
- Regenerate button triggers Flow manually

#### 6.7 Handle Asset Regeneration

**Scenarios:**

- Speaker updates their images
- Design templates are updated
- Manual regeneration requested

**Implementation:**

- Track which source images/templates were used
- Option to regenerate individual assets or all
- Keep previous versions (don't overwrite)

---

## Phase 7: Heise.de Integration

### Context

For selected episodes (usually Deep Dives), a document is sent to Heise.de who may publish the episode. This should be automated with human approval.

### Tasks

#### 7.1 Add Heise Fields to Podcast Collection

**Fields:**

- `heise_eligible` (boolean) - Whether this episode should go to Heise
- `heise_document_status` (dropdown) - `not_applicable`, `pending`, `generated`, `approved`, `sent`
- `heise_sent_at` (datetime) - When email was sent
- `heise_document` (relation to files) - Generated document

#### 7.2 Document Heise.de Requirements

**Analyze current Google Doc format:**

- Document structure
- Required metadata fields
- Formatting requirements
- File format (Google Doc, PDF, plain text email?)

**Create specification:** `heise_document_spec.md`

#### 7.3 Implement Document Generation

**Trigger:** `heise_eligible` set to true AND shownotes approved

**Generation:**

- Create document from template
- Populate with:
  - Episode title
  - Publication date
  - Hosts and guests
  - Shownotes/description
  - Episode link
  - Any other required metadata

**Output format:**

- If email body: Generate formatted text
- If attachment: Google Doc

**Implementation:**

- Template system (Handlebars, EJS, or similar)
- Store generated document in Directus

#### 7.4 Create Heise Review Interface

**Requirements:**

- View generated document
- Edit if needed (minor corrections)
- Preview as it will appear
- Approve button
- Recipient email address (pre-filled or configurable)

#### 7.5 Implement Email Sending

**Trigger:** Heise document status set to `approved`

**Flow steps:**

1. Fetch document and episode details
2. Compose email:
   - To: Heise contact email (from config)
   - Subject: Episode title or standard format
   - Body: Document content or reference
   - Attachment: If document is file
3. Send via email service
4. Update status to `sent`
5. Record timestamp

**Email service:**

- Use existing nodemailer setup
- Or Directus mail if configured

---

## Phase 8: Migration & Cleanup

### Context

Existing hooks (like Buzzsprout upload) should potentially be migrated to Flows for consistency.

### Tasks

#### 8.1 Audit Existing Hooks

**Document current hooks:**

- Location in codebase
- Trigger conditions
- What they do
- Dependencies

**Hooks to review:**

- Buzzsprout upload hook
- Any other custom hooks

#### 8.2 Plan Hook Migration to Flows

**For each hook, decide:**

- Migrate to Flow (recommended for consistency)
- Keep as hook (if complex logic not suited for Flows)
- Deprecate (if no longer needed)

**Migration approach:**

- Create equivalent Flow
- Test thoroughly
- Run both in parallel briefly
- Disable old hook
- Remove old hook code

#### 8.3 Documentation

**Create/update documentation:**

- How to use new calendar views
- Content review workflow
- Speaker portal admin guide
- Asset pipeline overview
- Heise.de process
- Troubleshooting common issues

#### 8.4 Testing Strategy

**For each phase, create:**

- Test cases for happy path
- Test cases for error conditions
- Integration test scenarios
- User acceptance criteria

**Testing environment:**

- Consider setting up staging Directus instance
- Or use feature flags to test in production carefully

---

## Appendix: Service Recommendations Summary

| Function           | Recommended Service     | Alternative                   |
| ------------------ | ----------------------- | ----------------------------- |
| Transcription      | Deepgram or AssemblyAI  | OpenAI Whisper API            |
| LLM                | Gemini API              | Claude API                    |
| Background Removal | remove.bg               | rembg (self-hosted)           |
| Image Generation   | Puppeteer HTML-to-image | Bannerbear                    |
| Social Scheduling  | Direct platform APIs    | Buffer (if APIs insufficient) |
| Email              | Existing nodemailer     | SendGrid, Resend              |

---

## Appendix: Priority Order

Based on discussion, recommended implementation order:

1. **Phase 2: Transcription Pipeline** - Foundation for all AI features
2. **Phase 3: AI Content Generation** - Immediate value from transcripts
3. **Phase 4: Social Media Publishing** - Distribute content efficiently
4. **Phase 1: CMS Schema & Calendar Views** - Can be done in parallel
5. **Phase 5: Speaker Portal** - Improves guest onboarding
6. **Phase 6: Asset Pipeline** - Builds on speaker portal
7. **Phase 7: Heise.de Integration** - Nice to have automation
8. **Phase 8: Migration & Cleanup** - Ongoing as needed

---

## Open Items & Decisions Needed

- [ ] Asset specifications from design team (Phase 6.1)
- [ ] Heise.de document format details (Phase 7.2)
- [ ] LinkedIn company page URN lookup process
- [ ] Mastodon instance URL for programmier.bar account
- [ ] Budget approval for paid services (remove.bg, transcription API)
- [ ] Staging environment setup decision
- [ ] Email templates design/copy
