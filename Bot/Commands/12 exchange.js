const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder
} = require('discord.js');
const dbManager = require('../Data/database');

// ننشئ متغير لتخزين البيانات لكل مستخدم
const userExchangeData = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('exchange')
        .setDescription('💎 Exchange Sky Crystals for Coins'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const userData = await dbManager.getUserProfile(userId);

            if (!userData) {
                await interaction.editReply({
                    content: '❌ **No Account Found**\nSend a message in chat to create your account.'
                });
                return;
            }

            // Get exchange limits
            const limits = await this.getExchangeLimits(userId);

            // Store user data
            userExchangeData.set(userId, {
                userData: userData,
                limits: limits,
                selectedAmount: 0
            });

            // Create exchange interface with selected amount = 0
            const container = this.createExchangeInterface(interaction, userData, limits, 0);

            // إرسال الرسالة أولاً
            const message = await interaction.editReply({ 
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            // ثم إعداد الـ collector
            await this.setupCollector(message, userId, interaction);

        } catch (error) {
            console.error('Error in exchange command:', error);
            await interaction.editReply({
                content: '❌ **Exchange Error**\nAn error occurred.'
            });
        }
    },

    async getExchangeLimits(userId) {
        try {
            const dailyLimit = await dbManager.getBotSetting('exchange_daily_limit');
            const baseRate = await dbManager.getBotSetting('exchange_base_rate');

            // جلب بيانات المستخدم للتحقق من الـ daily limit
            const userData = await dbManager.getUserProfile(userId);
            if (!userData) {
                return {
                    dailyLimit: dailyLimit ? parseInt(dailyLimit.setting_value) : 5,
                    baseRate: baseRate ? parseInt(baseRate.setting_value) : 130,
                    remainingLimit: 5
                };
            }

            // التحقق من daily reset
            await this.checkDailyReset(userId, userData);

            // حساب الـ remaining limit
            const exchangedToday = userData.crystals_exchanged_today || 0;
            const totalDailyLimit = dailyLimit ? parseInt(dailyLimit.setting_value) : 5;
            const remainingLimit = Math.max(0, totalDailyLimit - exchangedToday);

            return {
                dailyLimit: totalDailyLimit,
                baseRate: baseRate ? parseInt(baseRate.setting_value) : 130,
                remainingLimit: remainingLimit
            };
        } catch (error) {
            return {
                dailyLimit: 5,
                baseRate: 130,
                remainingLimit: 5
            };
        }
    },

    // دالة للتحقق من daily reset
    async checkDailyReset(userId, userData) {
        try {
            const today = new Date();
            const lastReset = userData.last_exchange_reset 
                ? new Date(userData.last_exchange_reset) 
                : new Date(0);

            // إذا الفرق أكثر من 24 ساعة أو يوم مختلف
            const hoursDiff = (today - lastReset) / (1000 * 60 * 60);
            const todayDate = today.toISOString().split('T')[0];
            const lastResetDate = lastReset.toISOString().split('T')[0];

            if (hoursDiff >= 24 || todayDate !== lastResetDate) {
                await dbManager.run(
                    `UPDATE levels 
                     SET crystals_exchanged_today = 0,
                         last_exchange_reset = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [userId]
                );
                console.log(`🔄 Reset daily exchange for user ${userId}`);
            }
        } catch (error) {
            console.error('Error resetting daily exchange:', error);
        }
    },

    createExchangeInterface(interaction, userData, limits, selectedAmount = 0) {
        const maxCrystals = userData.sky_crystals;
        const maxAllowed = Math.min(maxCrystals, limits.remainingLimit);
        const totalCoins = selectedAmount * limits.baseRate;
        const timeUntilReset = this.getFormattedTimeUntilReset(userData.last_exchange_reset);

        // User Section
        const userSection = new SectionBuilder()
            .addTextDisplayComponents(
                (textDisplay1) => textDisplay1.setContent(`**# ${interaction.user.username}**`),
                (textDisplay2) => textDisplay2.setContent(`**Coins:** ${userData.sky_coins.toLocaleString()} <:Coins:1468446651965374534>`),
                (textDisplay3) => textDisplay3.setContent(`**Crystals:** ${userData.sky_crystals.toLocaleString()} <:Crystal:1468446688338251793>`)
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail.setURL(interaction.user.displayAvatarURL({ size: 128 }))
            );

        // Exchange Section - فقط SELECTED و TOTAL و RESET TIME
        const exchangeSection = new SectionBuilder()
            .addTextDisplayComponents(
                (textDisplay1) => textDisplay1.setContent(`**🎯 SELECTED:** **${selectedAmount}** Crystal${selectedAmount !== 1 ? 's' : ''}`),
                (textDisplay2) => textDisplay2.setContent(`**💰 TOTAL:** **${totalCoins.toLocaleString()}** Coins`),
                (textDisplay3) => textDisplay3.setContent(`**⌛ Reset in:** ${timeUntilReset}`)
            )
            .setButtonAccessory((button) =>
                button.setCustomId('exchange_confirm')
                    .setLabel('Confirm Exchange')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(selectedAmount === 0 || selectedAmount > maxAllowed)
            );

        // Buttons Row
        const buttonsRow = new ActionRowBuilder()
            .setComponents(
                new ButtonBuilder()
                    .setCustomId('exchange_minimum')
                    .setLabel('Minimum')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(maxCrystals === 0 || maxAllowed < 1),
                new ButtonBuilder()
                    .setCustomId('exchange_minus_1')
                    .setLabel('-1')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(maxCrystals === 0 || selectedAmount <= 0),
                new ButtonBuilder()
                    .setCustomId('exchange_plus_1')
                    .setLabel('+1')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(maxCrystals === 0 || selectedAmount >= maxAllowed),
                new ButtonBuilder()
                    .setCustomId('exchange_maximum')
                    .setLabel('Maximum')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(maxCrystals === 0 || maxAllowed < 1)
            );

        // Separators
        const separator1 = new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small);

        const separator2 = new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small);

        // Container
        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents(userSection)
            .addSeparatorComponents(separator1)
            .addSectionComponents(exchangeSection)
            .addSeparatorComponents(separator2)
            .addActionRowComponents(buttonsRow);

        return container;
    },

    // دالة جديدة: حساب الوقت المتبقي بالتنسيق المطلوب
    getFormattedTimeUntilReset(lastReset) {
        try {
            if (!lastReset) return "24h 00m 00s";

            const now = new Date();
            const resetTime = new Date(lastReset);

            // أضف 24 ساعة لوقت الـ reset
            resetTime.setHours(resetTime.getHours() + 24);

            const diffMs = resetTime - now;

            if (diffMs <= 0) return "00h 00m 00s";

            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

            return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        } catch (error) {
            return "24h 00m 00s";
        }
    },

    // Setup collector للتعامل مع الأزرار
    async setupCollector(message, userId, originalInteraction) {
        const filter = i => i.user.id === userId;

        const collector = message.createMessageComponentCollector({ 
            filter, 
            time: 300000
        });

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();

                const userData = userExchangeData.get(userId);
                if (!userData) {
                    await i.editReply({ content: '❌ Session expired. Please use /exchange again.' });
                    collector.stop();
                    return;
                }

                let { selectedAmount, limits } = userData;
                const maxCrystals = userData.userData.sky_crystals;

                // تحديث الـ remaining limit ديناميكياً
                const currentUserData = await dbManager.getUserProfile(userId);
                const exchangedToday = currentUserData?.crystals_exchanged_today || 0;
                const remainingLimit = Math.max(0, limits.dailyLimit - exchangedToday);
                const maxAllowed = Math.min(maxCrystals, remainingLimit);

                let newAmount = selectedAmount;

                switch (i.customId) {
                    case 'exchange_minimum':
                        newAmount = 1;
                        break;
                    case 'exchange_minus_1':
                        newAmount = Math.max(0, selectedAmount - 1);
                        break;
                    case 'exchange_plus_1':
                        newAmount = Math.min(maxAllowed, selectedAmount + 1);
                        break;
                    case 'exchange_maximum':
                        newAmount = maxAllowed;
                        break;
                    case 'exchange_confirm':
                        await this.processExchange(i, newAmount, userData.userData, limits);
                        userExchangeData.delete(userId);
                        collector.stop();
                        return;
                }

                // تحديث البيانات المخزنة
                userExchangeData.set(userId, {
                    ...userData,
                    selectedAmount: newAmount,
                    limits: {
                        ...limits,
                        remainingLimit: remainingLimit
                    }
                });

                // تحديث الواجهة بالمبلغ الجديد
                const updatedContainer = this.createExchangeInterface(
                    originalInteraction,
                    userData.userData,
                    {
                        ...limits,
                        remainingLimit: remainingLimit
                    },
                    newAmount
                );

                await i.editReply({
                    components: [updatedContainer],
                    flags: MessageFlags.IsComponentsV2
                });

            } catch (error) {
                console.error('Error handling button:', error);
                await i.editReply({ 
                    content: '❌ Error processing your request.' 
                });
            }
        });

        collector.on('end', () => {
            userExchangeData.delete(userId);
        });
    },

    // معالجة التبادل
    async processExchange(interaction, amount, userData, limits) {
        try {
            // التحقق من الرصيد
            if (userData.sky_crystals < amount) {
                await interaction.editReply({
                    content: `❌ **Not enough crystals!**\nYou need ${amount} but only have ${userData.sky_crystals}.`
                });
                return;
            }

            if (amount <= 0) {
                await interaction.editReply({
                    content: '❌ **Invalid amount!**\nPlease select at least 1 crystal.'
                });
                return;
            }

            // التحقق من الـ daily limit
            const exchangedToday = userData.crystals_exchanged_today || 0;
            if (exchangedToday + amount > limits.dailyLimit) {
                await interaction.editReply({
                    content: `❌ **Daily limit exceeded!**\nYou can exchange only ${limits.dailyLimit - exchangedToday} more crystals today.`
                });
                return;
            }

            // حساب النتيجة
            const totalCoins = amount * limits.baseRate;

            // تحديث قاعدة البيانات مع crystals_exchanged_today
            await dbManager.run(
                `UPDATE levels 
                 SET sky_crystals = sky_crystals - ?, 
                     sky_coins = sky_coins + ?,
                     crystals_exchanged_today = crystals_exchanged_today + ?,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ?`,
                [amount, totalCoins, amount, interaction.user.id]
            );

            // جلب البيانات المحدثة
            const updatedUserData = await dbManager.getUserProfile(interaction.user.id);

            // عرض رسالة النجاح مع البيانات الجديدة
            const successContainer = new ContainerBuilder()
                .setAccentColor(0x00ff00)
                .addTextDisplayComponents(
                    (textDisplay) =>
                        textDisplay.setContent(
                            `✅ **EXCHANGE COMPLETE!**\n\n` +
                            `**<:Crystal:1468446688338251793> CRYSTALS:** -${amount}\n` +
                            `**<:Coins:1468446651965374534> COINS:** +${totalCoins.toLocaleString()}\n\n` +
                            `**NEW BALANCE:**\n` +
                            `• <:Crystal:1468446688338251793> Crystals: ${updatedUserData.sky_crystals}\n` +
                            `• <:Coins:1468446651965374534> Coins: ${updatedUserData.sky_coins.toLocaleString()}\n\n` +
                            `**📅 DAILY PROGRESS:**\n` +
                            `• Exchanged today: ${updatedUserData.crystals_exchanged_today || 0}/${limits.dailyLimit} crystals`
                        )
                );

            await interaction.editReply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Exchange error:', error);
            await interaction.editReply({
                content: '❌ **Transaction failed!**\nPlease try again.'
            });
        }
    }
};