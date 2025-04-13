Discord CS Matchmaking Bot
A Discord bot for creating and managing CS game lobbies with automated matchmaking, team selection, and map veto processes.
Features

Multiple Game Modes: Support for 1v1, 2v2, 3v3, and 5v5 matches
Automated Lobbies: Creates category with queue channel and voice lobby
Ready Check System: Ensures all players are ready before starting
Team Selection:

Random captains selection
Captain-based player drafting
Automatic random assignment if time expires


Map Veto Process:

Captains take turns banning maps
CS map pool (de_train, de_dust2, de_shortnuke, de_shortdust)
Final map selected automatically


Team Management:

Creates separate voice channels for each team
Automatically moves players to their team channels


Continuous Games: Creates new game lobbies after matches start
Persistent State: Stores games in MongoDB and recovers on restart

Setup

Clone the repository
Install dependencies:
npm install

Create a .env file with:
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
MONGODB_URI=your_mongodb_connection_string

Register commands:
node deploy-commands.js

Start the bot:
node index.js


Usage
Creating a Game
Use the /create_game command with the following options:

mode: Select from 1v1, 2v2, 3v3, or 5v5
category (optional): ID of existing category to create a new game there

Game Flow

Players join the Lobby voice channel
When enough players join, a ready check begins
After all players confirm, captains are selected randomly
Captains take turns picking players for their teams
Captains take turns banning maps until only one remains
Team voice channels are created and players are moved
A new game lobby is automatically created for the next match
