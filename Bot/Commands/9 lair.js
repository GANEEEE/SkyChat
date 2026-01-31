const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');

// API for random facts (truths)
const FACTS_API = 'https://uselessfacts.jsph.pl/api/v2/facts/random';

// API for random jokes (can be used as lies)
const JOKES_API = 'https://official-joke-api.appspot.com/jokes/random';

// Fallback truths and lies in case API fails
const FALLBACK_TRUTHS = [
    "The average sneeze travels at about 100 miles per hour",
    "Octopuses have three hearts and nine brains",
    "Honey never spoils - archaeologists have found edible honey in ancient Egyptian tombs",
    "A day on Venus is longer than a year on Venus",
    "Bananas are berries, but strawberries aren't"
];

const FALLBACK_LIES = [
    "Bees can fly faster than commercial airplanes",
    "Humans only use 10% of their brains",
    "Goldfish have a 3-second memory span",
    "Sharks don't get cancer",
    "The Great Wall of China is visible from space with the naked eye"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liar')
        .setDescription('Play "Who\'s the Liar?" - Guess which statement is false'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Create game data
            const gameData = await createGameData();

            // Create game interface
            const embed = new EmbedBuilder()
                .setTitle('🎮 Who\'s the Liar?')
                .setDescription('**Game Rules:**\nI have 3 statements. Two are true, one is a lie.\nTry to spot the lie!')
                .setImage(process.env.BlueLine)
                .setColor(process.env.Bluecolor)
                .addFields(
                    { name: '1️⃣ Statement 1', value: gameData.statements[0], inline: false },
                    { name: '2️⃣ Statement 2', value: gameData.statements[1], inline: false },
                    { name: '3️⃣ Statement 3', value: gameData.statements[2], inline: false }
                )
                .setFooter({ text: 'Choose the number of the false statement using the buttons below' });

            // Create choice buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('lie_1')
                        .setLabel('1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('lie_2')
                        .setLabel('2')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('lie_3')
                        .setLabel('3')
                        .setStyle(ButtonStyle.Primary)
                );

            const reply = await interaction.editReply({ 
                embeds: [embed], 
                components: [row] 
            });

            // Create interaction collector
            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000 // 60 seconds to play
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ 
                        content: 'It\'s not your turn to play!', 
                        ephemeral: true 
                    });
                }

                const selectedLie = parseInt(i.customId.split('_')[1]);
                const isCorrect = selectedLie === gameData.lieIndex + 1;

                // Update message with game result
                const resultEmbed = new EmbedBuilder()
                    .setTitle(isCorrect ? '🎉 Correct! You won!' : '❌ Sorry, you lost!')
                    .setColor(isCorrect ? process.env.Bluecolor : '#8B0000')
                    .setDescription(isCorrect ? 
                        'You successfully spotted the lie! 🎯' : 
                        `The lie was statement number ${gameData.lieIndex + 1}: "${gameData.statements[gameData.lieIndex]}"`)
                    .addFields(
                        { name: 'True Statements:', value: gameData.truths.join('\n'), inline: false },
                        { name: 'False Statement:', value: gameData.lie, inline: false }
                    );

                await i.update({ 
                    embeds: [resultEmbed], 
                    components: [] 
                });

                collector.stop();
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.editReply({ 
                        content: 'Time\'s up! No statement was selected.',
                        components: [] 
                    });
                }
            });

        } catch (error) {
            console.error('Error in liar game:', error);
            await interaction.editReply('❌ An error occurred while preparing the game. Please try again later.');
        }
    }
};

// Function to create game data
async function createGameData() {
    try {
        // Get true facts from API
        const factResponse1 = await axios.get(FACTS_API);
        const factResponse2 = await axios.get(FACTS_API);

        // Get a joke to use as a lie
        const jokeResponse = await axios.get(JOKES_API);
        const lie = `${jokeResponse.data.setup} ${jokeResponse.data.punchline}`;

        // Prepare statements
        const truths = [
            factResponse1.data.text,
            factResponse2.data.text
        ];

        const statements = [...truths, lie];

        // Randomly shuffle the statements
        for (let i = statements.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [statements[i], statements[j]] = [statements[j], statements[i]];
        }

        // Find the new index of the lie after shuffling
        const lieIndex = statements.indexOf(lie);

        return {
            statements,
            lieIndex,
            lie: lie,
            truths: truths
        };

    } catch (error) {
        console.error('Error fetching data from APIs:', error);

        // Use fallback data if API fails
        const randomTruths = [...FALLBACK_TRUTHS]
            .sort(() => Math.random() - 0.5)
            .slice(0, 2);

        const randomLie = FALLBACK_LIES[Math.floor(Math.random() * FALLBACK_LIES.length)];

        const statements = [...randomTruths, randomLie];

        // Randomly shuffle the statements
        for (let i = statements.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [statements[i], statements[j]] = [statements[j], statements[i]];
        }

        const lieIndex = statements.indexOf(randomLie);

        return {
            statements,
            lieIndex,
            lie: randomLie,
            truths: randomTruths
        };
    }
}