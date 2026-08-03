import { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from "discord.js";

// Minimal fallback ticket system.
// Keeps the bot bootable while still providing a usable ticket panel.
export const ticketCommands = [
    new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Ticket system placeholder")
        .addSubcommand(sub =>
            sub.setName("status")
                .setDescription("Show ticket system status")
        ),

    new SlashCommandBuilder()
        .setName("ticket-panel")
        .setDescription("Deploy the ticket creation panel")
];

export function createTicketSystem({ config = {}, tickets = { tickets: {} }, saveTickets = () => {}, saveConfig = () => {}, getLogChannelId = () => null } = {}) {
    const ticketStore = tickets?.tickets || {};
    const ticketCategory = String(config.ticketCategory || "").trim();

    async function createTicketChannel(interaction) {
        if (!interaction.guild) {
            return { ok: false, message: "Tickets can only be created in a server." };
        }

        const nextCounter = Number(config.ticketCounter || 0) + 1;
        const channelName = `ticket-${nextCounter}`;
        const guild = interaction.guild;
        const categoryId = ticketCategory || null;

        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId || undefined,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ["ViewChannel"]
                    },
                    {
                        id: interaction.user.id,
                        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles", "EmbedLinks"]
                    }
                ],
                reason: `Support ticket created by ${interaction.user.tag}`
            });

            const ticketId = `TICKET-${String(nextCounter).padStart(6, "0")}`;
            ticketStore[channel.id] = {
                id: ticketId,
                opener: interaction.user.id,
                channel: channel.id,
                status: "open",
                createdAt: new Date().toISOString(),
                closed: false,
                firstMessageProcessed: false,
                description: "Support ticket created from the fallback panel."
            };

            config.ticketCounter = nextCounter;
            saveTickets();
            saveConfig();

            const ticketLogChannelId = getLogChannelId(guild.id, "ticket") || getLogChannelId(guild.id, "moderation") || null;
            if (ticketLogChannelId) {
                const logChannel = guild.channels.cache.get(ticketLogChannelId) || await guild.channels.fetch(ticketLogChannelId).catch(() => null);
                if (logChannel?.isTextBased()) {
                    try {
                        await logChannel.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#4ea8de")
                                    .setTitle("🎫 New Ticket Created")
                                    .setDescription(`A new support ticket was opened by <@${interaction.user.id}>.`)
                                    .addFields(
                                        { name: "Ticket", value: ticketId, inline: true },
                                        { name: "Channel", value: `<#${channel.id}>`, inline: true }
                                    )
                                    .setTimestamp()
                            ]
                        });
                    } catch {}
                }
            }

            await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#4ea8de")
                        .setTitle("🎫 Support Ticket")
                        .setDescription(`Thanks for reaching out, <@${interaction.user.id}>. Describe your issue and a staff member will assist you shortly.`)
                        .addFields(
                            { name: "Ticket ID", value: ticketId, inline: true },
                            { name: "Status", value: "Open", inline: true }
                        )
                        .setTimestamp()
                ]
            });

            return {
                ok: true,
                channelId: channel.id,
                ticketId,
                message: `✅ Ticket created in <#${channel.id}>.`
            };
        } catch (error) {
            console.error("Ticket channel creation failed:", error);
            return {
                ok: false,
                message: `❌ I couldn't create your ticket right now: ${error.message || "unknown error"}`
            };
        }
    }

    return {
        async handleButtonInteraction(interaction) {
            if (!interaction.isButton()) {
                return false;
            }

            if (interaction.customId !== "ticket_panel_open") {
                return false;
            }

            const result = await createTicketChannel(interaction);
            await interaction.reply({
                content: result.message,
                flags: MessageFlags.Ephemeral
            });

            return true;
        },
        async handleModalSubmit() {
            return false;
        },
        async handleChatInputCommand(interaction) {
            if (!interaction.isChatInputCommand()) {
                return false;
            }

            if (interaction.commandName !== "ticket" && interaction.commandName !== "ticket-panel") {
                return false;
            }

            if (interaction.commandName === "ticket") {
                await interaction.reply({
                    content: "Ticket system is running in fallback mode. Use `/ticket-panel` to open a support ticket.",
                    flags: MessageFlags.Ephemeral
                });

                return true;
            }

            const panelEmbed = new EmbedBuilder()
                .setColor("#4ea8de")
                .setTitle("🎫 Ticket Creation Panel")
                .setDescription("Use the button below to open a support ticket. The ticket channel will be created under your configured ticket category.")
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("ticket_panel_open")
                    .setLabel("Open a Ticket")
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({
                embeds: [panelEmbed],
                components: [row]
            });

            return true;
        }
    };
}
