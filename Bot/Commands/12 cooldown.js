const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    SeparatorBuilder, 
    TextDisplayBuilder,
    MessageFlags 
} = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cooldown')
        .setDescription('View all your active cooldowns')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('View another user\'s cooldowns (optional)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            // تحديد المستخدم المستهدف
            let targetUser = interaction.options.getUser('user');
            const isSelf = !targetUser || targetUser.id === interaction.user.id;

            if (!targetUser) {
                targetUser = interaction.user;
            }

            const userId = targetUser.id;
            const username = targetUser.username;
            const userAvatar = targetUser.displayAvatarURL({ extension: 'png', size: 256 });

            await interaction.deferReply();

            // الحصول على بيانات المستخدم
            const userData = await dbManager.get(`SELECT * FROM levels WHERE user_id = ?`, [userId]);

            if (!userData) {
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF9900)
                    .addSectionComponents((section) =>
                        section
                            .addTextDisplayComponents(
                                (textDisplay) =>
                                    textDisplay.setContent(`# 📭 ${username}'s Cooldowns`)
                            )
                            .setThumbnailAccessory((thumbnail) =>
                                thumbnail
                                    .setDescription(`${username}'s profile`)
                                    .setURL(userAvatar)
                            )
                    )
                    .addSeparatorComponents((separator) => separator)
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`*${username} doesn't have a profile yet.*\n*They need to interact with the bot first.*`)
                    );

                return await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

            const now = new Date();

            // إنشاء الـ Container الرئيسي
            const container = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents(
                            (textDisplay) =>
                                textDisplay.setContent(`# ⏰ ${username}'s Cooldown/s`)
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`${username}'s cooldowns`)
                                .setURL(userAvatar)
                        )
                );

            // ========== 1. DAILY RESET COOLDOWN (last_daily_earned) ==========
            container.addSeparatorComponents((separator) => separator)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('## **Daily Limits Reset**')
                );

            const lastDailyEarned = userData.last_daily_earned ? new Date(userData.last_daily_earned) : null;
            if (lastDailyEarned) {
                const nextDailyReset = new Date(lastDailyEarned.getTime() + (24 * 60 * 60 * 1000));
                const timeDiff = nextDailyReset - now;

                if (timeDiff > 0) {
                    const secondsLeft = Math.floor(timeDiff / 1000);
                    const hours = Math.floor(secondsLeft / 3600);
                    const minutes = Math.floor((secondsLeft % 3600) / 60);
                    const seconds = secondsLeft % 60;

                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`⏳ **Time Left:** \`${hours}h ${minutes}m ${seconds}s\``)
                    );

                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`📊 **Daily Progress:** \`${userData.xp_earned_today || 0}/500 XP | ${userData.coins_earned_today || 0}/750 Coins\``)
                    );
                } else {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`✅ **Ready to claim!**`)
                    );
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`🎯 **Daily limits have been reset**`)
                    );
                }
            } else {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`🎊 **First day!** No cooldown yet`)
                );
            }

            // ========== 2. DAILY REWARD COOLDOWN (last_daily) ==========
            container.addSeparatorComponents((separator) => separator)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('## **Daily Reward**')
                );

            const lastDaily = userData.last_daily ? new Date(userData.last_daily) : null;
            if (lastDaily) {
                const nextDaily = new Date(lastDaily.getTime() + (24 * 60 * 60 * 1000));
                const timeDiff = nextDaily - now;

                if (timeDiff > 0) {
                    const secondsLeft = Math.floor(timeDiff / 1000);
                    const hours = Math.floor(secondsLeft / 3600);
                    const minutes = Math.floor((secondsLeft % 3600) / 60);
                    const seconds = secondsLeft % 60;

                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`⏳ **Next Daily In:** \`${hours}h ${minutes}m ${seconds}s\``)
                    );
                } else {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`✅ **Ready to claim!**`)
                    );
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`🎁 **Daily reward is available**`)
                    );
                }

                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`🔥 **Streak:** \`${userData.daily_streak || 0} days\``)
                );
            } else {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`🎯 **No daily claimed yet** - Use \`/daily\` to start`)
                );
            }

            // ========== 3. WEEKLY REWARD COOLDOWN (last_weekly) ==========
            container.addSeparatorComponents((separator) => separator)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('## **Weekly Reward**')
                );

            const lastWeekly = userData.last_weekly ? new Date(userData.last_weekly) : null;
            if (lastWeekly) {
                const nextWeekly = new Date(lastWeekly.getTime() + (7 * 24 * 60 * 60 * 1000));
                const timeDiff = nextWeekly - now;

                if (timeDiff > 0) {
                    const secondsLeft = Math.floor(timeDiff / 1000);
                    const days = Math.floor(secondsLeft / (24 * 3600));
                    const hours = Math.floor((secondsLeft % (24 * 3600)) / 3600);
                    const minutes = Math.floor((secondsLeft % 3600) / 60);
                    const seconds = secondsLeft % 60;

                    let timeString = '';
                    if (days > 0) timeString += `${days}d `;
                    if (hours > 0) timeString += `${hours}h `;
                    if (minutes > 0) timeString += `${minutes}m `;
                    timeString += `${seconds}s`;

                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`⏳ **Next Weekly In:** \`${timeString}\``)
                    );
                } else {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`✅ **Ready to claim!**`)
                    );
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`🎁 **Weekly reward is available**`)
                    );
                }

                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`🔥 **Streak:** \`${userData.weekly_streak || 0} weeks\``)
                );
            } else {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`🎯 **No weekly claimed yet** - Use \`/weekly\` to start`)
                );
            }

            // ========== 4. EXCHANGE RESET COOLDOWN (last_exchange_reset) ==========
            container.addSeparatorComponents((separator) => separator)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('## **Crystal Exchange Reset**')
                );

            const lastExchangeReset = userData.last_exchange_reset ? new Date(userData.last_exchange_reset) : null;
            if (lastExchangeReset) {
                const nextExchangeReset = new Date(lastExchangeReset.getTime() + (24 * 60 * 60 * 1000));
                const timeDiff = nextExchangeReset - now;

                if (timeDiff > 0) {
                    const secondsLeft = Math.floor(timeDiff / 1000);
                    const hours = Math.floor(secondsLeft / 3600);
                    const minutes = Math.floor((secondsLeft % 3600) / 60);
                    const seconds = secondsLeft % 60;

                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`⏳ **Next Reset In:** \`${hours}h ${minutes}m ${seconds}s\``)
                    );

                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`💎 **Crystals Exchanged Today:** \`${userData.crystals_exchanged_today || 0}\``)
                    );
                } else {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`✅ **Ready to exchange!**`)
                    );
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`🔄 **Daily exchange limit has been reset**`)
                    );
                }
            } else {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`🎊 **First time!** No exchange cooldown yet`)
                );
            }

            // ========== 5. GOALS RESET COOLDOWNS ==========
            container.addSeparatorComponents((separator) => separator)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('## **Goals Reset**')
                );

            try {
                // جلب بيانات المهام
                const userGoals = await dbManager.getUserGoals(userId);

                if (!userGoals) {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`📭 *${username} doesn't have goals yet*`)
                    );
                } else {
                    // التحقق من المهام اليومية
                    if (userGoals.timestamps && userGoals.timestamps.next_daily_reset) {
                        const nextDailyReset = new Date(userGoals.timestamps.next_daily_reset);
                        const timeDiff = nextDailyReset - now;

                        if (timeDiff > 0) {
                            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

                            container.addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`🕰️ **Daily Goals Reset:** \`${hours}h ${minutes}m\``)
                            );
                        } else {
                            container.addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`✅ **Daily Goals:** Ready for reset`)
                            );
                        }
                    }

                    // التحقق من المهام الأسبوعية
                    if (userGoals.timestamps && userGoals.timestamps.next_weekly_reset) {
                        const nextWeeklyReset = new Date(userGoals.timestamps.next_weekly_reset);
                        const timeDiff = nextWeeklyReset - now;

                        if (timeDiff > 0) {
                            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                            container.addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`📆 **Weekly Goal Reset:** \`${days}d ${hours}h\``)
                            );
                        } else {
                            container.addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent(`✅ **Weekly Goal:** Ready for reset`)
                            );
                        }
                    }

                    // عرض حالة المهام الحالية
                    const hasActiveGoals = userGoals.daily && userGoals.daily.length > 0;
                    if (hasActiveGoals) {
                        let activeCount = 0;
                        let completedCount = 0;
                        let claimedCount = 0;

                        if (userGoals.daily) {
                            activeCount += userGoals.daily.filter(g => g && !g.claimed).length;
                            completedCount += userGoals.daily.filter(g => g && g.completed).length;
                            claimedCount += userGoals.daily.filter(g => g && g.claimed).length;
                        }

                        if (userGoals.weekly) {
                            if (!userGoals.weekly.claimed) activeCount++;
                            if (userGoals.weekly.completed) completedCount++;
                            if (userGoals.weekly.claimed) claimedCount++;
                        }

                        container.addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`🎯 **Active:** \`${activeCount}\` | **Completed:** \`${completedCount}\` | **Claimed:** \`${claimedCount}\``)
                        );
                    }
                }
            } catch (error) {
                console.error('Error fetching goals for cooldown:', error);
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`⚠️ *Could not load goals data*`)
                );
            }

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Error in cooldown command:', error);

            const container = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('# ❌ Error\n*Please try again later*')
                );

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};