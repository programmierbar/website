#!/usr/bin/env node
/**
 * Setup script for local Directus development
 * - Creates a Public policy for unauthenticated access
 * - Adds public read permissions for main collections
 * - Imports production data or creates fallback sample data
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@programmier.bar';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';
const PROD_URL = 'https://admin.programmier.bar';
const PROD_API_TOKEN = process.env.PROD_API_TOKEN || '';
const DIRECTUS_LOCAL_ADMIN_TOKEN = 'random_SECRET_t0ken!';

// Collections that need public read access
const PUBLIC_COLLECTIONS = [
    'podcasts',
    'meetups',
    'speakers',
    'members',
    'tags',
    'picks_of_the_day',
    'conferences',
    'talks',
    'transcripts',
    'testimonials',
    'partners',
    'home_page',
    'podcast_page',
    'meetup_page',
    'hall_of_fame_page',
    'about_page',
    'contact_page',
    'pick_of_the_day_page',
    'conference_page',
    'imprint_page',
    'privacy_page',
    'coc_page',
    'recordings_page',
    'login_page',
    'profile_creation_page',
    'raffle_page',
    'cocktail_menu',
    'ticket_settings',
    'directus_files',
    // Junction tables
    'podcast_members',
    'podcast_speakers',
    'podcast_tags',
    'meetup_members',
    'meetup_speakers',
    'meetup_tags',
    'meetup_gallery_images',
    'meetups_talks',
    'speaker_tags',
    'member_tags',
    'pick_of_the_day_tags',
    'conferences_speakers',
    'conferences_talks',
    'conferences_partners',
    'conferences_directus_files',
    'talks_members',
    'talks_speakers',
    'home_page_highlights',
    'home_page_podcasts',
];

let _isTokenSet = false;
async function getToken() {
    if (_isTokenSet) return DIRECTUS_LOCAL_ADMIN_TOKEN;

    let res = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    let data = await res.json();
    let tmpToken = data.data?.access_token;
    res = await fetch(`${DIRECTUS_URL}/users/me`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tmpToken}`,
        }
    });
    data = await res.json();
    let id = data.data?.id;
    res = await fetch(`${DIRECTUS_URL}/users/${id}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tmpToken}`,
        },
        body: JSON.stringify({ token: DIRECTUS_LOCAL_ADMIN_TOKEN }),
    });

    if (!res.ok) {
        throw new Error('Could not set admin user token.');
    }

    _isTokenSet = true;

    return DIRECTUS_LOCAL_ADMIN_TOKEN
}

async function getOrCreatePublicPolicy(token) {
    console.log('Setting up public access policy...');

    const policiesRes = await fetch(`${DIRECTUS_URL}/policies`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const policiesData = await policiesRes.json();

    let publicPolicy = policiesData.data?.find(p => p.name === 'Public' || p.name === 'public');

    if (publicPolicy) {
        console.log(`  Found existing policy: ${publicPolicy.id}`);
        return publicPolicy.id;
    }

    const createRes = await fetch(`${DIRECTUS_URL}/policies`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            name: 'Public',
            icon: 'public',
            description: 'Public read access for unauthenticated users',
            admin_access: false,
            app_access: false,
        }),
    });

    if (!createRes.ok) {
        const err = await createRes.json();
        console.error('  Failed to create public policy:', err.errors?.[0]?.message);
        return null;
    }

    const createData = await createRes.json();
    console.log(`  Created policy: ${createData.data.id}`);
    return createData.data.id;
}

async function setPublicPolicyAccess(token, policyId) {
    console.log('Setting public policy for unauthenticated access...');

    const accessRes = await fetch(`${DIRECTUS_URL}/access`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (accessRes.ok) {
        const accessData = await accessRes.json();
        const hasPublicAccess = accessData.data?.some(a => a.policy === policyId && a.role === null);

        if (!hasPublicAccess) {
            const createAccessRes = await fetch(`${DIRECTUS_URL}/access`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    role: null,
                    policy: policyId,
                }),
            });

            if (createAccessRes.ok) {
                console.log('  Linked policy to public access');
            } else {
                const err = await createAccessRes.json();
                console.log('  Note:', err.errors?.[0]?.message || 'Could not set public access');
            }
        } else {
            console.log('  Policy already has public access');
        }
    }
}

async function addPublicPermissions(token, policyId) {
    console.log('\nAdding public read permissions...');

    for (const collection of PUBLIC_COLLECTIONS) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/permissions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    collection,
                    action: 'read',
                    policy: policyId,
                    permissions: {},
                    fields: ['*'],
                }),
            });

            if (res.ok) {
                console.log(`  ✓ ${collection}`);
            } else {
                const err = await res.json();
                if (err.errors?.[0]?.message?.includes('already exists') ||
                    err.errors?.[0]?.message?.includes('unique')) {
                    console.log(`  - ${collection} (already exists)`);
                } else {
                    console.log(`  ✗ ${collection}: ${err.errors?.[0]?.message || 'error'}`);
                }
            }
        } catch (e) {
            console.log(`  ✗ ${collection}: ${e.message}`);
        }
    }
}

// --- Production Data Import ---

/**
 * Fetch items from a production collection.
 */
async function fetchFromProduction(name, { limit = 50, sort = '-id' } = {}) {
    try {
        const url = `${PROD_URL}/items/${name}?limit=${limit}&sort=${sort}&fields=*`;
        const res = await fetch(url);
        if (!res.ok) {
            console.log(`  ✗ ${name}: Could not fetch from production (${res.status})`);
            return [];
        }
        const data = await res.json();
        return data.data || [];
    } catch (e) {
        console.log(`  ✗ ${name}: ${e.message}`);
        return [];
    }
}

/**
 * Strip relational/system fields from an item to avoid foreign key issues.
 * Keeps JSON arrays (objects like faqs, agenda, news) but strips relational
 * arrays (integer/string IDs that reference junction tables).
 * Adds status: 'published' if missing (production API doesn't expose the status
 * field, but all returned items are published).
 */
function stripForImport(item) {
    const cleaned = {};
    for (const [key, value] of Object.entries(item)) {
        // Skip system fields
        if (['date_created', 'date_updated', 'user_created', 'user_updated'].includes(key)) continue;
        // For arrays: keep JSON data arrays (objects), skip relational ID arrays
        if (Array.isArray(value)) {
            if (value.length === 0 || (typeof value[0] === 'object' && value[0] !== null)) {
                // Empty array or array of objects = JSON field (keep)
                cleaned[key] = value;
            }
            // Array of primitives (IDs) = relational field (skip)
            continue;
        }
        cleaned[key] = value;
    }
    // Production public API only returns published items but doesn't include
    // the status field. Without it, Directus clears published_on on insert.
    if (!cleaned.status && cleaned.published_on) {
        cleaned.status = 'published';
    }
    return cleaned;
}

/**
 * Insert items into local Directus. Returns count of imported/skipped.
 * On foreign key errors, retries with UUID foreign keys set to null.
 */
async function insertItems(token, name, items) {
    let imported = 0;
    let skipped = 0;
    let lastError = null;

    for (const item of items) {
        const cleaned = stripForImport(item);

        try {
            let res = await fetch(`${DIRECTUS_URL}/items/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(cleaned),
            });

            if (res.ok) {
                imported++;
            } else {
                const err = await res.json();
                const errMsg = err.errors?.[0]?.message;

                // On foreign key error, retry with UUID references nulled out
                if (errMsg === 'Invalid foreign key.') {
                    const relaxed = { ...cleaned };
                    for (const [key, value] of Object.entries(relaxed)) {
                        if (key === 'id') continue;
                        if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(value)) {
                            relaxed[key] = null;
                        }
                    }
                    res = await fetch(`${DIRECTUS_URL}/items/${name}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify(relaxed),
                    });
                    if (res.ok) {
                        imported++;
                    } else {
                        lastError = errMsg;
                        skipped++;
                    }
                } else {
                    lastError = errMsg;
                    skipped++;
                }
            }
        } catch (e) {
            lastError = e.message;
            skipped++;
        }
    }

    const status = imported > 0 ? '✓' : (skipped > 0 ? '!' : '-');
    let msg = `  ${status} ${name}: ${imported} imported, ${skipped} skipped`;
    if (skipped > 0 && lastError) msg += ` (${lastError})`;
    console.log(msg);
    return { imported, skipped };
}

/**
 * Import a singleton page from production (fetch + PATCH locally).
 */
async function importSingleton(token, name) {
    try {
        const prodRes = await fetch(`${PROD_URL}/items/${name}?fields=*`);
        if (!prodRes.ok) {
            console.log(`  ✗ ${name}: Could not fetch from production (${prodRes.status})`);
            return null;
        }

        const prodData = await prodRes.json();
        const item = prodData.data;
        if (!item) {
            console.log(`  - ${name}: No data in production`);
            return null;
        }

        delete item.date_created;
        delete item.date_updated;
        delete item.user_created;
        delete item.user_updated;

        const res = await fetch(`${DIRECTUS_URL}/items/${name}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(item),
        });

        if (res.ok) {
            console.log(`  ✓ ${name}`);
            return item;
        } else {
            const err = await res.json();
            console.log(`  ✗ ${name}: ${err.errors?.[0]?.message || 'error'}`);
            return null;
        }
    } catch (e) {
        console.log(`  ✗ ${name}: ${e.message}`);
        return null;
    }
}

/**
 * Collect all file IDs referenced in data items (looks at known file fields).
 */
function collectFileIds(allData) {
    const fileIds = new Set();
    const fileFields = [
        'cover_image', 'banner_image', 'profile_image', 'event_image',
        'normal_image', 'action_image', 'image', 'video', 'poster',
        'thumbnail', 'directus_files_id',
    ];

    for (const items of Object.values(allData)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
            for (const field of fileFields) {
                if (item[field] && typeof item[field] === 'string') {
                    fileIds.add(item[field]);
                }
            }
        }
    }

    return fileIds;
}

/**
 * Import files from production — downloads actual file data so images work locally.
 * Uses the local Directus /files/import endpoint to fetch from production asset URLs.
 */
async function importFiles(token, fileIds) {
    if (fileIds.size === 0) return;

    console.log(`\nImporting files (${fileIds.size})...`);

    let imported = 0;
    let skipped = 0;

    for (const fileId of fileIds) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/files/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    url: `${PROD_URL}/assets/${fileId}`,
                    data: { id: fileId },
                }),
            });

            if (res.ok) {
                imported++;
            } else {
                const err = await res.json();
                const errMsg = err.errors?.[0]?.message || '';
                if (errMsg.includes('unique') || errMsg.includes('already exists')) {
                    skipped++;
                } else {
                    skipped++;
                }
            }
        } catch (e) {
            skipped++;
        }
    }

    console.log(`  ✓ files: ${imported} imported, ${skipped} skipped`);
}

async function importSampleData(token) {
    console.log('\nFetching data from production...');

    // Phase 1: Fetch ALL data from production first
    const data = {};
    const collections = [
        { name: 'tags', limit: 200 },
        { name: 'members', limit: 10 },
        { name: 'speakers', limit: 20 },
        { name: 'podcasts', limit: 10 },
        { name: 'meetups', limit: 5 },
        { name: 'conferences', limit: 5 },
        { name: 'talks', limit: 20 },
        { name: 'picks_of_the_day', limit: 10 },
        { name: 'testimonials', limit: 10 },
        { name: 'partners', limit: 10 },
    ];

    for (const { name, limit } of collections) {
        data[name] = await fetchFromProduction(name, { limit });
        console.log(`  fetched ${name}: ${data[name].length} items`);
    }

    const junctions = [
        { name: 'podcast_members', limit: 50 },
        { name: 'podcast_speakers', limit: 50 },
        { name: 'podcast_tags', limit: 100 },
        { name: 'meetup_members', limit: 30 },
        { name: 'meetup_speakers', limit: 30 },
        { name: 'meetup_tags', limit: 50 },
        { name: 'meetups_talks', limit: 30 },
        { name: 'meetup_gallery_images', limit: 50 },
        { name: 'speaker_tags', limit: 100 },
        { name: 'member_tags', limit: 30 },
        { name: 'pick_of_the_day_tags', limit: 50 },
        { name: 'conferences_speakers', limit: 30 },
        { name: 'conferences_talks', limit: 30 },
        { name: 'conferences_partners', limit: 20 },
        { name: 'conferences_directus_files', limit: 30 },
        { name: 'talks_speakers', limit: 50 },
        { name: 'talks_members', limit: 50 },
        { name: 'home_page_highlights', limit: 10 },
        { name: 'home_page_podcasts', limit: 10 },
    ];

    for (const { name, limit } of junctions) {
        data[name] = await fetchFromProduction(name, { limit });
    }

    // Also fetch singletons to collect their file references
    const singletons = [
        'home_page', 'podcast_page', 'meetup_page', 'conference_page',
        'hall_of_fame_page', 'about_page', 'contact_page', 'pick_of_the_day_page',
        'privacy_page', 'imprint_page', 'coc_page', 'recordings_page',
        'login_page', 'profile_creation_page', 'raffle_page',
        'cocktail_menu', 'ticket_settings',
    ];

    const singletonData = {};
    for (const name of singletons) {
        try {
            const res = await fetch(`${PROD_URL}/items/${name}?fields=*`);
            if (res.ok) {
                const d = await res.json();
                if (d.data) singletonData[name] = d.data;
            }
        } catch (e) {}
    }

    // Phase 2: Collect ALL file IDs and import file metadata FIRST
    const fileIds = collectFileIds(data);
    // Also collect from singletons
    const fileFields = [
        'cover_image', 'banner_image', 'profile_image', 'event_image',
        'normal_image', 'action_image', 'image', 'video', 'poster',
        'thumbnail', 'directus_files_id',
    ];
    for (const item of Object.values(singletonData)) {
        for (const field of fileFields) {
            if (item[field] && typeof item[field] === 'string') {
                fileIds.add(item[field]);
            }
        }
    }
    token = await getToken();
    await importFiles(token, fileIds);

    // Phase 3: Import collections in dependency order
    token = await getToken();
    console.log('\nImporting collections...');
    for (const name of ['tags', 'members', 'speakers', 'partners', 'testimonials']) {
        if (data[name]?.length) await insertItems(token, name, data[name]);
    }
    for (const name of ['podcasts', 'meetups', 'conferences', 'talks', 'picks_of_the_day']) {
        if (data[name]?.length) await insertItems(token, name, data[name]);
    }

    // Phase 3b: Fix slugs overwritten by set-slug hook during insert
    token = await getToken();
    // The set-slug hook auto-generates slugs on items.create, overwriting production slugs.
    // PATCHing just {slug} doesn't trigger the hook (it only fires when title/name fields change).
    const slugCollections = ['speakers', 'podcasts', 'meetups', 'conferences'];
    console.log('\nFixing slugs...');
    for (const name of slugCollections) {
        if (!data[name]?.length) continue;
        let fixed = 0;
        for (const item of data[name]) {
            if (!item.id || !item.slug) continue;
            try {
                const res = await fetch(`${DIRECTUS_URL}/items/${name}/${item.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ slug: item.slug }),
                });
                if (res.ok) fixed++;
            } catch (e) {}
        }
        console.log(`  ✓ ${name}: ${fixed} slugs fixed`);
    }

    // Phase 4: Import junction tables
    token = await getToken();
    console.log('\nImporting relations...');
    for (const { name } of junctions) {
        if (data[name]?.length) await insertItems(token, name, data[name]);
    }

    // Phase 5: Import singleton pages
    token = await getToken();
    console.log('\nImporting singleton pages...');
    for (const name of singletons) {
        await importSingleton(token, name);
    }
}

// --- Fallback Sample Data (when production is unreachable) ---

async function createLocalSampleData(token) {
    console.log('\nCreating local sample data (production unreachable)...');

    // Create placeholder image
    let coverImageId = null;
    try {
        const imgRes = await fetch(`${DIRECTUS_URL}/files/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                url: 'https://placehold.co/800x800/1a1a1a/a3e635?text=Podcast',
                data: { title: 'Podcast Cover Placeholder' },
            }),
        });
        if (imgRes.ok) {
            const data = await imgRes.json();
            coverImageId = data.data.id;
            console.log('  ✓ Placeholder image');
        }
    } catch (e) {
        console.log('  ✗ Placeholder image:', e.message);
    }

    // Singleton pages — create minimal valid content
    const singletonDefaults = [
        { name: 'home_page', data: { intro_heading: 'Die Plattform für Web- und App-Entwickler:innen', podcast_heading: 'Neueste Folgen', meetup_heading: 'Meetups & Events', highlights_heading: 'Highlights', meta_title: 'programmier.bar', meta_description: 'Der Podcast für App- und Webentwicklung', news: [] } },
        { name: 'podcast_page', data: { meta_title: 'Podcast', meta_description: 'Alle Podcast-Folgen' } },
        { name: 'meetup_page', data: { meta_title: 'Meetups', meta_description: 'Unsere Meetups' } },
        { name: 'conference_page', data: { meta_title: 'Konferenzen', meta_description: 'Unsere Konferenzen' } },
        { name: 'hall_of_fame_page', data: { meta_title: 'Hall of Fame', meta_description: 'Unsere Speaker:innen' } },
        { name: 'about_page', data: { meta_title: 'Über uns', meta_description: 'Das Team hinter der programmier.bar' } },
        { name: 'contact_page', data: { meta_title: 'Kontakt', meta_description: 'Kontaktiere uns' } },
        { name: 'pick_of_the_day_page', data: { meta_title: 'Pick of the Day', meta_description: 'Unsere Tipps' } },
        { name: 'privacy_page', data: { meta_title: 'Datenschutz', text: '<p>Datenschutzerklärung</p>' } },
        { name: 'imprint_page', data: { meta_title: 'Impressum', text: '<p>Impressum</p>' } },
        { name: 'coc_page', data: { meta_title: 'Code of Conduct' } },
        { name: 'recordings_page', data: { meta_title: 'Recordings' } },
        { name: 'login_page', data: { meta_title: 'Login' } },
        { name: 'profile_creation_page', data: { meta_title: 'Profil erstellen' } },
        { name: 'raffle_page', data: { meta_title: 'Gewinnspiel' } },
        { name: 'cocktail_menu', data: {} },
        { name: 'ticket_settings', data: {} },
    ];

    for (const { name, data } of singletonDefaults) {
        try {
            await fetch(`${DIRECTUS_URL}/items/${name}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data),
            });
            console.log(`  ✓ ${name}`);
        } catch (e) {
            console.log(`  ✗ ${name}: ${e.message}`);
        }
    }

    // Tags
    const tagIds = {};
    const tags = ['JavaScript', 'TypeScript', 'Vue.js', 'React', 'Node.js', 'Flutter', 'Swift', 'Kotlin', 'CSS', 'DevOps'];
    for (const name of tags) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'published', name, published_on: '2024-01-01' }),
            });
            if (res.ok) {
                const data = await res.json();
                tagIds[name] = data.data.id;
            }
        } catch (e) {}
    }
    console.log(`  ✓ tags: ${Object.keys(tagIds).length} created`);

    // Members
    const memberIds = [];
    const members = [
        { first_name: 'Fabi', last_name: 'Stein', task_area: 'podcast_crew', occupation: 'Senior Developer' },
        { first_name: 'Jojo', last_name: 'Wallner', task_area: 'podcast_crew', occupation: 'Developer' },
        { first_name: 'Sebi', last_name: 'Keller', task_area: 'podcast_crew', occupation: 'Developer' },
    ];
    for (const m of members) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'published', ...m, description: 'Host of programmier.bar', team_member: true, published_on: '2024-01-01' }),
            });
            if (res.ok) {
                const data = await res.json();
                memberIds.push(data.data.id);
            }
        } catch (e) {}
    }
    console.log(`  ✓ members: ${memberIds.length} created`);

    // Speakers
    const speakerIds = [];
    const speakers = [
        { first_name: 'Max', last_name: 'Mustermann', slug: 'max-mustermann', occupation: 'CTO at TechCorp' },
        { first_name: 'Anna', last_name: 'Beispiel', slug: 'anna-beispiel', occupation: 'Senior Engineer' },
        { first_name: 'Lisa', last_name: 'Developer', slug: 'lisa-developer', occupation: 'Tech Lead' },
    ];
    for (const s of speakers) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/speakers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'published', ...s, description: 'Guest speaker', listed_hof: true, published_on: '2024-01-01' }),
            });
            if (res.ok) {
                const data = await res.json();
                speakerIds.push(data.data.id);
            }
        } catch (e) {}
    }
    console.log(`  ✓ speakers: ${speakerIds.length} created`);

    // Podcasts
    const podcastIds = [];
    const podcasts = [
        { type: 'deep_dive', number: '100', title: 'Deep Dive TypeScript', slug: 'deep-dive-100-typescript', description: 'In dieser Episode sprechen wir über TypeScript Best Practices.', published_on: '2024-12-01' },
        { type: 'news', number: '50', title: 'News Januar 2025', slug: 'news-50-januar-2025', description: 'Die neuesten News aus der Web- und App-Entwicklung.', published_on: '2025-01-15' },
        { type: 'cto_special', number: '25', title: 'CTO Special: Startup Architektur', slug: 'cto-special-25-startup', description: 'Wie baut man eine skalierbare Architektur für Startups?', published_on: '2024-11-01' },
    ];
    for (const p of podcasts) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/podcasts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'published', ...p, cover_image: coverImageId, audio_url: 'https://example.com/audio.mp3' }),
            });
            if (res.ok) {
                const data = await res.json();
                podcastIds.push(data.data.id);
            }
        } catch (e) {}
    }
    console.log(`  ✓ podcasts: ${podcastIds.length} created`);

    // Talks
    const talkIds = [];
    const talks = [
        { title: 'Einführung in Flutter', abstract: 'Ein Überblick über das Flutter Framework.' },
        { title: 'State Management in Vue 3', abstract: 'Verschiedene Ansätze für State Management.' },
    ];
    for (const t of talks) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/talks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'published', ...t }),
            });
            if (res.ok) {
                const data = await res.json();
                talkIds.push(data.data.id);
            }
        } catch (e) {}
    }
    console.log(`  ✓ talks: ${talkIds.length} created`);

    // Meetup
    try {
        const meetupRes = await fetch(`${DIRECTUS_URL}/items/meetups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                status: 'published', slug: 'meetup-1-sample', title: 'Sample Meetup',
                description: 'Ein Sample-Meetup für die lokale Entwicklung.',
                intro: 'Willkommen zum Sample Meetup',
                start_on: '2025-01-15T18:00:00', end_on: '2025-01-15T21:00:00',
                published_on: '2025-01-01', cover_image: coverImageId,
            }),
        });
        if (meetupRes.ok) console.log('  ✓ meetups: 1 created');
    } catch (e) {}

    // Conference
    try {
        const confRes = await fetch(`${DIRECTUS_URL}/items/conferences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                status: 'published', slug: 'sample-conference', title: 'Sample Conference',
                headline_1: 'Eine Beispiel-Konferenz',
                text_1: '<p>Beschreibung der Konferenz.</p>',
                start_on: '2025-06-15T09:00:00', end_on: '2025-06-15T18:00:00',
                published_on: '2025-01-01', cover_image: coverImageId,
                faqs: [{ question: 'Was ist das?', answer: '<p>Eine Beispiel-Konferenz.</p>' }],
                agenda: [
                    { start: '2025-06-15T09:00:00', title: 'Einlass' },
                    { start: '2025-06-15T10:00:00', title: 'Talk 1' },
                ],
            }),
        });
        if (confRes.ok) console.log('  ✓ conferences: 1 created');
    } catch (e) {}

    // Testimonials
    const testimonials = [
        { text: '<p>Super Podcast! Höre ich jede Woche.</p>', subtitle: 'Feedback', weight: 5 },
        { text: '<p>Die Meetups sind immer spannend und gut organisiert.</p>', subtitle: 'Community', weight: 4 },
        { text: '<p>Tolle Themenauswahl und sympathische Hosts.</p>', subtitle: 'Podcast Review', weight: 5 },
    ];
    let testimonialCount = 0;
    for (const t of testimonials) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/testimonials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: 'published', ...t }),
            });
            if (res.ok) testimonialCount++;
        } catch (e) {}
    }
    console.log(`  ✓ testimonials: ${testimonialCount} created`);

    // Picks of the day
    let pickCount = 0;
    const picks = [
        { name: 'VS Code', website_url: 'https://code.visualstudio.com/', description: '<p>Der beliebteste Code-Editor.</p>' },
        { name: 'GitHub Copilot', website_url: 'https://github.com/features/copilot', description: '<p>AI-gestütztes Coding.</p>' },
        { name: 'Tailwind CSS', website_url: 'https://tailwindcss.com/', description: '<p>Utility-first CSS Framework.</p>' },
    ];
    for (let i = 0; i < picks.length; i++) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/picks_of_the_day`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    status: 'published', ...picks[i],
                    published_on: '2024-01-01',
                    podcast: podcastIds[i % podcastIds.length] || null,
                }),
            });
            if (res.ok) pickCount++;
        } catch (e) {}
    }
    console.log(`  ✓ picks_of_the_day: ${pickCount} created`);

    // Relations
    let relCount = 0;
    for (let i = 0; i < podcastIds.length && i < memberIds.length; i++) {
        try {
            await fetch(`${DIRECTUS_URL}/items/podcast_members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ podcast: podcastIds[i], member: memberIds[i], sort: 1 }),
            });
            relCount++;
        } catch (e) {}
    }
    if (speakerIds[0] && podcastIds[0]) {
        try {
            await fetch(`${DIRECTUS_URL}/items/podcast_speakers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ podcast: podcastIds[0], speaker: speakerIds[0], sort: 1 }),
            });
            relCount++;
        } catch (e) {}
    }
    console.log(`  ✓ relations: ${relCount} created`);
}

// --- Admin Collection Import (requires PROD_API_TOKEN) ---

/**
 * Fetch items from a production collection using admin auth.
 */
async function fetchFromProductionAdmin(name, { fields = ['*'], limit = 500 } = {}) {
    if (!PROD_API_TOKEN) return [];
    try {
        const fieldsParam = fields.join(',');
        const url = `${PROD_URL}/items/${name}?limit=${limit}&fields=${fieldsParam}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${PROD_API_TOKEN}` },
        });
        if (!res.ok) {
            console.log(`  ✗ ${name}: Could not fetch from production (${res.status})`);
            return [];
        }
        const data = await res.json();
        return data.data || [];
    } catch (e) {
        console.log(`  ✗ ${name}: ${e.message}`);
        return [];
    }
}

/**
 * Import a keyed collection (items with a unique `key` field).
 * Skips items that already exist locally (matched by key).
 */
async function importKeyedCollection(token, name, items, dataFields) {
    let imported = 0;
    let skipped = 0;

    for (const item of items) {
        const cleaned = {};
        for (const field of dataFields) {
            if (item[field] !== undefined) cleaned[field] = item[field];
        }

        try {
            const checkRes = await fetch(
                `${DIRECTUS_URL}/items/${name}?filter[key][_eq]=${encodeURIComponent(item.key)}&limit=1`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const checkData = await checkRes.json();

            if (checkData.data?.length > 0) {
                skipped++;
                continue;
            }

            const res = await fetch(`${DIRECTUS_URL}/items/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(cleaned),
            });

            if (res.ok) {
                imported++;
            } else {
                const err = await res.json();
                console.log(`    ✗ ${item.key}: ${err.errors?.[0]?.message || 'error'}`);
                skipped++;
            }
        } catch (e) {
            skipped++;
        }
    }

    const status = imported > 0 ? '✓' : (skipped > 0 ? '-' : '-');
    console.log(`  ${status} ${name}: ${imported} imported, ${skipped} skipped`);
}

/**
 * Import a file (actual binary) from production into local Directus.
 * Uses the /files/import endpoint with production asset URL.
 */
async function importFileFromProduction(localToken, fileId) {
    try {
        const fileUrl = `${PROD_URL}/assets/${fileId}?access_token=${PROD_API_TOKEN}`;
        const res = await fetch(`${DIRECTUS_URL}/files/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localToken}`,
            },
            body: JSON.stringify({
                url: fileUrl,
                data: { id: fileId },
            }),
        });

        if (res.ok) return true;

        const err = await res.json();
        const errMsg = err.errors?.[0]?.message || '';
        if (errMsg.includes('unique') || errMsg.includes('already exists')) {
            return true; // already imported
        }
        console.log(`    ✗ file ${fileId}: ${errMsg}`);
        return false;
    } catch (e) {
        console.log(`    ✗ file ${fileId}: ${e.message}`);
        return false;
    }
}

/**
 * Import asset templates and their template_image files from production.
 */
async function importAssetTemplates(token, templates) {
    // Import template_image files first (actual binaries, not just metadata)
    const imageIds = [...new Set(templates.map(t => t.template_image).filter(Boolean))];
    if (imageIds.length > 0) {
        console.log(`  Importing ${imageIds.length} template image(s)...`);
        for (const fileId of imageIds) {
            await importFileFromProduction(token, fileId);
        }
    }

    // Import template records
    let imported = 0;
    let skipped = 0;
    const dataFields = [
        'name', 'asset_type', 'episode_type', 'title_contains', 'active',
        'requires_speaker_image', 'template_image', 'prompt_template',
        'generation_model', 'output_format', 'variables_schema',
    ];

    for (const template of templates) {
        const cleaned = {};
        for (const field of dataFields) {
            if (template[field] !== undefined) cleaned[field] = template[field];
        }

        try {
            // Check if template already exists by name + asset_type
            const checkRes = await fetch(
                `${DIRECTUS_URL}/items/asset_templates?filter[name][_eq]=${encodeURIComponent(template.name)}&filter[asset_type][_eq]=${encodeURIComponent(template.asset_type || '')}&limit=1`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const checkData = await checkRes.json();

            if (checkData.data?.length > 0) {
                skipped++;
                continue;
            }

            const res = await fetch(`${DIRECTUS_URL}/items/asset_templates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(cleaned),
            });

            if (res.ok) {
                imported++;
            } else {
                const err = await res.json();
                console.log(`    ✗ ${template.name}: ${err.errors?.[0]?.message || 'error'}`);
                skipped++;
            }
        } catch (e) {
            skipped++;
        }
    }

    console.log(`  ✓ asset_templates: ${imported} imported, ${skipped} skipped`);
}

/**
 * Import admin-only collections from production (requires PROD_API_TOKEN).
 */
async function importAdminCollections(token) {
    // Validate token first
    const testRes = await fetch(`${PROD_URL}/items/email_templates?limit=1`, {
        headers: { 'Authorization': `Bearer ${PROD_API_TOKEN}` },
    });
    if (!testRes.ok) {
        console.log(`  ✗ PROD_API_TOKEN is invalid or expired (${testRes.status}). Skipping admin collections.`);
        return;
    }

    // 1. automation_settings
    const settings = await fetchFromProductionAdmin('automation_settings', {
        fields: ['key', 'name', 'value', 'value_type', 'description'],
    });
    if (settings.length) {
        await importKeyedCollection(token, 'automation_settings', settings,
            ['key', 'name', 'value', 'value_type', 'description']);
    }

    // 2. email_templates
    const emailTemplates = await fetchFromProductionAdmin('email_templates', {
        fields: ['key', 'name', 'subject', 'body_html', 'description'],
    });
    if (emailTemplates.length) {
        await importKeyedCollection(token, 'email_templates', emailTemplates,
            ['key', 'name', 'subject', 'body_html', 'description']);
    }

    // 3. ai_prompts
    const aiPrompts = await fetchFromProductionAdmin('ai_prompts', {
        fields: ['key', 'name', 'prompt_text', 'category', 'description'],
    });
    if (aiPrompts.length) {
        await importKeyedCollection(token, 'ai_prompts', aiPrompts,
            ['key', 'name', 'prompt_text', 'category', 'description']);
    }

    // 4. asset_templates (includes template_image file download)
    const assetTemplates = await fetchFromProductionAdmin('asset_templates', {
        fields: ['name', 'asset_type', 'episode_type', 'title_contains', 'active',
            'requires_speaker_image', 'template_image', 'prompt_template',
            'generation_model', 'output_format', 'variables_schema'],
    });
    if (assetTemplates.length) {
        await importAssetTemplates(token, assetTemplates);
    }
}

// --- Main ---

async function main() {
    console.log(`Setting up local Directus at ${DIRECTUS_URL}\n`);

    let token = await getToken();
    if (!token) {
        console.error('Failed to authenticate. Is Directus running?');
        process.exit(1);
    }

    const policyId = await getOrCreatePublicPolicy(token);
    if (!policyId) {
        console.error('Could not create public policy');
        process.exit(1);
    }

    await setPublicPolicyAccess(token, policyId);
    await addPublicPermissions(token, policyId);

    const args = process.argv.slice(2);

    if (args.includes('--import-data')) {
        // Try production import, fall back to local sample data
        try {
            const testRes = await fetch(`${PROD_URL}/items/tags?limit=1`);
            if (testRes.ok) {
                await importSampleData(token);
            } else {
                console.log('\nProduction API not accessible, creating local sample data instead...');
                await createLocalSampleData(token);
            }
        } catch (e) {
            console.log(`\nCannot reach production (${e.message}), creating local sample data instead...`);
            await createLocalSampleData(token);
        }
    } else {
        await createLocalSampleData(token);
    }

    // Import admin collections (requires PROD_API_TOKEN)
    if (PROD_API_TOKEN) {
        token = await getToken();
        console.log('\nImporting admin collections from production...');
        await importAdminCollections(token);
    } else {
        console.log('\nSkipping admin collections (PROD_API_TOKEN not set)');
        console.log('  Set PROD_API_TOKEN in .env to import email templates, AI prompts, etc.');
    }

    console.log('\n✅ Done! Local Directus is ready for development.');
    console.log('   Admin panel: http://localhost:8055 (admin@programmier.bar / 123456)');
}

main().catch(console.error);
