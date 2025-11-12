# Speaker Info Portal Implementation

## Overview

This implementation provides a public speaker information portal that allows external speakers to update their profile information through a token-based authentication system without requiring access to the Directus backend.

## Features Implemented

### 1. Token-Based Authentication
- **Route**: `/speaker-info/[token]`
- **Security**: Only accessible with valid tokens stored in the speakers collection
- **Protection**: Direct access without token shows error page

### 2. Dynamic Schema-Based Form Generation
- **Dynamic Fields**: Forms are generated based on the actual Directus speakers collection schema
- **Automatic Updates**: Changes to the database schema automatically reflect in the form
- **Field Types**: Supports text, email, URL, textarea, and file upload fields
- **Field Filtering**: Excludes internal/admin fields (id, status, etc.) from public form

### 3. Organized User Interface
- **Grouped Fields**: Form fields are organized into logical sections:
  - Basic Information (name, occupation, etc.)
  - Biography & Description (long text fields)
  - Social Media & Links (URL fields)
  - Images & Files (file uploads)
  - System Information (readonly fields)
- **Responsive Design**: Uses Tailwind CSS for mobile-friendly interface
- **User Feedback**: Clear success/error messages and loading states

### 4. File Upload Support
- **Image Uploads**: Supports profile images and other files
- **Validation**: File type and size validation (max 5MB, image types only)
- **Progress Tracking**: Visual upload progress indicators
- **Integration**: Uploaded files are properly linked to the speaker record

### 5. Data Validation
- **Client-side Validation**: Email format, URL format, required fields
- **Server-side Integration**: Respects Directus validation rules
- **User-friendly Errors**: Clear error messages for validation failures

## Files Created/Modified

### Core Implementation Files
- `composables/usePublicDirectus.ts` - Public Directus API client
- `composables/useDynamicSpeakerForm.ts` - Dynamic form generation and handling
- `components/DynamicFormField.vue` - Reusable form field component
- `pages/speaker-info/[token].vue` - Main portal page
- `pages/speaker-info/index.vue` - Error page for missing tokens

### Implementation Details

#### Token System
The system expects a `token` field in the speakers collection that uniquely identifies each speaker. The token should be:
- Unique per speaker
- Long enough to be secure (minimum 10 characters)
- Provided to speakers via secure communication

#### API Endpoints Used
- `GET /items/speakers?filter[token][_eq]=<token>` - Get speaker by token
- `PATCH /items/speakers/<id>` - Update speaker data
- `GET /fields/speakers` - Get collection schema
- `POST /files` - Upload files

#### Security Considerations
- No authentication required (relies on token secrecy)
- Only allows updates to the specific speaker record matching the token
- Excludes sensitive fields from the public form
- File upload validation prevents malicious uploads

## Directus Configuration Required

### 1. Public Role Permissions
The Directus public role needs the following permissions:

#### Speakers Collection
- **Read**: Filter by token field only
- **Update**: Own records only (filtered by token)
- **Fields**: Exclude sensitive fields from public access

#### Files Collection
- **Create**: Allow file uploads
- **Read**: Allow access to uploaded files

### 2. Database Schema
Add a `token` field to the speakers collection:
- Type: String
- Interface: Input (or UUID for auto-generation)
- Required: Yes
- Unique: Yes

### 3. Environment Variables
Ensure `DIRECTUS_CMS_URL` is properly configured in the Nuxt application.

## Usage Instructions

### For Administrators
1. Add token field to speakers collection in Directus
2. Generate unique tokens for each speaker
3. Configure public role permissions
4. Send speakers their portal URLs: `https://programmier.bar/speaker-info/[their-token]`

### For Speakers
1. Access the portal using the provided URL
2. Update profile information using the form
3. Upload new images if needed
4. Submit the form to save changes
5. Receive confirmation of successful updates

## Error Handling

The system handles various error scenarios:
- Invalid or missing tokens
- Network connectivity issues
- File upload failures
- Validation errors
- Permission issues

All errors are displayed to users with clear, actionable messages.

## Future Enhancements

Possible improvements for future versions:
1. Email notifications on successful updates
2. Preview of how the profile will appear on the website
3. Support for multiple image uploads
4. Integration with social media APIs for automatic link validation
5. Audit trail of changes made through the portal

## Testing

To test the implementation:
1. Ensure Directus is running with proper permissions
2. Create a test speaker record with a token
3. Visit `/speaker-info/[test-token]`
4. Verify form loads with current speaker data
5. Test form submission and file uploads
6. Verify data updates in Directus backend

## Support

For questions or issues with the speaker portal, speakers should contact:
- Email: kontakt@programmier.bar
- The portal includes this contact information for user reference