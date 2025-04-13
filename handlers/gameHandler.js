const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require('discord.js');
const Game = require('../models/game');
const pickHandler = require('./pickHandler');
const config = require('../config');

module.exports = {
    async createQueueEmbed(game) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🎮 Игровое Лобби: ${game.mode}`)
            .setDescription(`⏳ Ожидание игроков: ${game.players?.length || 0}/${game.requiredPlayers}`)
            .addFields(
                { name: '📊 Статус', value: '⌛ Ожидание игроков в голосовом канале Лобби' },
                { name: '🎲 Режим', value: game.mode }
            )
            .setFooter({ text: 'CS:GO Matchmaking Bot' })
            .setTimestamp();

        if (game.players && game.players.length > 0) {
            embed.addFields({ name: '👥 Игроки', value: game.players.map(p => p.username).join('\n') });
        }

        return embed;
    },

    async createNewGameInExistingCategory(previousGame) {
        try {
            const guild = global.client.guilds.cache.get(previousGame.guildId);
            if (!guild) {
                console.error(`Guild not found with ID: ${previousGame.guildId}`);
                return;
            }

            const category = guild.channels.cache.get(previousGame.categoryId);
            if (!category) {
                console.error(`Category not found with ID: ${previousGame.categoryId}`);
                return;
            }

            const queueChannel = guild.channels.cache.get(previousGame.queueChannelId);
            if (!queueChannel) {
                console.error(`Queue channel not found with ID: ${previousGame.queueChannelId}`);
                return;
            }

            const lobbyChannel = guild.channels.cache.get(previousGame.lobbyChannelId);
            if (!lobbyChannel) {
                console.error(`Lobby channel not found with ID: ${previousGame.lobbyChannelId}`);
                return;
            }

            previousGame.active = false;
            await previousGame.save();

            const embed = await this.createQueueEmbed({
                mode: previousGame.mode,
                requiredPlayers: previousGame.requiredPlayers,
                players: [],
                status: 'waiting'
            });

            const queueMessage = await queueChannel.send({
                content: 'Присоединяйтесь в голосовой канал Лобби, чтобы начать.',
                embeds: [embed]
            });

            const game = new Game({
                guildId: guild.id,
                categoryId: category.id,
                queueChannelId: queueChannel.id,
                lobbyChannelId: lobbyChannel.id,
                messageId: queueMessage.id,
                mode: previousGame.mode,
                requiredPlayers: previousGame.requiredPlayers,
                maps: {
                    pool: previousGame.maps.pool,
                    banned: []
                },
                active: true,
                lastActivityAt: new Date()
            });

            await game.save();

            this.watchLobby(lobbyChannel, game);

            return { category, queueChannel, lobbyChannel, game };
        } catch (error) {
            console.error('Error creating new game in existing category:', error);
        }
    },

    async createQueueStatusEmbed(game) {
        let statusText = '';
        let playersField = '';

        switch (game.status) {
            case 'waiting':
                statusText = '⌛ Ожидание игроков в голосовом канале Лобби';
                playersField = game.players.map(p => p.username).join('\n') || 'Пока нет игроков';
                break;
            case 'ready_check':
                statusText = '⚠️ Проверка готовности в процессе';
                playersField = game.players.map(p => `${p.username}: ${p.ready ? '✅' : '❌'}`).join('\n');
                break;
            case 'captain_pick':
                statusText = '👑 Выбор команд капитанами';
                playersField = game.players.map(p => {
                    let teamSymbol = '';
                    if (p.team === 1) teamSymbol = '🔴';
                    else if (p.team === 2) teamSymbol = '🔵';

                    let captainSymbol = game.captains.some(c => c.userId === p.userId) ? '👑 ' : '';

                    return `${captainSymbol}${p.username} ${teamSymbol}`;
                }).join('\n');
                break;
            case 'map_pick':
                statusText = '🗺️ Выбор карты в процессе';
                playersField = game.players.map(p => {
                    let teamSymbol = p.team === 1 ? '🔴' : '🔵';
                    let captainSymbol = game.captains.some(c => c.userId === p.userId) ? '👑 ' : '';
                    return `${teamSymbol} ${captainSymbol}${p.username}`;
                }).join('\n');
                break;
            case 'in_progress':
                statusText = '🏆 Игра началась';
                playersField = game.players.map(p => {
                    let teamSymbol = p.team === 1 ? '🔴' : '🔵';
                    return `${teamSymbol} ${p.username}`;
                }).join('\n');
                break;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🎮 Игровое Лобби: ${game.mode}`)
            .setDescription(`👥 Игроки: ${game.players.length}/${game.requiredPlayers}`)
            .addFields(
                { name: '📊 Статус', value: statusText },
                { name: '👥 Игроки', value: playersField || 'Нет игроков' },
                { name: '🎲 Режим', value: game.mode }
            )
            .setFooter({ text: 'CS:GO Matchmaking Bot' });

        if (game.status === 'map_pick' || game.status === 'in_progress') {
            const mapPool = game.maps.pool.filter(map => !game.maps.banned.includes(map));
            const mapsField = `🗺️ Доступные: ${mapPool.map(map => config.mapDisplayNames[map] || map).join(', ')}\n❌ Забаненные: ${game.maps.banned.map(map => config.mapDisplayNames[map] || map).join(', ') || 'Нет'}\n✅ Выбранная: ${game.maps.selected ? (config.mapDisplayNames[game.maps.selected] || game.maps.selected) : 'Нет'}`;
            embed.addFields({ name: '🗺️ Карты', value: mapsField });
        }

        embed.setTimestamp();

        return embed;
    },

    async createGame(interaction, mode) {
        const { guild } = interaction;

        let requiredPlayers;
        switch (mode) {
            case '1v1': requiredPlayers = 2; break;
            case '2v2': requiredPlayers = 4; break;
            case '3v3': requiredPlayers = 6; break;
            case '5v5': requiredPlayers = 10; break;
            default: throw new Error('Invalid game mode');
        }

        const categoryName = `🎮 RU Game | ${mode}`;

        const category = await guild.channels.create({
            name: categoryName,
            type: ChannelType.GuildCategory,
        });

        const queueChannel = await guild.channels.create({
            name: '📋・очередь',
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.SendMessages],
                    allow: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.client.user.id,
                    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel],
                }
            ],
        });

        const lobbyChannel = await guild.channels.create({
            name: '🔊・Лобби',
            type: ChannelType.GuildVoice,
            parent: category,
        });

        const embed = await this.createQueueEmbed({
            mode,
            requiredPlayers,
            players: [],
            status: 'waiting'
        });

        const queueMessage = await queueChannel.send({ embeds: [embed] });

        const game = new Game({
            guildId: guild.id,
            categoryId: category.id,
            queueChannelId: queueChannel.id,
            lobbyChannelId: lobbyChannel.id,
            messageId: queueMessage.id,
            mode,
            requiredPlayers,
            maps: {
                pool: config.defaultMapPool,
                banned: []
            },
            active: true,
            lastActivityAt: new Date()
        });

        await game.save();

        this.watchLobby(lobbyChannel, game);

        return { category, queueChannel, lobbyChannel, game };
    },

    async watchLobby(lobbyChannel, gameDoc) {
        const collector = lobbyChannel.guild.channels.cache.get(lobbyChannel.id);

        if (!collector) return;

        const client = lobbyChannel.client;

        client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                if (oldState.channelId === lobbyChannel.id || newState.channelId === lobbyChannel.id) {
                    const game = await Game.findById(gameDoc._id);
                    if (!game || game.status !== 'waiting') return;

                    const channel = client.channels.cache.get(game.lobbyChannelId);
                    if (!channel) return;

                    const members = channel.members;

                    const currentPlayers = game.players.filter(p =>
                        members.some(m => m.id === p.userId)
                    );

                    const newPlayers = members.filter(m =>
                        !game.players.some(p => p.userId === m.id)
                    );

                    newPlayers.forEach(m => {
                        game.players.push({
                            userId: m.id,
                            username: m.user.username,
                            ready: false,
                            team: 0
                        });
                    });

                    game.players = game.players.filter(p =>
                        members.some(m => m.id === p.userId)
                    );

                    await game.save();

                    await this.updateQueueEmbed(game);

                    if (game.players.length >= game.requiredPlayers && game.status === 'waiting') {
                        await this.startReadyCheck(game);
                    }
                }
            } catch (error) {
                console.error('Error in voice state update handler:', error);
            }
        });
    },

    async updateQueueEmbed(game) {
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

            const channel = guild.channels.cache.get(game.queueChannelId);
            if (!channel) {
                console.error(`Channel not found with ID: ${game.queueChannelId}`);
                return;
            }

            let message;
            try {
                message = await channel.messages.fetch(game.messageId);
            } catch (err) {
                console.error('Could not fetch message:', err);

                const embed = await this.createQueueStatusEmbed(game);
                const newMessage = await channel.send({ embeds: [embed] });
                game.messageId = newMessage.id;
                await game.save();
                return;
            }

            const embed = await this.createQueueStatusEmbed(game);

            if (game.status === 'ready_check') {
                embed.addFields({
                    name: '⚠️ Проверка Готовности',
                    value: `Все игроки должны подтвердить готовность к игре в течение 20 секунд.\nГотовы: ${game.players.filter(p => p.ready).length}/${game.players.length}`
                });
            } else if (game.status === 'captain_pick' && game.captains && game.captains.length > 0) {
                const currentCaptain = game.currentPickTurn % 2 === 1 ?
                    game.captains.find(c => c.team === 1) :
                    game.captains.find(c => c.team === 2);

                if (currentCaptain) {
                    const availablePlayers = game.players.filter(p => p.team === 0);
                    if (availablePlayers.length > 0) {
                        embed.addFields({
                            name: '👑 Выбор Команд',
                            value: `<@${currentCaptain.userId}> (Команда ${currentCaptain.team}) выбирает игрока.\nДоступные игроки: ${availablePlayers.map(p => p.username).join(', ')}`
                        });
                    }
                }
            } else if (game.status === 'map_pick') {
                const mapPool = game.maps.pool.filter(map => !game.maps.banned.includes(map));
                if (game.captains && game.captains.length > 0) {
                    const currentBanTurn = game.maps.banned.length + 1;
                    const currentCaptain = currentBanTurn % 2 === 1 ?
                        game.captains.find(c => c.team === 1) :
                        game.captains.find(c => c.team === 2);

                    if (currentCaptain && mapPool.length > 1) {
                        embed.addFields({
                            name: '🗺️ Фаза Бана Карт',
                            value: `<@${currentCaptain.userId}> (Команда ${currentCaptain.team}) банит карту.`
                        });
                    }
                }
            } else if (game.status === 'in_progress' && game.maps.selected) {
                embed.addFields({
                    name: '🏆 Игра Началась',
                    value: `Игра началась на карте: **${config.mapDisplayNames[game.maps.selected] || game.maps.selected}**\nИгроки перемещены в каналы своих команд.`
                });
            }

            await message.edit({ embeds: [embed] });

            await Game.findByIdAndUpdate(game._id, { lastActivityAt: new Date() });
        } catch (error) {
            console.error('Error updating queue embed:', error);
        }
    },

    async startReadyCheck(game) {
        try {
            if (!global.client) {
                console.error('Client is not accessible globally');
                return;
            }

            game.status = 'ready_check';
            game.readyCheckTimeout = new Date(Date.now() + 20000);
            await game.save();

            const guild = global.client.guilds.cache.get(game.guildId);
            if (!guild) {
                console.error(`Guild not found with ID: ${game.guildId}`);
                return;
            }

            const lobbyChannel = guild.channels.cache.get(game.lobbyChannelId);
            if (lobbyChannel) {
                await lobbyChannel.permissionOverwrites.edit(guild.id, {
                    Connect: false
                });
            }

            const queueChannel = guild.channels.cache.get(game.queueChannelId);
            if (!queueChannel) return;

            await this.updateQueueEmbed(game);

            const readyButton = new ButtonBuilder()
                .setCustomId('ready_confirm')
                .setLabel('✅ Готов')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(readyButton);

            const readyMessage = await queueChannel.send({
                content: `⚠️ **ПРОВЕРКА ГОТОВНОСТИ** ⚠️\n${game.players.map(p => `<@${p.userId}>`).join(' ')}, нажмите кнопку ниже, чтобы подтвердить готовность:`,
                components: [row]
            });

            game.currentPhaseMessageId = readyMessage.id;
            await game.save();

            const filter = i => i.customId === 'ready_confirm' &&
                game.players.some(p => p.userId === i.user.id);

            const collector = readyMessage.createMessageComponentCollector({
                filter,
                time: 20000
            });

            collector.on('collect', async i => {
                try {
                    const updatedGame = await Game.findById(game._id);
                    if (!updatedGame || updatedGame.status !== 'ready_check') return;

                    const playerIndex = updatedGame.players.findIndex(p => p.userId === i.user.id);
                    if (playerIndex === -1) return;

                    updatedGame.players[playerIndex].ready = true;
                    await updatedGame.save();

                    await i.reply({ content: '✅ Вы подтвердили готовность!', ephemeral: true });

                    await this.updateQueueEmbed(updatedGame);

                    const readyCount = updatedGame.players.filter(p => p.ready).length;
                    const totalCount = updatedGame.players.length;
                    await readyMessage.edit({
                        content: `⚠️ **ПРОВЕРКА ГОТОВНОСТИ** ⚠️\n${updatedGame.players.map(p => `<@${p.userId}> ${p.ready ? '✅' : '❌'}`).join(' ')}\n\nГотовы: ${readyCount}/${totalCount}`,
                        components: [row]
                    });

                    const allReady = updatedGame.players.every(p => p.ready);
                    if (allReady) {
                        collector.stop('all_ready');
                    }
                } catch (error) {
                    console.error('Error handling ready button:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                try {
                    const updatedGame = await Game.findById(game._id);
                    if (!updatedGame) return;

                    if (reason === 'all_ready') {
                        await readyMessage.edit({
                            content: `✅ **ВСЕ ИГРОКИ ГОТОВЫ!** ✅\nНачинаем выбор команд...`,
                            components: []
                        });

                        setTimeout(async () => {
                            try {
                                await readyMessage.delete().catch(() => { });
                            } catch (error) {
                                console.error('Error deleting ready check message:', error);
                            }
                        }, 5000);

                        await this.startCaptainPick(updatedGame);
                    } else {
                        const notReadyPlayers = updatedGame.players.filter(p => !p.ready);

                        await readyMessage.edit({
                            content: `❌ **ПРОВЕРКА ГОТОВНОСТИ ПРОВАЛЕНА!** ❌\nСледующие игроки не подтвердили готовность: ${notReadyPlayers.map(p => p.username).join(', ')}`,
                            components: []
                        });

                        updatedGame.status = 'waiting';
                        updatedGame.players.forEach(p => p.ready = false);
                        await updatedGame.save();

                        const lobbyChannel = guild.channels.cache.get(updatedGame.lobbyChannelId);
                        if (lobbyChannel) {
                            await lobbyChannel.permissionOverwrites.edit(guild.id, {
                                Connect: null
                            });
                        }

                        await this.updateQueueEmbed(updatedGame);

                        setTimeout(async () => {
                            try {
                                await readyMessage.delete().catch(() => { });

                                const game = await Game.findById(updatedGame._id);
                                if (game && game.currentPhaseMessageId === readyMessage.id) {
                                    game.currentPhaseMessageId = null;
                                    await game.save();
                                }
                            } catch (error) {
                                console.error('Error deleting ready check message:', error);
                            }
                        }, 10000);
                    }
                } catch (error) {
                    console.error('Error handling ready check completion:', error);
                }
            });
        } catch (error) {
            console.error('Error starting ready check:', error);
        }
    },

    async startCaptainPick(game) {
        try {
            const shuffledPlayers = [...game.players].sort(() => Math.random() - 0.5);

            const captain1 = shuffledPlayers[0];
            const captain2 = shuffledPlayers[1];

            const playerIndex1 = game.players.findIndex(p => p.userId === captain1.userId);
            const playerIndex2 = game.players.findIndex(p => p.userId === captain2.userId);

            game.players[playerIndex1].team = 1;
            game.players[playerIndex2].team = 2;

            game.captains = [
                { userId: captain1.userId, team: 1 },
                { userId: captain2.userId, team: 2 }
            ];

            game.status = 'captain_pick';
            await game.save();

            await this.updateQueueEmbed(game);

            if (game.players.length > 2) {
                await pickHandler.startPlayerPick(game);
            } else {
                await pickHandler.startMapPick(game);
            }
        } catch (error) {
            console.error('Error starting captain pick:', error);
        }
    }
};