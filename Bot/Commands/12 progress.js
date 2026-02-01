const { 
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ComponentType
} = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('progress')
        .setDescription('View your progress in different reward systems'),

    async execute(interaction) {
        try {
            // بدل deferReply، أرسل ردًا فوريًا
            const container = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addTextDisplayComponents((text) => text.setContent(`## Loading your progress...`));

            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                fetchReply: true
            });

            // ثم استدع showMainProgressMenu
            await showMainProgressMenu(interaction);

        } catch (error) {
            console.error('❌ Error in progress command:', error);

            // معالجة الأخطاء بطريقة آمنة
            if (interaction.deferred || interaction.replied) {
                try {
                    await interaction.editReply({ 
                        content: '❌ Error executing command.', 
                        flags: MessageFlags.Ephemeral 
                    });
                } catch (editError) {}
            } else {
                try {
                    await interaction.reply({ 
                        content: '❌ Error executing command.', 
                        flags: MessageFlags.Ephemeral 
                    });
                } catch (replyError) {}
            }
        }
    }
};

// ========== MAIN MENU ==========

async function showMainProgressMenu(interaction) {
    let response;

    try {
        // التحقق من أن التفاعل لم ينتهي
        if (!interaction || interaction.ended) {
            console.log('❌ Interaction already ended');
            return;
        }

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff);

        container
            .addTextDisplayComponents((text) => text.setContent(`## Welcome ${interaction.user.username} To Progress Menu`))
            .addTextDisplayComponents((text) => text.setContent('-# Choose system to view:'))

            .addSeparatorComponents((sep) => sep.setDivider(true))

            .addTextDisplayComponents((text) => text.setContent('### 🎯 Global Challenges'))
            .addTextDisplayComponents((text) => text.setContent('Server-wide challenge progress'))

            .addTextDisplayComponents((text) => text.setContent('### 📦 Crate System'))
            .addTextDisplayComponents((text) => text.setContent('Your crate & drop progress'))

            .addSeparatorComponents((sep) => sep.setDivider(false))

            .addActionRowComponents((row) =>
                row.setComponents(
                    new ButtonBuilder()
                        .setCustomId('progress_challenges')
                        .setLabel('View Challenges')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('progress_crates')
                        .setLabel('View Crates')
                        .setStyle(ButtonStyle.Success)
                )
            );

        // استخدام editReply إذا كان deferReply تم
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } else {
            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                fetchReply: true
            });
        }

        // احصل على الرسالة
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000, // قلل الوقت إلى 30 ثانية
            filter: (i) => i.user.id === interaction.user.id
        });

        collector.on('collect', async (i) => {
            try {
                if (!i.isButton()) return;

                // تحقق من عمر التفاعل
                if (i.createdTimestamp < Date.now() - 5000) {
                    console.log('⚠️ Interaction too old, ignoring');
                    return;
                }

                try {
                    await i.deferUpdate();
                } catch (deferError) {
                    console.log('⚠️ Defer update failed, trying direct handling');
                    // استمر في المعالجة حتى بدون deferUpdate
                }

                switch(i.customId) {
                    case 'progress_challenges':
                        await showChallengesProgress(i);
                        break;
                    case 'progress_crates':
                        await showCratesProgress(i);
                        break;
                }
            } catch (error) {
                if (error.code === 10062) {
                    console.log('⚠️ Interaction expired, skipping');
                    return;
                }
                console.error('Error in button handler:', error);
            }
        });

        collector.on('end', (collected, reason) => {
            console.log(`Progress collector ended. Reason: ${reason}, Collected: ${collected.size}`);
        });

        return response;

    } catch (error) {
        if (error.code === 10062) {
            console.log('⚠️ Interaction expired in main menu');
            return;
        }
        console.error('Error showing main menu:', error);
    }
}

// ========== GLOBAL CHALLENGES PROGRESS ==========

async function showChallengesProgress(interaction) {
    try {
        // التحقق من التفاعل
        if (!interaction || interaction.ended) {
            console.log('❌ Interaction ended for challenges');
            return;
        }

        const userId = interaction.user.id;
        const guildId = interaction.guild?.id;

        // محاولة deferUpdate فقط إذا لم يتم الرد بعد
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.deferUpdate();
            } catch (deferError) {
                console.log('⚠️ Cannot defer update, continuing...');
                // لا تخرج من الدالة، استمر
            }
        }

        const challengeData = await dbManager.getGlobalChallengeWithTargets(guildId);

        if (!challengeData) {
            await interaction.editReply({
                content: '❌ No active challenges in this server.',
                components: [],
                flags: MessageFlags.IsComponentsV2
            });
            return;
        }

        const currentMessages = challengeData.messages_in_current_cycle;

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff);

        // بناء المحتوى بنفس التنسيق الأصلي
        container
            .addTextDisplayComponents((text) => text.setContent('# 🎯 Global Challenges'))
            .addTextDisplayComponents((text) => text.setContent(`Total Messages: **${currentMessages.toLocaleString()}**`))
            .addSeparatorComponents((sep) => sep.setDivider(true))
            .addTextDisplayComponents((text) => text.setContent('## Main Events'));

        // Star Target - نفس التنسيق الأصلي
        const starReached = currentMessages >= challengeData.star_target;
        const starRemaining = Math.max(0, challengeData.star_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${starReached ? '✅' : '⭐'} Star Drop** ➠ (Drop in **${challengeData.star_target.toLocaleString()}** - Remaining: **${starRemaining}** messages)`
        ));

        // Comet Target - نفس التنسيق الأصلي
        const cometReached = currentMessages >= challengeData.comet_target;
        const cometRemaining = Math.max(0, challengeData.comet_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${cometReached ? '✅' : '☄️'} Comet Drop** ➠ (Drop in **${challengeData.comet_target.toLocaleString()}** - Remaining: **${cometRemaining} messages)**`
        ));

        // Nebula Target - نفس التنسيق الأصلي
        const nebulaReached = currentMessages >= challengeData.nebula_target;
        const nebulaRemaining = Math.max(0, challengeData.nebula_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${nebulaReached ? '✅' : '🌌'} Nebula Drop** ➠ (Drop in **${challengeData.nebula_target.toLocaleString()}** - Remaining: **${nebulaRemaining}** messages)`
        ));

        // Meteoroid Target - نفس التنسيق الأصلي
        const meteoroidReached = currentMessages >= challengeData.meteoroid_target;
        const meteoroidRemaining = Math.max(0, challengeData.meteoroid_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${meteoroidReached ? '✅' : '🔥'} Meteoroid Drop** ➠ (Drop in **${challengeData.meteoroid_target.toLocaleString()}** - Remaining: **${meteoroidRemaining}** messages)`
        ));

        // Between Targets - نفس التنسيق الأصلي
        container
            .addSeparatorComponents((sep) => sep.setDivider(true))
            .addTextDisplayComponents((text) => text.setContent('## Mini Events'));

        // Before-Star - نفس التنسيق الأصلي
        const beforeStarReached = currentMessages >= challengeData.before_star_target;
        const beforeStarRemaining = Math.max(0, challengeData.before_star_target - currentMessages);
        const beforeStarStatus = challengeData.before_star_completed ? '✅' : '🎯';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${beforeStarStatus} Mini Star** ➠ (Drop in **${challengeData.before_star_target.toLocaleString()}** - Remaining: **${beforeStarRemaining}** messages)`
        ));

        // Star-Comet - نفس التنسيق الأصلي
        const starCometReached = currentMessages >= challengeData.star_comet_target;
        const starCometRemaining = Math.max(0, challengeData.star_comet_target - currentMessages);
        const starCometStatus = challengeData.star_comet_completed ? '✅' : '⚡';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${starCometStatus} Mini Comet** ➠ (Drop in **${challengeData.star_comet_target.toLocaleString()}** - Remaining: **${starCometRemaining}** messages)`
        ));

        // Comet-Nebula - نفس التنسيق الأصلي
        const cometNebulaReached = currentMessages >= challengeData.comet_nebula_target;
        const cometNebulaRemaining = Math.max(0, challengeData.comet_nebula_target - currentMessages);
        const cometNebulaStatus = challengeData.comet_nebula_completed ? '✅' : '💫';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${cometNebulaStatus} Mini Nebula** ➠ (Drop in **${challengeData.comet_nebula_target.toLocaleString()}** - Remaining: **${cometNebulaRemaining}** messages)`
        ));

        // Nebula-Meteoroid - نفس التنسيق الأصلي
        const nebulaMeteoroidReached = currentMessages >= challengeData.nebula_meteoroid_target;
        const nebulaMeteoroidRemaining = Math.max(0, challengeData.nebula_meteoroid_target - currentMessages);
        const nebulaMeteoroidStatus = challengeData.nebula_meteoroid_completed ? '✅' : '🌀';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${nebulaMeteoroidStatus} Mini Meteoroid** ➠ (Drop in **${challengeData.nebula_meteoroid_target.toLocaleString()}** - Remaining: **${nebulaMeteoroidRemaining}** messages)`
        ));

        // Voice Challenge - نفس التنسيق الأصلي
        const voiceChallengeReached = currentMessages >= challengeData.voice_challenge_target;
        const voiceChallengeRemaining = Math.max(0, challengeData.voice_challenge_target - currentMessages);
        const voiceChallengeStatus = challengeData.voice_challenge_completed ? '✅' : '🎧';
        container.addTextDisplayComponents((text) => text.setContent(
            `**${voiceChallengeStatus} Voice Challenge** ➠ (Drop in **${challengeData.voice_challenge_target.toLocaleString()}** - Remaining: **${voiceChallengeRemaining}** messages)`
        ));

        // Navigation - نفس التنسيق الأصلي
        container
            .addSeparatorComponents((sep) => sep.setDivider(false))
            .addActionRowComponents((row) =>
                row.setComponents(
                    new ButtonBuilder()
                        .setCustomId('progress_challenges')
                        .setLabel('Challenges')
                        .setEmoji('🎯')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('progress_crates')
                        .setLabel('Crates')
                        .setEmoji('📦')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(false)
                )
            );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        // إنشاء collector جديد
        const message = await interaction.fetchReply();
        createCollectorForPage(message, userId, 'challenges');

    } catch (error) {
        if (error.code === 10062) {
            console.log('⚠️ Interaction expired in challenges');
            return;
        }
        console.error('Error showing challenges progress:', error);
    }
}

// ========== CRATE PROGRESS ==========

async function showCratesProgress(interaction) {
    try {
        // التحقق من التفاعل
        if (!interaction || interaction.ended) {
            console.log('❌ Interaction ended for crates');
            return;
        }

        const userId = interaction.user.id;

        // محاولة deferUpdate فقط إذا لم يتم الرد بعد
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.deferUpdate();
            } catch (deferError) {
                console.log('⚠️ Cannot defer update, continuing...');
                // لا تخرج من الدالة، استمر
            }
        }

        const dropProgress = await dbManager.getUserDropProgress(userId);

        if (!dropProgress) {
            const container = new ContainerBuilder()
                .setAccentColor(0x0073ff);

            container
                .addTextDisplayComponents((text) => text.setContent('# 📦 Crate Progress'))
                .addTextDisplayComponents((text) => text.setContent('## ❌ No Crates Available'))
                .addTextDisplayComponents((text) => text.setContent('### Start grinding messages to earn your first crate!'))
                .addTextDisplayComponents((text) => text.setContent('- Send messages in counted channels'))
                .addTextDisplayComponents((text) => text.setContent('- Complete challenges'))
                .addTextDisplayComponents((text) => text.setContent('- Stay active in the server'))

                .addSeparatorComponents((sep) => sep.setDivider(false))
                .addActionRowComponents((row) =>
                    row.setComponents(
                        new ButtonBuilder()
                            .setCustomId('progress_challenges')
                            .setLabel('Challenges')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🎯')
                            .setDisabled(false),
                        new ButtonBuilder()
                            .setCustomId('progress_crates')
                            .setLabel('Crates')
                            .setEmoji('📦')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                    )
                );

            await interaction.editReply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            // إنشاء collector جديد
            const message = await interaction.fetchReply();
            createCollectorForPage(message, userId, 'crates');
            return;
        }

        const currentMessages = dropProgress.total_messages;

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff);

        // بناء المحتوى بنفس التنسيق الأصلي
        container
            .addTextDisplayComponents((text) => text.setContent('# 📦 Crate Progress'))
            .addTextDisplayComponents((text) => text.setContent(`**Total Messages:** ${currentMessages.toLocaleString()}`))
            .addSeparatorComponents((sep) => sep.setDivider(true));

        // Common Drop - نفس التنسيق الأصلي
        const commonReached = currentMessages >= dropProgress.common_target;
        const commonRemaining = Math.max(0, dropProgress.common_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${commonReached ? '✅' : '📦'} Common Crate** ➠ (Drop in **${dropProgress.common_target.toLocaleString()}** - Remaining: **${commonRemaining}** messages)\n-# Received: **${dropProgress.total_common_received}** times`
        ));

        // Rare Drop - نفس التنسيق الأصلي
        const rareReached = currentMessages >= dropProgress.rare_target;
        const rareRemaining = Math.max(0, dropProgress.rare_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${rareReached ? '✅' : '✨'} Rare Crate** ➠ (Drop in **${dropProgress.rare_target.toLocaleString()}** - Remaining: **${rareRemaining}** messages)\n-# Received: **${dropProgress.total_rare_received}** times`
        ));

        // Epic Drop - نفس التنسيق الأصلي
        const epicReached = currentMessages >= dropProgress.epic_target;
        const epicRemaining = Math.max(0, dropProgress.epic_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${epicReached ? '✅' : '💎'} Epic Crate** ➠ (Drop in **${dropProgress.epic_target.toLocaleString()}** - Remaining: **${epicRemaining}** messages)\n-# Received: **${dropProgress.total_epic_received}** times`
        ));

        // Legendary Drop - نفس التنسيق الأصلي
        const legendaryReached = currentMessages >= dropProgress.legendary_target;
        const legendaryRemaining = Math.max(0, dropProgress.legendary_target - currentMessages);
        container.addTextDisplayComponents((text) => text.setContent(
            `**${legendaryReached ? '✅' : '🔥'} Legendary Crate** ➠ (Drop in **${dropProgress.legendary_target.toLocaleString()}** - Remaining: **${legendaryRemaining}** messages)\n-# Received: **${dropProgress.total_legendary_received}** times`
        ));

        // Check for available drops
        let availableDrops = [];
        if (commonReached && dropProgress.last_common_at < dropProgress.common_target) {
            availableDrops.push('📦 Common Drop Available!');
        }
        if (rareReached && dropProgress.last_rare_at < dropProgress.rare_target) {
            availableDrops.push('✨ Rare Drop Available!');
        }
        if (epicReached && dropProgress.last_epic_at < dropProgress.epic_target) {
            availableDrops.push('💎 Epic Drop Available!');
        }
        if (legendaryReached && dropProgress.last_legendary_at < dropProgress.legendary_target) {
            availableDrops.push('🔥 Legendary Drop Available!');
        }

        // Available Drops - نفس التنسيق الأصلي
        if (availableDrops.length > 0) {
            container
                .addSeparatorComponents((sep) => sep.setDivider(true))
                .addTextDisplayComponents((text) => text.setContent('## 🎁 Available Drops!'))
                .addTextDisplayComponents((text) => text.setContent(availableDrops.join('\n')));
        }

        // Navigation - نفس التنسيق الأصلي
        container
            .addSeparatorComponents((sep) => sep.setDivider(false))
            .addActionRowComponents((row) =>
                row.setComponents(
                    new ButtonBuilder()
                        .setCustomId('progress_challenges')
                        .setLabel('Challenges')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎯')
                        .setDisabled(false),
                    new ButtonBuilder()
                        .setCustomId('progress_crates')
                        .setLabel('Crates')
                        .setEmoji('📦')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                )
            );

        await interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        // إنشاء collector جديد
        const message = await interaction.fetchReply();
        createCollectorForPage(message, userId, 'crates');

    } catch (error) {
        if (error.code === 10062) {
            console.log('⚠️ Interaction expired in crates');
            return;
        }
        console.error('Error showing crates progress:', error);
    }
}

// ========== HELPER FUNCTION FOR COLLECTOR ==========

function createCollectorForPage(message, userId, currentPage) {
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000, // قلل الوقت إلى 30 ثانية
        filter: (i) => i.user.id === userId
    });

    collector.on('collect', async (i) => {
        try {
            if (!i.isButton()) return;

            // تحقق من عمر التفاعل
            if (i.createdTimestamp < Date.now() - 5000) {
                console.log('⚠️ Interaction too old, ignoring');
                return;
            }

            try {
                await i.deferUpdate();
            } catch (deferError) {
                if (deferError.code === 10062) {
                    console.log('⚠️ Interaction expired in collector');
                    return;
                }
                console.log('⚠️ Page collector defer failed:', deferError.message);
                // استمر في المعالجة
            }

            // إذا كان الزر محظورًا (مختار بالفعل) لا تفعل شيء
            if ((currentPage === 'challenges' && i.customId === 'progress_challenges') ||
                (currentPage === 'crates' && i.customId === 'progress_crates')) {
                console.log('⚠️ Button already selected');
                return;
            }

            switch(i.customId) {
                case 'progress_challenges':
                    await showChallengesProgress(i);
                    break;
                case 'progress_crates':
                    await showCratesProgress(i);
                    break;
            }
        } catch (error) {
            if (error.code === 10062) {
                console.log('⚠️ Interaction expired in collector handler');
                return;
            }
            console.error('Error in page collector:', error);
        }
    });

    collector.on('end', (collected, reason) => {
        console.log(`Page collector ended. Reason: ${reason}, Collected: ${collected.size}`);
    });

    return collector;
}