const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    SeparatorBuilder, 
    TextDisplayBuilder,
    MessageFlags 
} = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('goals')
        .setDescription('🎯 View your daily and weekly missions')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('View another user\'s goals (optional)')
                .setRequired(false)),

    async execute(interaction) {
        // 1. تحديد المستخدم المستهدف
        let targetUser = interaction.options.getUser('user');
        const isSelf = !targetUser || targetUser.id === interaction.user.id;

        if (!targetUser) {
            targetUser = interaction.user;
        }

        const userId = targetUser.id;
        const username = targetUser.username;

        try {
            console.log(`🔍 /goals command for ${username} (${userId}) requested by ${interaction.user.username}`);

            // 2. التحقق من المهام وتجديدها إذا لزم
            console.log(`🔄 Checking/Generating goals for ${username}`);
            const generateResult = await dbManager.generateUserGoals(userId, username);

            if (generateResult.error) {
                console.error('Generate error:', generateResult.error);
                await interaction.reply({
                    content: '❌ An error occurred while generating goals.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // 3. جلب بيانات المهام بعد التجديد
            const goalsData = await dbManager.getUserGoals(userId);
            console.log('Goals data loaded:', {
                dailyCount: goalsData.daily?.length || 0,
                weeklyExists: !!goalsData.weekly,
                hasTimestamps: !!goalsData.timestamps
            });

            // 4. إذا ما فيش أهداف، نعرض رسالة
            if ((!goalsData.daily || goalsData.daily.length === 0) && !goalsData.weekly) {
                const container = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(`# ❌ No Goals Found\n*${username} doesn't have any active goals.*`)
                    );

                if (isSelf) {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent('*Try again in a few seconds, or contact an admin if the issue persists.*')
                    );
                }

                await interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // 5. التحقق من المهام المكتملة واستلامها تلقائياً (فقط إذا كان المستخدم نفسه)
            if (isSelf) {
                await checkAndClaimGoals(userId, goalsData, interaction.guild, interaction.client);

                // جلب البيانات المحدثة بعد الاستلام
                const updatedGoalsData = await dbManager.getUserGoals(userId);
                if (updatedGoalsData) {
                    goalsData.daily = updatedGoalsData.daily;
                    goalsData.weekly = updatedGoalsData.weekly;
                }
            }

            // 6. إنشاء الواجهة
            const goalsContainer = createGoalsContainer(goalsData, targetUser, isSelf);

            // 7. إرسال الرد
            await interaction.reply({
                components: [goalsContainer],
                flags: MessageFlags.IsComponentsV2
            });

            console.log(`✅ /goals command completed for ${username}`);

        } catch (error) {
            console.error('❌ Error in /goals command:', error);
            await interaction.reply({
                content: '❌ An error occurred while displaying goals. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};

// ========== HELPER FUNCTIONS ==========

async function checkAndClaimGoals(userId, goalsData, guild, client) {
    try {
        console.log(`🔍 Checking claimable goals for ${userId}`);

        // التحقق من المهام اليومية
        if (goalsData.daily && Array.isArray(goalsData.daily)) {
            for (let i = 0; i < goalsData.daily.length; i++) {
                const goal = goalsData.daily[i];
                if (!goal) continue;

                const goalType = i === 0 ? 'daily1' : 'daily2';

                // إذا المهمة مكتملة ولم يتم استلامها
                if (goal.completed && !goal.claimed) {
                    console.log(`🎁 Found completed daily goal: ${goal.title} (${goalType})`);

                    const result = await claimGoalRewardAndUpdateLevels(
                        userId, 
                        goal.rowId, 
                        goalType, 
                        guild,
                        client
                    );

                    if (result?.success) {
                        console.log(`✅ Claimed daily goal: ${goal.title}`);
                    }
                }
            }
        }

        // التحقق من المهمة الأسبوعية
        if (goalsData.weekly && goalsData.weekly.completed && !goalsData.weekly.claimed) {
            console.log(`🎁 Found completed weekly goal: ${goalsData.weekly.title}`);

            const result = await claimGoalRewardAndUpdateLevels(
                userId, 
                goalsData.weekly.rowId, 
                'weekly', 
                guild,
                client
            );

            if (result?.success) {
                console.log(`✅ Claimed weekly goal: ${goalsData.weekly.title}`);
            }
        }

    } catch (error) {
        console.error('Error in checkAndClaimGoals:', error);
    }
}

async function claimGoalRewardAndUpdateLevels(userId, rowId, goalType, guild = null, client = null) {
    try {
        console.log(`💰 Claiming ${goalType} goal ${rowId} for user ${userId}`);

        // 1. أولاً: تحقق أن الهدف موجود ومكتمل وغير مستلم
        const userGoals = await dbManager.getUserGoals(userId);
        console.log('User goals check:', {
            hasDaily: userGoals.daily?.length > 0,
            hasWeekly: !!userGoals.weekly,
            goalType: goalType
        });

        let targetGoal = null;
        let isCompleted = false;
        let isClaimed = false;

        // البحث عن الهدف المطلوب
        if (goalType === 'daily1' && userGoals.daily && userGoals.daily.length > 0) {
            targetGoal = userGoals.daily[0];
            console.log('Daily goal 1 found:', {
                title: targetGoal?.title,
                progress: targetGoal?.progress,
                requirement: targetGoal?.assigned_requirement,
                completed: targetGoal?.completed,
                claimed: targetGoal?.claimed
            });
        } 
        else if (goalType === 'daily2' && userGoals.daily && userGoals.daily.length > 1) {
            targetGoal = userGoals.daily[1];
            console.log('Daily goal 2 found:', {
                title: targetGoal?.title,
                progress: targetGoal?.progress,
                requirement: targetGoal?.assigned_requirement,
                completed: targetGoal?.completed,
                claimed: targetGoal?.claimed
            });
        } 
        else if (goalType === 'weekly') {
            targetGoal = userGoals.weekly;
            console.log('Weekly goal found:', {
                title: targetGoal?.title,
                progress: targetGoal?.progress,
                requirement: targetGoal?.assigned_requirement,
                completed: targetGoal?.completed,
                claimed: targetGoal?.claimed
            });
        }

        if (!targetGoal) {
            console.log(`❌ Goal ${goalType} not found for user ${userId}`);
            return { 
                success: false, 
                error: 'Goal not found',
                code: 'GOAL_NOT_FOUND'
            };
        }

        // 2. التحقق من الإكمال والاستلام
        isCompleted = targetGoal.completed || false;
        isClaimed = targetGoal.claimed || false;

        console.log(`📊 Goal status: completed=${isCompleted}, claimed=${isClaimed}`);

        // 3. إذا المهمة مش مكتملة، شوف لو التقدم وصل للهدف
        if (!isCompleted) {
            const progress = targetGoal.progress || 0;
            const requirement = targetGoal.assigned_requirement || 1;

            console.log(`📈 Checking progress: ${progress}/${requirement}`);

            if (progress >= requirement) {
                console.log(`🎯 Progress reached requirement! Marking as completed...`);

                // تحديث حالة الإكمال في الداتابيز
                let updateField;
                if (goalType === 'daily1') updateField = 'daily1_completed';
                else if (goalType === 'daily2') updateField = 'daily2_completed';
                else updateField = 'weekly_completed';

                await dbManager.run(
                    `UPDATE user_goals 
                     SET ${updateField} = true,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [userId]
                );

                isCompleted = true;
                console.log(`✅ Goal ${goalType} marked as completed`);
            }
        }

        // 4. الشروط النهائية للاستلام
        if (!isCompleted) {
            return { 
                success: false, 
                error: 'Goal not completed yet',
                code: 'GOAL_NOT_COMPLETED'
            };
        }

        if (isClaimed) {
            return { 
                success: false, 
                error: 'Goal already claimed',
                code: 'ALREADY_CLAIMED'
            };
        }

        // 5. استلام المكافأة
        console.log(`🎁 Claiming reward for ${goalType}...`);
        const claimResult = await dbManager.claimGoalReward(userId, rowId, goalType);

        if (!claimResult || !claimResult.success) {
            console.log(`❌ Failed to claim ${goalType}:`, claimResult?.error || 'Unknown error');
            return claimResult || { success: false, error: 'Claim failed' };
        }

        console.log(`✅ Claim successful:`, claimResult);

        // 6. منح المكافآت عبر LevelSystem
        const baseReward = {
            xp: claimResult.rewards?.xp || 0,
            coins: claimResult.rewards?.coins || 0,
            crystals: claimResult.rewards?.crystals || 0
        };

        let username = 'Unknown';

        // جلب اسم المستخدم
        if (client) {
            try {
                const user = await client.users.fetch(userId);
                username = user ? user.username : 'Unknown';
            } catch (fetchError) {
                console.log(`⚠️ Could not fetch user ${userId} from client`);
                const userData = await dbManager.getUserProfile(userId);
                username = userData?.username || 'Unknown';
            }
        } else {
            const userData = await dbManager.getUserProfile(userId);
            username = userData?.username || 'Unknown';
        }

        // استدعاء LevelSystem
        const levelSystemResult = await levelSystem.processUserRewards(
            userId,
            username,
            baseReward.xp,
            baseReward.coins,
            baseReward.crystals,
            client,
            guild,
            'goal',
            true
        );

        console.log(`✅ Goal rewards processed:`, {
            baseReward: baseReward,
            levelUp: levelSystemResult?.levelUp || false,
            newLevel: levelSystemResult?.newLevel || 0,
            gotBonus: claimResult?.gotBonus || false
        });

        return {
            success: true,
            goalId: rowId,
            goalType: goalType,
            goalTitle: targetGoal.title,
            rewards: baseReward,
            gotBonus: claimResult?.gotBonus || false,
            bonusType: claimResult?.bonusType,
            levelSystemResult: levelSystemResult
        };

    } catch (error) {
        console.error('❌ Error claiming goal and updating levels:', error);
        console.error('Error stack:', error.stack);
        return { 
            success: false, 
            error: error.message,
            code: 'UNEXPECTED_ERROR'
        };
    }
}

function createGoalsContainer(goalsData, user, isSelf) {
    const userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 }) || 
                      'https://i.imgur.com/AfFp7pu.png';

    const container = new ContainerBuilder()
        .setAccentColor(0x0073ff);

    // HEADER مع معلومات الوقت المتبقي
    let headerText = `# 🎯 ${user.username}'s Goals\n`;

    if (isSelf) {
        headerText += `💰 *Rewards are automatically saved*\n\n*Check /cooldown for reset time*`;
    }

    container.addSectionComponents((section) =>
        section
            .addTextDisplayComponents(
                (textDisplay) =>
                    textDisplay.setContent(headerText)
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`${user.username}'s Goals`)
                    .setURL(userAvatar)
            )
    );

    container.addSeparatorComponents((separator) => separator);

    // التحقق إذا كان المستخدم لديه أهداف
    const hasDailyGoals = goalsData.daily && goalsData.daily.length > 0 && 
                         goalsData.daily.some(goal => goal !== null);
    const hasWeeklyGoal = goalsData.weekly && goalsData.weekly.title;

    if (!hasDailyGoals && !hasWeeklyGoal) {
        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(`## 📭 No Goals Found\n*${user.username} doesn't have any active goals yet.*`)
        );

        if (!isSelf) {
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(`*Only users can generate goals for themselves by using \`/goals\`*`)
            );
        }

        return container;
    }

    // DAILY GOALS
    if (hasDailyGoals) {
        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent('## 📅 Daily Goals (2/2)')
        );

        goalsData.daily.forEach((goal, index) => {
            if (!goal) return;

            const progress = goal.progress || 0;
            const requirement = goal.assigned_requirement || goal.actualRequirement || 1;
            const progressBar = createVisualProgressBar(progress, requirement);

            // علامة ✅ إذا المهمة مكتملة
            const completedEmoji = goal.completed ? ' ✅' : '';

            // علامة 💰 إذا المكافأة تم استلامها
            const claimedEmoji = goal.claimed ? ' 💰' : '';

            const titleEmoji = completedEmoji || claimedEmoji;

            const simplifiedDesc = simplifyDescription(goal);
            const hasBonus = goal.bonus_chance && goal.bonus_chance > 0;

            // العنوان مع الايموجي المناسب
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `### ${goal.title || 'Untitled'}${titleEmoji}\n` +
                    `\`\`\`\n${simplifiedDesc}\n\`\`\``
                )
            );

            // المكافآت
            let rewardsText = `Rewards: **${goal.assigned_xp || 0} XP ** ||&|| **${goal.assigned_coins || 0} 🪙**`;
            if (goal.assigned_crystals && goal.assigned_crystals > 0) {
                rewardsText += ` ||&|| **${goal.assigned_crystals} 💎**`;
            }
            if (hasBonus) {
                rewardsText += `\n-# 🎲 ${Math.round((goal.bonus_chance || 0) * 100)}% Bonus Chance`;
            }

            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(rewardsText)
            );

            // التقدم وشريط التقدم
            container.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(`-# **Progress:** ${progress}/${requirement}\n${progressBar}`)
            );

            // حالة المهمة
            if (goal.completed) {
                if (goal.claimed) {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent('-# *💰 Reward claimed*')
                    );
                } else {
                    container.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent('-# *🎉 Ready to claim! (Will auto-claim)*')
                    );
                }
            }

            // إضافة فاصل بين المهام اليومية
            if (index < goalsData.daily.filter(g => g !== null).length - 1) {
                container.addSeparatorComponents((separator) => separator);
            }
        });
    }

    // فاصل بين اليومية والأسبوعية
    if (hasDailyGoals && hasWeeklyGoal) {
        container.addSeparatorComponents((separator) => separator);
    }

    // WEEKLY GOAL
    if (hasWeeklyGoal) {
        const goal = goalsData.weekly;
        const progress = goal.progress || 0;
        const requirement = goal.assigned_requirement || goal.actualRequirement || 1;
        const progressBar = createVisualProgressBar(progress, requirement);

        // علامة ✅ إذا المهمة مكتملة
        const completedEmoji = goal.completed ? ' ✅' : '';

        // علامة 💰 إذا المكافأة تم استلامها
        const claimedEmoji = goal.claimed ? ' 💰' : '';

        const titleEmoji = completedEmoji || claimedEmoji;

        const simplifiedDesc = simplifyDescription(goal);
        const hasBonus = goal.bonus_chance && goal.bonus_chance > 0;

        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent('## 📆 Weekly Mission')
        );

        // العنوان مع الايموجي المناسب
        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(
                `### ${goal.title || 'Untitled'}${titleEmoji}\n` +
                `\`\`\`\n${simplifiedDesc}\n\`\`\``
            )
        );

        // المكافآت
        let rewardsText = `Rewards: **${goal.assigned_xp || 0} XP ** ||&|| **${goal.assigned_coins || 0} 🪙**`;
        if (goal.assigned_crystals && goal.assigned_crystals > 0) {
            rewardsText += ` ||&|| **${goal.assigned_crystals} 💎**`;
        }
        if (hasBonus) {
            rewardsText += `\n-# 🎲 ${Math.round((goal.bonus_chance || 0) * 100)}% Bonus Chance`;
        }

        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(rewardsText)
        );

        // التقدم وشريط التقدم
        container.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(`-# **Progress:** ${progress}/${requirement}\n${progressBar}`)
        );

        // حالة المهمة
        if (goal.completed) {
            if (goal.claimed) {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('-# *💰 Reward claimed*')
                );
            } else {
                container.addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('-# *🎉 Ready to claim! (Will auto-claim)*')
                );
            }
        }
    }

    return container;
}

function createVisualProgressBar(current, total) {
    if (total === 0) return '';

    const percentage = Math.min(100, (current / total) * 100);
    const filledBlocks = Math.min(10, Math.floor(percentage / 10));
    const emptyBlocks = 10 - filledBlocks;

    const filled = ' 🟦'.repeat(filledBlocks);
    const empty = ' ⬛'.repeat(emptyBlocks);

    return `${filled}${empty} (${Math.round(percentage)}%)`;
}

function simplifyDescription(goal) {
    if (!goal) return 'No description';

    const description = goal.description || '';
    const requirement = goal.assigned_requirement || goal.actualRequirement || 1;

    // استخدام requirement من الداتا مباشرة
    if (description.toLowerCase().includes('bump')) {
        return `Bump ${requirement} times`;
    } 
    else if (description.toLowerCase().includes('send') || description.toLowerCase().includes('message')) {
        return `Send ${requirement} messages`;
    }
    else if (description.toLowerCase().includes('claim') || description.toLowerCase().includes('drop')) {
        return `Claim ${requirement} drops`;
    }
    else if (description.toLowerCase().includes('spend') || description.toLowerCase().includes('minute')) {
        return `Spend ${requirement} minutes in voice`;
    }
    else if (description.toLowerCase().includes('get') || description.toLowerCase().includes('staff')) {
        return `Get ${requirement} staff reactions`;
    }
    else if (description.toLowerCase().includes('earn') || description.toLowerCase().includes('coin')) {
        return `Earn ${requirement} coins from drops`;
    }
    else if (description.toLowerCase().includes('reply') || description.toLowerCase().includes('different')) {
        return `Reply to ${requirement} different people`;
    }
    else if (description.toLowerCase().includes('collect') || description.toLowerCase().includes('total')) {
        return `Collect ${requirement} coins`;
    }
    else {
        // لو ما عرفناش النوع، استخدم الوصف الأساسي
        return description.replace(/\d+-\d+/, requirement.toString())
                         .replace(/X/i, requirement.toString());
    }
}