const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const gameHandler = require('../handlers/gameHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create_game')
        .setDescription('Создать новое игровое лобби')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Игровой режим')
                .setRequired(true)
                .addChoices(
                    { name: '1v1 - Соло', value: '1v1' },
                    { name: '2v2 - Пары', value: '2v2' },
                    { name: '3v3 - Тройки', value: '3v3' },
                    { name: '5v5 - Пятерки', value: '5v5' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const mode = interaction.options.getString('mode');

        await interaction.deferReply({ ephemeral: true });

        try {
            await gameHandler.createGame(interaction, mode);
            await interaction.editReply(`✅ Игровое лобби для режима ${mode} успешно создано!`);
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Не удалось создать игровое лобби: ${error.message}`);
        }
    }
};