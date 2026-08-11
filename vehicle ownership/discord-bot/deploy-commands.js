const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('assign-vehicle')
        .setDescription('Assign a vehicle + spawn code to a player (staff only)')
        .addUserOption(opt => opt.setName('player').setDescription('The owner').setRequired(true))
        .addStringOption(opt => opt.setName('model').setDescription('Vehicle spawn model, e.g. adder').setRequired(true))
        .addStringOption(opt => opt.setName('plate').setDescription('License plate').setRequired(true))
        .addStringOption(opt => opt.setName('code').setDescription('Custom spawn code (leave blank to auto-generate)')),
    new SlashCommandBuilder()
        .setName('mycars')
        .setDescription('View and manage the vehicles you own')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Slash commands registered.');
    } catch (err) {
        console.error(err);
    }
})();
