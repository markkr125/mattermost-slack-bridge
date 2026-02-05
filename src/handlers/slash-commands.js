// src/handlers/slash-commands.js
const { createContextLogger } = require('../utils/logger');
const { perfMonitor } = require('../utils/perf-monitor');

const log = createContextLogger('slash-commands');

/**
 * Handle slash commands for bridge control and monitoring
 */

/**
 * Process Slack slash command
 * @param {Object} slackApp - Slack app instance
 * @param {Object} mmApi - Mattermost API client
 * @param {Object} command - Slack command payload
 */
async function handleSlackSlashCommand(slackApp, mmApi, command) {
  const { command: cmdName, text, user_id, channel_id } = command;
  
  log.info('Received Slack slash command', { command: cmdName, text, userId: user_id });

  // Only handle our bridge command
  if (cmdName !== '/bridge') {
    return;
  }

  const args = text.trim().split(/\s+/);
  const subcommand = args[0] || 'help';

  let response;

  try {
    switch (subcommand) {
      case 'status':
        response = await getStatusResponse();
        break;
      
      case 'stats':
        response = await getStatsResponse();
        break;
      
      case 'perf':
        response = await getPerfResponse();
        break;
      
      case 'help':
      default:
        response = getHelpResponse();
        break;
    }

    return {
      response_type: 'ephemeral',
      text: response
    };
  } catch (error) {
    log.error('Error executing slash command', { error: error.message });
    return {
      response_type: 'ephemeral',
      text: `❌ Error: ${error.message}`
    };
  }
}

/**
 * Process Mattermost slash command
 * @param {Object} slackApp - Slack app instance
 * @param {Object} mmApi - Mattermost API client
 * @param {Object} payload - Mattermost command payload
 */
async function handleMattermostSlashCommand(slackApp, mmApi, payload) {
  const { command, text, user_id, channel_id } = payload;
  
  log.info('Received Mattermost slash command', { command, text, userId: user_id });

  // Only handle our bridge command
  if (command !== '/bridge') {
    return;
  }

  const args = text.trim().split(/\s+/);
  const subcommand = args[0] || 'help';

  let responseText;

  try {
    switch (subcommand) {
      case 'status':
        responseText = await getStatusResponse();
        break;
      
      case 'stats':
        responseText = await getStatsResponse();
        break;
      
      case 'perf':
        responseText = await getPerfResponse();
        break;
      
      case 'help':
      default:
        responseText = getHelpResponse();
        break;
    }

    // Post ephemeral message in Mattermost
    await mmApi.post('/posts', {
      channel_id: channel_id,
      message: responseText,
      props: {
        from_webhook: 'true'
      }
    });

    return { status: 'ok' };
  } catch (error) {
    log.error('Error executing Mattermost slash command', { error: error.message });
    
    try {
      await mmApi.post('/posts', {
        channel_id: channel_id,
        message: `❌ Error: ${error.message}`
      });
    } catch (postError) {
      log.error('Failed to post error message', { error: postError.message });
    }

    return { status: 'error', error: error.message };
  }
}

/**
 * Get help message
 */
function getHelpResponse() {
  return `
🌉 **Bridge Commands**

Available commands:
• \`/bridge status\` - Show bridge connection status
• \`/bridge stats\` - Display message statistics
• \`/bridge perf\` - Show performance metrics
• \`/bridge help\` - Show this help message

Use these commands to monitor and control the bridge.
  `.trim();
}

/**
 * Get bridge status
 */
async function getStatusResponse() {
  const uptime = process.uptime();
  const uptimeHours = Math.floor(uptime / 3600);
  const uptimeMins = Math.floor((uptime % 3600) / 60);

  return `
🌉 **Bridge Status**

✅ Bridge is operational
⏱️  Uptime: ${uptimeHours}h ${uptimeMins}m
💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
  `.trim();
}

/**
 * Get message statistics
 */
async function getStatsResponse() {
  const { getConnectionStatus } = require('../metrics/metrics');
  const status = getConnectionStatus();

  return `
📊 **Bridge Statistics**

Slack: ${status.slack ? '🟢 Connected' : '🔴 Disconnected'}
Mattermost: ${status.mattermost ? '🟢 Connected' : '🔴 Disconnected'}

See /metrics endpoint for detailed statistics.
  `.trim();
}

/**
 * Get performance metrics
 */
async function getPerfResponse() {
  const summary = perfMonitor.summarize();
  
  if (Object.keys(summary).length === 0) {
    return '📈 **Performance Metrics**\n\nNo performance data available yet.';
  }

  const lines = ['📈 **Performance Metrics**', ''];
  
  for (const [label, stats] of Object.entries(summary)) {
    if (!stats) continue;
    
    lines.push(`**${label}**`);
    lines.push(`  Samples: ${stats.sampleCount}`);
    lines.push(`  Avg: ${stats.timing.meanMs.toFixed(2)}ms`);
    lines.push(`  P95: ${stats.timing.p95Ms.toFixed(2)}ms`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

module.exports = {
  handleSlackSlashCommand,
  handleMattermostSlashCommand
};
