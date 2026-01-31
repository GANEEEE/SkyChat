const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('game')
        .setDescription('Search for a game on Steam and other platforms')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name of the game you want to search for')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();

        try {
            const response = await axios.get(
                `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(focusedValue)}&cc=US&l=en&limit=5`
            );

            const choices = response.data.items.map(item => ({
                name: item.name.length > 100 ? item.name.substring(0, 97) + '...' : item.name,
                value: item.id.toString()
            }));

            await interaction.respond(choices);
        } catch (error) {
            console.error('Error fetching autocomplete data:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const gameId = interaction.options.getString('name');
        await interaction.deferReply();

        try {
            // الحصول على بيانات اللعبة من Steam API
            const appDetailsResponse = await axios.get(
                `https://store.steampowered.com/api/appdetails?appids=${gameId}&cc=US&l=en`
            );

            const details = appDetailsResponse.data[gameId];

            if (!details || !details.success) {
                return await interaction.editReply('Sorry, there was an error fetching game details.');
            }

            const gameData = details.data;

            // الحصول على بيانات التقييم من SteamSpy
            let steamRating = 'No user reviews';
            try {
                const steamSpyResponse = await axios.get(
                    `https://steamspy.com/api.php?request=appdetails&appid=${gameId}`
                );

                const spyData = steamSpyResponse.data;

                if (spyData.positive !== undefined && spyData.negative !== undefined) {
                    const positive = parseInt(spyData.positive);
                    const negative = parseInt(spyData.negative);
                    const total = positive + negative;
                    const ratio = total > 0 ? positive / total : 0;
                    const positivePercentage = ratio * 100;

                    // نظام التقييم المعتمد من Steam
                    if (total < 10) {
                        steamRating = 'Not enough reviews';
                    } else if (positivePercentage >= 95 && total >= 500) {
                        steamRating = 'Overwhelmingly Positive';
                    } else if (positivePercentage >= 95 && total < 500) {
                        steamRating = 'Very Positive';
                    } else if (positivePercentage >= 80 && total >= 50) {
                        steamRating = 'Very Positive';
                    } else if (positivePercentage >= 80 && total < 50) {
                        steamRating = 'Positive';
                    } else if (positivePercentage >= 70 && total >= 50) {
                        steamRating = 'Mostly Positive';
                    } else if (positivePercentage >= 70 && total < 50) {
                        steamRating = 'Positive';
                    } else if (positivePercentage >= 40 && total >= 50) {
                        steamRating = 'Mixed';
                    } else if (positivePercentage >= 40 && total < 50) {
                        steamRating = 'Mixed';
                    } else if (positivePercentage >= 20 && total >= 50) {
                        steamRating = 'Mostly Negative';
                    } else if (positivePercentage >= 20 && total < 50) {
                        steamRating = 'Negative';
                    } else if (positivePercentage >= 5 && total >= 500) {
                        steamRating = 'Overwhelmingly Negative';
                    } else if (positivePercentage >= 5 && total < 500) {
                        steamRating = 'Very Negative';
                    } else {
                        steamRating = 'Overwhelmingly Negative';
                    }

                    // إضافة نسبة التقييم الإيجابي
                    steamRating += ` (${Math.round(positivePercentage)}% positive)`;
                }
            } catch (error) {
                console.error('Error fetching SteamSpy data:', error);
                steamRating = 'Rating not available';
            }

            // الباقي من الكود الأصلي...
            let achievementsCount = 'No achievements';
            try {
                const schemaResponse = await axios.get(
                    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${process.env.STEAM_API_KEY || 'DEMO'}&appid=${gameId}`
                );
                if (schemaResponse.data.game && 
                    schemaResponse.data.game.availableGameStats && 
                    schemaResponse.data.game.availableGameStats.achievements &&
                    schemaResponse.data.game.availableGameStats.achievements.length > 0) {
                    achievementsCount = `${schemaResponse.data.game.availableGameStats.achievements.length} achievements`;
                }
            } catch (error) {
                if (gameData.achievements && gameData.achievements.total > 0) {
                    achievementsCount = `${gameData.achievements.total} achievements`;
                }
            }

            // Price information
            let priceInfo = 'Not available';
            let discountPercent = '0%';
            let finalPrice = 'Not available';

            if (gameData.price_overview) {
                priceInfo = gameData.price_overview.initial_formatted;
                discountPercent = `${gameData.price_overview.discount_percent}%`;
                finalPrice = gameData.price_overview.final_formatted;
            } else if (gameData.is_free) {
                priceInfo = 'Free';
                finalPrice = 'Free';
                discountPercent = '0%';
            }

            // Release date
            const releaseDate = gameData.release_date?.date || 'Not available';

            // Multiplayer check
            const isMultiplayer = gameData.categories 
                ? gameData.categories.some(category => 
                    category.description.includes('Multiplayer') || 
                    category.description.includes('Co-op') ||
                    category.description.includes('Online') ||
                    category.description.includes('PvP') ||
                    category.description.includes('MMO'))
                : false;

            // Tags بدلاً من Categories
            const tags = gameData.genres 
                ? gameData.genres.map(genre => genre.description).join(', ') 
                : 'Not available';

            // Developers
            const developers = gameData.developers?.join(', ') || 'Not available';

            // إنشاء الـ Embed مع إضافة حقل التقييم
            const embed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle(gameData.name)
                .setURL(`https://store.steampowered.com/app/${gameId}`)
                .setDescription(gameData.short_description || 'No description available')
                .setImage(gameData.header_image)
                .addFields(
                    { 
                        name: '💰 **Price Information**', 
                        value: `**Original:** ${priceInfo} | **Discount:** ${discountPercent} | **Current:** ${finalPrice}`,
                        inline: false 
                    },
                    { 
                        name: '📅 **Release Date**', 
                        value: releaseDate,
                        inline: true 
                    },
                    { 
                        name: '🏆 **Achievements**', 
                        value: achievementsCount,
                        inline: true 
                    },
                    { 
                        name: '⭐ **Steam Rating**', 
                        value: steamRating,
                        inline: false 
                    },
                    { 
                        name: '🎮 **Multiplayer**', 
                        value: isMultiplayer ? '✅' : '❌',
                        inline: true 
                    },
                    { 
                        name: '🏷️ **Tags**', 
                        value: tags.length > 100 ? tags.substring(0, 97) + '...' : tags,
                        inline: false 
                    },
                    { 
                        name: '👨‍💻 **Developers**', 
                        value: developers.length > 100 ? developers.substring(0, 97) + '...' : developers,
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: `Requested by ${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error executing game command:', error);
            await interaction.editReply('Sorry, there was an error searching for the game.');
        }
    },
};
