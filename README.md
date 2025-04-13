# Discord CS:GO Matchmaking Bot (Nightly Build)

This is the development branch of the Discord CS:GO Matchmaking Bot, containing the latest features and improvements that have not yet been released to the stable branch. Please be aware that this version may contain experimental features and could be less stable than the release version.

## Development Status

This nightly build is under active development. Features may be incomplete, behavior may change without notice, and there could be performance or stability issues. We recommend using the stable branch for production environments.

## Experimental Features

The nightly branch includes the following experimental features that are not yet available in the stable release:

- **Enhanced Map Pool Management**: Ability to customize the map pool per game mode
- **Match History**: Tracking of completed matches with basic statistics
- **Team Balancing**: Experimental algorithm for more balanced team selection
- **Advanced Ready Check**: More robust ready check system with additional time controls
- **Localization Framework**: Foundations for supporting multiple languages
- **Voice Channel Controls**: Advanced permissions and controls for team voice channels

## Installation

### Standard Installation

1. Clone the repository, specifying the nightly branch:
   ```
   git clone -b nightly https://github.com/henceketh/discord-csgo-matchmaking-bot.git
   cd discord-csgo-matchmaking-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with:
   ```
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id
   MONGODB_URI=your_mongodb_connection_string
   ```

4. Register commands:
   ```
   node deploy-commands.js
   ```

5. Start the bot:
   ```
   node index.js
   ```

### Docker Installation (Nightly)

The nightly branch includes improved Docker support:

1. Clone the repository, specifying the nightly branch:
   ```
   git clone -b nightly https://github.com/henceketh/discord-csgo-matchmaking-bot.git
   cd discord-csgo-matchmaking-bot
   ```

2. Create a `.env` file as described above, and add:
   ```
   MONGO_USER=your_mongodb_username
   MONGO_PASSWORD=your_mongodb_password
   ```

3. Build and start the containers:
   ```
   docker-compose up -d
   ```

## Reporting Issues

When reporting issues with the nightly build, please:

1. Check if the issue already exists in the Issue tracker
2. Create a new issue with "[Nightly]" at the beginning of the title
3. Include the specific nightly build version or commit hash
4. Provide detailed reproduction steps
5. Include logs, error messages, and context

## Contributing to Development

Contributions to the nightly branch are welcome. Please follow these guidelines:

1. Fork the repository and create your branch from `nightly`
2. Implement your changes following the project's coding standards
3. Add or update tests for your changes
4. Update documentation to reflect your changes
5. Submit a pull request to the `nightly` branch

## Switching Between Branches

To switch between nightly and stable branches:

```
git checkout main    # For stable version
git checkout nightly # For development version
```

Remember to run `npm install` after switching branches to ensure you have the correct dependencies.
