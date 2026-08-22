const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ASSETS = path.join(__dirname, "assets");

const BACKGROUND = path.join(ASSETS, "background.png");
const HOPE = path.join(ASSETS, "hope you enjoy your stay.png");
const PANELS = path.join(ASSETS, "side pannels.png");

// Put your Discord welcome channel ID here.
// Example: const WELCOME_CHANNEL_ID = "123456789012345678";
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || "1533859646031265952";

async function makeWelcomeImage() {
    if (!fs.existsSync(BACKGROUND)) {
        throw new Error('Missing "assets/background.png"');
    }

    const meta = await sharp(BACKGROUND).metadata();

    if (!meta.width || !meta.height) {
        throw new Error("Could not read the size of background.png");
    }

    const overlays = [];

    for (const file of [PANELS, HOPE]) {
        if (fs.existsSync(file)) {
            overlays.push({
                input: await sharp(file)
                    .resize(meta.width, meta.height, { fit: "fill" })
                    .png()
                    .toBuffer(),
                top: 0,
                left: 0
            });
        }
    }

    return sharp(BACKGROUND)
        .composite(overlays)
        .png()
        .toBuffer();
}

function setupWelcome(client) {
    client.on("guildMemberAdd", async (member) => {
        try {
            if (WELCOME_CHANNEL_ID === "PUT_CHANNEL_ID_HERE") {
                console.error("[WELCOME] Set WELCOME_CHANNEL_ID in welcome/index.js first.");
                return;
            }

            const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);

            if (!channel || !channel.isTextBased()) {
                console.error("[WELCOME] The configured channel could not be found or is not a text channel.");
                return;
            }

            const image = await makeWelcomeImage();

            const attachment = new AttachmentBuilder(image, {
                name: "welcome.png"
            });

            const embed = new EmbedBuilder()
                .setColor(0x2f9e68)
                .setTitle("Welcome!")
                .setDescription(
                    `Welcome ${member}!\\n` +
                    `You are our **${member.guild.memberCount}th Member**.\\n` +
                    `Please look around and talk to some of our members.`
                )
                .setImage("attachment://welcome.png")
                .setTimestamp();

            await channel.send({
                embeds: [embed],
                files: [attachment]
            });

            console.log(`[WELCOME] Sent welcome message for ${member.user.tag}`);
        } catch (error) {
            console.error("[WELCOME] Failed to send welcome message:", error);
        }
    });
}

module.exports = { setupWelcome };
