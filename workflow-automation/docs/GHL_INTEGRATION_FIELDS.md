# GoHighLevel Integration Fields

This document outlines all the fields we store when connecting a GoHighLevel account.

## Fields Stored During OAuth Callback

### Core IDs (Available Immediately)
- **locationId**: The GoHighLevel location/sub-account ID
- **companyId**: The GoHighLevel company/agency ID  
- **userId**: The GoHighLevel user ID who authorized the connection

### User Information (From JWT)
- **userType**: Type of user (Location, Agency, etc.)
- **email**: User's email from JWT token

### OAuth Details
- **scope**: Authorized OAuth scopes
- **tokenType**: Token type (typically "Bearer")
- **encryptedTokens**: Encrypted access and refresh tokens

### JWT Metadata
- **iss**: Token issuer
- **aud**: Token audience
- **sub**: Token subject (user identifier)

### Timestamps
- **connectedAt**: When the integration was connected
- **lastTokenRefresh**: Last time tokens were refreshed
- **tokenExpiresAt**: When the current token expires

### Integration Metadata
- **integrationId**: Integration ID from JWT (if available)
- **marketplaceAppId**: Marketplace app ID from JWT (if available)

### Permissions & Features
- **permissions**: Array of granted permissions
- **features**: Array of enabled features

## Fields Populated After Connection (via fetch-details endpoint)

### Location Details
- **locationName**: Business/location name
- **locationTimezone**: Location's timezone
- **locationAddress**: Full address object
  - address
  - city
  - state
  - postalCode
  - country
- **locationPhone**: Location's phone number
- **locationEmail**: Location's email
- **locationWebsite**: Location's website

### Company Details
- **companyName**: Parent company/agency name

### User Details
- **userName**: Full name of connected user
- **userEmail**: User's email
- **userRole**: User's role in the system
- **userPhone**: User's phone number
- **userPermissions**: Detailed user permissions array

### System Data
- **accessibleLocations**: Array of all locations user can access
  - id
  - name
  - companyId
- **pipelines**: Array of opportunity pipelines
  - id
  - name
  - stages (count)

## Critical Fields for System Operation

The following fields are essential for the system to function properly:

1. **locationId** - Required for all API calls
2. **companyId** - Needed for company-level operations
3. **encryptedTokens** - Required for authentication
4. **locationName** - Important for UI display
5. **userName** - Important for audit trails

## Usage in the System

These fields are used throughout the application for:

- **API Authentication**: Using encrypted tokens and location ID
- **Multi-location Support**: Using accessible locations list
- **User Context**: Displaying user and location information
- **Permissions**: Checking what operations are allowed
- **Timezone Handling**: Converting times for the location
- **Audit Trails**: Tracking who performed actions

## Updating Fields

Fields are updated in two scenarios:

1. **During OAuth**: Core fields are captured from the token exchange
2. **Post-Connection**: Additional details are fetched via API calls to populate descriptive fields

The system is designed to gracefully handle missing fields and will attempt to fetch them when needed.