# GitHub Actions Workflows

## Algolia Index Maintenance

### Overview
The `algolia-index-maintenance.yml` workflow automatically checks and repairs the Algolia search index to keep it synchronized with the database.

### Schedule
- **Automatic**: Every Monday at 6:00 AM UTC (8:00 AM CET)
- **Manual**: Can be triggered manually via GitHub Actions UI

### Required Secrets
Configure these secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

| Secret Name | Description | Example                         |
|------------|-------------|---------------------------------|
| `PUBLIC_URL` | Public URL of your Directus CMS | `https://admin.programmier.bar` |
| `ALGOLIA_INDEX` | Name of your Algolia search index | `programmierbar_search`         |
| `ALGOLIA_APP_ID` | Your Algolia Application ID | `ABC123DEF456`                  |
| `ALGOLIA_API_KEY` | Your Algolia Admin API Key | `abc123def456...`               |

### Features

#### Automatic Monitoring
- Runs weekly to catch and fix index drift
- Creates GitHub issues automatically if repairs fail
- Provides detailed logging and statistics

#### Manual Repair Options
- Repair all collections: Run workflow with `collection: all`
- Repair specific collection: Choose from dropdown (podcasts, meetups, speakers, etc.)
- Emergency repairs can be triggered anytime

#### Smart Issue Creation
When the workflow fails, it automatically creates a GitHub issue with:
- Failure timestamp and details
- Link to workflow logs
- Troubleshooting checklist
- Mentions maintainers team

### Usage

#### Manual Trigger
1. Go to `Actions` tab in GitHub
2. Select `Algolia Index Maintenance` workflow
3. Click `Run workflow`
4. Choose collection to repair (default: all)
5. Click `Run workflow` button

#### Monitoring
- Check the `Actions` tab for recent workflow runs
- Failed runs will create issues in the `Issues` tab
- Workflow logs show detailed repair statistics

### Troubleshooting

#### Common Issues
1. **Permission Errors**: Verify `PUBLIC_URL` allows public API access
2. **Authentication Errors**: Check `ALGOLIA_API_KEY` has admin permissions
3. **Network Errors**: Ensure both Directus and Algolia are accessible

#### Manual Repair
If the automated repair fails, you can run it manually:

```bash
cd directus-cms/extensions/directus-extension-programmierbar-bundle
npm install
npm run algolia-index-repair all
```

#### Environment Variables
For local testing, create a `.env` file:

```env
PUBLIC_URL=https://your-directus-url.com
ALGOLIA_INDEX=your_index_name
ALGOLIA_APP_ID=your_app_id
ALGOLIA_API_KEY=your_admin_api_key
```

### Security Notes
- Use Admin API Key (not Search-only key) for repair operations
- Store all sensitive values as GitHub Secrets, never in code
- The workflow only accesses public API endpoints of Directus
- Consider IP restrictions on Algolia API keys if needed

### Maintenance
- Review workflow logs monthly for patterns
- Update Node.js version in workflow as needed
- Monitor Algolia API usage and rate limits
- Consider adjusting schedule frequency based on content update patterns