# Mattermost-slack-bridge
> Experimental bride between mattermost and slack (not affiliated with mattermost or slack).

The following features are currently supported, but limited to oner channel at the moment:
- Chats in channels work
- Threads work
- File sharing should also work

What does not work (and will not work):
- Direct messages
- Huddles

## Todo:
- Better error handling, do not crash on errors
- Threads are currently tracked in RAM, it needs to be in some sort external process (Redis?)
- Support more then one channel, allow some sort of channel mapping.

# Configure the Slack App
## OAuth & Permissions
- In the app dashboard, go to OAuth & Permissions in the left sidebar.
- Under Bot Token Scopes, click Add an OAuth Scope.
- Add the following scopes (required for the bridge code):
    - chat:write (Send messages as your app)
    - chat:write.customize (Send messages as your app with a customized username and avatar)
    - files:read (View files shared in channels and conversations that your app has been added to)
    - groups:history (View messages and other content in private channels that your app has been added to)
    - groups:read (View basic information about private channels that your app has been added to)
    - groups:write (Manage private channels that your app has been added to and create new ones)
    - users:read (View people in a workspace)
- Save changes.

## Enable Event Subscriptions
 - Go to Event Subscriptions in the left sidebar.
 - Toggle Enable Events to On.
 - In the Request URL field, enter your server's public URL, e.g., http://your-server:3000/slack/events.
    - Note: Your server must be publicly accessible (use ngrok or a similar tool for local testing to expose localhost:3000 to the internet).
    - Slack will send a verification challenge to this URL. Ensure your server (from the provided bridge.js) is running to respond to it.
 - Under Subscribe to bot events, click Add Bot User Event and select:
    - message.channels (to listen for messages in public channels).
- Save changes. Slack will verify the Request URL; if it fails, check that your server is running and accessible.

## Install the App to Your Workspace
- Go to OAuth & Permissions > Install App to Workspace.
- Authorize the app in your Slack workspace.
- After installation, copy the Bot User OAuth Token (starts with xoxb-). This is your SLACK_BOT_TOKEN for the .env file.

## Get the Signing Secret
- Go to Basic Information in the left sidebar.
- Under App Credentials, copy the Signing Secret. This is your SLACK_SIGNING_SECRET for the .env file.

## Get Slack Channel ID:
- In Slack, right-click the channel you want to bridge, select View channel details, and copy the Channel ID (e.g., C0123456789) from the bottom. Add it to .env as SLACK_CHANNEL_ID.

# Configure mattermost bot
## Enable Personal Access Tokens
- Go to System Console (accessible via the menu in the top-left corner as a system admin) > Integrations > Integration Management.
- Ensure Enable Personal Access Tokens is set to true. This allows bots to authenticate using tokens.
- Save changes.

## Create a Bot Account
- Under System Console > Integrations > Bot Accounts, and make sure bot accounts are enabled.
- After that got out of the System Console, and got to0 Integrations console, on the left side select Bot Accounts.
- Click Create Bot Account.
   - The bot needs to have "post:all" permission enabled.
- Copy the Bot Token
- This is your MM_TOKEN for the .env file
```env
MM_TOKEN=your-bot-token
```
## Configure usernames and picture overwride 
For the username and profile picture from slack to showup on mattermost:
- Go to System Console > Integrations > Integration Management.
- Enable **Enable integrations to override usernames**.
- Enable **Enable integrations to override profile picture icons**.









