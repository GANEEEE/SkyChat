const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../Data/database'); // استيراد مدير قاعدة البيانات

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Remove a role from a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to remove the role from')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('The role to remove from the user')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles), // فقط الأعضاء الذين لديهم صلاحية إدارة الأدوار يمكنهم استخدام الأمر

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

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
            const role = interaction.options.getRole('role');

            // الحصول على عضو الجيلد (السيرفر)
            const targetMember = interaction.guild.members.cache.get(targetUser.id);

            try {
                // التحقق مما إذا كان البوت يستطيع إدارة الأدوار
                const botMember = interaction.guild.members.cache.get(client.user.id);
                if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                    const embed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ Bot Permission Error')
                        .setImage(process.env.RedLine)
                        .setDescription('I do not have permission to manage roles.');
                    return interaction.editReply({ embeds: [embed] });
                }

                // التحقق مما إذا كان الدور أعلى من دور البوت
                if (role.position >= botMember.roles.highest.position) {
                    const embed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ Role Hierarchy Error')
                        .setImage(process.env.RedLine)
                        .setDescription('I cannot remove this role as it is higher than or equal to my highest role.');
                    return interaction.editReply({ embeds: [embed] });
                }

                // التحقق مما إذا كان المستخدم لديه الدور بالفعل
                if (!targetMember.roles.cache.has(role.id)) {
                    const embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⚠️ Role Not Assigned')
                        .setImage(process.env.OrangeLine)
                        .setDescription(`User ${targetUser} does not have the role <@&${role.id}>.`);
                    return interaction.editReply({ embeds: [embed] });
                }

                // إزالة الدور من المستخدم
                await targetMember.roles.remove(role);

                // إرسال رسالة النجاح
                const successEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('✅ Role Removed Successfully')
                    .setDescription(`Successfully removed the role <@&${role.id}> from ${targetUser}.`)
                    .setImage(process.env.BlueLine)
                    .addFields(
                        { name: 'User', value: `${targetUser}`, inline: true },
                        { name: 'Role', value: `<@&${role.id}>`, inline: true },
                        { name: 'Moderator', value: `${interaction.user}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Error in removerole command:', error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Error')
                    .setImage(process.env.RedLine)
                    .setDescription('An error occurred while removing the role.');
                await interaction.editReply({ embeds: [errorEmbed] });
            }

        } catch (error) {
            console.error('Error in removerole command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while processing the command.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};