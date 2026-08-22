HENDRY COUNTY PROJECT - AUTOMATIC WELCOME
=============================================

This version DOES NOT use /welcome.

It automatically sends the welcome message whenever a member joins
your Discord server.

FOLDER:
welcome/
  index.js
  README.txt
  assets/
    background.png
    hope you enjoy your stay.png
    side pannels.png

1. PUT YOUR PNGs IN assets/
--------------------------------
Use these exact filenames:

background.png
hope you enjoy your stay.png
side pannels.png

background.png controls the final image size.

For example, if background.png is 1920x1080, the final generated
welcome image will be 1920x1080.

The other two PNGs are resized to exactly the same dimensions and
placed over the background.

Use transparent PNGs for the overlays so the background can show
through.

2. SET THE WELCOME CHANNEL
--------------------------------
Open welcome/index.js and find:

const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || "PUT_CHANNEL_ID_HERE";

Replace PUT_CHANNEL_ID_HERE with the ID of the Discord channel where
you want welcomes to be sent.

Example:

const WELCOME_CHANNEL_ID = "123456789012345678";

To copy a channel ID, enable Developer Mode in Discord, right-click
the welcome channel and choose Copy Channel ID.

3. ADD THIS TO YOUR MAIN BOT index.js
--------------------------------
At the very bottom of your main index.js:

const { setupWelcome } = require("./welcome");
setupWelcome(client);

IMPORTANT:
Your bot needs the GuildMembers intent enabled.

Your client should include:

GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers

For example:

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

4. INSTALL SHARP
--------------------------------
Run this in your bot folder:

npm install sharp

5. BOT PERMISSIONS
--------------------------------
Make sure the bot can:
- View the welcome channel
- Send Messages
- Embed Links
- Attach Files

That's it.

When someone joins, the bot will automatically:
1. Detect the member joining.
2. Generate the image using your three PNGs.
3. Mention the new member.
4. Show the server member number.
5. Send the image immediately into your chosen welcome channel.
