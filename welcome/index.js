console.log("🔥🔥🔥 WELCOME FILE LOADED 🔥🔥🔥");

import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS = path.join(__dirname, "assets");

const BACKGROUND = path.join(ASSETS, "background.png");
const HOPE = path.join(ASSETS, "hope you enjoy your stay.png");
const PANELS = path.join(ASSETS, "side pannels.png");

// PUT YOUR WELCOME CHANNEL ID HERE
const WELCOME_CHANNEL_ID = "1533590256354590725";

async function makeWelcomeImage() {
    console.log("[WELCOME] Creating welcome image...");

    if (!fs.existsSync(BACKGROUND)) {
        throw new Error(`Missing: ${BACKGROUND}`);
    }

    const meta = await sharp(BACKGROUND).metadata();

    if (!meta.width || !meta.height) {
        throw new Error("Could not read background.png dimensions.");
    }

    console.log(
        `[WELCOME] Background size: ${meta.width}x${meta.height}`
    );

    const overlays = [];

    if (fs.existsSync(PANELS)) {
        console.log("[WELCOME] Found side pannels.png");

        overlays.push({
            input: await sharp(PANELS)
                .resize(meta.width, meta.height, {
                    fit: "fill"
                })
                .png()
                .toBuffer(),
            top: 0,
            left: 0
        });
    } else {
        console.log("[WELCOME] WARNING: side pannels.png not found");
    }

    if (fs.existsSync(HOPE)) {
        console.log("[WELCOME] Found hope you enjoy your stay.png");

        overlays.push({
            input: await sharp(HOPE)
                .resize(meta.width, meta.height, {
                    fit: "fill"
                })
                .png()
                .toBuffer(),
            top: 0,
            left: 0
        });
    } else {
        console.log("[WELCOME] WARNING: hope you enjoy your stay.png not found");
    }

    return sharp(BACKGROUND)
        .composite(overlays)
        .png()
        .toBuffer();
}

function setupWelcome(client) {

    console.log("[WELCOME] Welcome system loaded.");

    client.on("guildMemberAdd", async (member) => {

        console.log(
            `[WELCOME] MEMBER JOINED: ${member.user.tag} (${member.id})`
        );

        try {

            if (WELCOME_CHANNEL_ID === "YOUR_CHANNEL_ID_HERE") {
                console.error(
                    "[WELCOME] ERROR: You have not set WELCOME_CHANNEL_ID!"
                );
                return;
            }

            console.log(
                `[WELCOME] Looking for channel: ${WELCOME_CHANNEL_ID}`
            );

            const channel = await member.guild.channels.fetch(
                WELCOME_CHANNEL_ID
            );

            if (!channel) {
                console.error(
                    "[WELCOME] ERROR: Channel was not found."
                );
                return;
            }

            console.log(
                `[WELCOME] Found channel: #${channel.name}`
            );

            if (!channel.isTextBased()) {
                console.error(
                    "[WELCOME] ERROR: Channel is not a text channel."
                );
                return;
            }

            const image = await makeWelcomeImage();

            console.log("[WELCOME] Image created successfully.");

            const attachment = new AttachmentBuilder(image, {
                name: "welcome.png"
            });

            const embed = new EmbedBuilder()
                .setColor(0x2f9e68)
                .setTitle("Welcome!")
                .setDescription(
                    `Welcome ${member}!\n` +
                    `You are our **${member.guild.memberCount}th Member**.\n` +
                    `Please look around and talk to some of our members.`
                )
                .setImage("attachment://welcome.png")
                .setTimestamp();

            await channel.send({
                embeds: [embed],
                files: [attachment]
            });

            console.log(
                `[WELCOME] SUCCESS! Welcome message sent for ${member.user.tag}`
            );

        } catch (error) {

            console.error(
                "[WELCOME] FAILED TO SEND WELCOME MESSAGE:"
            );

            console.error(error);

        }
    });
}

export { setupWelcome };