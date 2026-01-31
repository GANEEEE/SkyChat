const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetinviter')
        .setDescription('completely reset all invite statistics and records for a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to COMPLETELY reset invite statistics for')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');

        try {
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
                    .setDescription(`This command is available only for <@&${roleInfo.id}>`);
                return interaction.editReply({ embeds: [embed] });
            }

            // التأكد من وجود المستخدم في جدول invites
            const existingUser = await dbManager.get('SELECT * FROM invites WHERE user_id = ?', [targetUser.id]);

            if (!existingUser) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ User Not Found')
                    .setImage(process.env.RedLine)
                    .setDescription(`<@${targetUser.id}> does not have any invite statistics to reset.`);
                return interaction.editReply({ embeds: [embed] });
            }

            // جلب عدد الأشخاص اللي دخلوا عن طريق هذا المستخدم
            const invitedMembers = await dbManager.all(
                'SELECT * FROM member_join_history WHERE inviter_id = ?', 
                [targetUser.id]
            );

            const invitedCount = invitedMembers ? invitedMembers.length : 0;

            // عرض تأكيد خطير جداً
            const confirmEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('🚨 DANGER | COMPLETE RESET')
                .setDescription(`**You are about to COMPLETELY ERASE all invite records for:**\n<@${targetUser.id}> (\`${targetUser.tag}\`)`)
                .setImage(process.env.RedLine)
                .addFields(
                    { name: '📊 Current Statistics', value: `Total: \`${existingUser.total}\` | Verified: \`${existingUser.verified}\` | Unverified: \`${existingUser.unverified}\` | Left: \`${existingUser.left_count}\``, ineline: false},
                    { name: '👥 Members Invited', value: `\`${invitedCount}\` members will be affected`, ineline: false },
                    { name: '⚠️ Consequences', value: 'This will:\n• Reset all statistics to ZERO\n• DELETE all join history records\n• Cannot be undone!', ineline: false}
                )
                .setFooter({ text: 'THIS ACTION IS PERMANENT AND CANNOT BE UNDONE!' });

            const confirmButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_reset')
                    .setLabel('💀 CONFIRM COMPLETE RESET')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_reset')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Secondary)
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

                if (i.customId === 'cancel_reset') {
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ Operation Cancelled')
                        .setImage(process.env.RedLine)
                        .setDescription('Complete reset has been cancelled.');

                    await i.editReply({ 
                        embeds: [cancelEmbed], 
                        components: [] 
                    });
                    collector.stop();
                    return;
                }

                if (i.customId === 'confirm_reset') {
                    try {
                        // 1. حذف جميع سجلات member_join_history المرتبطة بهذا المستخدم
                        await dbManager.run(
                            'UPDATE member_join_history SET inviter_id = ? WHERE inviter_id = ?',
                            ['ResetInvite', targetUser.id]
                        );

                        // 2. تصفير جميع الإحصائيات في جدول invites
                        await dbManager.run(
                            `UPDATE invites SET 
                             total = 0, 
                             verified = 0, 
                             unverified = 0, 
                             left_count = 0,
                             last_updated = CURRENT_TIMESTAMP 
                             WHERE user_id = ?`,
                            [targetUser.id]
                        );

                        const successEmbed = new EmbedBuilder()
                            .setColor('#0073ff')
                            .setTitle('COMPLETE RESET SUCCESSFUL')
                            .setDescription(`**ALL invite records for <@${targetUser.id}> have been\nCOMPLETELY ERASED**`)
                            .setImage(process.env.BlueLine)
                            .addFields(
                                { name: '📊 Statistics Reset', value: `Total: \`0\` | Verified: \`0\` | Unverified: \`0\` | Left: \`0\``, inline:false },
                                { name: '🗑️ Records Deleted', value: `\`${invitedCount}\` join history records removed`, inline:true },
                                { name: '👤 Reset by', value: `<@${interaction.user.id}>`, inline:true }
                            )

                        await i.editReply({ 
                            embeds: [successEmbed], 
                            components: [] 
                        });

                    } catch (error) {
                        console.error('Error in complete reset:', error);
                        const errorEmbed = new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('❌ Reset Failed')
                            .setImage(process.env.RedLine)
                            .setDescription('An error occurred during the complete reset.')
                            .addFields(
                                { name: 'Details', value: error.message.substring(0, 1000) }
                            );

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
            console.error('Error in resetinviter command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing the command.')
                .setImage(process.env.RedLine)
                .addFields(
                    { name: 'Details', value: error.message.substring(0, 1000) }
                );
            await interaction.editReply({ 
                embeds: [errorEmbed], 
                components: [] 
            });
        }
    }
};