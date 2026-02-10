# Asset Generation Pipeline

This document describes the automated asset generation system for podcast episodes. The system uses AI (Google Gemini) to generate visual assets like episode covers, speaker portraits, and social media images.

## Overview

The asset generation pipeline automatically creates visual assets when:
1. A speaker's portal submission is approved (`portal_submission_status` changes to `approved`)
2. An admin manually triggers regeneration by setting `regenerate_assets: true` on a podcast

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Speaker Approved   │────▶│   Asset Generation   │────▶│  Generated Assets   │
│  or Manual Trigger  │     │       Hook           │     │  Stored in Directus │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
                                      │
                                      ▼
                            ┌──────────────────────┐
                            │    Gemini API        │
                            │  (Image Generation)  │
                            └──────────────────────┘
```

## Collections

### `asset_templates`

Stores template configurations for asset generation:

| Field | Description |
|-------|-------------|
| `name` | Descriptive name for the template |
| `asset_type` | Type of asset (episode_cover, speaker_portrait, heise_banner, etc.) |
| `episode_type` | Specific episode type this template applies to (null = all types) |
| `title_contains` | Only match podcasts whose title contains this text, case-insensitive (null = all titles) |
| `active` | Whether this template is currently in use |
| `requires_speaker_image` | Whether the template needs a speaker profile image |
| `template_image` | Base template image to be modified by AI |
| `prompt_template` | AI prompt with Handlebars-style variables |
| `generation_model` | Optional override for the AI model |

### `podcast_generated_assets`

Tracks generated assets for each podcast:

| Field | Description |
|-------|-------------|
| `podcast_id` | Reference to the podcast |
| `template_id` | Reference to the template used |
| `asset_type` | Type of asset generated |
| `status` | Generation status (pending, generating, generated, failed, approved) |
| `generated_file` | Reference to the generated image file |
| `generation_prompt` | The actual prompt sent to AI (for debugging) |
| `error_message` | Error details if generation failed |

### Podcast Fields

Two fields are added to the `podcasts` collection:

| Field | Description |
|-------|-------------|
| `regenerate_assets` | Boolean flag to trigger regeneration |
| `assets_status` | Current status (not_started, generating, complete, partial, failed) |

## Generation Flow

### 1. Trigger

The hook triggers on:
- `speakers.items.update` when `portal_submission_status` becomes `approved`
- `podcasts.items.update` when `regenerate_assets` becomes `true`

### 2. Template Selection

For each podcast, the system:
1. Fetches all active templates
2. Filters templates by episode type (matches `podcast.type` or templates with `episode_type: null`)
3. Filters by `title_contains` — templates with this field set are only used when the podcast title contains the specified text (case-insensitive). Templates without `title_contains` match all podcasts of that type.
4. Skips templates requiring speaker images if no speaker image is available

### 3. Variable Substitution

Template prompts support Handlebars-style variables:

| Variable | Source |
|----------|--------|
| `{{number}}` | Episode number |
| `{{title}}` | Episode title |
| `{{episode_type}}` | Episode type (deep_dive, news, etc.) |
| `{{episode_type_display}}` | Human-readable type (Deep Dive, News, etc.) |
| `{{speaker_name}}` | Full name of the primary speaker |
| `{{speaker_occupation}}` | Speaker's job title/role |
| `{{hosts}}` | Comma-separated list of host names |

Conditional blocks are also supported:
```
{{#if speaker_name}}mit {{speaker_name}}{{/if}}
```

### 4. Image Generation

The system calls the Gemini API with:
- The rendered prompt text
- Input images (template image, speaker profile image)
- Model configuration (default: `gemini-3-pro-image-preview`)

### 5. Storage

Generated images are:
1. Uploaded to Directus file storage
2. Linked to a `podcast_generated_assets` record
3. Optionally auto-linked to the podcast (`cover_image` or `banner_image`)

### 6. Status Updates

The `assets_status` field reflects the overall result:
- `generating` - Asset generation is in progress
- `complete` - All templates generated successfully
- `partial` - Some templates succeeded, some failed
- `failed` - All templates failed

## Limitations

### Single Speaker Support

**Important:** The current implementation only uses the **first speaker** (`speakers[0]`) for asset generation. Multi-speaker episodes (e.g., panel discussions with multiple guests) will only feature the first speaker in generated assets.

This is intentional for typical Deep Dive episodes which feature a single guest speaker. For episodes with multiple speakers, consider:
- Manually creating assets that feature all speakers
- Ordering speakers in Directus so the primary guest is first

### Template Rendering

The template renderer is intentionally simple:
- Supports `{{variable}}` substitution
- Supports `{{#if variable}}...{{/if}}` conditionals
- Does **not** support nested conditionals or complex Handlebars features
- Does **not** escape HTML (not needed for AI prompts)

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for image generation |
| `STORAGE_LOCATIONS` | No | Comma-separated storage locations (default: local) |
| `STORAGE_LOCAL_ROOT` | No | Path for local file storage (default: ./uploads) |

### Default Templates

The setup script creates default templates for:
- Episode Cover - Deep Dive
- Episode Cover - News
- Speaker Portrait
- Heise Banner
- LinkedIn Post Image
- Instagram Post Image

These can be customized in the Directus admin under the `asset_templates` collection.

## Regeneration

To regenerate assets for a podcast:

1. **Via Directus Admin:**
   - Open the podcast item
   - Set "Regenerate Assets" to true
   - Save

2. **Via API:**
   ```bash
   curl -X PATCH "https://your-directus/items/podcasts/123" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"regenerate_assets": true}'
   ```

Regeneration will:
1. Delete existing `podcast_generated_assets` records for the podcast
2. Delete the associated files from `directus_files`
3. Generate new assets using current templates

## Troubleshooting

### Assets not generating

1. Check that `GEMINI_API_KEY` is set in the Directus environment
2. Verify templates are marked as `active: true`
3. Check the Directus logs for error messages
4. Review the `error_message` field in `podcast_generated_assets`

### Partial generation

If `assets_status` shows `partial`:
1. Check `podcast_generated_assets` for failed records
2. Review the `error_message` field for each failure
3. Common causes:
   - Missing speaker image for templates that require it
   - Gemini API rate limits or errors
   - Invalid prompt content

### Wrong speaker in assets

Remember that only the first speaker is used. Reorder speakers in the podcast's speaker list to change which speaker appears in generated assets.

## File Locations

- **Hook:** `directus-cms/extensions/directus-extension-programmierbar-bundle/src/asset-generation/`
- **Setup Script:** `directus-cms/utils/setup-asset-templates.mjs`
- **Fix Scripts:** `directus-cms/utils/fix-asset-*.mjs`
