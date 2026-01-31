const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const dbManager = require('../Data/database'); // تأكد من المسار الصحيح

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fixinviter')
        .setDescription('Fix missing inviter for a member and update statistics')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member who joined')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('inviter')
                .setDescription('The inviter to assign')
                .setRequired(true)),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
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
                    .setImage(process.env.RedLine)
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

            // الحصول على الأعضاء من الخيارات
            const targetMember = interaction.options.getMember('member');
            const targetInviter = interaction.options.getMember('inviter');

            // التحقق من وجود الأعضاء
            if (!targetMember) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Member Not Found')
                    .setImage(process.env.RedLine)
                    .setDescription('The specified member was not found in this server.');
                return interaction.editReply({ embeds: [embed] });
            }

            if (!targetInviter) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Inviter Not Found')
                    .setImage(process.env.RedLine)
                    .setDescription('The specified inviter was not found in this server.');
                return interaction.editReply({ embeds: [embed] });
            }

            const memberId = targetMember.id;
            const inviterId = targetInviter.id;

            // التحقق من عدم كون العضو هو نفسه الداعي
            if (memberId === inviterId) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Invalid Assignment')
                    .setImage(process.env.RedLine)
                    .setDescription('A member cannot be their own inviter.');
                return interaction.editReply({ embeds: [embed] });
            }

            // إنشاء زر التأكيد
            const confirmEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Confirm Inviter Assignment')
            .addFields(
                {
                    name: '📊 Assignment Details',
                    value: '━━━━━━━━━━━━━━━━━━━━',
                    inline: false
                },
                {
                    name: '👤 Member',
                    value: `${targetMember}\nID: \`${memberId}\``,
                    inline: true
                },
                {
                    name: '📋 Inviter',
                    value: `${targetInviter}\nID: \`${inviterId}\``,
                    inline: true
                },
                {
                    name: '⚠️ Important Note',
                    value: '━━━━━━━━━━━━━━━━━━━━',
                    inline: false
                },
                {
                    name: 'Confirmation Required',
                    value: '**Are you sure you want to assign this inviter?**',
                    inline: false
                },
                {
                    name: 'Automatic Correction',
                    value: 'If the member already has an inviter, their stats will be corrected automatically:\n• Old inviter\'s stats will be reduced\n• New inviter\'s stats will be increased',
                    inline: false
                }
            )
            .setImage(process.env.OrangeLine)
            .setFooter({ text: 'This action cannot be undone.' });

            const confirmButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_fix')
                    .setLabel('✅ Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_fix')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({ 
                embeds: [confirmEmbed], 
                components: [confirmButtons] 
            });

            // إعداد collector للتأكيد
            const collector = interaction.channel.createMessageComponentCollector({ 
                time: 30000 
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ 
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#8B0000')
                                .setDescription('❌ You don\'t have permission to use this button.')
                                .setImage(process.env.RedLine)
                        ],
                        ephemeral: true 
                    });
                }

                await i.deferUpdate();

                if (i.customId === 'cancel_fix') {
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ Operation Cancelled')
                        .setImage(process.env.RedLine)
                        .setDescription('Inviter assignment has been cancelled.');

                    await i.editReply({ 
                        embeds: [cancelEmbed], 
                        components: [] 
                    });
                    collector.stop();
                    return;
                }

                if (i.customId === 'confirm_fix') {
                    try {
                        const result = await this.fixInviter(memberId, inviterId, interaction.guild, client);

                        if (result.success) {
                            const successEmbed = new EmbedBuilder()
                            .setColor(process.env.Bluecolor)
                            .setTitle('✅ Inviter Assigned Successfully!')
                            .addFields(
                                {
                                    name: 'Member',
                                    value: `<@${memberId}>`,
                                    inline: true
                                },
                                {
                                    name: 'New Inviter',
                                    value: `<@${inviterId}>`,
                                    inline: true
                                },
                                {
                                    name: 'Previous Inviter',
                                    value: result.oldInviter ? 
                                        (result.oldInviter !== inviterId ? `<@${result.oldInviter}>` : 'Same') : 
                                        'None',
                                    inline: true
                                }
                            )
                            .addFields(
                                {
                                    name: 'Status',
                                    value: result.status,
                                    inline: true
                                },
                                {
                                    name: 'Stats Updated',
                                    value: result.statsUpdated ? '✅' : '❌',
                                    inline: true
                                },
                                {
                                    name: 'Verification Fixed',
                                    value: result.fixedVerification ? '✅' : '❌',
                                    inline: true
                                }
                            )
                            .addFields({
                                name: 'Stats Correction',
                                value: `• Old Inviter: ${result.oldInviter && result.oldInviter !== inviterId ? 
                                    'Reduced ⬇️' : 'No change'}\n• New Inviter: Increased ⬆️`,
                                inline: false
                            })
                            .setImage(process.env.BlueLine);

                            await i.editReply({ 
                                embeds: [successEmbed], 
                                components: [] 
                            });
                        } else {
                            throw new Error(result.error);
                        }

                    } catch (error) {
                        console.error('Error fixing inviter:', error);

                        const errorEmbed = new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('❌ Failed to Assign Inviter')
                            .setImage(process.env.RedLine)
                            .setDescription(this.getErrorMessage(error));

                        await i.editReply({ 
                            embeds: [errorEmbed], 
                            components: [] 
                        });
                    }

                    collector.stop();
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({ 
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#FFA500')
                                .setTitle('⏰ Timeout')
                                .setImage(process.env.OrangeLine)
                                .setDescription('Confirmation timed out. Please run the command again.')
                        ], 
                        components: [] 
                    }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in fixinviter command:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ An error occurred.')
                        .setDescription('An error occurred while processing your request, please try again later.')
                        .setImage(process.env.RedLine)
                ],
                components: []
            });
        }
    },

    // ===== الدوال المساعدة ===== //
    isValidSnowflake(id) {
        return /^\d{17,20}$/.test(id);
    },

    async fixInviter(memberId, inviterId, guild, client) {
        try {
            // 1. الحصول على الداعي القديم أولاً
            const oldInviter = await dbManager.getMemberInviter(memberId);

            // 2. تحديث تاريخ الانضمام
            const updateHistory = await dbManager.run(
                'UPDATE member_join_history SET inviter_id = ? WHERE member_id = ?',
                [inviterId, memberId]
            );

            if (updateHistory.changes === 0) {
                return { success: false, error: 'Member not found in join history' };
            }

            // 3. تحديث بيانات الداعي الجديد
            try {
                const inviterUser = await client.users.fetch(inviterId).catch(() => null);
                if (inviterUser) {
                    await client.inviterSystem.updateUserInviteData({
                        userId: inviterId,
                        username: inviterUser.tag
                    });
                }
            } catch (error) {
                console.log('⚠️ Could not update inviter username:', error.message);
            }

            // 4. الحصول على العضو الحالي
            const guildMember = await guild.members.fetch(memberId).catch(() => null);
            let fixedVerification = false;

            if (guildMember) {
                // العضو لا يزال موجوداً
                const isVerified = client.verifiedRole && guildMember.roles.cache.has(client.verifiedRole.id);

                // تصحيح الإحصائيات بين الداعي القديم والجديد
                await this.comprehensiveStatsCorrection(memberId, inviterId, oldInviter, isVerified, client, guild);

                fixedVerification = true;

                return {
                    success: true,
                    status: isVerified ? 'Verified' : 'Unverified',
                    statsUpdated: true,
                    fixedVerification: true,
                    oldInviter: oldInviter,
                    newInviter: inviterId
                };

            } else {
                // العضو غادر - معالجة خاصة
                const wasVerified = await dbManager.getMemberVerificationStatus(memberId);

                // إذا كان هناك داعي قديم، ننقص من إحصائياته أولاً
                if (oldInviter && oldInviter !== 'Unknown' && oldInviter !== 'Vanity URL' && oldInviter !== inviterId) {
                    const updates = { total: -1 };
                    if (wasVerified) {
                        updates.verified = -1;
                    } else {
                        updates.unverified = -1;
                    }
                    await client.inviterSystem.incrementInviterStats(oldInviter, updates);
                }

                // ثم نزيد عند الداعي الجديد
                const newUpdates = { total: 1 };
                if (wasVerified) {
                    newUpdates.verified = 1;
                } else {
                    newUpdates.unverified = 1;
                }
                await client.inviterSystem.incrementInviterStats(inviterId, newUpdates);

                return {
                    success: true,
                    status: 'Left',
                    statsUpdated: true,
                    fixedVerification: false,
                    oldInviter: oldInviter,
                    newInviter: inviterId
                };
            }

        } catch (error) {
            console.error('Error in fixInviter:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    },

    // ===== الدالة الجديدة: تصحيح الإحصائيات الكامل ===== //
    async comprehensiveStatsCorrection(memberId, inviterId, oldInviter, isVerified, client, guild) {
        try {
            console.log(`🔄 Starting comprehensive stats correction for member ${memberId}`);
            console.log(`📊 Old inviter: ${oldInviter}, New inviter: ${inviterId}, Verified: ${isVerified}`);

            // إذا كان الداعي الجديد هو نفس القديم، لا داعي للتصحيح الكامل
            if (oldInviter === inviterId) {
                console.log(`⚠️ Same inviter, only updating verification status`);

                // تحديث حالة التحقق فقط
                await dbManager.updateMemberVerification(memberId, guild.id, isVerified);

                // تحديث إحصائيات الداعي
                const currentStats = await client.inviterSystem.getInviterStats(inviterId);
                const updates = { total: 0 };

                if (isVerified && currentStats.verified < currentStats.total) {
                    updates.verified = 1;
                    updates.unverified = -1;
                } else if (!isVerified && currentStats.unverified < currentStats.total) {
                    updates.verified = -1;
                    updates.unverified = 1;
                }

                if (updates.verified !== 0 || updates.unverified !== 0) {
                    await client.inviterSystem.incrementInviterStats(inviterId, updates);
                }

                return;
            }

            // 1. إذا كان هناك داعي قديم، ننقص من إحصائياته
            if (oldInviter && oldInviter !== 'Unknown' && oldInviter !== 'Vanity URL') {
                const oldStats = await client.inviterSystem.getInviterStats(oldInviter);
                console.log(`📊 Old inviter stats before:`, oldStats);

                const oldUpdates = { total: -1 };

                // نتحقق من حالة التحقق القديمة
                const wasVerified = await dbManager.getMemberVerificationStatus(memberId);

                if (wasVerified && oldStats.verified > 0) {
                    oldUpdates.verified = -1;
                    oldUpdates.unverified = 0;
                } else if (!wasVerified && oldStats.unverified > 0) {
                    oldUpdates.verified = 0;
                    oldUpdates.unverified = -1;
                }

                console.log(`➖ Removing from old inviter:`, oldUpdates);
                await client.inviterSystem.incrementInviterStats(oldInviter, oldUpdates);

                // نتأكد من التحديث
                await new Promise(resolve => setTimeout(resolve, 300));
                const updatedOldStats = await client.inviterSystem.getInviterStats(oldInviter);
                console.log(`📊 Old inviter stats after:`, updatedOldStats);
            }

            // 2. نزيد عند الداعي الجديد
            const newStats = await client.inviterSystem.getInviterStats(inviterId);
            console.log(`📊 New inviter stats before:`, newStats);

            const newUpdates = { total: 1 };
            if (isVerified) {
                newUpdates.verified = 1;
                newUpdates.unverified = 0;
            } else {
                newUpdates.verified = 0;
                newUpdates.unverified = 1;
            }

            console.log(`➕ Adding to new inviter:`, newUpdates);
            await client.inviterSystem.incrementInviterStats(inviterId, newUpdates);

            // نتأكد من التحديث
            await new Promise(resolve => setTimeout(resolve, 300));
            const updatedNewStats = await client.inviterSystem.getInviterStats(inviterId);
            console.log(`📊 New inviter stats after:`, updatedNewStats);

            // 3. تحديث حالة التحقق في قاعدة البيانات
            await dbManager.updateMemberVerification(memberId, guild.id, isVerified);

            console.log(`✅ Successfully corrected stats for member ${memberId}`);

        } catch (error) {
            console.error('❌ Error in comprehensiveStatsCorrection:', error);
            throw error;
        }
    },

    // ===== الدوال المساعدة الجديدة ===== //

    // دالة لجلب جميع أعضاء داعي معين
    async getAllInvitedMembers(inviterId) {
        try {
            const result = await dbManager.all(
                'SELECT member_id FROM member_join_history WHERE inviter_id = ?',
                [inviterId]
            );
            return result.map(row => row.member_id);
        } catch (error) {
            console.error('Error getting invited members:', error);
            return [];
        }
    },

    getErrorMessage(error) {
        if (error.message.includes('Member not found')) {
            return '**Reason:** Member ID not found in join history database.';
        } else if (error.message.includes('fetch')) {
            return '**Reason:** Could not fetch member information. The ID might be invalid or the user left the server.';
        } else if (error.message.includes('permission')) {
            return '**Reason:** Bot does not have sufficient permissions to perform this action.';
        } else {
            return `**Reason:** ${error.message}`;
        }
    }
};