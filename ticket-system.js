import { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

// Minimal fallback ticket system.
// Keeps the bot bootable when the full ticket module is not present.
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

export function createTicketSystem() {
    return {
        async handleButtonInteraction(interaction) {
            if (!interaction.isButton()) {
                return false;
            }

            if (interaction.customId !== "ticket_panel_open") {
                return false;
            }

            await interaction.reply({
                content: "Ticket system module is not installed on this deployment yet.",
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
                    content: "Ticket system module is not installed on this deployment yet.",
                    flags: MessageFlags.Ephemeral
                });

                return true;
            }

            const panelEmbed = new EmbedBuilder()
                .setColor("#4ea8de")
                .setTitle("🎫 Ticket Creation Panel")
                .setDescription("Use the button below to open a support ticket. This deployment is currently running the fallback ticket handler until the full ticket module is available.")
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
