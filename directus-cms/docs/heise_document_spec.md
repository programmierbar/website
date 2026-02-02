# Heise.de Podcast Episode Document Specification

This document describes the format and content requirements for podcast episode documents sent to Heise.de for potential publication.

## Overview

For selected podcast episodes (typically Deep Dives), a document is generated and sent to Heise.de who may choose to feature the episode on their platform. This document provides all necessary metadata and content for their editorial team to evaluate and publish the episode.

## Document Format

The Heise document is generated as an **HTML email body** with the option to attach a **plain text version** for accessibility. The document uses a clean, professional layout optimized for email clients.

## Required Fields

### Episode Metadata

| Field | Source | Format |
|-------|--------|--------|
| Episode Title | `podcasts.title` | Plain text |
| Episode Number | `podcasts.number` | e.g., "Deep Dive 123" |
| Episode Type | `podcasts.type` | Deep Dive, CTO Special, News, etc. |
| Publication Date | `podcasts.planned_publish_date` | German date format (DD.MM.YYYY) |
| Episode URL | Constructed | `https://programmier.bar/podcast/{slug}` |
| Duration | `podcasts.duration` (if available) | "XX Minuten" |

### Guest Information

| Field | Source | Format |
|-------|--------|--------|
| Guest Name(s) | `speakers.first_name`, `speakers.last_name` | Full name(s), comma-separated |
| Guest Title | `speakers.academic_title` | Optional prefix |
| Guest Position | `speakers.occupation` | Job title and company |
| Guest Bio | `speakers.description` | Short biography |
| Guest Links | `speakers.linkedin_url`, etc. | Social media links |

### Host Information

| Field | Source | Format |
|-------|--------|--------|
| Host Name(s) | `members.first_name`, `members.last_name` | Full name(s) |

### Content

| Field | Source | Format |
|-------|--------|--------|
| Episode Description | `podcasts.description` (approved shownotes) | HTML formatted |
| Key Topics | From shownotes or transcript analysis | Bullet points |
| Episode Links | Episode page URL, streaming platform links | URLs |

## Document Structure

### 1. Header Section
```
programmier.bar - Podcast für App- und Webentwicklung
Neue Episode: [Title]
```

### 2. Episode Overview
- Episode type and number
- Publication date
- Brief one-paragraph summary

### 3. Guest Profile(s)
- Name with title
- Current position
- Brief bio (2-3 sentences)
- Relevant links (LinkedIn, website)

### 4. Episode Description
- Full shownotes/description (HTML)
- Key topics covered (bullet points)

### 5. Technical Details
- Episode URL
- Duration (if available)
- Streaming links (Apple Podcasts, Spotify, etc.)

### 6. Contact Information
- Podcast contact email
- Website URL
- Social media handles

## Email Template

The email is sent with:

- **Subject**: `[programmier.bar] Neue Episode: {Episode Title}`
- **To**: Heise.de editorial contact (configurable via `HEISE_CONTACT_EMAIL` env var)
- **From**: `podcast@programmier.bar` (or configured sender)
- **Reply-To**: `podcast@programmier.bar`

## Workflow Status Values

The `heise_document_status` field tracks the document lifecycle:

| Status | Description |
|--------|-------------|
| `not_applicable` | Episode not eligible for Heise (default) |
| `pending` | Episode marked as eligible, awaiting document generation |
| `generated` | Document has been generated, awaiting review |
| `approved` | Document reviewed and approved for sending |
| `sent` | Email has been sent to Heise |

## Trigger Conditions

Document generation is triggered when:
1. `heise_eligible` is set to `true` on a podcast
2. AND shownotes have been approved (either all `podcast_generated_content` with status `approved`, or `publishing_status` is `approved` or later)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HEISE_CONTACT_EMAIL` | Heise editorial contact email | Required |
| `WEBSITE_URL` | Base URL for episode links | `https://programmier.bar` |
| `EMAIL_SMTP_*` | SMTP configuration | Required |

## Sample Document

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>programmier.bar - Neue Episode</title>
</head>
<body>
    <h1>programmier.bar - Podcast für App- und Webentwicklung</h1>
    <h2>Neue Episode: Deep Dive 150 - Kubernetes in Production</h2>

    <p><strong>Erscheinungsdatum:</strong> 15. Januar 2026</p>

    <h3>Zu Gast: Dr. Maria Schmidt</h3>
    <p>Head of Platform Engineering bei TechCorp GmbH</p>
    <p>Maria ist Expertin für Cloud-Native-Infrastrukturen und arbeitet seit über 10 Jahren
    mit Kubernetes in produktiven Umgebungen.</p>

    <h3>Über die Episode</h3>
    <p>[Episode description / shownotes here]</p>

    <h3>Themen</h3>
    <ul>
        <li>Kubernetes Cluster Management</li>
        <li>GitOps Workflows</li>
        <li>Monitoring und Observability</li>
    </ul>

    <h3>Links</h3>
    <ul>
        <li>Episode: https://programmier.bar/podcast/deep-dive-150</li>
        <li>Spotify: [link]</li>
        <li>Apple Podcasts: [link]</li>
    </ul>

    <hr>
    <p>
        <strong>programmier.bar</strong><br>
        Der Podcast für App- und Webentwicklung<br>
        <a href="https://programmier.bar">programmier.bar</a><br>
        Kontakt: podcast@programmier.bar
    </p>
</body>
</html>
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-30 | Initial specification |
