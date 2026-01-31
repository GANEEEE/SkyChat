const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../Data/database'); // استيراد مدير قاعدة البيانات

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Delete messages from the channel (optionally from a specific user)')
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user whose messages will be deleted (optional)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // فقط الأعضاء الذين لديهم صلاحية إدارة الرسائل يمكنهم استخدام الأمر

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true }); // إجابة مؤقتة غير مرئية للآخرين

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

            const targetUser = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('amount');

            // التحقق من صلاحيات البوت
            const botMember = interaction.guild.members.cache.get(client.user.id);
            if (!botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Bot Permission Error')
                    .setImage(process.env.RedLine)
                    .setDescription('I do not have permission to manage messages.');
                return interaction.editReply({ embeds: [embed] });
            }

            let deletedCount = 0;
            let description = '';

            if (targetUser) {
                // جلب الرسائل من القناة وحذف رسائل مستخدم معين
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(m => m.author.id === targetUser.id).first(amount);

                if (userMessages.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⚠️ No Messages Found')
                        .setImage(process.env.OrangeLine)
                        .setDescription(`No messages found from ${targetUser} in the last 100 messages.`);
                    return interaction.editReply({ embeds: [embed] });
                }

                // حذف رسائل المستخدم المحدد
                await interaction.channel.bulkDelete(userMessages, true);
                deletedCount = userMessages.length;
                description = `Successfully deleted ${deletedCount} messages from ${targetUser}.`;
            } else {
                // حذف الرسائل العامة
                const messages = await interaction.channel.bulkDelete(amount, true);
                deletedCount = messages.size;
                description = `Successfully deleted ${deletedCount} messages.`;
            }

            // إرسال رسالة النجاح
            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('✅ Messages Cleared Successfully')
                .setImage(process.env.BlueLine)
                .setDescription(description)
                .addFields(
                    { name: 'Channel', value: `${interaction.channel}`, inline: true },
                    { name: 'Messages Deleted', value: `${deletedCount}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user}`, inline: true }
                );

            // إضافة حقل المستخدم إذا كان محددًا
            if (targetUser) {
                successEmbed.addFields(
                    { name: 'User', value: `${targetUser}`, inline: true }
                );
            }

            successEmbed.setTimestamp();
            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error in clear command:', error);

            // معالجة الأخطاء الخاصة
            if (error.code === 50034) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Cannot Delete Old Messages')
                    .setImage(process.env.OrangeLine)
                    .setDescription('You can only delete messages that are less than 14 days old.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while trying to delete messages.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};