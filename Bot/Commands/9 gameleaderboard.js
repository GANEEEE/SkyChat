const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('storyleaderboard')
        .setDescription('Show the top players in story adventures')
        .addStringOption(option =>
            option.setName('story')
                .setDescription('Choose a specific story')
                .addChoices(
                    { name: 'Mystery Crime', value: 'crime' },
                    { name: 'Egyptian Adventure', value: 'egypt' },
                    { name: 'Ancient Astronomer', value: 'astronomer' },
                    { name: 'Haunted Mansion', value: 'haunted' },
                    { name: 'Zombie Castle', value: 'zombie' },
                    { name: 'All Stories', value: 'all' }
                )),

    async execute(interaction, client) {
        await interaction.deferReply();

        const storyType = interaction.options.getString('story') || 'all';

        try {
            console.log('📊 Fetching story leaderboard data...');

            let leaderboardData = [];

            if (storyType === 'all') {
                leaderboardData = await dbManager.getStoryLeaderboard(null, 100);
            } else {
                // تحويل storyType إلى عنوان القصة
                const storyTitles = {
                    'crime': '🕵️‍♂️ MYSTERY CRIME INVESTIGATION',
                    'egypt': '🏺 EGYPTIAN ADVENTURE',
                    'astronomer': '🔭 ANCIENT ASTRONOMER',
                    'haunted': '👻 HAUNTED MANSION',
                    'zombie': '🧟‍♂️ ZOMBIE CASTLE'
                };

                leaderboardData = await dbManager.getStoryLeaderboard(storyTitles[storyType], 100);
            }

            console.log(`📊 Fetched successfully ${leaderboardData.length} records from the database`);

            if (leaderboardData.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('🏆 Story Adventures Leaderboard')
                    .setDescription('No one has completed any story adventures yet!')
                    .setImage(process.env.BlueLine)
                    .addFields(
                        { name: '💡 How to get on the leaderboard?', value: 'Use `/story` command to start an adventure and complete different endings!' }
                    );

                return interaction.editReply({ embeds: [embed] });
            }

            // الحصول على إحصائيات إضافية لكل مستخدم
            const userStats = {};
            for (const entry of leaderboardData) {
                const userStoryStats = await dbManager.getUserStoryStats(entry.user_id);

                userStats[entry.user_id] = {
                    user_id: entry.user_id,
                    username: entry.username,
                    endings_completed: entry.endings_completed,
                    stories_completed: userStoryStats.length,
                    stories: {}
                };

                // الحصول على تفاصيل كل قصة
                for (const storyStat of userStoryStats) {
                    const storyEndings = await dbManager.getUserCompletedEndings(entry.user_id, storyStat.story_title);
                    userStats[entry.user_id].stories[storyStat.story_title] = {
                        endings: storyStat.endings_completed,
                        completed_endings: storyEndings.map(e => e.ending_id)
                    };
                }
            }

            // تحويل إلى مصفوفة وترتيبها حسب عدد النهايات المكتملة
            const rankedData = Object.values(userStats)
                .sort((a, b) => b.endings_completed - a.endings_completed || b.stories_completed - a.stories_completed)
                .map((user, index) => ({
                    ...user,
                    rank: index + 1
                }));

            // إعداد التقسيم للصفحات
            const perPage = 10;
            let currentPage = 0;
            const totalPages = Math.ceil(rankedData.length / perPage);

            // دالة إنشاء الرد
            const generateLeaderboardEmbed = (page) => {
                const startIdx = page * perPage;
                const pageData = rankedData.slice(startIdx, startIdx + perPage);

                // تعريف ألوان القصص
                const storyColors = {
                    'crime': '#2C3E50',
                    'egypt': '#D4AF37',
                    'astronomer': '#1F618D',
                    'haunted': '#DCDCDC',
                    'zombie': '#8B0000'
                };

                // إعداد العنوان واللون بناءً على نوع القصة
                let title = '🏆 Story Adventures Leaderboard';
                let color = process.env.Bluecolor;

                if (storyType !== 'all') {
                    const storyNames = {
                        'crime': '🕵️‍♂️ Mystery Crime Leaderboard',
                        'egypt': '🏺 Egyptian Adventure Leaderboard',
                        'astronomer': '🔭 Ancient Astronomer Leaderboard',
                        'haunted': '👻 Haunted Mansion Leaderboard',
                        'zombie': '🧟‍♂️ Zombie Castle Leaderboard'
                    };
                    title = storyNames[storyType];
                    color = storyColors[storyType];
                }

                const description = pageData.map((user) => {
                    const medal = user.rank === 1 ? '🥇' : 
                                user.rank === 2 ? '🥈' : 
                                user.rank === 3 ? '🥉' : `[${user.rank}]`;

                    // إذا كان نوع القصة "all"، نعرض إحصائيات كل القصص
                    if (storyType === 'all') {
                        let storiesInfo = '';

                        // إيموجيات القصص
                        const storyEmojis = {
                            '🕵️‍♂️ MYSTERY CRIME INVESTIGATION': '🕵️‍♂️',
                            '🏺 EGYPTIAN ADVENTURE': '🏺',
                            '🔭 ANCIENT ASTRONOMER': '🔭',
                            '👻 HAUNTED MANSION': '👻',
                            '🧟‍♂️ ZOMBIE CASTLE': '🧟‍♂️'
                        };

                        // جمع إحصائيات كل قصة
                        for (const [storyTitle, stats] of Object.entries(user.stories)) {
                            const emoji = storyEmojis[storyTitle] || '📖';
                            storiesInfo += `${emoji}\`${stats.endings}\` `;
                        }

                        return `${medal} <@${user.user_id}> \n ┖  🏆 \`${user.endings_completed} endings\` → ${storiesInfo}`;
                    } else {
                        // إذا كان نوع القصة محدد، نعرض فقط إحصائيات هذه القصة
                        const storyTitles = {
                            'crime': '🕵️‍♂️ MYSTERY CRIME INVESTIGATION',
                            'egypt': '🏺 EGYPTIAN ADVENTURE',
                            'astronomer': '🔭 ANCIENT ASTRONOMER',
                            'haunted': '👻 HAUNTED MANSION',
                            'zombie': '🧟‍♂️ ZOMBIE CASTLE'
                        };

                        const currentStoryTitle = storyTitles[storyType];
                        const storyStats = user.stories[currentStoryTitle] || { endings: 0 };

                        return `${medal} <@${user.user_id}> \n ┖  🏆 \`${storyStats.endings} endings\``;
                    }
                }).join('\n\n');

                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(title)
                    .setDescription(description)
                    .setImage(process.env.BlueLine)
                    .setFooter({ 
                        text: `Page ${page + 1} of ${totalPages} • ${rankedData.length} Adventurers`,
                        iconURL: interaction.guild.iconURL()
                    })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀️ Prev')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('check_user')
                        .setLabel('Check My Stats')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🔍'),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page >= totalPages - 1)
                );

                return { embeds: [embed], components: [row] };
            };

            // دالة إنشاء embed لعرض بيانات المستخدم الحالي
            const generateUserEmbed = (user) => {
                const medal = user.rank === 1 ? '🥇' : 
                            user.rank === 2 ? '🥈' : 
                            user.rank === 3 ? '🥉' : `#${user.rank}`;

                let storiesInfo = '';

                // إيموجيات القصص
                const storyEmojis = {
                    '🕵️‍♂️ MYSTERY CRIME INVESTIGATION': '🕵️‍♂️',
                    '🏺 EGYPTIAN ADVENTURE': '🏺',
                    '🔭 ANCIENT ASTRONOMER': '🔭',
                    '👻 HAUNTED MANSION': '👻',
                    '🧟‍♂️ ZOMBIE CASTLE': '🧟‍♂️'
                };

                for (const [storyTitle, stats] of Object.entries(user.stories)) {
                    const emoji = storyEmojis[storyTitle] || '📖';
                    storiesInfo += `${emoji} **${storyTitle}**: ${stats.endings} endings completed\n`;
                }

                return new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle(`🔍 Your Story Adventures Stats`)
                    .setImage(process.env.BlueLine)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: 'Rank', value: `${medal}`, inline: true },
                        { name: 'Endings Completed', value: `🏆 \`${user.endings_completed}\``, inline: true },
                        { name: 'Stories Played', value: `📖 \`${user.stories_completed}\``, inline: true },
                        { name: 'Story Details', value: storiesInfo || 'No story details available' }
                    )
                    .setFooter({ 
                        text: `Requested by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();
            };

            // إرسال الرد الأولي
            const message = await interaction.editReply(generateLeaderboardEmbed(currentPage));

            // إنشاء جامع للأزرار
            const collector = message.createMessageComponentCollector({ 
                filter: i => i.user.id === interaction.user.id,
                time: 300000 // 5 دقائق
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev_page') {
                    currentPage = Math.max(0, currentPage - 1);
                    await i.update(generateLeaderboardEmbed(currentPage));
                } else if (i.customId === 'next_page') {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                    await i.update(generateLeaderboardEmbed(currentPage));
                } else if (i.customId === 'check_user') {
                    // البحث عن بيانات المستخدم الحالي
                    const userData = rankedData.find(u => u.user_id === interaction.user.id);

                    if (userData) {
                        await i.reply({ 
                            embeds: [generateUserEmbed(userData)], 
                            ephemeral: true 
                        });
                    } else {
                        await i.reply({ 
                            content: '❌ You are not on the leaderboard yet. Complete some story adventures to see your stats!', 
                            ephemeral: true 
                        });
                    }
                }
            });

            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀️ Prev')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('check_user')
                        .setLabel('Check My Stats')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔍')
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                message.edit({ components: [disabledRow] }).catch(console.error);
            });

        } catch (error) {
            console.error('Error in story leaderboard command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while fetching leaderboard data.')
                .addFields(
                    { name: 'Details', value: error.message.substring(0, 1000) }
                );
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};