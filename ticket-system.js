import { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } from "discord.js";

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
        ),

    new SlashCommandBuilder()
        .setName("ticketmanagement")
        .setDescription("Open the ticket management panel for this ticket channel")
];

const REVIEW_CHANNEL_ID = "1533837247810371724";

export function createTicketSystem({ config = {}, tickets = { tickets: {} }, saveTickets = () => {}, saveConfig = () => {}, getLogChannelId = () => null, isStaffMember = () => false } = {}) {
    const ticketStore = tickets?.tickets || {};

    function saveTicketState() {
        saveTickets();
    }

    function ensureTicketDefaults(ticket) {
        if (!ticket) return;
        if (!Array.isArray(ticket.messages)) ticket.messages = [];
        if (typeof ticket.claimedBy !== "string") ticket.claimedBy = null;
        if (typeof ticket.closedBy !== "string") ticket.closedBy = null;
        if (typeof ticket.closedAt !== "string") ticket.closedAt = null;
        if (typeof ticket.closeReason !== "string") ticket.closeReason = null;
        if (typeof ticket.pendingReviewRequest !== "boolean") ticket.pendingReviewRequest = false;
        if (!ticket.reviewRequest || typeof ticket.reviewRequest !== "object") {
            ticket.reviewRequest = null;
        }
    }

    function getTicketByChannel(channelId) {
        if (!channelId) return null;
        const ticket = ticketStore[String(channelId)] || null;
        if (ticket) ensureTicketDefaults(ticket);
        return ticket;
    }

    function getOpenTicketByChannel(channelId) {
        const ticket = getTicketByChannel(channelId);
        return ticket && String(ticket.status).toLowerCase() === "open" ? ticket : null;
    }

    function getTicketById(ticketId) {
        if (!ticketId) return null;
        return Object.values(ticketStore).find(ticket => String(ticket.id) === String(ticketId)) || null;
    }

    function getPendingReviewByOpener(userId) {
        if (!userId) return null;
        return Object.values(ticketStore).find(ticket => ticket.opener === userId && ticket.pendingReviewRequest) || null;
    }

    function parseUserIds(input) {
        const text = String(input || "");
        const matches = [...text.matchAll(/<@!?(\d{17,20})>|(\d{17,20})/g)];
        const ids = matches
            .map(match => match[1] || match[2])
            .filter(Boolean)
            .map(id => String(id).trim());
        return [...new Set(ids)];
    }

    function formatTicketTimestamp(value) {
        if (!value) return "Unknown";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toISOString().replace("T", " ").replace("Z", " UTC");
    }

    function buildTranscriptText(ticket) {
        if (!ticket) return "";
        const lines = [];
        lines.push(`Ticket ID: ${ticket.id}`);
        lines.push(`Channel ID: ${ticket.channel}`);
        lines.push(`Opened By: ${ticket.opener}`);
        lines.push(`Created At: ${formatTicketTimestamp(ticket.createdAt)}`);
        lines.push(`Status: ${ticket.status || "unknown"}`);
        if (ticket.claimedBy) lines.push(`Claimed By: ${ticket.claimedBy}`);
        if (ticket.closedBy) lines.push(`Closed By: ${ticket.closedBy}`);
        if (ticket.closedAt) lines.push(`Closed At: ${formatTicketTimestamp(ticket.closedAt)}`);
        if (ticket.closeReason) lines.push(`Close Reason: ${ticket.closeReason}`);
        if (ticket.reviewRequest) {
            lines.push(`Pending Review: ${ticket.pendingReviewRequest ? "Yes" : "No"}`);
            lines.push(`Review Status: ${ticket.reviewRequest.status || "unknown"}`);
            if (ticket.reviewRequest.requestedBy) lines.push(`Review Requested By: ${ticket.reviewRequest.requestedBy}`);
            if (ticket.reviewRequest.reviewText) lines.push(`Review Text: ${ticket.reviewRequest.reviewText}`);
        }
        lines.push("\nMessage history:\n");

        const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
        for (let index = 0; index < messages.length; index += 1) {
            const message = messages[index];
            lines.push(`---`);
            lines.push(`Message #${index + 1}`);
            lines.push(`Author: ${message.authorTag} (${message.authorId})`);
            lines.push(`Timestamp: ${formatTicketTimestamp(message.createdAt)}`);
            lines.push(`Content: ${message.content || "(no content)"}`);
            if (Array.isArray(message.attachments) && message.attachments.length > 0) {
                lines.push("Attachments:");
                message.attachments.forEach(att => {
                    lines.push(`- ${att.name || "attachment"}: ${att.url}`);
                });
            }
            lines.push("");
        }

        if (messages.length === 0) {
            lines.push("No messages were logged for this ticket channel.");
        }

        return lines.join("\n");
    }

    function closeTicket(channelId, closedBy, opts = {}) {
        const ticket = getOpenTicketByChannel(channelId);
        if (!ticket) return null;
        ticket.status = "closed";
        ticket.closed = true;
        ticket.closedAt = new Date().toISOString();
        ticket.closedBy = String(closedBy || "unknown");
        ticket.closeReason = typeof opts.reason === "string" ? opts.reason.trim() : null;
        ticket.closedByStaff = Boolean(opts.closedByStaff);
        if (opts.reviewText) {
            ticket.reviewRequest = ticket.reviewRequest || {};
            ticket.reviewRequest.reviewText = opts.reviewText;
            ticket.reviewRequest.status = "submitted";
            ticket.reviewRequest.respondedAt = new Date().toISOString();
        }
        ticket.pendingReviewRequest = false;
        saveTicketState();
        return ticket;
    }

    function claimTicket(channelId, staffId) {
        const ticket = getTicketByChannel(channelId);
        if (!ticket) return null;
        ticket.claimedBy = String(staffId);
        saveTicketState();
        return ticket;
    }

    function requestTicketReview(channelId, requestedBy) {
        const ticket = getTicketByChannel(channelId);
        if (!ticket) return null;
        ticket.pendingReviewRequest = true;
        ticket.reviewRequest = {
            status: "pending",
            requestedBy: String(requestedBy || "unknown"),
            requestedAt: new Date().toISOString(),
            reviewText: null,
            respondedAt: null
        };
        saveTicketState();
        return ticket;
    }

    function submitTicketReview(userId, reviewText) {
        const ticket = getPendingReviewByOpener(userId);
        if (!ticket) return null;
        ticket.reviewRequest = ticket.reviewRequest || {};
        ticket.reviewRequest.reviewText = String(reviewText || "").trim();
        ticket.reviewRequest.respondedAt = new Date().toISOString();
        ticket.reviewRequest.status = "completed";
        ticket.pendingReviewRequest = false;
        saveTicketState();
        return ticket;
    }

    function buildTicketCreationEmbed(ticket, openerId) {
        return new EmbedBuilder()
            .setColor("#4ea8de")
            .setTitle("🎫 Support Ticket")
            .setDescription(`Thanks for reaching out, <@${openerId}>. Describe your issue and a staff member will assist you shortly.`)
            .addFields(
                { name: "Ticket ID", value: ticket.id, inline: true },
                { name: "Status", value: "Open", inline: true },
                { name: "Opened By", value: `<@${openerId}>`, inline: false }
            )
            .setTimestamp();
    }

    async function createTicketChannel(interaction) {
        if (!interaction.guild) {
            return { ok: false, message: "Tickets can only be created in a server." };
        }

        const ticketCategory = String(config.ticketCategory || "").trim();
        if (!ticketCategory) {
            return { ok: false, message: "ticket category not set up yet" };
        }

        const category = await interaction.guild.channels.fetch(ticketCategory).catch(() => null);
        if (!category || category.type !== ChannelType.GuildCategory) {
            return { ok: false, message: "ticket category not set up yet" };
        }

        const nextCounter = Number(config.ticketCounter || 0) + 1;
        const channelName = `ticket-${nextCounter}`;
        const guild = interaction.guild;
        const categoryId = category.id;

        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId,
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
                openerTag: interaction.user.tag,
                guild: guild.id,
                channel: channel.id,
                status: "open",
                createdAt: new Date().toISOString(),
                closed: false,
                firstMessageProcessed: false,
                description: "Support ticket created from the fallback panel.",
                messages: [],
                claimedBy: null,
                closedBy: null,
                closedAt: null,
                closeReason: null,
                closedByStaff: false,
                pendingReviewRequest: false,
                reviewRequest: null
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

            const openButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("ticket_user_close")
                    .setLabel("Close Ticket")
                    .setStyle(ButtonStyle.Danger)
            );

            await channel.send({
                embeds: [buildTicketCreationEmbed(ticketStore[channel.id], interaction.user.id)],
                components: [openButtons]
            });

            return { ok: true, channelId: channel.id, ticketId, message: `✅ Ticket created in <#${channel.id}>.` };
        } catch (error) {
            console.error("Ticket channel creation failed:", error);
            return { ok: false, message: `❌ I couldn't create your ticket right now: ${error.message || "unknown error"}` };
        }
    }

    function logTicketMessage(message) {
        if (!message?.channelId || !message?.author || message.author.bot) return false;
        const ticket = getOpenTicketByChannel(message.channelId);
        if (!ticket) return false;

        ticket.messages = ticket.messages || [];
        ticket.messages.push({
            id: message.id,
            authorId: message.author.id,
            authorTag: message.author.tag,
            content: message.content || "",
            createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
            attachments: Array.from(message.attachments.values()).map(upload => ({
                name: String(upload.name || "attachment"),
                url: upload.url
            }))
        });
        saveTicketState();
        return true;
    }

    async function sendTranscriptToChannel(guild, ticket) {
        const transcriptChannelId = getLogChannelId(guild.id, "transcript");
        if (!transcriptChannelId) {
            return { ok: false, error: "Transcript log channel is not configured." };
        }
        const transcriptChannel = await guild.channels.fetch(transcriptChannelId).catch(() => null);
        if (!transcriptChannel || !transcriptChannel.isTextBased()) {
            return { ok: false, error: "Transcript log channel could not be reached." };
        }

        const transcriptText = buildTranscriptText(ticket);
        const transcriptBuffer = Buffer.from(transcriptText, "utf8");
        const transcriptFileName = `${ticket.id}.txt`;

        const embed = new EmbedBuilder()
            .setColor("#4ea8de")
            .setTitle("📜 Ticket Transcript")
            .setDescription(`Transcript generated for <#${ticket.channel}>.`)
            .addFields(
                { name: "Ticket ID", value: ticket.id, inline: true },
                { name: "Opened By", value: `<@${ticket.opener}>`, inline: true },
                { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true }
            )
            .setTimestamp();

        await transcriptChannel.send({ embeds: [embed], files: [{ attachment: transcriptBuffer, name: transcriptFileName }] }).catch(error => {
            console.error("Failed to send ticket transcript:", error);
        });

        return { ok: true };
    }

    async function sendReviewEmbed(guild, ticket, reviewText, reviewSource) {
        const reviewChannel = await guild.channels.fetch(REVIEW_CHANNEL_ID).catch(() => null);
        if (!reviewChannel || !reviewChannel.isTextBased()) {
            return { ok: false, error: "Review channel not available." };
        }

        const reviewEmbed = new EmbedBuilder()
            .setTitle("Ticket Review Received")
            .setColor("#5865F2")
            .addFields(
                { name: "Ticket ID", value: ticket.id, inline: true },
                { name: "Opened By", value: `<@${ticket.opener}>`, inline: true },
                { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true },
                { name: "Review", value: reviewText || "No review text provided.", inline: false },
                { name: "Source", value: reviewSource, inline: true }
            )
            .setTimestamp();

        await reviewChannel.send({ embeds: [reviewEmbed] }).catch(error => {
            console.error("Failed to send ticket review embed:", error);
        });

        return { ok: true };
    }

    async function closeTicketAndNotify(interaction, ticket, closedById, reason, options = {}) {
        const closedTicket = closeTicket(ticket.channel, closedById, {
            reason,
            closedByStaff: Boolean(options.closedByStaff),
            reviewText: options.reviewText
        });

        if (!closedTicket) {
            await interaction.reply({ content: "❌ This ticket is already closed or could not be found.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return { ok: false };
        }

        const ticketChannel = interaction.guild?.channels.cache.get(ticket.channel) || await interaction.guild?.channels.fetch(ticket.channel).catch(() => null);
        if (!ticketChannel || !ticketChannel.isTextBased()) {
            await interaction.reply({ content: "❌ Could not locate the ticket channel to send the closure update.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return { ok: false };
        }

        const closeEmbed = new EmbedBuilder()
            .setColor("#2d5a3d")
            .setTitle("✅ Ticket Closed")
            .setDescription(reason ? `This ticket was closed with reason: ${reason}` : "This ticket has been closed.")
            .addFields(
                { name: "Ticket ID", value: closedTicket.id, inline: true },
                { name: "Closed By", value: `<@${closedById}>`, inline: true },
                { name: "Claimed By", value: closedTicket.claimedBy ? `<@${closedTicket.claimedBy}>` : "Unclaimed", inline: true }
            )
            .setTimestamp();

        await ticketChannel.send({ embeds: [closeEmbed], components: [] }).catch(() => {});
        await sendTranscriptToChannel(interaction.guild, closedTicket);

        if (options.sendReview || options.reviewText) {
            await sendReviewEmbed(interaction.guild, closedTicket, options.reviewText || reason || "No review text provided.", options.reviewSource || "Ticket Closure");
        }

        await interaction.reply({ content: `✅ ${reason ? "Ticket closed with reason." : "Ticket closed."} Transcript generated and sent to the configured log channel.`, flags: MessageFlags.Ephemeral }).catch(() => {});

        return { ok: true };
    }

    async function closeTicketWithModal(interaction, ticket, closedById, reason, reviewSource) {
        return closeTicketAndNotify(interaction, ticket, closedById, reason, {
            closedByStaff: true,
            reviewText: reason,
            sendReview: true,
            reviewSource
        });
    }

    async function handleButtonInteraction(interaction) {
        if (!interaction.isButton()) {
            return false;
        }

        if (interaction.customId.startsWith("ticket_panel_open")) {
            const result = await createTicketChannel(interaction);
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral });
            return true;
        }

        if (interaction.customId === "ticket_user_close") {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }
            if (interaction.user.id !== ticket.opener) {
                await interaction.reply({ content: "❌ Only the ticket opener may close this ticket with this button.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const modal = new ModalBuilder()
                .setCustomId("ticket_user_close_modal")
                .setTitle("Close Ticket Review");

            const reasonInput = new TextInputBuilder()
                .setCustomId("ticket_user_close_reason")
                .setLabel("Why are you closing this ticket? (Review)")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal).catch(error => {
                console.error("Failed to show ticket user close modal:", error);
            });
            return true;
        }

        if (interaction.customId.startsWith("ticketmgmt_")) {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const staffAllowed = isStaffMember(interaction.member);
            if (!staffAllowed) {
                await interaction.reply({ content: "❌ You do not have permission to manage tickets.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            if (interaction.customId === "ticketmgmt_close") {
                await closeTicketAndNotify(interaction, ticket, interaction.user.id, null, { closedByStaff: true });
                return true;
            }

            if (interaction.customId === "ticketmgmt_close_reason") {
                const modal = new ModalBuilder()
                    .setCustomId("ticket_close_reason_modal")
                    .setTitle("Close Ticket With Reason");

                const reasonInput = new TextInputBuilder()
                    .setCustomId("ticket_close_reason")
                    .setLabel("Reason for closing the ticket")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                await interaction.showModal(modal).catch(error => {
                    console.error("Failed to show ticket close reason modal:", error);
                });
                return true;
            }

            if (interaction.customId === "ticketmgmt_claim") {
                claimTicket(ticket.channel, interaction.user.id);
                const claimEmbed = new EmbedBuilder()
                    .setColor("#4ea8de")
                    .setTitle("Your ticket has been claimed!")
                    .setDescription(`Staff Member: <@${interaction.user.id}>\nThey will assist you shortly.`)
                    .setTimestamp();
                await interaction.channel.send({ embeds: [claimEmbed] }).catch(() => {});
                await interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>.`, flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            if (interaction.customId === "ticketmgmt_add_users" || interaction.customId === "ticketmgmt_remove_users") {
                const modal = new ModalBuilder()
                    .setCustomId(interaction.customId === "ticketmgmt_add_users" ? "ticket_add_users_modal" : "ticket_remove_users_modal")
                    .setTitle(interaction.customId === "ticketmgmt_add_users" ? "Add Users to Ticket" : "Remove Users from Ticket");

                const userIdsInput = new TextInputBuilder()
                    .setCustomId("ticket_user_ids")
                    .setLabel("User IDs or mentions")
                    .setPlaceholder("<@123...>, 456..., 789...")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(userIdsInput));
                await interaction.showModal(modal).catch(error => {
                    console.error("Failed to show ticket user management modal:", error);
                });
                return true;
            }

            if (interaction.customId === "ticketmgmt_lar") {
                const opener = await interaction.client.users.fetch(ticket.opener).catch(() => null);
                if (!opener) {
                    await interaction.reply({ content: "❌ Could not find the ticket opener to send the review request.", flags: MessageFlags.Ephemeral }).catch(() => {});
                    return true;
                }

                requestTicketReview(ticket.channel, interaction.user.id);
                const dmEmbed = new EmbedBuilder()
                    .setColor("#4ea8de")
                    .setTitle("How was your service?")
                    .setDescription("Please reply to this DM with a short text review of the ticket experience.")
                    .addFields(
                        { name: "Ticket", value: ticket.id, inline: true },
                        { name: "Asked By", value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setTimestamp();

                await opener.send({ embeds: [dmEmbed] }).catch(async err => {
                    console.error("Could not DM ticket opener for LAR:", err);
                    await interaction.reply({ content: "❌ I could not DM the ticket opener. They may have DMs disabled.", flags: MessageFlags.Ephemeral }).catch(() => {});
                });

                await interaction.reply({ content: `✅ Review request sent to the ticket opener.`, flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }
        }

        return false;
    }

    async function handleModalSubmit(interaction) {
        if (!interaction.isModalSubmit()) return false;

        if (interaction.customId === "ticket_user_close_modal") {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }
            if (interaction.user.id !== ticket.opener) {
                await interaction.reply({ content: "❌ Only the ticket opener may close this ticket.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const reason = interaction.fields.getTextInputValue("ticket_user_close_reason").trim();
            await closeTicketAndNotify(interaction, ticket, interaction.user.id, reason, {
                reviewText: reason,
                sendReview: true,
                reviewSource: "User Close"
            });
            return true;
        }

        if (interaction.customId === "ticket_close_reason_modal") {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }
            const reason = interaction.fields.getTextInputValue("ticket_close_reason").trim();
            await closeTicketWithModal(interaction, ticket, interaction.user.id, reason, "Staff Close With Reason");
            return true;
        }

        if (interaction.customId === "ticket_add_users_modal" || interaction.customId === "ticket_remove_users_modal") {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const userIds = parseUserIds(interaction.fields.getTextInputValue("ticket_user_ids"));
            const allow = interaction.customId === "ticket_add_users_modal";
            const channel = interaction.guild?.channels.cache.get(ticket.channel) || await interaction.guild?.channels.fetch(ticket.channel).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                await interaction.reply({ content: "❌ Could not find the ticket channel.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const results = [];
            for (const userId of userIds) {
                try {
                    if (allow) {
                        await channel.permissionOverwrites.edit(userId, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true,
                            AttachFiles: true,
                            EmbedLinks: true
                        });
                        results.push(`Added <@${userId}>`);
                    } else {
                        await channel.permissionOverwrites.delete(userId).catch(() => {});
                        results.push(`Removed <@${userId}>`);
                    }
                } catch (error) {
                    results.push(`Failed ${allow ? "adding" : "removing"} <@${userId}>`);
                }
            }

            await interaction.reply({ content: `✅ ${allow ? "Users added" : "Users removed"}:\n${results.join("\n")}`, flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        return false;
    }

    async function handleChatInputCommand(interaction) {
        if (!interaction.isChatInputCommand()) return false;

        if (interaction.commandName === "ticket") {
            await interaction.reply({ content: "Ticket system is running in fallback mode. Use `/ticket-panel` to open a support ticket.", flags: MessageFlags.Ephemeral });
            return true;
        }

        if (interaction.commandName === "ticketcat") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: "❌ You need administrator permissions to use `/ticketcat`.", flags: MessageFlags.Ephemeral });
                return true;
            }

            const category = interaction.options.getChannel("category");
            if (!category || category.type !== ChannelType.GuildCategory) {
                await interaction.reply({ content: "❌ Please select a valid category channel.", flags: MessageFlags.Ephemeral });
                return true;
            }

            config.ticketCategory = category.id;
            saveConfig();
            await interaction.reply({ content: `✅ Ticket category set to <#${category.id}> for this guild.`, flags: MessageFlags.Ephemeral });
            return true;
        }

        if (interaction.commandName === "ticket-panel") {
            const ticketCategory = String(config.ticketCategory || "").trim();
            const ticketButtonLabels = Array.isArray(config.ticketTypes) && config.ticketTypes.length > 0
                ? config.ticketTypes.map(t => String(t?.label || "").trim()).filter(Boolean)
                : ["Open a Ticket"];

            if (!ticketCategory) {
                await interaction.reply({ content: "ticket category not set up yet", flags: MessageFlags.Ephemeral });
                return true;
            }

            const category = await interaction.guild.channels.fetch(ticketCategory).catch(() => null);
            if (!category || category.type !== ChannelType.GuildCategory) {
                await interaction.reply({ content: "ticket category not set up yet", flags: MessageFlags.Ephemeral });
                return true;
            }

            const panelEmbed = new EmbedBuilder()
                .setColor("#4ea8de")
                .setTitle("🎫 Ticket Creation Panel")
                .setDescription(
                    ticketCategory
                        ? `Use the buttons below to open a support ticket. New ticket channels will be created under the configured category: <#${ticketCategory}>.`
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

            await interaction.reply({ embeds: [panelEmbed], components: [row] });
            return true;
        }

        if (interaction.commandName === "ticketmanagement") {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ No open ticket was found in this channel.", flags: MessageFlags.Ephemeral });
                return true;
            }

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("ticketmgmt_close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId("ticketmgmt_close_reason").setLabel("Close With Reason").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("ticketmgmt_claim").setLabel("Claim Ticket").setStyle(ButtonStyle.Success)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("ticketmgmt_add_users").setLabel("Add Users").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("ticketmgmt_remove_users").setLabel("Remove Users").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("ticketmgmt_lar").setLabel("LAR – Leave A Review").setStyle(ButtonStyle.Success)
            );

            const panelEmbed = new EmbedBuilder()
                .setColor("#4ea8de")
                .setTitle("Ticket Management Panel")
                .setDescription("Use the buttons below to manage this ticket and generate a transcript when it closes.")
                .addFields(
                    { name: "Ticket", value: ticket.id, inline: true },
                    { name: "Opened By", value: `<@${ticket.opener}>`, inline: true },
                    { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [panelEmbed], components: [row1, row2], flags: MessageFlags.Ephemeral });
            return true;
        }

        return false;
    }

    return {
        handleButtonInteraction,
        handleModalSubmit,
        handleChatInputCommand,
        logTicketMessage,
        getTicketByChannel,
        getTicketById,
        getPendingReviewByOpener,
        submitTicketReview,
        sendReviewEmbed,
        generateTranscriptText: buildTranscriptText
    };
}
