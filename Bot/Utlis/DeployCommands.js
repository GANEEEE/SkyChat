// Bot/Utils/deployCommands.js
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'Commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
      console.warn(`⚠️ Skipped command in ${file}: missing "data" or "execute"`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    console.log('🚀 Deploying slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Successfully deployed all commands.');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
}

module.exports = deployCommands;
