# Secret Rotation Procedure

This document outlines the procedure for rotating secrets used by the XIV Dye Tools Discord Bot.

## Discord Bot Token

### When to Rotate
- Token has been compromised or exposed
- Regular security rotation (recommended: annually)
- Bot permissions have changed significantly

### Rotation Steps

1. **Generate New Token**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Navigate to your application → Bot settings
   - Click "Reset Token" (or "Regenerate" if token is already visible)
   - **Important:** Copy the new token immediately (you won't see it again)

2. **Update Fly.io Secrets**
   ```bash
   fly secrets set DISCORD_TOKEN=<new_token>
   ```

3. **Restart Bot**
   ```bash
   fly apps restart xivdyetools-discord-bot
   ```

4. **Verify Bot is Online**
   - Check Discord server - bot should appear online
   - Test a command to verify functionality
   - Check logs for any errors

5. **Revoke Old Token** (if still accessible)
   - If the old token is still visible in Developer Portal, you can regenerate it to invalidate the old one
   - Note: This step is automatic when you reset the token

## Redis Password (if applicable)

### When to Rotate
- Password has been compromised
- Redis instance has been migrated
- Regular security rotation (recommended: annually)

### Rotation Steps

1. **Connect to Redis**
   ```bash
   redis-cli -h <redis-host> -p <redis-port>
   ```

2. **Set New Password**
   ```bash
   CONFIG SET requirepass <new_password>
   ```

3. **Update Fly.io Secrets**
   ```bash
   fly secrets set REDIS_PASSWORD=<new_password>
   ```

4. **Restart Bot**
   ```bash
   fly apps restart xivdyetools-discord-bot
   ```

5. **Verify Redis Connection**
   - Check bot logs for Redis connection errors
   - Test commands that use Redis caching

## Error Webhook URL

### When to Rotate
- Webhook has been compromised or exposed
- Discord channel has been deleted or permissions changed
- Regular security rotation (recommended: annually)

### Rotation Steps

1. **Create New Webhook**
   - Go to Discord channel settings
   - Navigate to Integrations → Webhooks
   - Create new webhook or regenerate existing one
   - Copy the webhook URL

2. **Update Fly.io Secrets**
   ```bash
   fly secrets set ERROR_WEBHOOK_URL=<new_webhook_url>
   ```

3. **Restart Bot**
   ```bash
   fly apps restart xivdyetools-discord-bot
   ```

4. **Test Error Reporting**
   - Trigger a test error (if possible) or wait for next error
   - Verify error appears in Discord channel

5. **Delete Old Webhook** (if applicable)
   - Delete the old webhook from Discord channel settings

## Security Best Practices

- **Never commit secrets to git** - Always use environment variables or secret management
- **Use strong passwords** - Minimum 32 characters for Redis passwords
- **Rotate regularly** - Annual rotation recommended for all secrets
- **Monitor for exposure** - Check logs and error reports for potential leaks
- **Use different secrets per environment** - Never reuse production secrets in development
- **Document rotation dates** - Keep a log of when secrets were last rotated

## Emergency Procedures

If a secret is compromised:

1. **Immediately rotate the compromised secret** using the steps above
2. **Review logs** for any suspicious activity
3. **Check for unauthorized access** to bot or services
4. **Notify team members** if working in a team
5. **Document the incident** in security logs

## Verification Checklist

After rotating any secret:

- [ ] New secret is set in Fly.io
- [ ] Bot has been restarted
- [ ] Bot appears online in Discord
- [ ] Commands are working correctly
- [ ] No errors in bot logs
- [ ] Redis connection works (if applicable)
- [ ] Error webhook works (if applicable)
- [ ] Old secret has been invalidated

---

**Last Updated:** November 23, 2025  
**Next Review:** November 23, 2026


