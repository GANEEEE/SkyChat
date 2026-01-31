const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleartesters')
        .setDescription('Clear ALL testers applications data from database'),

    async execute(interaction) {
        try {
            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // التحقق من أن المستخدم لديه Moderate Role
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setDescription(`This command is available only for <@&${roleInfo.id}>`);
                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            // إمبدد التأكيد
            const confirmEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ Clear All Testers Data')
                .setDescription('**Are you sure you want to clear ALL testers applications data?**')
                .addFields(
                    { name: '📊 What will be deleted:', value: '• All applications (pending, approved, rejected)\n• All thread records\n• All application history', inline: false },
                    { name: '🚨 Warning:', value: 'This action **cannot be undone**! All data will be permanently lost.', inline: false }
                )
                .setImage(process.env.OrangeLine)

            // أزرار التأكيد
            const confirmButton = new ButtonBuilder()
                .setCustomId(`confirm_clear_testers_${interaction.user.id}`)
                .setLabel('Yes, Clear All Data')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✅');

            const cancelButton = new ButtonBuilder()
                .setCustomId(`cancel_clear_testers_${interaction.user.id}`)
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌');

            const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const reply = await interaction.reply({
                embeds: [confirmEmbed],
                components: [actionRow],
                flags: 64
            });

            // إنشاء مجمع للتفاعلات
            const collector = reply.createMessageComponentCollector({ 
                time: 60000, // 1 دقيقة
                filter: i => i.user.id === interaction.user.id
            });

            collector.on('collect', async i => {
                await i.deferUpdate();

                if (i.customId === `confirm_clear_testers_${interaction.user.id}`) {
                    try {
                        // جلب إحصائيات قبل المسح
                        const stats = await dbManager.get(`
                            SELECT 
                                COUNT(*) as total_applications,
                                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                                SUM(CASE WHEN thread_status = 'active' THEN 1 ELSE 0 END) as active_threads
                            FROM tester_applications
                        `);

                        // مسح جميع البيانات من الجدول
                        await dbManager.run('DELETE FROM tester_applications');

                        // إمبدد النجاح
                        const successEmbed = new EmbedBuilder()
                            .setColor(process.env.Bluecolor)
                            .setTitle('✅ All Testers Data Cleared Successfully')
                            .setDescription('All testers applications data has been permanently deleted from the database.')
                            .addFields(
                                { name: 'Data Cleared:', value: `**Total Applications:** ${stats.total_applications || 0}\n**Pending:** ${stats.pending || 0}\n**Approved:** ${stats.approved || 0}\n**Rejected:** ${stats.rejected || 0}\n**Active Threads:** ${stats.active_threads || 0}`, inline: false },
                                { name: 'Cleared At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                                { name: 'Cleared By', value: interaction.user.toString(), inline: true }
                            )
                            .setImage(process.env.BlueLine)

                        await i.editReply({
                            embeds: [successEmbed],
                            components: []
                        });

                    } catch (error) {
                        console.error('Error clearing testers data:', error);

                        const errorEmbed = new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('❌ Error Clearing Data')
                            .setDescription('An error occurred while clearing the testers data. Please try again.')
                            .setImage(process.env.RedLine)

                        await i.editReply({
                            embeds: [errorEmbed],
                            components: []
                        });
                    }

                } else if (i.customId === `cancel_clear_testers_${interaction.user.id}`) {
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('Operation Cancelled')
                        .setDescription('Testers data clearing has been cancelled. No data was deleted.')
                        .setImage(process.env.RedLine)

                    await i.editReply({
                        embeds: [cancelEmbed],
                        components: []
                    });
                }

                collector.stop();
            });

            collector.on('end', () => {
                // تعطيل الأزرار بعد انتهاء الوقت
                const disabledConfirm = new ButtonBuilder()
                    .setCustomId(`confirm_clear_testers_${interaction.user.id}_expired`)
                    .setLabel('Yes, Clear All Data')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✅')
                    .setDisabled(true);

                const disabledCancel = new ButtonBuilder()
                    .setCustomId(`cancel_clear_testers_${interaction.user.id}_expired`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
                    .setDisabled(true);

                const disabledRow = new ActionRowBuilder().addComponents(disabledConfirm, disabledCancel);

                reply.edit({ components: [disabledRow] }).catch(() => {});
            });

        } catch (error) {
            console.error('Error in cleartesters command:', error);
            await interaction.reply({
                content: '❌ An error occurred while executing this command.',
                flags: 64
            });
        }
    }
};