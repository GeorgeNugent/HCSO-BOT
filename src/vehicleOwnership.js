import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } from "discord.js";
import db from "./vehicleOwnershipDb.js";

function generateCode(length = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

export async function handleAssignVehicle(interaction) {
    const staffRoleId = process.env.STAFF_ROLE_ID;
    if (staffRoleId && !interaction.member.roles.cache.has(staffRoleId)) {
        return interaction.reply({ content: "You do not have permission to assign vehicles.", ephemeral: true });
    }

    const target = interaction.options.getUser("player", true);
    const model = interaction.options.getString("model", true);
    const plate = interaction.options.getString("plate", true);
    const code = interaction.options.getString("code") || generateCode();

    await db.query(
        "INSERT INTO owned_vehicles (spawn_code, model, plate, owner_discord_id, assigned_by) VALUES (?, ?, ?, ?, ?)",
        [code, model, plate, target.id, interaction.user.id]
    );

    const embed = new EmbedBuilder()
        .setTitle("Vehicle Ownership Assigned")
        .setColor(0x2ecc71)
        .addFields(
            { name: "Vehicle", value: model, inline: true },
            { name: "Plate", value: plate, inline: true },
            { name: "Spawn Code", value: `\`${code}\``, inline: true },
            { name: "Assigned By", value: `<@${interaction.user.id}>`, inline: false }
        )
        .setFooter({ text: `Use /spawncar ${code} in-game to spawn it.` });

    try {
        await target.send({ embeds: [embed] });
    } catch {
        // ignore DM failures
    }

    return interaction.reply({ content: `Assigned **${model}** (code \`${code}\`) to ${target}.`, ephemeral: true });
}

export async function handleMyCars(interaction) {
    const [rows] = await db.query(
        "SELECT * FROM owned_vehicles WHERE owner_discord_id = ?",
        [interaction.user.id]
    );

    if (!rows || rows.length === 0) {
        return interaction.reply({ content: "You don't own any vehicles.", ephemeral: true });
    }

    for (let i = 0; i < rows.length; i++) {
        const v = rows[i];
        const embed = new EmbedBuilder()
            .setTitle(v.model)
            .setColor(0x3498db)
            .addFields(
                { name: "Plate", value: v.plate, inline: true },
                { name: "Spawn Code", value: `\`${v.spawn_code}\``, inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`give_${v.id}`).setLabel("Give Access").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`revert_${v.id}`).setLabel("Revert All Access").setStyle(ButtonStyle.Danger)
        );

        if (i === 0) {
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        } else {
            await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
        }
    }
}

export async function handleGiveButton(interaction) {
    const vehicleId = interaction.customId.split("_")[1];
    const [rows] = await db.query("SELECT * FROM owned_vehicles WHERE id = ?", [vehicleId]);
    const vehicle = rows[0];

    if (!vehicle || vehicle.owner_discord_id !== interaction.user.id) {
        return interaction.reply({ content: "You do not own this vehicle.", ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
            .setCustomId(`giveselect_${vehicleId}`)
            .setPlaceholder("Choose who to give access to")
            .setMinValues(1)
            .setMaxValues(1)
    );

    return interaction.reply({
        content: `Who should get access to **${vehicle.model}**?`,
        components: [row],
        ephemeral: true
    });
}

export async function handleGiveSelect(interaction) {
    const vehicleId = interaction.customId.split("_")[1];
    const target = interaction.users.first();
    if (!target) {
        return interaction.update({ content: "No user selected.", components: [] });
    }

    const [rows] = await db.query("SELECT * FROM owned_vehicles WHERE id = ?", [vehicleId]);
    const vehicle = rows[0];

    if (!vehicle || vehicle.owner_discord_id !== interaction.user.id) {
        return interaction.update({ content: "You do not own this vehicle.", components: [] });
    }

    await db.query(
        "INSERT INTO vehicle_access (vehicle_id, holder_discord_id, granted_by) VALUES (?, ?, ?)",
        [vehicleId, target.id, interaction.user.id]
    );

    const embed = new EmbedBuilder()
        .setTitle("Vehicle Access Granted")
        .setColor(0x2ecc71)
        .addFields(
            { name: "Vehicle", value: vehicle.model, inline: true },
            { name: "Plate", value: vehicle.plate, inline: true },
            { name: "Spawn Code", value: `\`${vehicle.spawn_code}\``, inline: false },
            { name: "Given By", value: `<@${interaction.user.id}>`, inline: false }
        )
        .setFooter({ text: `Use /spawncar ${vehicle.spawn_code} in-game to spawn it.` });

    try {
        await target.send({ embeds: [embed] });
    } catch {
        // ignore DM failures
    }

    return interaction.update({ content: `Access given to ${target}.`, components: [] });
}

export async function handleRevertButton(interaction) {
    const vehicleId = interaction.customId.split("_")[1];
    const [rows] = await db.query("SELECT * FROM owned_vehicles WHERE id = ?", [vehicleId]);
    const vehicle = rows[0];

    if (!vehicle || vehicle.owner_discord_id !== interaction.user.id) {
        return interaction.reply({ content: "You do not own this vehicle.", ephemeral: true });
    }

    await db.query("DELETE FROM vehicle_access WHERE vehicle_id = ?", [vehicleId]);
    return interaction.reply({ content: `All shared access to **${vehicle.model}** has been revoked.`, ephemeral: true });
}
