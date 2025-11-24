# Privacy Policy

**Last Updated:** December 2024  
**Bot Name:** XIV Dye Tools Discord Bot  
**Developer:** [Your Name/Organization]

## Overview

This privacy policy describes how the XIV Dye Tools Discord Bot ("the Bot", "we", "us") collects, uses, and protects your information when you interact with it on Discord.

## Data Collection

### What Data We Collect

The Bot collects the following information when you use its commands:

1. **Discord User ID**
   - Your unique Discord user identifier
   - Used for: Analytics, rate limiting, security event tracking

2. **Discord Guild ID** (Server ID)
   - The unique identifier of the Discord server where you use the Bot
   - Used for: Analytics, usage statistics

3. **Command Usage Data**
   - Command name (e.g., `/match`, `/harmony`)
   - Timestamp of command execution
   - Success/failure status
   - Error types (if command fails)
   - Used for: Analytics, performance monitoring, error tracking

4. **Security Events**
   - Rate limit violations
   - Input validation failures
   - Suspicious activity patterns
   - Used for: Security monitoring, abuse prevention

### What Data We Do NOT Collect

- **Message Content:** The Bot does not read or store message content outside of command interactions
- **Personal Information:** We do not collect names, email addresses, or other personal identifiers beyond Discord IDs
- **Image Data:** Images uploaded via `/match-image` are processed temporarily and **not stored permanently**
- **Location Data:** We do not collect any location or geographic information
- **Payment Information:** The Bot is free to use and does not process any payments

## Data Storage

### Storage Location

- **Primary Storage:** Redis database (if configured)
- **Fallback Storage:** In-memory storage (if Redis unavailable)
- **Hosting:** Data is stored on the hosting provider's infrastructure (Fly.io)

### Data Retention

- **Analytics Data:** Retained for **30 days**
  - Daily command counts
  - Command usage statistics
  - Unique user counts (using HyperLogLog for privacy)
  
- **Security Events:** Retained for **7-30 days**
  - Per-user security events: **7 days**
  - Daily security event summaries: **30 days**
  
- **Rate Limiting Data:** Retained temporarily (typically minutes to hours)
  - Used for rate limit enforcement
  - Automatically expires based on rate limit windows

- **Image Data:** **Not stored**
  - Images are processed in memory
  - No permanent storage of uploaded images

## Data Usage

### How We Use Your Data

1. **Service Operation**
   - Processing your commands and requests
   - Rate limiting to prevent abuse
   - Error handling and debugging

2. **Analytics**
   - Understanding command usage patterns
   - Monitoring bot performance
   - Identifying popular features
   - Tracking error rates

3. **Security**
   - Detecting and preventing abuse
   - Rate limit enforcement
   - Security event logging
   - Protecting the Bot and its users

4. **Improvements**
   - Identifying bugs and issues
   - Planning feature improvements
   - Optimizing performance

### Data Sharing

**We do not sell, rent, or share your data with third parties.**

The only exception is:
- **Error Notifications:** If configured, error information may be sent to an error webhook for debugging purposes. This is optional and can be disabled.

## Your Rights

### Access to Your Data

You can request information about data collected about you by:
- Contacting the bot developer
- Using the `/stats` command to see aggregated usage statistics (does not show personal data)

### Data Deletion

- Most data automatically expires based on retention policies (7-30 days)
- You can request immediate deletion of your data by contacting the bot developer
- Note: Some data may be retained for security/legal purposes if required

### Opt-Out

- You can stop using the Bot at any time
- Data collection stops when you stop using the Bot
- Historical data will be automatically deleted per retention policies

## Security

### Data Protection

- **Encryption:** Data in transit is encrypted (HTTPS/TLS)
- **Access Control:** Data access is restricted to authorized systems only
- **Security Monitoring:** Security events are logged and monitored
- **Rate Limiting:** Prevents abuse and protects user data

### Security Measures

- Input validation to prevent malicious data
- Image upload security (size limits, format validation, decompression bomb protection)
- Secret redaction in logs
- Non-root Docker container execution
- Regular security audits

## Children's Privacy

The Bot is designed for users 13 years and older (Discord's minimum age requirement). We do not knowingly collect data from users under 13.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date at the top of this document.

**Significant changes will be:**
- Announced in the Bot's support server (if available)
- Documented in the changelog
- Reflected in this document

## Contact

If you have questions or concerns about this privacy policy or your data:

- **Discord Support Server:** [Link if available]
- **GitHub Issues:** [Repository link]
- **Email:** [Contact email if available]

## Compliance

This Bot complies with:
- **Discord Terms of Service**
- **Discord Developer Policy**
- **GDPR** (for EU users): We provide data access and deletion rights
- **CCPA** (for California users): We do not sell personal information

## Data Processing Legal Basis (GDPR)

For EU users, our legal basis for processing data is:
- **Legitimate Interest:** Operating and improving the Bot service
- **Consent:** By using the Bot, you consent to data collection as described
- **Contract:** Data processing is necessary to provide the Bot service

## Third-Party Services

The Bot uses the following third-party services:

1. **Discord API**
   - Required for Bot operation
   - Subject to Discord's privacy policy: https://discord.com/privacy

2. **Redis** (if configured)
   - Used for data storage
   - Hosted on Fly.io infrastructure
   - Subject to Fly.io's privacy policy: https://fly.io/legal/privacy-policy/

3. **Fly.io** (Hosting)
   - Bot hosting infrastructure
   - Subject to Fly.io's privacy policy

## Data Breach Notification

In the unlikely event of a data breach:
- We will notify affected users within 72 hours
- We will report to relevant authorities as required by law
- We will take immediate steps to secure the system

## Additional Information

### Image Processing

When you upload an image via `/match-image`:
- The image is processed in memory only
- No permanent storage occurs
- Image data is discarded after processing
- EXIF metadata is stripped for privacy

### Command Logging

Command executions are logged for:
- Analytics purposes
- Error tracking
- Performance monitoring

Logs contain:
- Command name
- User ID (anonymized in some contexts)
- Timestamp
- Success/failure status

Logs do NOT contain:
- Command input values (colors, dye names, etc.)
- Personal messages
- Sensitive information

## Questions?

If you have any questions about this privacy policy or how we handle your data, please contact us using the methods listed in the Contact section above.

---

**By using the XIV Dye Tools Discord Bot, you agree to this privacy policy.**

