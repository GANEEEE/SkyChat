const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// قائمة التصنيفات الموسعة (20 تصنيف)
const steamGenres = [
    "Action", "Adventure", "RPG", "Strategy", "Simulation",
    "Sports", "Racing", "Horror", "Puzzle", "Platformer",
    "Shooter", "Fighting", "Open World", "Sandbox", "Survival",
    "MMO", "VR", "Indie", "Casual", "Multiplayer", "Indie", "Free to Play", "PvE", "PvP", "Sci-Fi", "Fantasy", "Historical", "Military", "Building", "Co-op", "Online Co-op", "Hack and Slash", "Stealth", "Zombies"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('random')
        .setDescription('Get a random Steam game')
        .addStringOption(option =>
            option.setName('genre')
                .setDescription('Choose game genre')
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();

        // فلترة الأنواع بناءً على الإدخال
        const filtered = steamGenres
            .filter(genre => genre.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(interaction) {
        await interaction.deferReply();

        const genre = interaction.options.getString('genre');
        const randomType = genre ? `Genre: ${genre}` : 'Completely Random';

        try {
            // 1. الحصول على قائمة الألعاب من SteamSpy
            const gamesListUrl = genre
                ? `https://steamspy.com/api.php?request=tag&tag=${encodeURIComponent(genre)}`
                : `https://steamspy.com/api.php?request=all`;

            const listRes = await axios.get(gamesListUrl);
            let gamesArr = Object.values(listRes.data);

            // 2. تصفية الألعاب فقط (استبعاد DLC وغيرها)
            gamesArr = gamesArr.filter(game => {
                // نتأكد أن اللعبة ليست DLC أو محتوى إضافي
                const isGame = !game.appid.toString().includes('dlc') && 
                              !game.name.toLowerCase().includes('dlc') &&
                              !game.name.toLowerCase().includes('soundtrack') &&
                              !game.name.toLowerCase().includes('artbook') &&
                              !game.name.toLowerCase().includes('season pass') &&
                              !game.name.toLowerCase().includes('expansion') &&
                              !game.name.toLowerCase().includes('ost') &&
                              !game.name.toLowerCase().includes('pack') &&
                              !game.name.toLowerCase().includes('bundle');
                return isGame;
            });

            if (!gamesArr.length) {
                return interaction.editReply(`No games found for genre: ${genre || 'Any'}. Try another genre.`);
            }

            // 3. اختيار لعبة عشوائية
            const game = gamesArr[Math.floor(Math.random() * gamesArr.length)];

            // 4. الحصول على تفاصيل اللعبة من Steam API
            const detailUrl = `https://store.steampowered.com/api/appdetails?appids=${game.appid}`;
            const detailRes = await axios.get(detailUrl);
            const detailData = detailRes.data[game.appid];

            if (!detailData || !detailData.success) {
                return interaction.editReply('Game information is not available at the moment.');
            }

            const detail = detailData.data;

            // 5. التأكد من أن هذا تطبيق لعبة وليس محتوى آخر
            if (detail.type !== 'game') {
                return interaction.editReply('Selected item is not a game. Please try again.');
            }

            // 6. تجميع البيانات
            const name = detail.name || 'N/A';
            const storeLink = `https://store.steampowered.com/app/${game.appid}`;
            const image = detail.header_image || detail.capsule || null;

            const priceInfo = detail.price_overview;
            const price = priceInfo ? 
                `${(priceInfo.final / 100).toFixed(2)} ${priceInfo.currency}` : 
                'Free/Unavailable';

            const discount = priceInfo && priceInfo.discount_percent > 0 ?
                `Yes (${priceInfo.discount_percent}% off)` : 'No';

            const achievementsCount = detail.achievements ? detail.achievements.total : 'N/A';

            // تاريخ الإصدار
            const releaseDate = detail.release_date?.date || 'N/A';

            // تقييم Steam - استخدام البيانات من SteamSpy بدلاً من Steam API
            let steamRating = 'N/A';
            if (game.positive && game.negative) {
                const total = game.positive + game.negative;
                const ratio = game.positive / total;

                if (ratio >= 0.95 && total >= 500) steamRating = 'Overwhelmingly Positive';
                else if (ratio >= 0.8 && total >= 50) steamRating = 'Very Positive';
                else if (ratio >= 0.7 && total >= 50) steamRating = 'Mostly Positive';
                else if (ratio >= 0.4 && total >= 50) steamRating = 'Mixed';
                else if (ratio >= 0.2 && total >= 50) steamRating = 'Mostly Negative';
                else if (total >= 50) steamRating = 'Very Negative';
                else steamRating = 'No user reviews';
            }

            // المطورون والناشرون
            const developers = detail.developers?.join(', ') || 'N/A';
            const publishers = detail.publishers?.join(', ') || 'N/A';

            // أنواع اللعبة - استخدام بيانات Steam الرسمية
            const gameGenres = detail.genres ? 
                detail.genres.map(g => g.description).join(', ') : 
                (genre || 'N/A');

            // 7. بناء الـ Embed
            const embed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle(name)
                .setURL(storeLink)
                .setImage(image)
                .setDescription(detail.short_description ? 
                    (detail.short_description.length > 400 ? 
                        detail.short_description.substring(0, 397) + '...' : 
                        detail.short_description) : 
                    'No description available')
                .addFields(
                    { name: '💰 Price', value: price, inline: true },
                    { name: '🎯 Discount', value: discount, inline: true },
                    { name: '📅 Release Date', value: releaseDate, inline: false },
                    { name: '🏆 Achievements', value: `${achievementsCount}`, inline: true },
                    { name: '⭐ Steam Rating', value: steamRating, inline: true },
                    { name: '🎮 Game Genres', value: gameGenres.length > 100 ? 
                        gameGenres.substring(0, 97) + '...' : gameGenres, inline: false },
                    { name: '👨‍💻 Developers', value: developers.length > 100 ? 
                        developers.substring(0, 97) + '...' : developers, inline: true },
                    { name: '🏢 Publishers', value: publishers.length > 100 ? 
                        publishers.substring(0, 97) + '...' : publishers, inline: true }
                )
                .setFooter({ text: `Random Steam Game | ${randomType} |` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('Error in execute:', err);
            await interaction.editReply('An error occurred while fetching game data.');
        }
    }
};
