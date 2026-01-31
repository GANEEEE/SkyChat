const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temproleremove')
        .setDescription('Remove a temporary role from a user manually')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove the role from')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The temporary role to remove')
                .setRequired(true)),

    async execute(interaction, client) {
        // التحقق من أن dbManager متاح
        if (!client.dbManager) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Database Error')
                .setImage(process.env.RedLine)
                .setDescription('`Database connection is not available. Please try again later.`');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // التحقق من Moderate Role من قاعدة البيانات مباشرة
        const moderateRoleData = await client.dbManager.getBotSetting('moderateRole');

        if (!moderateRoleData) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Moderate Role Not Set')
                .setImage(process.env.RedLine)
                .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
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
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const targetMember = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');

        // التحقق من المدخلات
        if (!targetMember || !role) {
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ Invalid Input')
                .setImage(process.env.OrangeLine)
                .setDescription('Please select a valid user and role.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // التحقق من صلاحيات البوت
        const executor = interaction.member;
        const botMember = interaction.guild.members.me;

        // تحقق من هرمية الرتب
        if (role.position >= executor.roles.highest.position && interaction.guild.ownerId !== executor.id) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('⛔ Role Hierarchy')
                .setImage(process.env.RedLine)
                .setDescription('You cannot remove a role equal or higher than your highest role.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (role.position >= botMember.roles.highest.position) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('⛔ Bot Permissions')
                .setImage(process.env.RedLine)
                .setDescription('I cannot remove this role, because it is higher than my highest role.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('⛔ Bot Permissions')
                .setImage(process.env.RedLine)
                .setDescription('I do not have the **Manage Roles** permission.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            // التحقق مما إذا كانت الرول مؤقتة في قاعدة البيانات
            const tempRoleEntry = await client.dbManager.get(
                'SELECT * FROM temp_roles WHERE user_id = ? AND role_id = ? AND guild_id = ? AND is_active = true',
                [targetMember.id, role.id, interaction.guild.id]
            );

            if (!tempRoleEntry) {
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Not a Temporary Role')
                    .setImage(process.env.OrangeLine)
                    .setDescription(`The role ${role} is not assigned as a temporary role to ${targetMember}.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // التحقق مما إذا كان المستخدم لديه الرول
            if (!targetMember.roles.cache.has(role.id)) {
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Role Not Found')
                    .setImage(process.env.OrangeLine)
                    .setDescription(`${targetMember} does not have the role ${role}.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // إزالة الرول من المستخدم
            await targetMember.roles.remove(role);

            // تحديث قاعدة البيانات - حذف الرول المؤقت
            await client.dbManager.run(
                'DELETE FROM temp_roles WHERE user_id = ? AND role_id = ? AND guild_id = ?',
                [targetMember.id, role.id, interaction.guild.id]
            );

            // تنظيف أي timeouts نشطة لهذه الرول
            if (client.tempRoleTimeouts) {
                const timeoutKey = `${targetMember.id}-${role.id}-${interaction.guild.id}`;
                const timeout = client.tempRoleTimeouts.get(timeoutKey);
                if (timeout) {
                    clearTimeout(timeout);
                    client.tempRoleTimeouts.delete(timeoutKey);
                    console.log(`✅ Cleared timeout for manually removed temp role: ${timeoutKey}`);
                }
            }

            // حذف الرسالة الأولى اللي اتعملت لما الرتبة اتعطيت
            try {
                if (tempRoleEntry.initial_message_id && tempRoleEntry.channel_id) {
                    const channel = await client.channels.fetch(tempRoleEntry.channel_id).catch(() => null);
                    if (channel && channel.isTextBased) {
                        const messageToDelete = await channel.messages.fetch(tempRoleEntry.initial_message_id).catch(() => null);
                        if (messageToDelete && messageToDelete.deletable) {
                            await messageToDelete.delete().catch(error => {
                                console.error('Cannot delete initial message:', error);
                            });
                            console.log(`✅ Deleted initial message: ${tempRoleEntry.initial_message_id}`);
                        }
                    }
                }
            } catch (error) {
                console.error('Error deleting initial message:', error);
            }

            // إنشاء رد النجاح
            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('<:Alarm:1429538046986158220> Temporary Role Removed Manually')
                //.setDescription(`${role} removed from ${targetMember}`)
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setImage(process.env.BlueLine)
                .addFields(
                    { name: 'Removed Role', value: `${role}`, inline: true },
                    { name: 'Member', value: `${targetMember}`, inline: true },
                    { name: 'Duration', value: tempRoleEntry.duration, inline: false },
                    //{ name: 'Removed By', value: interaction.user.toString(), inline: true },
                    //{ name: 'Permission', value: `<@&${roleInfo.id}>`, inline: true }
                );

            await interaction.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error removing temporary role:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error Removing Role')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while removing the role. Please try again.');

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }
};