const {
    SlashCommandBuilder,
    ContainerBuilder,
    SectionBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    TextDisplayBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');

// تخزين عمليات فتح الكريت الحالية
const pendingBuffDecisions = new Map();

function cleanupOldDecisions() {
    const now = Date.now();
    const ONE_MINUTE = 60 * 1000;

    for (const [userId, decision] of pendingBuffDecisions.entries()) {
        if (decision.timestamp && (now - decision.timestamp > ONE_MINUTE)) {
            console.log(`🧹 Cleaning up old buff decision for user ${userId}`);
            pendingBuffDecisions.delete(userId);
        }
    }
}

// تشغيل التنظيف كل دقيقة
setInterval(cleanupOldDecisions, 60000);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('drops')
        .setDescription('View and open your drop crates'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            // إنشاء واجهة المتجر فقط
            await this.createOrUpdateDropsInterface(interaction, null, null, true);

            // ⚠️ ⚠️ ⚠️ مفيش Collector هنا خالص ⚠️ ⚠️ ⚠️

        } catch (error) {
            console.error('Error in /drops command:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('❌ An error occurred while displaying your drops.')
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },

    async createOrUpdateDropsInterface(interaction, resultMessage = null, buffData = null, isNew = false) {
        const userId = interaction.user.id;

        try {
            // 1. Get user's active buffs
            const userActiveBuffs = await dbManager.getUserActiveBuffs(userId);

            // 2. Get user's unopened crates
            const cratesData = await dbManager.getUserCrates(userId, {
                unusedOnly: true
            });

            // 3. Get user's drop progress stats
            const dropStats = await dbManager.getDropStats(userId);

            // 4. بناء واجهة المتجر
            const container = await this.buildDropsContainer(
                userActiveBuffs || [],
                cratesData || { crates: [] },
                dropStats || { drops: {} },
                interaction.user,
                interaction.guild,
                resultMessage,
                buffData
            );

            if (isNew) {
                await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            } else {
                await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            }

        } catch (error) {
            console.error('Error in createOrUpdateDropsInterface:', error);
            throw error;
        }
    },

    async buttonHandler(interaction) {
        const userId = interaction.user.id;

        try {
            await interaction.deferUpdate();

            // ✅ حالة قبول البف
            if (interaction.customId === 'buff_accept') {
                const buffDecision = pendingBuffDecisions.get(userId);
                if (!buffDecision) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('❌ Buff decision expired.')
                        );

                    await interaction.editReply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                    return;
                }

                try {
                    const { buffType, durationMinutes, crateId, crateType, rewards } = buffDecision;

                    const expiresAt = new Date();
                    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

                    await dbManager.run(
                        `INSERT INTO active_buffs 
                         (user_id, buff_type, multiplier, duration_minutes, expires_at, 
                          source_crate_type, source_crate_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            userId,
                            buffType,
                            2.0,
                            durationMinutes,
                            expiresAt.toISOString(),
                            crateType,
                            crateId
                        ]
                    );

                    pendingBuffDecisions.delete(userId);

                    const userActiveBuffs = await dbManager.getUserActiveBuffs(userId);

                    let buffsContent = '**Active Buffs:**\n';
                    if (userActiveBuffs && userActiveBuffs.length > 0) {
                        userActiveBuffs.forEach((buff, index) => {
                            const buffName = formatBuffName(buff.buff_type);
                            const expiresAt = buff.expires_at ? new Date(buff.expires_at) : null;
                            let expiresIn = 'Unknown';
                            if (expiresAt) {
                                const minutesLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 60000));
                                expiresIn = formatTime(minutesLeft);
                            }
                            buffsContent += `${buffName} - ⏳ ${expiresIn}`;
                            if (index < userActiveBuffs.length - 1) buffsContent += '\n';
                        });
                    }

                    const acceptMessage = `## ✅ Buff Accepted!\n\n` +
                                        `❌ **You cannot open crates while you have active buffs!**`;

                    await this.createOrUpdateDropsInterface(interaction, acceptMessage, null, false);

                } catch (dbError) {
                    console.error('Database error in accept_buff:', dbError);

                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('❌ An error occurred while saving the buff.')
                        );

                    await interaction.editReply({
                        components: [errorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
                // ✅ حالة رفض البف
                else if (interaction.customId === 'buff_reject') {
                    const buffDecision = pendingBuffDecisions.get(userId);

                    console.log(`❌ Reject buff - User: ${userId}, Decision exists: ${!!buffDecision}`);
                    console.log(`❌ All pending decisions:`, Array.from(pendingBuffDecisions.keys()));

                    if (!buffDecision) {
                        // ⚠️ مش نرجع رسالة خطأ، نرجع للواجهة العادية
                        console.log(`❌ No buff decision found for user ${userId}, returning to main drops`);

                        try {
                            // أعد تحميل الواجهة الرئيسية
                            await this.createOrUpdateDropsInterface(interaction, null, null, false);
                            return;
                        } catch (error) {
                            console.error('Error returning to main drops:', error);

                            const errorContainer = new ContainerBuilder()
                                .setAccentColor(0xFF0000)
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent('❌ Buff already processed. Returning to drops.')
                                );

                            await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                        }
                        return;
                    }

                    try {
                        const { buffType, durationMinutes, crateType, rewards } = buffDecision;

                        console.log(`❌ Processing reject buff - Buff: ${buffType}, Coins: ${rewards?.coins}, XP: ${rewards?.xp}`);

                        // ⚠️ مسح القرار أول ما بنبدأ
                        pendingBuffDecisions.delete(userId);

                        // تحديث رصيد المستخدم بالمكافآت
                        if (rewards?.coins > 0 || rewards?.xp > 0 || rewards?.crystals > 0) {
                            await levelSystem.processUserRewards(
                                userId,
                                '',
                                rewards.xp || 0,
                                rewards.coins || 0,
                                rewards.crystals || 0,
                                null,
                                null,
                                'drop',
                                true  // بدون daily limits
                            );
                        }

                        // ⚠️ تحديث مهمة Lucky Day إذا كان فيه coins
                        if (rewards?.coins > 0) {
                            try {
                                await dbManager.updateGoalProgress(userId, 'drop_coins', rewards.coins);
                            } catch (missionError) {
                                console.error('Error updating mission:', missionError.message);
                            }
                        }

                        // بناء رسالة الرفض
                        let rewardsContent = '';
                        if (rewards?.coins > 0) {
                            rewardsContent += `**${rewards.coins} <:Coins:1468446651965374534> Coins** added\n`;
                        }
                        if (rewards?.xp > 0) {
                            rewardsContent += `**${rewards.xp} <:XP:1468446751282302976>** added\n`;
                        }
                        if (rewards?.crystals > 0) {
                            rewardsContent += `**${rewards.crystals} <:Crystal:1468446688338251793> Crystals** added\n`;
                        }

                        const rejectMessage = `# ❌ Buff Rejected!\n\n` +
                                            `${rewardsContent}` +
                                            `\n*Buff has been discarded.*`;

                        await this.createOrUpdateDropsInterface(interaction, rejectMessage, null, false);

                    } catch (error) {
                        console.error('Error updating interface after reject:', error);

                        // ⚠️ حتى لو فشلت، أعد للواجهة الرئيسية
                        try {
                            await this.createOrUpdateDropsInterface(interaction, null, null, false);
                        } catch (retryError) {
                            console.error('Could not return to main drops:', retryError);
                        }
                    }
                }
            // ✅ حالة فتح الكريت
                // ✅ حالة فتح الكريت (مع الكوبون)
                else if (interaction.customId.startsWith('open_crate_')) {
                    const parts = interaction.customId.split('_');
                    const crateId = parts[2];
                    const crateType = parts[3];

                    try {
                        const userActiveBuffs = await dbManager.getUserActiveBuffs(userId);
                        const hasAnyBuff = userActiveBuffs && userActiveBuffs.length > 0;

                        if (hasAnyBuff) {
                            let buffsContent = '**Active Buffs:**\n';
                            userActiveBuffs.forEach((buff, index) => {
                                const buffName = formatBuffName(buff.buff_type);
                                const expiresAt = buff.expires_at ? new Date(buff.expires_at) : null;
                                let expiresIn = 'Unknown';
                                if (expiresAt) {
                                    const minutesLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 60000));
                                    expiresIn = formatTime(minutesLeft);
                                }
                                buffsContent += `${buffName} - ⏳ ${expiresIn}`;
                                if (index < userActiveBuffs.length - 1) buffsContent += '\n';
                            });

                            const errorContainer = new ContainerBuilder()
                                .setAccentColor(0xFFA500)
                                .addSectionComponents((section) =>
                                    section
                                        .addTextDisplayComponents((textDisplay) =>
                                            textDisplay.setContent(
                                                `# ⚠️ Cannot Open Crates\n\n` +
                                                `${buffsContent}\n\n` +
                                                `❌ **You cannot open crates while you have active buffs!**`
                                            )
                                        )
                                        .setThumbnailAccessory((thumbnail) =>
                                            thumbnail
                                                .setDescription('Active Buffs Warning')
                                                .setURL('https://i.imgur.com/w3duR07.png')
                                        )
                                );

                            await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                            return;
                        }

                        // فتح الكريت
                        const openResult = await this.openUserCrate(crateId, userId, crateType);

                        if (!openResult.success) {
                            const errorContainer = new ContainerBuilder()
                                .setAccentColor(0xFF0000)
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent(`❌ Failed to open crate: ${openResult.error}`)
                                );

                            await interaction.editReply({
                                components: [errorContainer],
                                flags: MessageFlags.IsComponentsV2
                            });
                            return;
                        }

                        const rewards = openResult.crate.rewards;
                        let rewardsContent = '';

                        if (rewards.coins > 0) {
                            rewardsContent += `**${rewards.coins} <:Coins:1468446651965374534> Coins** added\n`;
                        }
                        if (rewards.xp > 0) {
                            rewardsContent += `**${rewards.xp} <:XP:1468446751282302976>** added\n`;
                        }
                        if (rewards.crystals > 0) {
                            rewardsContent += `**${rewards.crystals} <:Crystal:1468446688338251793> Crystals** added\n`;
                        }

                        // ⭐⭐ ⭐⭐ ⭐⭐ عرض الكوبون إذا كان موجود ⭐⭐ ⭐⭐ ⭐⭐
                        if (openResult.coupon) {
                            const coupon = openResult.coupon;

                            // حساب الوقت المتبقي
                            const now = new Date();
                            const expiresAt = new Date(coupon.expires_at);
                            const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

                            rewardsContent += `\n🎫 **Bonus Coupon:** \`${coupon.code}\`\n`;
                            rewardsContent += `   • **Discount:** ${coupon.discount}% OFF\n`;
                            rewardsContent += `   • **Valid for:** ${daysLeft} days\n`;
                            rewardsContent += `   • **Use with:** /shop command`;
                        }

                        // ✅ التحقق إذا كان هناك buff في الكريت
                        if (openResult.buff) {
                            pendingBuffDecisions.set(userId, {
                                buffType: openResult.buff.type,
                                durationMinutes: openResult.buff.duration,
                                crateId: crateId,
                                crateType: crateType,
                                rewards: rewards,
                                coupon: openResult.coupon, // ⭐⭐ نضيف الكوبون للقرار ⭐⭐
                                timestamp: Date.now()
                            });

                            console.log(`💾 Saved buff decision for user ${userId}`);

                            const buffDecisionContainer = this.buildBuffDecisionContainer(
                                `# 🎉 You opened a ${crateType} crate!\n\n` +
                                `${rewardsContent}\n\n` +
                                `✨ **Buff Found:** ${formatBuffName(openResult.buff.type)} (${openResult.buff.duration} minutes)\n\n` +
                                `**Would you like to accept this buff?**`,
                                interaction.user
                            );

                            await interaction.editReply({
                                components: [buffDecisionContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                        } else {
                            // ⭐⭐ ⭐⭐ ⭐⭐ رسالة النجاح مع الكوبون ⭐⭐ ⭐⭐ ⭐⭐
                            let successMessage = `# 🎉 You opened a ${crateType} crate!\n\n` +
                                                `${rewardsContent}\n`;

                            // إضافة نص توجيهي للكوبون
                            if (openResult.coupon) {
                                successMessage += `\n💡 **Tip:** Use your coupon in the shop with \`/shop\` command!`;
                            }

                            await this.createOrUpdateDropsInterface(
                                interaction,
                                successMessage,
                                null,
                                false
                            );
                        }

                    } catch (error) {
                        console.error('Error opening crate:', error);

                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent('❌ An error occurred while opening the crate.')
                            );

                        await interaction.editReply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                    }
                }

        } catch (error) {
            console.error('Error in drops buttonHandler:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('❌ Error processing button click.')
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    },

    buildBuffDecisionContainer(resultMessage, user) {
        const userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 });
        const container = new ContainerBuilder().setAccentColor(0x5865F2);

        // ⭐⭐ نضيف معلومات الكوبون إذا كانت موجودة ⭐⭐
        let finalMessage = resultMessage;

        // يمكنك إضافة log هنا للتحقق
        console.log(`📝 Building buff container with message:`, resultMessage);

        container.addSectionComponents((section) =>
            section
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(finalMessage || '**Buff Decision**')
                )
                .setThumbnailAccessory((thumbnail) =>
                    thumbnail
                        .setDescription(`${user.username}'s Buff Decision`)
                        .setURL(userAvatar)
                )
        );

        container.addSeparatorComponents((separator) => separator);

        container.addActionRowComponents((row) =>
            row.setComponents([
                new ButtonBuilder()
                    .setCustomId('buff_accept')
                    .setLabel('✅ Accept Buff')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('buff_reject')
                    .setLabel('❌ Reject Buff')
                    .setStyle(ButtonStyle.Danger)
            ])
        );

        return container;
    },

    async buildDropsContainer(activeBuffs, cratesData, dropStats, user, guild, resultMessage = null, buffData = null) {
        const userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 });
        const container = new ContainerBuilder().setAccentColor(0x5865F2);

        const hasAnyBuff = Array.isArray(activeBuffs) && activeBuffs.length > 0;

        let sectionContent = `# 📦 Drops Section\n\n`;

        if (hasAnyBuff) {
            sectionContent += '**Active Buffs:**\n';
            activeBuffs.forEach((buff, index) => {
                if (buff && buff.buff_type) {
                    const buffName = formatBuffName(buff.buff_type);
                    const expiresAt = buff.expires_at ? new Date(buff.expires_at) : null;

                    let expiresIn = 'Unknown';
                    if (expiresAt) {
                        const minutesLeft = Math.max(0, Math.floor((expiresAt - new Date()) / 60000));
                        expiresIn = formatTime(minutesLeft);
                    }

                    sectionContent += `${buffName} - ⏳ ${expiresIn}`;
                    if (index < activeBuffs.length - 1) {
                        sectionContent += '\n';
                    }
                }
            });

            sectionContent += '\n\n🔒 **You cannot open crates while you have active buffs!**';
        } else {
            sectionContent += `🎉 You can open crates freely!\n\n`;
            sectionContent += `✅ No active buffs preventing crate opening.`;
        }

        container.addSectionComponents((section) =>
            section
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(sectionContent)
                )
                .setThumbnailAccessory((thumbnail) =>
                    thumbnail
                        .setDescription(`${user.username}'s Drops`)
                        .setURL(userAvatar)
                )
        );

        container.addSeparatorComponents((separator) => separator);

        const crateTypes = [
            { type: 'common', label: 'Common Drop', emoji: '📦' },
            { type: 'rare', label: 'Rare Drop', emoji: '✨' },
            { type: 'epic', label: 'Epic Drop', emoji: '💎' },
            { type: 'legendary', label: 'Legendary Drop', emoji: '🔥' }
        ];

        for (const crateType of crateTypes) {
            const crates = (cratesData && cratesData.crates) ?
                cratesData.crates.filter(c => c && c.crate_type === crateType.type) || [] : [];
            const count = crates.length;
            const firstId = crates[0]?.id || '0';
            const hasCrates = count > 0;
            const canOpen = hasCrates && !hasAnyBuff;

            container.addSectionComponents((section) =>
                section
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`**${crateType.emoji} ${crateType.label}**`)
                    )
                    .setButtonAccessory((button) =>
                        button
                            .setCustomId(`open_crate_${firstId}_${crateType.type}`)
                            .setLabel('Open')
                            .setStyle(canOpen ? ButtonStyle.Success : ButtonStyle.Secondary)
                            .setDisabled(!canOpen)
                    )
            );

            const receivedCount = (dropStats && dropStats.drops && dropStats.drops[crateType.type]) ?
                dropStats.drops[crateType.type].received || 0 : 0;

            let details = `**Crates available:** ${count}\n`;
            details += `**Total received:** ${receivedCount}`;

            if (hasAnyBuff) {
                details += '\n🔒 **Locked: Active buffs prevent opening**';
            }

            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(details)
            );

            container.addSeparatorComponents((separator) => separator);
        }

        if (resultMessage && resultMessage.trim() !== '') {
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(resultMessage)
            );
        }

        const totalCrates = (cratesData && cratesData.crates) ? cratesData.crates.length : 0;
        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(`Total crates available: ${totalCrates}`)
        );

        return container;
    },

    async openUserCrate(crateId, userId, crateType) {
        try {
            console.log(`🎁 ======= OPENING CRATE =======`);
            console.log(`📝 Crate ID: ${crateId}`);
            console.log(`👤 User ID: ${userId}`);
            console.log(`📦 Crate Type: ${crateType}`);

            // جلب معلومات الكريت
            const crate = await dbManager.get(
                `SELECT * FROM user_crates 
                 WHERE id = ? AND user_id = ?`,
                [crateId, userId]
            );

            if (!crate) {
                console.log(`❌ Crate not found: ID ${crateId}, User ${userId}`);
                return { 
                    success: false, 
                    error: 'Crate not found or already opened',
                    code: 'CRATE_NOT_FOUND' 
                };
            }

            if (crate.is_used) {
                console.log(`⚠️ Crate already opened at: ${crate.used_at}`);
                return { 
                    success: false, 
                    error: 'Crate already opened',
                    code: 'CRATE_ALREADY_USED',
                    openedAt: crate.used_at
                };
            }

            console.log(`📦 Crate details:`, {
                id: crate.id,
                type: crate.crate_type,
                reward_type: crate.reward_type,
                coins: crate.coins_amount || 0,
                xp: crate.xp_amount || 0,
                crystals: crate.crystals_amount || 0,
                coupon_discount: crate.coupon_discount,
                has_buff: !!(crate.buff_type && crate.buff_duration_minutes)
            });

            // ⭐⭐ ⭐⭐ ⭐⭐ إنشاء الكوبون هنا فقط وقت الفتح ⭐⭐ ⭐⭐ ⭐⭐
            let couponData = null;
            let couponCreationResult = null;

            if (crate.reward_type === 'coupon' && crate.coupon_discount) {
                console.log(`🎫 ======= CREATING COUPON =======`);
                console.log(`📊 Coupon discount from crate: ${crate.coupon_discount}%`);

                try {
                    const { couponSystem } = require('../Systems/couponsystem');

                    // تحليل coupon_info إذا كان موجود
                    let couponInfo = null;
                    if (crate.coupon_info) {
                        try {
                            couponInfo = typeof crate.coupon_info === 'string' 
                                ? JSON.parse(crate.coupon_info) 
                                : crate.coupon_info;
                            console.log(`📋 Coupon info:`, couponInfo);
                        } catch (parseError) {
                            console.error(`❌ Error parsing coupon_info:`, parseError.message);
                        }
                    }

                    // ⭐⭐ ⭐⭐ ⭐⭐ هنا بنخلق الكوبون الحقيقي ⭐⭐ ⭐⭐ ⭐⭐
                    couponCreationResult = await couponSystem.createCouponFromDrop(
                        userId,
                        crate.username || 'Unknown',
                        crate.coupon_discount,
                        crateId
                    );

                    if (couponCreationResult && couponCreationResult.success) {
                        console.log(`✅ Coupon created successfully!`);
                        console.log(`🎫 Coupon Code: ${couponCreationResult.couponCode}`);
                        console.log(`💰 Discount: ${couponCreationResult.discountPercentage}%`);
                        console.log(`📅 Valid for: ${couponCreationResult.validForDays} days`);

                        // جلب معلومات الكوبون من الداتابيز للتأكد
                        couponData = await dbManager.get(
                            `SELECT * FROM shop_coupons 
                             WHERE coupon_code = ? AND user_id = ?`,
                            [couponCreationResult.couponCode, userId]
                        );

                        if (couponData) {
                            console.log(`💾 Coupon confirmed in database: ${couponData.coupon_code}`);
                        } else {
                            console.log(`⚠️ Coupon created but not found in database`);
                        }

                    } else {
                        console.log(`❌ Coupon creation failed:`, couponCreationResult);
                    }

                } catch (couponError) {
                    console.error(`❌ Error creating coupon:`, couponError.message);
                    console.error(`❌ Stack trace:`, couponError.stack);
                }
            } else {
                console.log(`ℹ️ No coupon to create (reward_type: ${crate.reward_type}, coupon_discount: ${crate.coupon_discount})`);
            }

            // حساب المكافآت
            let totalCoins = crate.coins_amount || 0;
            let totalXP = crate.xp_amount || 0;
            let totalCrystals = crate.crystals_amount || 0;

            // إذا كان فيه كوبون، نضيف مكافأة إضافية
            if (couponData || couponCreationResult?.success) {
                // مكافأة إضافية للكوبون
                const bonusCoins = Math.floor(Math.random() * 50) + 25; // 25-75 كوينز إضافية
                const bonusXP = Math.floor(Math.random() * 30) + 15; // 15-45 XP إضافية

                totalCoins += bonusCoins;
                totalXP += bonusXP;

                console.log(`🎁 Added bonus rewards for coupon: +${bonusCoins} coins, +${bonusXP} XP`);
                console.log(`💰 Total coins after bonus: ${totalCoins}`);
                console.log(`⭐ Total XP after bonus: ${totalXP}`);
            }

            // ⭐⭐ ⭐⭐ ⭐⭐ حذف الكريت من الداتابيز ⭐⭐ ⭐⭐ ⭐⭐
            console.log(`🗑️ ======= DELETING CRATE =======`);
            console.log(`🚮 Deleting crate ${crateId} from user_crates table...`);

            const deleteResult = await dbManager.run(
                `DELETE FROM user_crates WHERE id = ?`,
                [crateId]
            );

            if (deleteResult.changes > 0) {
                console.log(`✅ Crate ${crateId} deleted successfully (${deleteResult.changes} row(s) affected)`);
            } else {
                console.log(`⚠️ No rows affected when deleting crate ${crateId}`);
            }

            // إعطاء المكافآت للمستخدم
            if (totalCoins > 0 || totalXP > 0 || totalCrystals > 0) {
                console.log(`💰 ======= PROCESSING REWARDS =======`);
                console.log(`🎁 Rewards to give:`);
                console.log(`   • Coins: ${totalCoins}`);
                console.log(`   • XP: ${totalXP}`);
                console.log(`   • Crystals: ${totalCrystals}`);

                try {
                    await levelSystem.processUserRewards(
                        userId,
                        '',
                        totalXP,
                        totalCoins,
                        totalCrystals,
                        null,
                        null,
                        'drop',
                        true  // بدون daily limits
                    );
                    console.log(`✅ Rewards processed successfully`);
                } catch (rewardError) {
                    console.error(`❌ Error processing rewards:`, rewardError.message);
                }
            }

            // تحديث مهام Lucky Day
            if (totalCoins > 0) {
                try {
                    await dbManager.updateGoalProgress(userId, 'drop_coins', totalCoins);
                    console.log(`📊 Updated Lucky Day mission: +${totalCoins} coins`);
                } catch (missionError) {
                    console.error(`❌ Error updating Lucky Day mission:`, missionError.message);
                }
            }

            // إعداد بيانات البف
            let buffData = null;
            if (crate.buff_type && crate.buff_duration_minutes) {
                buffData = {
                    type: crate.buff_type,
                    duration: crate.buff_duration_minutes,
                    expires_in: `${crate.buff_duration_minutes} minutes`,
                    description: this.formatBuffDescription(crate.buff_type)
                };
                console.log(`✨ Buff found: ${crate.buff_type} (${crate.buff_duration_minutes} minutes)`);
            }

            // بناء النتيجة
            const result = {
                success: true,
                crate: {
                    id: crateId,
                    type: crateType,
                    original_type: crate.crate_type,
                    rewards: {
                        coins: totalCoins,
                        xp: totalXP,
                        crystals: totalCrystals,
                        original_coins: crate.coins_amount || 0,
                        original_xp: crate.xp_amount || 0,
                        original_crystals: crate.crystals_amount || 0,
                        bonus_coins: totalCoins - (crate.coins_amount || 0),
                        bonus_xp: totalXP - (crate.xp_amount || 0)
                    }
                },
                buff: buffData,
                was_deleted: deleteResult.changes > 0
            };

            // ⭐⭐ إضافة معلومات الكوبون للنتيجة ⭐⭐
            if (couponData || couponCreationResult?.success) {
                const coupon = couponData || couponCreationResult;
                const couponCode = coupon.coupon_code || coupon.couponCode;
                const discount = coupon.discount_percentage || coupon.discountPercentage;

                // حساب الوقت المتبقي
                const expiresAt = coupon.expires_at || coupon.expiresAt;
                const now = new Date();
                const expiryDate = new Date(expiresAt);
                const daysLeft = Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));

                result.coupon = {
                    success: true,
                    code: couponCode,
                    discount: discount,
                    expires_at: expiresAt,
                    valid_for_days: daysLeft,
                    source: 'legendary_drop',
                    message: `🎫 **Bonus Coupon:** \`${couponCode}\` (${discount}% off)`,
                    formatted_message: `🎫 **Coupon Unlocked!**\n` +
                                     `   • **Code:** \`${couponCode}\`\n` +
                                     `   • **Discount:** ${discount}% OFF\n` +
                                     `   • **Valid for:** ${daysLeft} days\n` +
                                     `   • **Use with:** \`/shop\` command`
                };

                console.log(`🎫 Coupon added to result: ${couponCode} (${discount}%)`);
            }

            console.log(`✅ ======= CRATE OPENING COMPLETE =======`);
            console.log(`📊 Final result:`, {
                success: result.success,
                rewards: result.crate.rewards,
                has_coupon: !!result.coupon,
                coupon_code: result.coupon?.code,
                has_buff: !!result.buff,
                was_deleted: result.was_deleted
            });

            return result;

        } catch (error) {
            console.error('❌ ======= CRATE OPENING ERROR =======');
            console.error(`❌ Error in openUserCrate:`);
            console.error(`❌ Message: ${error.message}`);
            console.error(`❌ Stack trace:`, error.stack);

            return { 
                success: false, 
                error: error.message,
                code: 'CRATE_OPENING_ERROR',
                details: {
                    crateId,
                    userId,
                    crateType,
                    timestamp: new Date().toISOString()
                }
            };
        }
    },

    // دالة مساعدة لتنسيق وصف البف
    formatBuffDescription(buffType) {
        const descriptions = {
            'double_xp': 'Gain double XP from all sources',
            'double_coins': 'Earn double coins from all activities',
            'double_luck': 'Double chance for rare drops',
            'xp_boost': 'Increased XP gain',
            'coin_boost': 'Increased coin earnings',
            'luck_boost': 'Increased luck for drops'
        };

        return descriptions[buffType] || `Unknown buff: ${buffType}`;
    },

    /**
     * دالة للتحقق من كوبونات المستخدم وعرضها
     */
    async checkAndDisplayCoupons(userId) {
        try {
            const coupons = await dbManager.all(
                `SELECT * FROM shop_coupons 
                 WHERE user_id = ? 
                 AND is_used = false
                 AND expires_at > CURRENT_TIMESTAMP
                 ORDER BY expires_at ASC`,
                [userId]
            );

            if (coupons.length === 0) {
                return 'No active coupons available.';
            }

            let message = `🎫 **Your Active Coupons:**\n\n`;

            coupons.forEach((coupon, index) => {
                const expiresAt = new Date(coupon.expires_at);
                const now = new Date();
                const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

                message += `**${index + 1}.** \`${coupon.coupon_code}\`\n`;
                message += `   • **Discount:** ${coupon.discount_percentage}%\n`;
                message += `   • **Expires in:** ${daysLeft} days\n`;
                message += `   • **Source:** ${coupon.source_drop_type || 'Unknown'}\n\n`;
            });

            return message;
        } catch (error) {
            console.error('Error checking coupons:', error);
            return 'Error loading coupons.';
        }
    }
};

// ========== HELPER FUNCTIONS ==========

function formatBuffName(buffType) {
    const buffNames = {
        'double_xp': '⚡ Double XP',
        'double_coins': '💰 Double Coins',
        'double_luck': '🍀 Double Luck',
        'no_new_crates': '❌ No New Crates',
        'crate_cooldown': '⏳ Crate Cooldown',
        'opening_lock': '🔒 Opening Lock',
        'xp_boost': '⭐ XP Boost',
        'coin_boost': '🪙 Coin Boost',
        'luck_boost': '🎲 Luck Boost'
    };

    return buffNames[buffType] || buffType;
}

function formatTime(minutes) {
    if (minutes >= 1440) {
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        return `${days}d ${hours}h`;
    } else if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    } else {
        return `${minutes}m`;
    }
}