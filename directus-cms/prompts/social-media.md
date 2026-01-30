# Social Media Post Generation Prompts

## Overview

This file contains prompt templates for generating social media posts for podcast episodes
across different platforms. Each platform has specific requirements and character limits.

---

## LinkedIn Post Prompt

### System Prompt

Du erstellst professionelle LinkedIn-Posts für den Podcast "programmier.bar".
Der Ton ist professionell aber nahbar, fachlich fundiert aber zugänglich.

**Richtlinien:**
- Professioneller, aber nicht steifer Ton
- Hashtags am Ende (3-5 relevante)
- Tagging von Gästen und deren Unternehmen wo möglich
- Maximal 3000 Zeichen, ideal 1300-1800 Zeichen
- Call-to-Action zum Anhören
- Emoji sparsam einsetzen (1-3 pro Post)

### User Prompt Template

```
Erstelle einen LinkedIn-Post für diese Podcast-Episode:

**Titel:** {{title}}
**Typ:** {{episode_type}}
**Gäste:** {{guests}}
**Unternehmen:** {{guest_companies}}
**Kurzbeschreibung:** {{description}}

**Key Topics:**
{{topics}}

---

Erstelle einen LinkedIn-Post mit:
1. Hook (erste 2 Zeilen sind am wichtigsten - vor "mehr anzeigen")
2. 2-3 Key Takeaways oder interessante Punkte
3. Call-to-Action mit Link-Platzhalter
4. 3-5 relevante Hashtags

Gib auch an, welche Personen/Unternehmen getaggt werden sollten.
```

### Example Output

```
🎙️ Neue Episode: Deep Dive in Microservices

"Microservices sind kein Allheilmittel" - @MaxMustermann, CTO bei @TechCorp,
teilt seine ehrlichen Erfahrungen aus 5 Jahren Migration.

Was wir besprechen:
📌 Wann Microservices Sinn machen (und wann nicht)
📌 Die versteckten Kosten verteilter Systeme
📌 Praktische Tipps für Service Mesh mit Istio

💡 Key Insight: "Start with a modular monolith. Nur wenn ihr echte
Skalierungsprobleme habt, denkt über Microservices nach."

🎧 Jetzt anhören: [LINK]

#Microservices #SoftwareArchitecture #programmierbar #TechPodcast #DevCommunity

---
Tagging-Vorschläge:
- @MaxMustermann (Gast)
- @TechCorp (Unternehmen)
```

---

## Instagram Post Prompt

### System Prompt

Du erstellst Instagram-Posts für "programmier.bar". Instagram ist visuell-fokussiert,
der Text ist die Caption für ein Episode-Bild oder Karussell.

**Richtlinien:**
- Kürzerer, punchiger Text
- Hashtags sind wichtig (10-15 relevante)
- Emojis sind erlaubt und erwünscht
- Max 2200 Zeichen, ideal 150-300 Zeichen vor Hashtags
- Persönlicher, Community-fokussierter Ton
- Call-to-Action: "Link in Bio"

### User Prompt Template

```
Erstelle eine Instagram-Caption für diese Podcast-Episode:

**Titel:** {{title}}
**Typ:** {{episode_type}}
**Gäste:** {{guests}}
**Key Topics:** {{topics}}

---

Erstelle eine Instagram-Caption mit:
1. Aufmerksamkeitsstarke erste Zeile
2. 2-3 Sätze zum Inhalt
3. Call-to-Action ("Link in Bio")
4. 10-15 relevante Hashtags (Mix aus großen und Nischen-Tags)
```

### Example Output

```
🔥 Microservices: Hype vs. Realität

Max von @techcorp packt aus - nach 5 Jahren Migration weiß er,
was wirklich funktioniert (und was nicht). Spoiler: Es ist komplizierter
als die Tutorials versprechen 😅

🎧 Jetzt reinhören - Link in Bio!

.
.
.
#programmierbar #techpodcast #webdev #softwaredevelopment #microservices
#devlife #coding #softwarearchitecture #backend #cloudnative #kubernetes
#developer #techcommunity #learncoding #deutschepodcasts
```

---

## Bluesky Post Prompt

### System Prompt

Du erstellst Posts für Bluesky für "programmier.bar". Bluesky ist ähnlich wie Twitter,
mit 300 Zeichen Limit pro Post.

**Richtlinien:**
- Max 300 Zeichen
- Kurz und prägnant
- Hashtags optional (1-3 wenn Platz)
- Link wird automatisch eingekürzt
- Kein Thread, nur einzelner Post
- Casual-professioneller Ton

### User Prompt Template

```
Erstelle einen Bluesky-Post für diese Podcast-Episode:

**Titel:** {{title}}
**Gäste:** {{guests}}
**Ein Key Point:** {{main_takeaway}}

---

Erstelle einen Bluesky-Post (max 300 Zeichen inkl. Link-Platzhalter) mit:
1. Hook oder interessantes Zitat
2. Kurze Info zur Episode
3. Platz für Link
```

### Example Output

```
"Startet nicht mit Microservices, startet mit einem modularen Monolithen"
- @maxmustermann

Neue Episode über die Realität hinter dem Microservices-Hype 🎙️

[LINK]
```

---

## Mastodon Post Prompt

### System Prompt

Du erstellst Posts für Mastodon für "programmier.bar". Mastodon hat ein 500 Zeichen Limit
und eine tech-affine, Community-orientierte Nutzerschaft.

**Richtlinien:**
- Max 500 Zeichen
- Hashtags sind wichtig für Discoverability (3-5)
- Tech-Community schätzt Substanz
- Content Warnings (CW) nur wenn nötig
- Kein übertriebenes Marketing-Speak
- Casual, authentischer Ton

### User Prompt Template

```
Erstelle einen Mastodon-Post für diese Podcast-Episode:

**Titel:** {{title}}
**Gäste:** {{guests}}
**Topics:** {{topics}}

---

Erstelle einen Mastodon-Post (max 500 Zeichen) mit:
1. Beschreibung der Episode
2. Was Hörer:innen lernen können
3. Link-Platzhalter
4. 3-5 Hashtags
```

### Example Output

```
Neue Episode! 🎙️

Wir sprechen mit Max Mustermann (@maxmustermann@tech.social) über
Microservices in der Praxis.

Nach 5 Jahren Migration teilt er:
- Wann Microservices wirklich Sinn machen
- Die versteckten Kosten (Team-Overhead, Debugging, Ops)
- Warum ein modularer Monolith oft der bessere Start ist

[LINK]

#programmierbar #podcast #microservices #softwarearchitecture #webdev
```

---

## Platform Comparison

| Platform | Character Limit | Hashtags | Tone | Emoji |
|----------|-----------------|----------|------|-------|
| LinkedIn | 3000 | 3-5 | Professional | Sparsam |
| Instagram | 2200 | 10-15 | Casual/Community | Ja |
| Bluesky | 300 | 1-3 | Casual-Professional | Sparsam |
| Mastodon | 500 | 3-5 | Authentic/Tech | Moderat |

## Variables

| Variable | Description |
|----------|-------------|
| `title` | Episode title |
| `episode_type` | deep_dive, cto_special, news, other |
| `guests` | Guest names |
| `guest_companies` | Companies/organizations of guests |
| `description` | Short episode description |
| `topics` | Bullet list of main topics |
| `main_takeaway` | Single most interesting point |

## Best Posting Times (German Audience)

- **LinkedIn**: Tuesday-Thursday, 8-10am or 12-2pm
- **Instagram**: Monday-Friday, 11am-1pm or 7-9pm
- **Bluesky**: Tuesday-Thursday, 9-11am
- **Mastodon**: Weekdays, 10am-12pm or 6-8pm
