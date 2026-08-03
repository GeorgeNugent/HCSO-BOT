import { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } from "discord.js";

const REVIEW_CHANNEL_ID = "1533837247810371724";
const PANEL_BUTTON_PREFIX = "ticket_panel_open:";
const USER_CLOSE_BUTTON_ID = "ticket_user_close";
const STAFF_CLOSE_BUTTON_ID = "ticketmgmt_close";
const STAFF_CLOSE_REASON_BUTTON_ID = "ticketmgmt_close_reason";
const STAFF_CLAIM_BUTTON_ID = "ticketmgmt_claim";
const STAFF_ADD_USERS_BUTTON_ID = "ticketmgmt_add_users";
const STAFF_REMOVE_USERS_BUTTON_ID = "ticketmgmt_remove_users";
const STAFF_LAR_BUTTON_ID = "ticketmgmt_lar";

export const ticketCommands = [
    new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Ticket system helper commands")
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName("status")
                .setDescription("Show ticket status for this channel")
        ),

    new SlashCommandBuilder()
        .setName("ticket-panel")
        .setDescription("Post the ticket creation panel")
        .setDMPermission(false),

    new SlashCommandBuilder()
        .setName("ticket-panel-config")
        .setDescription("Configure the ticket panel title and description")
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName("title")
                .setDescription("Set the ticket panel title")
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("description")
                .setDescription("Set the ticket panel description")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("ticketcat")
        .setDescription("Set the category where new tickets will be created")
        .setDMPermission(false)
        .addChannelOption(option =>
            option.setName("category")
                .setDescription("Category to create ticket channels under")
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("ticket-management")
        .setDescription("Open the ticket management panel for a ticket channel")
        .setDMPermission(false)
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Ticket channel to manage (optional)")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("ticketmanagement")
        .setDescription("Open the ticket management panel for a ticket channel")
        .setDMPermission(false)
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Ticket channel to manage (optional)")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),
];

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

    function getPendingReviewByOpener(userId) {
        if (!userId) return null;
        return Object.values(ticketStore).find(ticket => ticket.opener === userId && ticket.pendingReviewRequest) || null;
    }

    function requestTicketReview(channelId, requestedBy) {
        const ticket = getTicketByChannel(channelId);
        if (!ticket || ticket.status !== "open") return null;

        ticket.pendingReviewRequest = true;
        ticket.reviewRequest = ticket.reviewRequest || {};
        ticket.reviewRequest.status = "requested";
        ticket.reviewRequest.requestedBy = String(requestedBy || "unknown");
        ticket.reviewRequest.requestedAt = new Date().toISOString();
        saveTicketState();
        return ticket;
    }

    function submitTicketReview(openerId, reviewText) {
        const ticket = getPendingReviewByOpener(openerId);
        if (!ticket) return null;

        ticket.pendingReviewRequest = false;
        ticket.reviewRequest = ticket.reviewRequest || {};
        ticket.reviewRequest.reviewText = String(reviewText || "").trim();
        ticket.reviewRequest.status = "submitted";
        ticket.reviewRequest.respondedAt = new Date().toISOString();
        saveTicketState();
        return ticket;
    }

    function parseUserIds(input) {
        const text = String(input || "");
        const matches = [...text.matchAll(/<@!?(\d{17,20})>|(\d{17,20})/g)];
        return [...new Set(matches.map(match => match[1] || match[2]).filter(Boolean).map(id => String(id).trim()))];
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
        if (ticket.pendingReviewRequest) lines.push(`Pending Review: Yes`);
        if (ticket.reviewRequest) {
            lines.push(`Review Status: ${ticket.reviewRequest.status || "unknown"}`);
            if (ticket.reviewRequest.requestedBy) lines.push(`Review Requested By: ${ticket.reviewRequest.requestedBy}`);
            if (ticket.reviewRequest.reviewText) lines.push(`Review Text: ${ticket.reviewRequest.reviewText}`);
            if (ticket.reviewRequest.respondedAt) lines.push(`Review Responded At: ${formatTicketTimestamp(ticket.reviewRequest.respondedAt)}`);
        }

        lines.push("");
        lines.push("--- Message History ---");
        lines.push("");

        const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
        if (messages.length === 0) {
            lines.push("No messages were logged for this ticket channel.");
            return lines.join("\n");
        }

        for (let index = 0; index < messages.length; index += 1) {
            const message = messages[index];
            lines.push(`Message #${index + 1}`);
            lines.push(`Author: ${message.authorTag} (${message.authorId})`);
            lines.push(`Timestamp: ${formatTicketTimestamp(message.createdAt)}`);
            lines.push(`Content: ${message.content || "(no content)"}`);
            if (Array.isArray(message.attachments) && message.attachments.length > 0) {
                lines.push("Attachments:");
                message.attachments.forEach(att => lines.push(`- ${att.name || "attachment"}: ${att.url}`));
            }
            lines.push("");
        }

        return lines.join("\n");
    }

    function buildTicketCreationEmbed(ticket, openerId) {
        return new EmbedBuilder()
            .setColor("#4ea8de")
            .setTitle("🎫 Support Ticket")
            .setDescription(`Thanks for reaching out, <@${openerId}>. Describe your issue and a staff member will assist you shortly.`)
            .addFields(
                { name: "Ticket ID", value: ticket.id, inline: true },
                { name: "Status", value: ticket.status === "open" ? "Open" : "Closed", inline: true },
                { name: "Opened By", value: `<@${openerId}>`, inline: false }
            )
            .setTimestamp();
    }

    function buildTicketPanelEmbed(categoryId) {
        const title = String(config.ticketPanelTitle || "").trim() || "🎫 Open a Support Ticket";
        const customDescription = String(config.ticketPanelDescription || "").trim();
        const defaultDescription = categoryId
            ? `Click the button below to open a ticket. New tickets will be created under <#${categoryId}>.`
            : "A ticket category has not been configured. Use `/ticketcat` to set one.";

        const embed = new EmbedBuilder()
            .setColor("#4ea8de")
            .setTitle(title)
            .setDescription(customDescription || defaultDescription)
            .setTimestamp();

        if (config.ticketPanelImageUrl && String(config.ticketPanelImageUrl).trim()) {
            embed.setImage(String(config.ticketPanelImageUrl).trim());
        }

        return embed;
    }

    function buildTicketManagementEmbed(ticket) {
        return new EmbedBuilder()
            .setColor("#4ea8de")
            .setTitle("Ticket Management Panel")
            .setDescription("Use the buttons below to manage this ticket.")
            .addFields(
                { name: "Ticket", value: ticket.id, inline: true },
                { name: "Opened By", value: `<@${ticket.opener}>`, inline: true },
                { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true }
            )
            .setTimestamp();
    }

    function getStaffRoleIds() {
        const ticketRoles = Array.isArray(config.moduleRoleAccess?.tickets) ? config.moduleRoleAccess.tickets : [];
        const supervisorRoles = Array.isArray(config.moduleRoleAccess?.supervisor) ? config.moduleRoleAccess.supervisor : [];
        return [...new Set([...ticketRoles, ...supervisorRoles].filter(roleId => typeof roleId === "string" && roleId.trim().length > 0))];
    }

    function buildTicketChannelPermissions(guild, openerId) {
        const overwrites = [
            {
                id: guild.roles.everyone.id,
                deny: ["ViewChannel"]
            },
            {
                id: openerId,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles", "EmbedLinks"]
            }
        ];

        for (const roleId of getStaffRoleIds()) {
            overwrites.push({
                id: roleId,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "AttachFiles", "EmbedLinks"]
            });
        }

        return overwrites;
    }

    async function createTicketChannel(interaction, ticketTypeLabel = null) {
        if (!interaction.guild) {
            return { ok: false, message: "Tickets can only be created inside a server." };
        }

        const ticketCategoryId = String(config.ticketCategory || "").trim();
        if (!ticketCategoryId) {
            return { ok: false, message: "The ticket category is not configured. Use `/ticketcat` to set it." };
        }

        const category = await interaction.guild.channels.fetch(ticketCategoryId).catch(() => null);
        if (!category || category.type !== ChannelType.GuildCategory) {
            return { ok: false, message: "The configured ticket category could not be found. Update it with `/ticketcat`." };
        }

        const ticketLabel = String(ticketTypeLabel || "Support Ticket").trim() || "Support Ticket";
        const nextCounter = Number(config.ticketCounter || 0) + 1;
        const channelName = `ticket-${nextCounter}`;

        try {
            const channel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: buildTicketChannelPermissions(interaction.guild, interaction.user.id),
                reason: `Ticket created by ${interaction.user.tag}`
            });

            const ticketId = `TICKET-${String(nextCounter).padStart(6, "0")}`;
            ticketStore[channel.id] = {
                id: ticketId,
                opener: interaction.user.id,
                openerTag: interaction.user.tag,
                guild: interaction.guild.id,
                channel: channel.id,
                status: "open",
                type: ticketLabel,
                createdAt: new Date().toISOString(),
                closed: false,
                closedBy: null,
                closedAt: null,
                closeReason: null,
                claimedBy: null,
                pendingReviewRequest: false,
                reviewRequest: null,
                messages: []
            };

            config.ticketCounter = nextCounter;
            saveConfig();
            saveTicketState();

            const logChannelId = getLogChannelId(interaction.guild.id, "ticket") || getLogChannelId(interaction.guild.id, "moderation");
            if (logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(logChannelId) || await interaction.guild.channels.fetch(logChannelId).catch(() => null);
                if (logChannel?.isTextBased()) {
                    logChannel.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#4ea8de")
                                .setTitle("🎫 New Ticket Created")
                                .setDescription(`A new ticket was opened by <@${interaction.user.id}>.`)
                                .addFields(
                                    { name: "Ticket ID", value: ticketId, inline: true },
                                    { name: "Channel", value: `<#${channel.id}>`, inline: true },
                                    { name: "Type", value: ticketLabel, inline: true }
                                )
                                .setTimestamp()
                        ]
                    }).catch(() => {});
                }
            }

            const ticketEmbed = buildTicketCreationEmbed(ticketStore[channel.id], interaction.user.id);
            await channel.send({ embeds: [ticketEmbed], components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(USER_CLOSE_BUTTON_ID)
                        .setLabel("Close Ticket")
                        .setStyle(ButtonStyle.Danger)
                )
            ] });

            return { ok: true, channelId: channel.id, ticketId, message: `✅ Ticket created in <#${channel.id}>.` };
        } catch (error) {
            console.error("Ticket channel creation failed:", error);
            return { ok: false, message: `❌ Unable to create your ticket: ${error.message || "unknown error"}` };
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
            attachments: Array.from(message.attachments.values()).map(att => ({
                name: String(att.name || "attachment"),
                url: att.url
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
            return { ok: false, error: "Transcript log channel is unavailable." };
        }

        const transcriptText = buildTranscriptText(ticket);
        const transcriptBuffer = Buffer.from(transcriptText, "utf8");
        const transcriptFileName = `${ticket.id}.txt`;

        const logEmbed = new EmbedBuilder()
            .setColor("#4ea8de")
            .setTitle("📜 Ticket Transcript")
            .setDescription(`Transcript generated for <#${ticket.channel}>.`)
            .addFields(
                { name: "Ticket ID", value: ticket.id, inline: true },
                { name: "Opened By", value: `<@${ticket.opener}>`, inline: true },
                { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true }
            )
            .setTimestamp();

        await transcriptChannel.send({ embeds: [logEmbed], files: [{ attachment: transcriptBuffer, name: transcriptFileName }] }).catch(error => {
            console.error("Failed to send ticket transcript:", error);
        });

        return { ok: true };
    }

    async function sendReviewEmbed(guild, ticket, reviewText, reviewSource) {
        const reviewChannel = await guild.channels.fetch(REVIEW_CHANNEL_ID).catch(() => null);
        if (!reviewChannel || !reviewChannel.isTextBased()) {
            return { ok: false, error: "Review channel is not available." };
        }

        const reviewEmbed = new EmbedBuilder()
            .setTitle("Ticket Review Received")
            .setColor("#5865F2")
            .addFields(
                { name: "Ticket ID", value: ticket.id, inline: true },
                { name: "Opened By", value: `<@${ticket.opener}>`, inline: true },
                { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true },
                { name: "Review", value: reviewText || "No review text provided.", inline: false },
                { name: "Source", value: reviewSource || "Ticket System", inline: true }
            )
            .setTimestamp();

        await reviewChannel.send({ embeds: [reviewEmbed] }).catch(error => {
            console.error("Failed to send ticket review embed:", error);
        });

        return { ok: true };
    }

    function closeTicket(channelId, closedBy, options = {}) {
        const ticket = getOpenTicketByChannel(channelId);
        if (!ticket) return null;

        ticket.status = "closed";
        ticket.closed = true;
        ticket.closedAt = new Date().toISOString();
        ticket.closedBy = String(closedBy || "unknown");
        ticket.closeReason = typeof options.reason === "string" ? options.reason.trim() : null;
        ticket.closedByStaff = Boolean(options.closedByStaff);

        if (options.reviewText) {
            ticket.reviewRequest = ticket.reviewRequest || {};
            ticket.reviewRequest.reviewText = String(options.reviewText || "").trim();
            ticket.reviewRequest.status = "submitted";
            ticket.reviewRequest.respondedAt = new Date().toISOString();
        }

        ticket.pendingReviewRequest = false;
        saveTicketState();
        return ticket;
    }

    async function closeTicketAndNotify(interaction, ticket, closedById, reason, options = {}) {
        const closedTicket = closeTicket(ticket.channel, closedById, {
            reason,
            closedByStaff: Boolean(options.closedByStaff),
            reviewText: options.reviewText
        });

        if (!closedTicket) {
            await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return { ok: false };
        }

        const ticketChannel = interaction.guild?.channels.cache.get(ticket.channel) || await interaction.guild?.channels.fetch(ticket.channel).catch(() => null);
        if (ticketChannel && ticketChannel.isTextBased()) {
            const closeEmbed = new EmbedBuilder()
                .setColor("#2d5a3d")
                .setTitle("✅ Ticket Closed")
                .setDescription(reason ? `This ticket was closed. Reason: ${reason}` : "This ticket has been closed.")
                .addFields(
                    { name: "Ticket ID", value: closedTicket.id, inline: true },
                    { name: "Closed By", value: `<@${closedById}>`, inline: true },
                    { name: "Claimed By", value: closedTicket.claimedBy ? `<@${closedTicket.claimedBy}>` : "Unclaimed", inline: true }
                )
                .setTimestamp();

            await ticketChannel.send({ embeds: [closeEmbed], components: [] }).catch(() => {});
        }

        const transcriptResult = await sendTranscriptToChannel(interaction.guild, closedTicket);
        if (!transcriptResult.ok) {
            console.error("Transcript send failed:", transcriptResult.error);
        }

        if (options.sendReview || options.reviewText) {
            await sendReviewEmbed(interaction.guild, closedTicket, options.reviewText || reason || "No review text provided.", options.reviewSource || "Ticket Closure");
        }

        await interaction.reply({ content: `✅ Ticket closed. Transcript generated and sent to the configured transcript channel.`, flags: MessageFlags.Ephemeral }).catch(() => {});
        return { ok: true };
    }

    async function handleButtonInteraction(interaction) {
        if (!interaction.isButton()) return false;

        if (interaction.customId.startsWith(PANEL_BUTTON_PREFIX)) {
            const label = decodeURIComponent(interaction.customId.slice(PANEL_BUTTON_PREFIX.length));
            const result = await createTicketChannel(interaction, label);
            await interaction.reply({ content: result.message, flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (interaction.customId === USER_CLOSE_BUTTON_ID) {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }
            if (interaction.user.id !== ticket.opener) {
                await interaction.reply({ content: "❌ Only the ticket opener may close this ticket.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const modal = new ModalBuilder()
                .setCustomId("ticket_user_close_modal")
                .setTitle("Close Ticket");

            const reasonInput = new TextInputBuilder()
                .setCustomId("ticket_user_close_reason")
                .setLabel("Why are you closing this ticket?")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal).catch(error => {
                console.error("Failed to show ticket close modal:", error);
            });
            return true;
        }

        if (!interaction.customId.startsWith("ticketmgmt_")) {
            return false;
        }

        const ticket = getOpenTicketByChannel(interaction.channelId);
        if (!ticket) {
            await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (!isStaffMember(interaction.member)) {
            await interaction.reply({ content: "❌ You do not have permission to manage tickets.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (interaction.customId === STAFF_CLOSE_BUTTON_ID) {
            await closeTicketAndNotify(interaction, ticket, interaction.user.id, null, { closedByStaff: true });
            return true;
        }

        if (interaction.customId === STAFF_CLOSE_REASON_BUTTON_ID) {
            const modal = new ModalBuilder()
                .setCustomId("ticket_close_reason_modal")
                .setTitle("Close Ticket With Reason");

            const reasonInput = new TextInputBuilder()
                .setCustomId("ticket_close_reason")
                .setLabel("Reason for closing this ticket")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal).catch(error => {
                console.error("Failed to show ticket close reason modal:", error);
            });
            return true;
        }

        if (interaction.customId === STAFF_CLAIM_BUTTON_ID) {
            ticket.claimedBy = interaction.user.id;
            saveTicketState();
            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#4ea8de")
                        .setTitle("Ticket Claimed")
                        .setDescription(`This ticket has been claimed by <@${interaction.user.id}>.`)
                        .setTimestamp()
                ]
            }).catch(() => {});
            await interaction.reply({ content: `✅ Ticket claimed by <@${interaction.user.id}>.`, flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (interaction.customId === STAFF_ADD_USERS_BUTTON_ID || interaction.customId === STAFF_REMOVE_USERS_BUTTON_ID) {
            const modal = new ModalBuilder()
                .setCustomId(interaction.customId === STAFF_ADD_USERS_BUTTON_ID ? "ticket_add_users_modal" : "ticket_remove_users_modal")
                .setTitle(interaction.customId === STAFF_ADD_USERS_BUTTON_ID ? "Add Users to Ticket" : "Remove Users from Ticket");

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

        if (interaction.customId === STAFF_LAR_BUTTON_ID) {
            const opener = await interaction.client.users.fetch(ticket.opener).catch(() => null);
            if (!opener) {
                await interaction.reply({ content: "❌ Could not find the ticket opener.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            requestTicketReview(ticket.channel, interaction.user.id);
            const dmEmbed = new EmbedBuilder()
                .setColor("#4ea8de")
                .setTitle("Ticket Review Requested")
                .setDescription("Please reply to this DM with a short review of your ticket experience.")
                .addFields(
                    { name: "Ticket", value: ticket.id, inline: true },
                    { name: "Requested By", value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp();

            await opener.send({ embeds: [dmEmbed] }).catch(async err => {
                console.error("Could not DM ticket opener for review:", err);
                await interaction.reply({ content: "❌ Could not DM the ticket opener. They may have DMs disabled.", flags: MessageFlags.Ephemeral }).catch(() => {});
            });

            await interaction.reply({ content: "✅ Review request sent to the ticket opener.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
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
            if (!isStaffMember(interaction.member)) {
                await interaction.reply({ content: "❌ You do not have permission to close this ticket.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const reason = interaction.fields.getTextInputValue("ticket_close_reason").trim();
            await closeTicketAndNotify(interaction, ticket, interaction.user.id, reason, {
                closedByStaff: true,
                reviewText: reason,
                sendReview: true,
                reviewSource: "Staff Close With Reason"
            });
            return true;
        }

        if (interaction.customId === "ticket_add_users_modal" || interaction.customId === "ticket_remove_users_modal") {
            const ticket = getOpenTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This ticket is already closed or not recognized.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }
            if (!isStaffMember(interaction.member)) {
                await interaction.reply({ content: "❌ You do not have permission to manage this ticket.", flags: MessageFlags.Ephemeral }).catch(() => {});
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
                    console.error("Ticket user management error:", error);
                    results.push(`Failed ${allow ? "adding" : "removing"} <@${userId}>`);
                }
            }

            await interaction.reply({ content: `✅ ${allow ? "Users added" : "Users removed"}:
${results.join("\n")}`, flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        return false;
    }

    async function handleChatInputCommand(interaction) {
        if (!interaction.isChatInputCommand()) return false;

        if (interaction.commandName === "ticket") {
            const ticket = getTicketByChannel(interaction.channelId);
            if (!ticket) {
                await interaction.reply({ content: "❌ This channel is not a recognized ticket channel.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const statusEmbed = new EmbedBuilder()
                .setTitle("Ticket Status")
                .setColor(ticket.status === "open" ? "#4ea8de" : "#2d5a3d")
                .addFields(
                    { name: "Ticket ID", value: ticket.id, inline: true },
                    { name: "Status", value: ticket.status || "Unknown", inline: true },
                    { name: "Opened By", value: `<@${ticket.opener}>`, inline: true },
                    { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true },
                    { name: "Created At", value: formatTicketTimestamp(ticket.createdAt), inline: false }
                )
                .setTimestamp();
            await interaction.reply({ embeds: [statusEmbed], flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (interaction.commandName === "ticketcat") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: "❌ Administrator permission required.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const category = interaction.options.getChannel("category");
            if (!category || category.type !== ChannelType.GuildCategory) {
                await interaction.reply({ content: "❌ Please select a valid category.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            config.ticketCategory = category.id;
            saveConfig();
            await interaction.reply({ content: `✅ Ticket category set to <#${category.id}>.`, flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (interaction.commandName === "ticket-panel") {
            const ticketTypeLabels = Array.isArray(config.ticketTypes) && config.ticketTypes.length > 0
                ? config.ticketTypes.map(t => String(t?.label || "").trim()).filter(Boolean)
                : ["Open a Ticket"];

            const panelEmbed = buildTicketPanelEmbed(config.ticketCategory);
            const row = new ActionRowBuilder();
            for (const label of ticketTypeLabels) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${PANEL_BUTTON_PREFIX}${encodeURIComponent(label)}`)
                        .setLabel(label)
                        .setStyle(ButtonStyle.Primary)
                );
            }

            await interaction.reply({ embeds: [panelEmbed], components: [row], flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (interaction.commandName === "ticket-panel-config") {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: "❌ Administrator permission required.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const title = interaction.options.getString("title");
            const description = interaction.options.getString("description");

            if (!title && !description) {
                await interaction.reply({ content: "❌ Please provide a title and/or description to update.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            if (typeof title === "string") {
                config.ticketPanelTitle = title.trim() || null;
            }
            if (typeof description === "string") {
                config.ticketPanelDescription = description.trim() || null;
            }

            saveConfig();
            await interaction.reply({ content: "✅ Ticket panel configuration updated.", flags: MessageFlags.Ephemeral }).catch(() => {});
            return true;
        }

        if (interaction.commandName === "ticket-management" || interaction.commandName === "ticketmanagement") {
            const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
            const ticket = targetChannel ? getOpenTicketByChannel(targetChannel.id) : null;
            if (!ticket) {
                await interaction.reply({ content: "❌ No open ticket was found in that channel. Run this in a ticket channel or specify a ticket channel with the `channel` option.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            if (!isStaffMember(interaction.member)) {
                await interaction.reply({ content: "❌ You do not have permission to manage this ticket.", flags: MessageFlags.Ephemeral }).catch(() => {});
                return true;
            }

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(STAFF_CLOSE_BUTTON_ID).setLabel("Close Ticket").setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(STAFF_CLOSE_REASON_BUTTON_ID).setLabel("Close With Reason").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(STAFF_CLAIM_BUTTON_ID).setLabel("Claim Ticket").setStyle(ButtonStyle.Success)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(STAFF_ADD_USERS_BUTTON_ID).setLabel("Add Users").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(STAFF_REMOVE_USERS_BUTTON_ID).setLabel("Remove Users").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(STAFF_LAR_BUTTON_ID).setLabel("Request Review").setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ embeds: [buildTicketManagementEmbed(ticket)], components: [row1, row2], flags: MessageFlags.Ephemeral }).catch(() => {});
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
        getPendingReviewByOpener,
        submitTicketReview,
        sendReviewEmbed,
        generateTranscriptText: buildTranscriptText
    };
}
