import { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from "discord.js";

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
        .setDescription("Deploy the ticket creation panel"),

    new SlashCommandBuilder()
        .setName("ticketcat")
        .setDescription("Set the category where new tickets will be created")
        .addChannelOption(o => o
            .setName("category")
            .setDescription("Category to create ticket channels under")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
];

export function createTicketSystem({ config = {}, tickets = { tickets: {} }, saveTickets = () => {}, saveConfig = () => {}, getLogChannelId = () => null } = {}) {
    const ticketStore = tickets?.tickets || {};
    const ticketCategory = String(config.ticketCategory || "").trim();
    const ticketButtonLabels = Array.isArray(config.ticketTypes) && config.ticketTypes.length > 0
        ? config.ticketTypes.map(t => String(t?.label || "").trim()).filter(Boolean)
        : ["Open a Ticket"];

    async function createTicketChannel(interaction) {
        if (!interaction.guild) {
            return { ok: false, message: "Tickets can only be created in a server." };
        }

        if (!ticketCategory) {
            return { ok: false, message: "ticket category not set up yet" };
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

            if (!interaction.customId.startsWith("ticket_panel_open")) {
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

            if (interaction.commandName !== "ticket" && interaction.commandName !== "ticket-panel" && interaction.commandName !== "ticketcat") {
                return false;
            }

            if (interaction.commandName === "ticket") {
                await interaction.reply({
                    content: "Ticket system is running in fallback mode. Use `/ticket-panel` to open a support ticket.",
                    flags: MessageFlags.Ephemeral
                });

                return true;
            }

            if (interaction.commandName === "ticketcat") {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    await interaction.reply({
                        content: "❌ You need administrator permissions to use `/ticketcat`.",
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                const category = interaction.options.getChannel("category");
                if (!category || category.type !== ChannelType.GuildCategory) {
                    await interaction.reply({
                        content: "❌ Please select a valid category channel.",
                        flags: MessageFlags.Ephemeral
                    });
                    return true;
                }

                config.ticketCategory = category.id;
                saveConfig();

                await interaction.reply({
                    content: `✅ Ticket category set to <#${category.id}> for this guild.`,
                    flags: MessageFlags.Ephemeral
                });

                return true;
            }

            if (!ticketCategory) {
                await interaction.reply({
                    content: "ticket category not set up yet",
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            const panelEmbed = new EmbedBuilder()
                .setColor("#4ea8de")
                .setTitle("🎫 Ticket Creation Panel")
                .setDescription(
                    ticketCategory
                        ? `Use the buttons below to open a support ticket. New ticket channels will be created under the configured category ID: ${ticketCategory}.`
                        : "Use the buttons below to open a support ticket. The ticket channel will be created in the configured ticket category once you set one in the dashboard."
                )
                .setTimestamp();

            const row = new ActionRowBuilder();
            for (const label of ticketButtonLabels) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ticket_panel_open:${encodeURIComponent(label)}`)
                        .setLabel(label)
                        .setStyle(ButtonStyle.Primary)
                );
            }

            await interaction.reply({
                embeds: [panelEmbed],
                components: [row]
            });

            return true;
        }
    };
}
