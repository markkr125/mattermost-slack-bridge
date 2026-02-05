# Deployment Guide

## Production Deployment Strategies

This guide covers deploying the bridge application to production environments.

## Pre-Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Environment variables documented
- [ ] Redis instance provisioned
- [ ] Slack app configured and approved
- [ ] Mattermost bot created with proper permissions
- [ ] Monitoring solution selected
- [ ] Backup strategy defined
- [ ] Security review completed

## Infrastructure Requirements

### Compute Resources

**Minimum Specifications**:
- CPU: 1 vCPU
- RAM: 512 MB
- Storage: 1 GB
- Network: Stable internet connection

**Recommended Specifications**:
- CPU: 2 vCPU
- RAM: 1 GB
- Storage: 5 GB
- Network: Low-latency connection

### Redis Instance

**Development**: Local Redis server
**Production**: Managed Redis service (AWS ElastiCache, Redis Labs, etc.)

Recommended configuration:
- Memory: 256 MB minimum
- Persistence: AOF enabled
- Maxmemory policy: `allkeys-lru`
- Connection pool: 10 connections

## Deployment Options

### Option 1: Traditional Server Deployment

Deploy directly on a virtual machine or bare metal server.

**Steps**:

1. Provision server (Ubuntu 20.04 LTS recommended)
2. Install Node.js and npm
3. Clone repository
4. Install dependencies
5. Configure environment
6. Set up process manager (PM2)
7. Configure firewall
8. Set up reverse proxy (optional)

**Process Manager Setup** (using PM2):

```bash
npm install -g pm2
pm2 start src/index.js --name bridge-service
pm2 save
pm2 startup
```

### Option 2: Container Deployment

Create a container image for consistent deployments.

**Dockerfile** (create in project root):

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
```

Build and run:
```bash
docker build -t mm-slack-bridge .
docker run -d --env-file .env -p 3000:3000 mm-slack-bridge
```

### Option 3: Platform-as-a-Service

Deploy to platforms like Heroku, Railway, or Render.

**Heroku Example**:

1. Create Heroku app
2. Add Redis addon: `heroku addons:create heroku-redis:mini`
3. Set environment variables
4. Deploy: `git push heroku main`

### Option 4: Serverless Deployment

Not recommended due to WebSocket requirements for Mattermost connection.

## Environment Configuration

### Production Environment Variables

Create a secure `.env` file or use your platform's secret management:

```env
# Application
NODE_ENV=production
PORT=3000

# Slack
SLACK_BOT_TOKEN=xoxb-prod-token-here
SLACK_SIGNING_SECRET=prod-signing-secret

# Mattermost
MM_TOKEN=prod-access-token
MM_URL=https://mattermost.yourcompany.com

# Channel Configuration
CHANNEL_MAPPINGS=[{"slack":"C_PROD_1","mattermost":"prod_mm_1"},{"slack":"C_PROD_2","mattermost":"prod_mm_2"}]

# Redis
REDIS_URL=redis://prod-redis.example.com:6379
REDIS_EXPIRY_DAYS=180

# Optional: TLS for Redis
# REDIS_URL=rediss://prod-redis.example.com:6380
```

### Secrets Management

**Never commit secrets to version control.**

Use platform-specific solutions:
- AWS: AWS Secrets Manager or Parameter Store
- GCP: Secret Manager
- Azure: Key Vault
- Heroku: Config Vars
- Docker: Environment files or secrets

## Security Hardening

### Network Security

1. **Firewall Configuration**
   - Allow inbound: Port 3000 (or your chosen port)
   - Allow inbound: Port 443 (if using HTTPS)
   - Allow outbound: Slack API (*.slack.com)
   - Allow outbound: Mattermost server
   - Allow outbound: Redis server

2. **Use HTTPS**
   - Set up reverse proxy (nginx, Apache)
   - Obtain SSL certificate (Let's Encrypt)
   - Terminate SSL at proxy level

3. **Network Isolation**
   - Place Redis in private subnet
   - Use VPC/VPN for internal services
   - Restrict access to management ports

### Application Security

1. **Environment Variables**
   - Never log secrets
   - Use read-only file permissions
   - Rotate tokens regularly

2. **Dependencies**
   - Run `npm audit` before deployment
   - Keep dependencies updated
   - Use `npm ci` for reproducible builds

3. **Process Isolation**
   - Run as non-root user
   - Use minimal file permissions
   - Enable security modules (AppArmor, SELinux)

## Monitoring and Logging

### Application Logging

The bridge logs to stdout/stderr. Capture logs using:

- **Systemd**: `journalctl -u bridge-service -f`
- **PM2**: `pm2 logs bridge-service`
- **Docker**: `docker logs -f container-id`
- **Cloud platforms**: Built-in log aggregation

### Log Aggregation

Send logs to centralized service:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- CloudWatch Logs

### Health Monitoring

Monitor these metrics:

1. **Application Health**
   - Process uptime
   - Memory usage
   - CPU usage
   - Event loop lag

2. **Connection Health**
   - Redis connection status
   - WebSocket connection status
   - Slack API response times
   - Mattermost API response times

3. **Business Metrics**
   - Messages processed per minute
   - Message latency
   - Error rate
   - File transfer success rate

### Alerting

Set up alerts for:
- Application crashes
- Redis connection failures
- WebSocket disconnections
- High error rates
- Memory exhaustion

## Scaling Considerations

### Vertical Scaling

Increase resources on single instance:
- Add more CPU cores
- Increase memory
- Use faster network

### Horizontal Scaling

Currently limited due to:
- Single WebSocket connection to Mattermost
- In-memory channel maps
- No leader election

**Future improvements needed**:
- Redis Pub/Sub for coordination
- Shared state in Redis
- Leader election mechanism

### Database Scaling

Redis scaling options:
- Redis Cluster for high availability
- Redis Sentinel for automatic failover
- Increase memory allocation
- Enable persistence (RDB + AOF)

## Backup and Recovery

### What to Backup

1. **Configuration**
   - Environment variables
   - Channel mappings
   - API credentials

2. **Redis Data** (optional)
   - Message mappings
   - Thread relationships

### Backup Strategy

**Configuration Backup**:
- Store in secret manager
- Document in secure wiki
- Version control (encrypted)

**Redis Backup**:
- Enable RDB snapshots
- Enable AOF persistence
- Regular backups to S3/GCS

### Disaster Recovery

**Recovery Time Objective (RTO)**: 15 minutes
**Recovery Point Objective (RPO)**: 24 hours

**Recovery Steps**:
1. Provision new infrastructure
2. Restore Redis from backup (if available)
3. Deploy application from repository
4. Configure environment variables
5. Start application
6. Verify connectivity

## Maintenance

### Regular Tasks

**Daily**:
- Check error logs
- Monitor resource usage
- Verify message flow

**Weekly**:
- Review security advisories
- Check Redis memory usage
- Analyze performance metrics

**Monthly**:
- Update dependencies
- Rotate access tokens
- Review backup integrity
- Performance optimization

### Updates and Rollbacks

**Update Process**:
1. Test in staging environment
2. Schedule maintenance window
3. Deploy new version
4. Monitor for issues
5. Keep previous version ready

**Rollback Process**:
1. Stop new version
2. Start previous version
3. Verify functionality
4. Investigate issues
5. Plan fix

### Zero-Downtime Deployment

Not currently supported due to WebSocket connection.

**Workaround**:
- Schedule brief maintenance window
- Notify users in advance
- Keep downtime under 1 minute

## Troubleshooting Production Issues

### Application Won't Start

1. Check environment variables
2. Verify Redis connectivity
3. Check port availability
4. Review startup logs
5. Verify file permissions

### High Memory Usage

1. Check for memory leaks
2. Review Redis memory usage
3. Analyze heap dumps
4. Restart application
5. Increase memory allocation

### Messages Not Syncing

1. Check channel mappings
2. Verify bot permissions
3. Test API connectivity
4. Review Redis connectivity
5. Check error logs

### Connection Drops

1. Check network stability
2. Verify WebSocket timeout
3. Review Mattermost server health
4. Check firewall rules
5. Monitor reconnection attempts

## Performance Optimization

### Application Level

1. **Caching**
   - Cache user info lookups
   - Cache channel info
   - Use Redis for distributed cache

2. **Async Processing**
   - Process messages concurrently
   - Use worker threads for file transfers
   - Queue heavy operations

3. **Connection Pooling**
   - Reuse HTTP connections
   - Configure keep-alive
   - Set proper timeouts

### Redis Level

1. **Memory Management**
   - Monitor memory usage
   - Adjust TTL values
   - Use appropriate data structures

2. **Connection Management**
   - Configure connection pool
   - Set proper timeouts
   - Monitor connection usage

### Network Level

1. **Latency Reduction**
   - Deploy close to services
   - Use CDN for static assets
   - Optimize DNS resolution

2. **Bandwidth Optimization**
   - Compress large messages
   - Stream file transfers
   - Batch small operations

## Production Checklist

Pre-Launch:
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Documentation updated
- [ ] Team trained
- [ ] Rollback plan ready
- [ ] Support contacts listed

Post-Launch:
- [ ] Monitor first 24 hours closely
- [ ] Gather user feedback
- [ ] Document issues
- [ ] Optimize based on metrics
- [ ] Schedule post-mortem

## Support

For production issues:
1. Check this documentation
2. Review application logs
3. Search GitHub issues
4. Create detailed bug report
5. Contact maintainers

## Additional Resources

- Security best practices
- Node.js production checklist
- Redis administration guide
- Slack API status page
- Mattermost troubleshooting guide
