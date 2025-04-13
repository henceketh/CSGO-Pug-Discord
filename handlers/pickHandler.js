const {
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const Game = require('../models/game');
const config = require('../config');

module.exports = {
    async startPlayerPick(game) {
        try {
            const client = global.client || require('../index').client;
            const guild = client.guilds.cache.get(game.guildId);
            if (!guild) return;

            const queueChannel = guild.channels.cache.get(game.queueChannelId);
            if (!queueChannel) return;

            const availablePlayers = game.players.filter(p => p.team === 0);
            if (availablePlayers.length === 0) {
                return this.startMapPick(game);
            }

            const currentCaptain = game.currentPickTurn % 2 === 1 ?
                game.captains.find(c => c.team === 1) :
                game.captains.find(c => c.team === 2);

            const pickEmbed = new EmbedBuilder()
                .setColor(currentCaptain.team === 1 ? '#ff0000' : '#0000ff')
                .setTitle('Team Selection')
                .setDescription(`<@${currentCaptain.userId}> (Team ${currentCaptain.team}), pick a player for your team.\nYou have 30 seconds to pick.`)
                .addFields(
                    { name: 'Available Players', value: availablePlayers.map(p => p.username).join('\n') }
                )
                .setTimestamp();

            const buttons = [];

            for (const player of availablePlayers) {
                const button = new ButtonBuilder()
                    .setCustomId(`pick_player_${player.userId}`)
                    .setLabel(player.username)
                    .setStyle(ButtonStyle.Primary);

                buttons.push(button);
            }

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
                rows.push(row);
            }

            const pickMessage = await queueChannel.send({
                content: `<@${currentCaptain.userId}>`,
                embeds: [pickEmbed],
                components: rows
            });

            game.currentPhaseMessageId = pickMessage.id;
            await game.save();

            const filter = i => {
                return i.customId.startsWith('pick_player_') &&
                    i.user.id === currentCaptain.userId;
            };

            const collector = pickMessage.createMessageComponentCollector({
                filter,
                time: 30000
            });

            let picked = false;

            collector.on('collect', async i => {
                try {
                    const updatedGame = await Game.findById(game._id);
                    if (!updatedGame || updatedGame.status !== 'captain_pick') return;

                    const playerId = i.customId.replace('pick_player_', '');
                    const playerIndex = updatedGame.players.findIndex(p => p.userId === playerId);

                    if (playerIndex === -1) return;

                    picked = true;
                    collector.stop();

                    updatedGame.players[playerIndex].team = currentCaptain.team;
                    updatedGame.currentPickTurn += 1;
                    await updatedGame.save();

                    await i.update({
                        content: `👑 <@${currentCaptain.userId}> выбрал игрока ${updatedGame.players[playerIndex].username}`,
                        embeds: [pickEmbed.setDescription(`✅ ${updatedGame.players[playerIndex].username} добавлен в Команду ${currentCaptain.team}`)],
                        components: []
                    });

                    const gameHandler = require('./gameHandler');
                    await gameHandler.updateQueueEmbed(updatedGame);

                    const remainingPlayers = updatedGame.players.filter(p => p.team === 0);
                    if (remainingPlayers.length > 0) {
                        setTimeout(() => this.startPlayerPick(updatedGame), 1500);
                    } else {
                        setTimeout(() => this.startMapPick(updatedGame), 1500);
                    }
                } catch (error) {
                    console.error('Error handling player pick:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (!picked) {
                    try {
                        const updatedGame = await Game.findById(game._id);
                        if (!updatedGame || updatedGame.status !== 'captain_pick') return;

                        const availablePlayers = updatedGame.players.filter(p => p.team === 0);
                        if (availablePlayers.length === 0) return;

                        const randomPlayerIndex = Math.floor(Math.random() * availablePlayers.length);
                        const randomPlayer = availablePlayers[randomPlayerIndex];

                        const playerIndex = updatedGame.players.findIndex(p => p.userId === randomPlayer.userId);

                        updatedGame.players[playerIndex].team = currentCaptain.team;
                        updatedGame.currentPickTurn += 1;
                        await updatedGame.save();

                        await pickMessage.edit({
                            content: `⏱️ <@${currentCaptain.userId}> не успел выбрать. ${randomPlayer.username} случайно добавлен в Команду ${currentCaptain.team}`,
                            embeds: [pickEmbed.setDescription(`🎲 ${randomPlayer.username} случайно добавлен в Команду ${currentCaptain.team}`)],
                            components: []
                        });

                        const gameHandler = require('./gameHandler');
                        await gameHandler.updateQueueEmbed(updatedGame);

                        const remainingPlayers = updatedGame.players.filter(p => p.team === 0);
                        if (remainingPlayers.length > 0) {
                            setTimeout(() => this.startPlayerPick(updatedGame), 1500);
                        } else {
                            setTimeout(() => this.startMapPick(updatedGame), 1500);
                        }
                    } catch (error) {
                        console.error('Error handling timeout pick:', error);
                    }
                }
            });
        } catch (error) {
            console.error('Error starting player pick:', error);
        }
    },

    async startMapPick(game) {
        try {
            if (!global.client) {
                console.error('Client is not accessible globally');
                return;
            }

            game.status = 'map_pick';
            await game.save();

            const gameHandler = require('./gameHandler');
            await gameHandler.updateQueueEmbed(game);

            const guild = client.guilds.cache.get(game.guildId);
            if (!guild) return;

            const queueChannel = guild.channels.cache.get(game.queueChannelId);
            if (!queueChannel) return;

            let currentMapPool = [...game.maps.pool];
            let currentBanTurn = 1;
            let team1Captain = game.captains.find(c => c.team === 1);
            let team2Captain = game.captains.find(c => c.team === 2);

            while (currentMapPool.length > 1) {
                const currentCaptain = currentBanTurn % 2 === 1 ? team1Captain : team2Captain;

                if (game.currentPhaseMessageId) {
                    try {
                        const oldMessage = await queueChannel.messages.fetch(game.currentPhaseMessageId);
                        await oldMessage.delete().catch(() => { });
                    } catch (error) { }
                }

                const mapEmbed = new EmbedBuilder()
                    .setColor(currentCaptain.team === 1 ? '#ff0000' : '#0000ff')
                    .setTitle('🗺️ Фаза Бана Карт')
                    .setDescription(`<@${currentCaptain.userId}> (Команда ${currentCaptain.team}), забаньте карту.\nУ вас есть 30 секунд.`)
                    .addFields(
                        { name: '🗺️ Доступные Карты', value: currentMapPool.map(map => config.mapDisplayNames[map] || map).join('\n') },
                        { name: '❌ Забаненные Карты', value: game.maps.banned.map(map => config.mapDisplayNames[map] || map).join('\n') || 'Нет' }
                    )
                    .setFooter({ text: 'Нажмите на кнопку с названием карты для бана' })
                    .setTimestamp();

                const buttons = currentMapPool.map(map =>
                    new ButtonBuilder()
                        .setCustomId(`ban_map_${map}`)
                        .setLabel(config.mapDisplayNames[map] || map)
                        .setStyle(ButtonStyle.Primary)
                );

                const rows = [];
                for (let i = 0; i < buttons.length; i += 5) {
                    const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
                    rows.push(row);
                }

                const mapMessage = await queueChannel.send({
                    content: `<@${currentCaptain.userId}>`,
                    embeds: [mapEmbed],
                    components: rows
                });

                // Update the current phase message ID
                game.currentPhaseMessageId = mapMessage.id;
                await game.save();

                const filter = i => {
                    return i.customId.startsWith('ban_map_') &&
                        i.user.id === currentCaptain.userId;
                };

                let banned = false;
                let bannedMap = '';

                try {
                    const interaction = await mapMessage.awaitMessageComponent({
                        filter,
                        time: 30000
                    });

                    bannedMap = interaction.customId.replace('ban_map_', '');

                    game.maps.banned.push(bannedMap);
                    currentMapPool = currentMapPool.filter(map => map !== bannedMap);

                    await interaction.update({
                        content: `🚫 <@${currentCaptain.userId}> забанил карту ${bannedMap}`,
                        embeds: [mapEmbed.setDescription(`❌ ${bannedMap} забанена Командой ${currentCaptain.team}`)],
                        components: []
                    });

                    banned = true;
                } catch (error) {
                    const randomIndex = Math.floor(Math.random() * currentMapPool.length);
                    bannedMap = currentMapPool[randomIndex];

                    game.maps.banned.push(bannedMap);
                    currentMapPool = currentMapPool.filter(map => map !== bannedMap);

                    await mapMessage.edit({
                        content: `⏱️ <@${currentCaptain.userId}> не успел забанить карту. ${bannedMap} случайно забанена`,
                        embeds: [mapEmbed.setDescription(`🎲 ${bannedMap} случайно забанена для Команды ${currentCaptain.team}`)],
                        components: []
                    });
                }

                currentBanTurn += 1;
                await game.save();
                await gameHandler.updateQueueEmbed(game);

                if (currentMapPool.length === 1) {
                    game.maps.selected = currentMapPool[0];
                    game.status = 'in_progress';
                    game.currentPhaseMessageId = null;
                    await game.save();

                    await this.createTeamChannels(game);
                }
            }
        } catch (error) {
            console.error('Error in map pick phase:', error);
        }
    },

    async createTeamChannels(game) {
        try {
            if (!global.client) {
                console.error('Client is not accessible globally');
                return;
            }

            const guild = global.client.guilds.cache.get(game.guildId);
            if (!guild) {
                console.error(`Guild not found with ID: ${game.guildId}`);
                return;
            }

            const category = guild.channels.cache.get(game.categoryId);
            if (!category) return;

            const team1Players = game.players.filter(p => p.team === 1);
            const team2Players = game.players.filter(p => p.team === 2);

            const team1Channel = await guild.channels.create({
                name: '🔴・Команда 1',
                type: ChannelType.GuildVoice,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: global.client.user.id,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    },
                    ...team1Players.map(p => ({
                        id: p.userId,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    }))
                ],
            });

            const team2Channel = await guild.channels.create({
                name: '🔵・Команда 2',
                type: ChannelType.GuildVoice,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: global.client.user.id,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    },
                    ...team2Players.map(p => ({
                        id: p.userId,
                        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
                    }))
                ],
            });

            game.team1ChannelId = team1Channel.id;
            game.team2ChannelId = team2Channel.id;
            await game.save();

            const gameHandler = require('./gameHandler');
            await gameHandler.updateQueueEmbed(game);

            const lobbyChannel = guild.channels.cache.get(game.lobbyChannelId);
            if (lobbyChannel) {
                for (const member of lobbyChannel.members.values()) {
                    const player = game.players.find(p => p.userId === member.id);
                    if (player) {
                        if (player.team === 1) {
                            await member.voice.setChannel(team1Channel).catch(console.error);
                        } else if (player.team === 2) {
                            await member.voice.setChannel(team2Channel).catch(console.error);
                        }
                    }
                }

                await lobbyChannel.permissionOverwrites.edit(guild.id, {
                    Connect: null
                });
            }

            setTimeout(async () => {
                try {
                    await gameHandler.createNewGameInExistingCategory(game);
                } catch (error) {
                    console.error('Error creating new game after match started:', error);
                }
            }, 3000);
        } catch (error) {
            console.error('Error creating team channels:', error);
        }
    }
};