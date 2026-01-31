const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    Container,
    SeparatorBuilder,
    TextDisplayBuilder,
    MessageFlags 
} = require('discord.js');
const dbManager = require('../Data/database');

const SKYWELL_LEVELS = [
    { level: 0, name: "Beginner", emoji: "🌱", roleId: null },
    { level: 1, name: "Novice Thrower", emoji: "🌿", roleId: "1465705164139794443" },
    { level: 2, name: "Advanced Thrower", emoji: "💧", roleId: "1465705207760556186" },
    { level: 3, name: "Master Thrower", emoji: "🌊", roleId: "1465705232280453283" },
    { level: 4, name: "Well Keeper", emoji: "🌀", roleId: "1465705263209123975" },
    { level: 5, name: "Skywell Legend", emoji: "🌟", roleId: "1465705294234652736" }
];

// إضافة الرول الجديدة
const FIRST_THROW_ROLE_ID = "1465788817196847298"; // ضع الرول ID هنا
const MIN_COINS_FOR_THROW = 500; // الحد الأدنى للعملات فقط
const MIN_CRYSTALS_FOR_THROW = 1; // الحد الأدنى للكريستالز

module.exports = {
    data: new SlashCommandBuilder()
        .setName('makeawish')
        .setDescription('Throw coins or crystals into the Skywell')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('What to throw?')
                .setRequired(true)
                .addChoices(
                    { name: '🪙 Coins', value: 'coins' },
                    { name: '💎 Crystals', value: 'crystals' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to throw')
                .setRequired(true)
                .setMinValue(1) // الحد الأدنى العام
                .setMaxValue(10000)),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const userId = interaction.user.id;
            const username = interaction.user.username;
            const userAvatar = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
            const type = interaction.options.getString('type');
            const amount = interaction.options.getInteger('amount');

            // 👇 تحقق منفصل للعملات والكريستالز 👇
            if (type === 'coins' && amount < MIN_COINS_FOR_THROW) {
                return await interaction.editReply({
                    content: `❌ Minimum coins to throw is ${MIN_COINS_FOR_THROW.toLocaleString()} 🪙`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (type === 'crystals' && amount < MIN_CRYSTALS_FOR_THROW) {
                return await interaction.editReply({
                    content: `❌ Minimum crystals to throw is ${MIN_CRYSTALS_FOR_THROW.toLocaleString()} 💎`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // 1. التحقق من الرصيد
            const userBalance = await dbManager.get(
                'SELECT sky_coins, sky_crystals FROM levels WHERE user_id = $1',
                [userId]
            );

            if (!userBalance) {
                return await interaction.editReply({
                    content: '❌ You need to create an account first!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // التحقق من الرصيد
            if (type === 'coins' && userBalance.sky_coins < amount) {
                return await interaction.editReply({
                    content: `❌ Not enough coins! You have ${userBalance.sky_coins} 🪙`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (type === 'crystals' && userBalance.sky_crystals < amount) {
                return await interaction.editReply({
                    content: `❌ Not enough crystals! You have ${userBalance.sky_crystals} 💎`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // 2. خصم المبلغ
            if (type === 'coins') {
                await dbManager.run(
                    'UPDATE levels SET sky_coins = sky_coins - $1 WHERE user_id = $2',
                    [amount, userId]
                );
            } else {
                await dbManager.run(
                    'UPDATE levels SET sky_crystals = sky_crystals - $1 WHERE user_id = $2',
                    [amount, userId]
                );
            }

            // 3. تحديث Skywell
            let updateResult;
            let convertedCoins = 0;

            if (type === 'coins') {
                updateResult = await dbManager.updateCoinThrow(userId, amount, username);
            } else {
                updateResult = await dbManager.updateCrystalThrow(userId, amount, username);
                convertedCoins = updateResult.convertedCoins || 0;
            }

            if (!updateResult.success) {
                // استرجاع المبلغ في حالة الخطأ
                if (type === 'coins') {
                    await dbManager.run(
                        'UPDATE levels SET sky_coins = sky_coins + $1 WHERE user_id = $2',
                        [amount, userId]
                    );
                } else {
                    await dbManager.run(
                        'UPDATE levels SET sky_crystals = sky_crystals + $1 WHERE user_id = $2',
                        [amount, userId]
                    );
                }

                return await interaction.editReply({
                    content: '❌ Error updating Skywell.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // 4. جلب البيانات الجديدة من Skywell
            const stats = await dbManager.getSkywellStats(userId);
            if (!stats) {
                return await interaction.editReply({
                    content: '❌ Error getting stats.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // 5. التحقق من أول رمية وإضافة الرول
            let firstThrowMessage = '';
            const isFirstThrow = (stats.throw_count || 0) === 1; // بعد الرمية الحالية بيكون 1

            if (isFirstThrow && FIRST_THROW_ROLE_ID) {
                try {
                    const member = await interaction.guild.members.fetch(userId);
                    if (!member.roles.cache.has(FIRST_THROW_ROLE_ID)) {
                        await member.roles.add(FIRST_THROW_ROLE_ID);
                        firstThrowMessage = `🎉 **First Throw!** You earned the special role!`;
                    }
                } catch (error) {
                    console.error('Error adding first throw role:', error);
                }
            }

            // 6. التحقق من المستوي
            const oldLevel = stats.currentLevel || 0;
            const totalEffective = stats.totalEffectiveCoins || 0;

            let newLevel = oldLevel;
            if (totalEffective >= 50000) newLevel = 5;
            else if (totalEffective >= 30000) newLevel = 4;
            else if (totalEffective >= 15000) newLevel = 3;
            else if (totalEffective >= 5000) newLevel = 2;
            else if (totalEffective >= 100) newLevel = 1;

            // 7. تحديث المستوي لو ارتفع
            let levelUp = false;
            let levelInfo = null;

            if (newLevel > oldLevel) {
                levelUp = true;
                levelInfo = SKYWELL_LEVELS.find(l => l.level === newLevel);

                await dbManager.updateSkywellLevel(userId, newLevel, levelInfo?.roleId || null);

                // تطبيق الرول
                if (levelInfo?.roleId) {
                    try {
                        const member = await interaction.guild.members.fetch(userId);
                        const newRole = levelInfo.roleId;

                        // إزالة رولات قديمة
                        for (const level of SKYWELL_LEVELS) {
                            if (level.roleId && level.roleId !== newRole && member.roles.cache.has(level.roleId)) {
                                await member.roles.remove(level.roleId);
                            }
                        }

                        // إضافة رول جديد
                        await member.roles.add(newRole);

                    } catch (error) {
                        console.error('Error updating roles:', error);
                    }
                }
            }

            // 8. حساب بيانات العرض
            const throwCount = stats.throw_count || 0;
            const nextLevelCoins = stats.nextLevelCoins || 0;
            const progress = stats.progress || 0;
            const currentLevelInfo = SKYWELL_LEVELS.find(l => l.level === newLevel);

            // دالة لإنشاء شريط التقدم
            const createProgressBar = (percentage, length = 15) => {
                const filled = Math.floor((percentage / 100) * length);
                const empty = length - filled;
                return ' 🟦'.repeat(filled) + ' ⬛'.repeat(empty);
            };

            const progressBar = createProgressBar(progress);

            // 9. إنشاء الرد باستخدام المكونات الجديدة
            const container = new ContainerBuilder()
                .setAccentColor(type === 'coins' ? 0xF1C40F : 0x9B59B6);

            // المحتوى الرئيسي
            let sectionContent = `**${username}** → ${amount.toLocaleString()} ${type === 'coins' ? '🪙 into the well' : '💎 into Skywell'}`;
            

            // إضافة رسالة أول رمية إذا كانت موجودة
            if (firstThrowMessage) {
                sectionContent += `\n\n${firstThrowMessage}`;
            }

            // إضافة البونص إذا كانت كريستالز
            if (type === 'crystals' && convertedCoins > 0) {
                sectionContent += `\n\n💎 Bonus from Crystals: +${convertedCoins.toLocaleString()} 🪙`;
            }

            // إضافة الإجمالي
            sectionContent += `\n\nTotal Tossed: ${totalEffective.toLocaleString()} 🪙`;
            

            // أضف المحتوى كـ TextDisplay
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(sectionContent)
            );

            // فاصل
            container.addSeparatorComponents((separator) => separator);

            // معلومات المستوي التالي إذا كان هناك مستوي تالي
            if (nextLevelCoins > 0 && newLevel < 5) {
                const nextLevelInfo = SKYWELL_LEVELS.find(l => l.level === newLevel + 1);
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`⏳ Next Level: ${nextLevelInfo?.name || `Level ${newLevel + 1}`} (${nextLevelCoins.toLocaleString()} 🪙)`)
                );

                // نسبة التقدم
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`-# ${progress}% Complete`)
                );

                // شريط التقدم
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(progressBar)
                );

                // فاصل آخر
                container.addSeparatorComponents((separator) => separator);
            }

            // معلومات المستوي والرمية
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(`-# ${currentLevelInfo?.emoji || '🌱'} Level ${newLevel} | Throw #${throwCount}`)
            );

            // إذا كان هناك Level Up
            if (levelUp) {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`🚀 **LEVEL UP!** → ${currentLevelInfo?.name || 'New Level'}`)
                );
            }

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Error in throw command:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('# ❌ Error\n*An error occurred while processing your throw*')
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};