#!/usr/bin/env node
/**
 * Setup script for local Directus development
 * - Creates a Public policy for unauthenticated access
 * - Adds public read permissions for main collections
 * - Imports sample data from production (optional)
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@programmier.bar';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';
const PROD_URL = 'https://admin.programmier.bar';

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
    'partners',
    'testimonials',
    'home_page_highlights',
    'home_page_podcasts',
];

async function getToken() {
    const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const data = await res.json();
    return data.data?.access_token;
}

async function getOrCreatePublicPolicy(token) {
    console.log('Setting up public access policy...');

    // Check if a public policy already exists
    const policiesRes = await fetch(`${DIRECTUS_URL}/policies`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const policiesData = await policiesRes.json();

    let publicPolicy = policiesData.data?.find(p => p.name === 'Public' || p.name === 'public');

    if (publicPolicy) {
        console.log(`  Found existing policy: ${publicPolicy.id}`);
        return publicPolicy.id;
    }

    // Create a new public policy
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

    // In Directus 11, we need to set this policy as the public access policy in settings
    // or associate it with an unauthenticated role

    // First, check for existing access settings
    const accessRes = await fetch(`${DIRECTUS_URL}/access`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (accessRes.ok) {
        const accessData = await accessRes.json();
        // Check if policy is already linked to public access
        const hasPublicAccess = accessData.data?.some(a => a.policy === policyId && a.role === null);

        if (!hasPublicAccess) {
            // Create access entry for unauthenticated users (role: null)
            const createAccessRes = await fetch(`${DIRECTUS_URL}/access`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    role: null,  // null = unauthenticated
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

async function createPlaceholderFiles(token) {
    console.log('\nCreating placeholder files...');

    const files = {};

    // Import placeholder video
    try {
        const videoRes = await fetch(`${DIRECTUS_URL}/files/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                url: 'https://www.w3schools.com/html/mov_bbb.mp4',
                data: { title: 'Placeholder Video' },
            }),
        });
        if (videoRes.ok) {
            const data = await videoRes.json();
            files.video = data.data.id;
            console.log('  ✓ Placeholder video');
        }
    } catch (e) {
        console.log('  ✗ Video:', e.message);
    }

    // Import placeholder image
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
            files.coverImage = data.data.id;
            console.log('  ✓ Placeholder cover image');
        }
    } catch (e) {
        console.log('  ✗ Image:', e.message);
    }

    return files;
}

async function createLocalSampleData(token, files) {
    console.log('\nCreating local sample data...');

    // Create home_page (singleton - use PATCH)
    try {
        await fetch(`${DIRECTUS_URL}/items/home_page`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                status: 'published',
                intro_heading: 'Der Podcast für App- und Webentwicklung',
                podcast_heading: 'Unsere Podcasts',
                meetup_heading: 'Unsere Meetups',
                highlights_heading: 'Highlights',
                meta_title: 'programmier.bar',
                meta_description: 'Der Podcast für App- und Webentwicklung',
                news: [],
                video: files.video || null,
            }),
        });
        console.log('  ✓ home_page');
    } catch (e) {
        console.log('  ✗ home_page:', e.message);
    }

    // Create tags
    const tagIds = {};
    const tags = ['JavaScript', 'TypeScript', 'Vue.js', 'React', 'Node.js'];
    for (const name of tags) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/tags`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'published', name, published_on: '2024-01-01' }),
            });
            if (res.ok) {
                const data = await res.json();
                tagIds[name] = data.data.id;
            }
        } catch (e) {}
    }
    console.log(`  ✓ tags: ${Object.keys(tagIds).length} created`);

    // Create members
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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status: 'published',
                    ...m,
                    description: `Host of programmier.bar`,
                    team_member: true,
                    published_on: '2024-01-01',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                memberIds.push(data.data.id);
            }
        } catch (e) {}
    }
    console.log(`  ✓ members: ${memberIds.length} created`);

    // Create speakers
    const speakerIds = [];
    const speakers = [
        { first_name: 'Max', last_name: 'Mustermann', slug: 'max-mustermann', occupation: 'CTO at TechCorp' },
        { first_name: 'Anna', last_name: 'Beispiel', slug: 'anna-beispiel', occupation: 'Senior Engineer' },
    ];
    for (const s of speakers) {
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/speakers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status: 'published',
                    ...s,
                    description: 'Guest speaker',
                    listed_hof: true,
                    published_on: '2024-01-01',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                speakerIds.push(data.data.id);
            }
        } catch (e) {}
    }
    console.log(`  ✓ speakers: ${speakerIds.length} created`);

    // Create podcasts
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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status: 'published',
                    ...p,
                    cover_image: files.coverImage || null,
                    audio_url: 'https://example.com/audio.mp3',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                podcastIds.push(data.data.id);
            }
        } catch (e) {}
    }
    console.log(`  ✓ podcasts: ${podcastIds.length} created`);

    // Create podcast relations
    let relCount = 0;
    for (let i = 0; i < podcastIds.length && i < memberIds.length; i++) {
        try {
            await fetch(`${DIRECTUS_URL}/items/podcast_members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ podcast: podcastIds[i], member: memberIds[i], sort: 1 }),
            });
            relCount++;
        } catch (e) {}
    }
    if (speakerIds[0] && podcastIds[0]) {
        try {
            await fetch(`${DIRECTUS_URL}/items/podcast_speakers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ podcast: podcastIds[0], speaker: speakerIds[0], sort: 1 }),
            });
            relCount++;
        } catch (e) {}
    }
    console.log(`  ✓ relations: ${relCount} created`);
}

async function importSampleData(token) {
    console.log('\nTrying to import data from production (requires public access)...');

    // Fetch sample data from production (public endpoints)
    const collections = [
        { name: 'tags', limit: 100 },
        { name: 'members', limit: 20, fields: 'id,status,sort,first_name,last_name,task_area,occupation,description,team_member,website_url,twitter_url,bluesky_url,linkedin_url,github_url,instagram_url,youtube_url,mastodon_url' },
        { name: 'speakers', limit: 30, fields: 'id,status,sort,slug,academic_title,first_name,last_name,occupation,description,website_url,twitter_url,linkedin_url,github_url,instagram_url,youtube_url,bluesky_url,listed_hof' },
        { name: 'podcasts', limit: 15, fields: 'id,status,sort,slug,type,number,title,description,published_on,apple_url,google_url,spotify_url,audio_url,buzzsprout_id' },
        { name: 'meetups', limit: 10, fields: 'id,status,sort,slug,start_on,end_on,title,description,youtube_url,meetup_url,intro,published_on' },
    ];

    for (const { name, limit, fields } of collections) {
        try {
            let url = `${PROD_URL}/items/${name}?limit=${limit}&sort=-id`;
            if (fields) url += `&fields=${fields}`;

            const prodRes = await fetch(url);
            if (!prodRes.ok) {
                console.log(`  ✗ ${name}: Could not fetch from production (${prodRes.status})`);
                continue;
            }

            const prodData = await prodRes.json();
            const items = prodData.data;

            if (!items || items.length === 0) {
                console.log(`  - ${name}: No data in production`);
                continue;
            }

            // Import each item
            let imported = 0;
            let skipped = 0;
            for (const item of items) {
                try {
                    const res = await fetch(`${DIRECTUS_URL}/items/${name}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify(item),
                    });

                    if (res.ok) {
                        imported++;
                    } else {
                        skipped++;
                    }
                } catch (e) {
                    skipped++;
                }
            }

            console.log(`  ✓ ${name}: ${imported} imported, ${skipped} skipped`);
        } catch (e) {
            console.log(`  ✗ ${name}: ${e.message}`);
        }
    }

    // Import junction table data for relations
    console.log('\nImporting relations...');
    const junctions = [
        { name: 'podcast_members', limit: 100 },
        { name: 'podcast_speakers', limit: 100 },
        { name: 'podcast_tags', limit: 200 },
        { name: 'speaker_tags', limit: 200 },
        { name: 'member_tags', limit: 100 },
    ];

    for (const { name, limit } of junctions) {
        try {
            const prodRes = await fetch(`${PROD_URL}/items/${name}?limit=${limit}`);
            if (!prodRes.ok) continue;

            const prodData = await prodRes.json();
            const items = prodData.data || [];

            let imported = 0;
            for (const item of items) {
                try {
                    const res = await fetch(`${DIRECTUS_URL}/items/${name}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify(item),
                    });
                    if (res.ok) imported++;
                } catch (e) {}
            }
            if (imported > 0) {
                console.log(`  ✓ ${name}: ${imported} items`);
            }
        } catch (e) {}
    }
}

async function main() {
    console.log(`Setting up local Directus at ${DIRECTUS_URL}\n`);

    const token = await getToken();
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

    // Always create placeholder files and local sample data
    const files = await createPlaceholderFiles(token);
    await createLocalSampleData(token, files);

    // Optionally try to import from production (usually fails due to auth)
    if (args.includes('--import-data')) {
        await importSampleData(token);
    }

    console.log('\n✅ Done! Local Directus is ready for development.');
    console.log('   The Nuxt website at http://localhost:3000 should now render properly.');
    console.log('   Admin panel: http://localhost:8055 (admin@programmier.bar / 123456)');
}

main().catch(console.error);
