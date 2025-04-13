const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    categoryId: { type: String, required: true },
    queueChannelId: { type: String, required: true },
    lobbyChannelId: { type: String, required: true },
    messageId: { type: String, required: true },
    currentPhaseMessageId: { type: String, default: null },
    mode: {
        type: String,
        required: true,
        enum: ['1v1', '2v2', '3v3', '5v5']
    },
    status: {
        type: String,
        enum: ['waiting', 'ready_check', 'captain_pick', 'map_pick', 'in_progress', 'completed'],
        default: 'waiting'
    },
    requiredPlayers: { type: Number, required: true },
    players: [{
        userId: String,
        username: String,
        ready: { type: Boolean, default: false },
        team: { type: Number, default: 0 }
    }],
    captains: [{
        userId: String,
        team: Number
    }],
    team1ChannelId: { type: String, default: null },
    team2ChannelId: { type: String, default: null },
    maps: {
        pool: [String],
        banned: [String],
        selected: { type: String, default: null }
    },
    currentPickTurn: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    readyCheckTimeout: { type: Date, default: null },
    captainPickTimeout: { type: Date, default: null },
    active: { type: Boolean, default: true }
});

module.exports = mongoose.model('Game', gameSchema);