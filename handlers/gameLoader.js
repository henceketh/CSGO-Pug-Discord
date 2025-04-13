const Game = require('../models/game');
const gameHandler = require('./gameHandler');
const pickHandler = require('./pickHandler');

module.exports = {
    async loadGames() {
        try {
            const activeGames = await Game.find({ active: true });
            console.log(`Found ${activeGames.length} active games`);

            if (activeGames.length === 0) return;

            for (const game of activeGames) {
                try {
                    const guild = global.client.guilds.cache.get(game.guildId);
                    if (!guild) {
                        console.log(`Guild ${game.guildId} not found for game ${game._id}, marking as inactive`);
                        game.active = false;
                        await game.save();
                        continue;
                    }

                    const category = guild.channels.cache.get(game.categoryId);
                    if (!category) {
                        console.log(`Category ${game.categoryId} not found for game ${game._id}, marking as inactive`);
                        game.active = false;
                        await game.save();
                        continue;
                    }

                    const queueChannel = guild.channels.cache.get(game.queueChannelId);
                    if (!queueChannel) {
                        console.log(`Queue channel ${game.queueChannelId} not found for game ${game._id}, marking as inactive`);
                        game.active = false;
                        await game.save();
                        continue;
                    }

                    try {
                        await queueChannel.messages.fetch(game.messageId);
                    } catch (error) {
                        console.log(`Could not fetch main queue message for game ${game._id}, creating a new one`);

                        const embed = await gameHandler.createQueueEmbed(game);
                        const newMessage = await queueChannel.send({ embeds: [embed] });
                        game.messageId = newMessage.id;
                        await game.save();
                    }

                    switch (game.status) {
                        case 'waiting':
                            const lobbyChannel = guild.channels.cache.get(game.lobbyChannelId);
                            if (lobbyChannel) {
                                gameHandler.watchLobby(lobbyChannel, game);
                                console.log(`Resumed watching lobby for game ${game._id}`);
                            } else {
                                console.log(`Lobby channel not found for game ${game._id}`);
                                game.active = false;
                                await game.save();
                            }
                            break;

                        case 'ready_check':
                            if (new Date(game.readyCheckTimeout) > new Date()) {
                                console.log(`Resuming ready check for game ${game._id}`);
                                gameHandler.startReadyCheck(game);
                            } else {
                                console.log(`Ready check timed out for game ${game._id}, resetting to waiting`);
                                game.status = 'waiting';
                                game.players.forEach(p => p.ready = false);
                                await game.save();
                                await gameHandler.updateQueueEmbed(game);

                                const lobbyChannel = guild.channels.cache.get(game.lobbyChannelId);
                                if (lobbyChannel) {
                                    await lobbyChannel.permissionOverwrites.edit(guild.id, {
                                        Connect: null
                                    });
                                    gameHandler.watchLobby(lobbyChannel, game);
                                }
                            }
                            break;

                        case 'captain_pick':
                            console.log(`Resuming captain pick for game ${game._id}`);
                            const availablePlayers = game.players.filter(p => p.team === 0);
                            if (availablePlayers.length > 0) {
                                pickHandler.startPlayerPick(game);
                            } else {
                                pickHandler.startMapPick(game);
                            }
                            break;

                        case 'map_pick':
                            console.log(`Resuming map pick for game ${game._id}`);
                            pickHandler.startMapPick(game);
                            break;

                        case 'in_progress':
                            console.log(`Game ${game._id} is in progress, updating queue message`);
                            await gameHandler.updateQueueEmbed(game);
                            break;

                        case 'completed':
                            console.log(`Game ${game._id} is completed, marking as inactive`);
                            game.active = false;
                            await game.save();
                            break;
                    }

                } catch (error) {
                    console.error(`Error processing game ${game._id}:`, error);
                    game.active = false;
                    await game.save();
                }
            }
        } catch (error) {
            console.error('Error loading games:', error);
        }
    }
};