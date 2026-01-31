const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    TextDisplayBuilder,
    MessageFlags,
    EmbedBuilder,
    PermissionFlagsBits 
} = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('🔄 Reset Sky Coins and daily limits')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to reset coins for (leave empty for all users)')
                .setRequired(false) // Changed to false as requested
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // التحقق من Moderate Role (مثل emojisteal)
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine || '')
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من أن المستخدم لديه Moderate Role
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setImage(process.env.RedLine || '')
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

            const targetUser = interaction.options.getUser('user');
            const executor = interaction.user;
            const guild = interaction.guild;

            if (!targetUser) {
                // حالة: بدون تحديد يوزر (الكل)
                await this.showConfirmationContainer(interaction, null, executor, guild);
            } else {
                // حالة: مع تحديد يوزر
                await this.showConfirmationContainer(interaction, targetUser, executor, guild);
            }

        } catch (error) {
            console.error('Error in resetcoins command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while executing the command')
                .addFields(
                    { name: 'Error Details', value: error.message.substring(0, 1000) }
                )
                .setTimestamp();

            await interaction.editReply({ 
                embeds: [errorEmbed],
                flags: MessageFlags.IsComponentsV2 
            });
        }
    },

    async showConfirmationContainer(interaction, targetUser, executor, guild) {
        try {
            const isAllUsers = !targetUser;

            // إنشاء Container مع واجهة Components V2
            const confirmationContainer = new ContainerBuilder()
                .setAccentColor(isAllUsers ? 0xFF9900 : 0x0099FF)
                .addSectionComponents((section) => {
                    const sectionBuilder = new SectionBuilder()
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `# ⚠️ **Confirmation Required**\n` +
                                `You are about to reset Sky Coins ${isAllUsers ? 'for **ALL USERS**' : `for **${targetUser.tag}**`}\n\n` +
                                `**Actions to be performed:**\n` +
                                `• Reset all Sky Coins to 0\n` +
                                `• Reset daily earning limits\n` +
                                `• Reset XP earned today\n` +
                                `• Update last daily earned timestamp\n\n` +
                                `**Executor:** ${executor.tag}\n` +
                                `**Server:** ${guild.name}`
                            )
                        );

                    // إضافة الصورة: صورة السيرفر للكل أو صورة اليوزر للفرد
                    if (isAllUsers) {
                        sectionBuilder.setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`Server Icon: ${guild.name}`)
                                .setURL(guild.iconURL({ size: 256, extension: 'png' }) || '')
                        );
                    } else {
                        sectionBuilder.setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`User Avatar: ${targetUser.tag}`)
                                .setURL(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
                        );
                    }

                    return sectionBuilder;
                })
                .addSeparatorComponents((separator) => separator.setDivider(true))
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('**Please confirm or cancel this action:**')
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('confirm_reset')
                                .setLabel('✅ Confirm Reset')
                                .setStyle(ButtonStyle.Success)
                        )
                )
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent('*This action cannot be undone*')
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('cancel_reset')
                                .setLabel('❌ Cancel')
                                .setStyle(ButtonStyle.Danger)
                        )
                );

            // إرسال الرد مع Components V2
            await interaction.editReply({
                components: [confirmationContainer],
                flags: MessageFlags.IsComponentsV2
            });

            // إعداد collector للأزرار
            this.setupConfirmationCollector(interaction, targetUser, executor, guild);

        } catch (error) {
            console.error('Error showing confirmation container:', error);
            throw error;
        }
    },

    setupConfirmationCollector(interaction, targetUser, executor, guild) {
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 60000, // 60 ثانية
            max: 1 
        });

        collector.on('collect', async (i) => {
            try {
                await i.deferUpdate();

                if (i.customId === 'cancel_reset') {
                    // إلغاء العملية
                    const cancelContainer = new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent('# ❌ **Action Cancelled**\nReset operation has been cancelled.')
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription('Cancelled')
                                        .setURL('https://cdn-icons-png.flaticon.com/512/753/753345.png')
                                )
                        );

                    await i.editReply({
                        components: [cancelContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    console.log(`❌ ${executor.tag} cancelled reset for ${targetUser ? targetUser.tag : 'all users'}`);
                    return;
                }

                if (i.customId === 'confirm_reset') {
                    // تنفيذ عملية الـ Reset
                    await this.executeReset(i, targetUser, executor, guild);
                }

            } catch (error) {
                console.error('Error in confirmation collector:', error);

                const errorContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addSectionComponents((section) =>
                        section
                            .addTextDisplayComponents((textDisplay) =>
                                textDisplay.setContent('# ❌ **Error**\nAn error occurred while processing your request.')
                            )
                    );

                i.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({
                    components: [],
                    content: '⏰ **Time expired!** Please use the command again.',
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        });
    },

    async executeReset(interaction, targetUser, executor, guild) {
        try {
            let result;
            const isAllUsers = !targetUser;

            if (targetUser) {
                // Reset specific user
                result = await dbManager.run(
                    `UPDATE levels 
                     SET sky_coins = 0,
                         coins_earned_today = 0,
                         xp_earned_today = 0,
                         last_daily_earned = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [targetUser.id]
                );

                if (result.changes === 0) {
                    // اليوزر مش موجود في الداتابيز
                    const notFoundContainer = new ContainerBuilder()
                        .setAccentColor(0xFF9900)
                        .addSectionComponents((section) =>
                            section
                                .addTextDisplayComponents((textDisplay) =>
                                    textDisplay.setContent(`# ⚠️ **User Not Found**\nUser ${targetUser.tag} does not have an account in the system.`)
                                )
                                .setThumbnailAccessory((thumbnail) =>
                                    thumbnail
                                        .setDescription('User not found')
                                        .setURL('https://cdn-icons-png.flaticon.com/512/1828/1828665.png')
                                )
                        );

                    await interaction.editReply({
                        components: [notFoundContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                    return;
                }
            } else {
                // Reset all users
                result = await dbManager.run(
                    `UPDATE levels 
                     SET sky_coins = 0,
                         coins_earned_today = 0,
                         xp_earned_today = 0,
                         last_daily_earned = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE sky_coins > 0 OR coins_earned_today > 0 OR xp_earned_today > 0`
                );
            }

            // إنشاء success container
            const successContainer = new ContainerBuilder()
                .setAccentColor(0x00FF00)
                .addSectionComponents((section) => {
                    const content = isAllUsers 
                        ? `# ✅ **Reset Successful**\nReset coins for **${result.changes} users** in ${guild.name}`
                        : `# ✅ **Reset Successful**\nReset coins for **${targetUser.tag}**`;

                    return section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(content)
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(isAllUsers ? 'Server Icon' : 'User Avatar')
                                .setURL(
                                    isAllUsers 
                                        ? guild.iconURL({ size: 256, extension: 'png' }) || ''
                                        : targetUser.displayAvatarURL({ size: 256, extension: 'png' })
                                )
                        );
                })
                .addSeparatorComponents((separator) => separator.setDivider(true))
                .addSectionComponents((section) =>
                    section.addTextDisplayComponents((textDisplay) => {
                        let details = '';
                        if (isAllUsers) {
                            details = `**Users Affected:** ${result.changes}\n` +
                                     `**Actions:**\n• Reset all Sky Coins\n• Reset daily limits\n• Reset XP earned today\n• Updated timestamps\n` +
                                     `**Executor:** ${executor.tag}\n` +
                                     `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                                     `**Server:** ${guild.name}`;
                        } else {
                            details = `**User:** ${targetUser.tag}\n` +
                                     `**ID:** ${targetUser.id}\n` +
                                     `**Actions:**\n• Reset Sky Coins to 0\n• Reset daily limits\n• Reset XP earned today\n• Updated last daily timestamp\n` +
                                     `**Executor:** ${executor.tag}\n` +
                                     `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`;
                        }

                        return textDisplay.setContent(details);
                    })
                )
                .addSeparatorComponents((separator) => separator.setDivider(true))
                .addSectionComponents((section) =>
                    section.addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent('*✅ Reset completed successfully*')
                    )
                );

            await interaction.editReply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });

            // تسجيل في الكونسول
            console.log(`🔄 ${executor.tag} reset coins for ${isAllUsers ? `${result.changes} users` : targetUser.tag} in ${guild.name}`);

        } catch (error) {
            console.error('Error executing reset:', error);

            const errorContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(`# ❌ **Reset Failed**\nError: ${error.message.substring(0, 200)}`)
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription('Error')
                                .setURL('https://cdn-icons-png.flaticon.com/512/753/753345.png')
                        )
                );

            await interaction.editReply({
                components: [errorContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};