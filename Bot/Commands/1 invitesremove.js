const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

// التحقق من صلاحية Moderate Role
async function checkModerateRole(interaction) {
    try {
        const moderateRoleData = await dbManager.get('SELECT setting_value FROM bot_settings WHERE setting_key = ?', ['moderateRole']);

        if (!moderateRoleData) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Moderate Role Not Set')
                .setImage(process.env.RedLine)
                .setDescription('No moderate role is configured, Please set a moderate role first using `/setrole`.');
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return false;
        }

        const roleInfo = JSON.parse(moderateRoleData.setting_value);
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const hasModerateRole = member.roles.cache.has(roleInfo.id);

        if (!hasModerateRole) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('⛔ Permission Denied')
                .setImage(process.env.RedLine)
                .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking moderate role:', error);
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('❌ Error')
            .setImage(process.env.RedLine)
            .setDescription('An error occurred while checking permissions.');
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removeinvites')
        .setDescription('Remove invites from a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove invites from')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of invites to remove')
                .setMinValue(1)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of invites to remove')
                .setRequired(true)
                .addChoices(
                    { name: 'Total', value: 'total' },
                    { name: 'Verified', value: 'verified' },
                    { name: 'Unverified', value: 'unverified' },
                    { name: 'Left', value: 'left' }
                )),

    async execute(interaction, client) {
        // التحقق من صلاحية Moderate Role
        const hasPermission = await checkModerateRole(interaction);
        if (!hasPermission) return;

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const type = interaction.options.getString('type');

        try {
            // جلب بيانات المستخدم الحالية
            const userData = await dbManager.get('SELECT * FROM invites WHERE user_id = ?', [targetUser.id]);

            if (!userData) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ User Not Found')
                    .setImage(process.env.OrangeLine)
                    .setDescription(`No invite data found for user ${targetUser.tag}`);
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // التحقق من أن الكمية لا تتجاوز القيم الحالية
            let canRemove = true;
            let errorMessage = '';

            switch (type) {
                case 'total':
                    if (userData.total < amount) {
                        canRemove = false;
                        errorMessage = `Cannot remove ${amount} from Total, current value is only ${userData.total}.`;
                    }
                    break;
                case 'verified':
                    if (userData.verified < amount) {
                        canRemove = false;
                        errorMessage = `Cannot remove ${amount} from Verified, current value is only ${userData.verified}.`;
                    }
                    break;
                case 'unverified':
                    if (userData.unverified < amount) {
                        canRemove = false;
                        errorMessage = `Cannot remove ${amount} from Unverified, current value is only ${userData.unverified}.`;
                    }
                    break;
                case 'left':
                    if (userData.left_count < amount) {
                        canRemove = false;
                        errorMessage = `Cannot remove ${amount} from Left, current value is only ${userData.left_count}.`;
                    }
                    break;
            }

            if (!canRemove) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Quantity Error')
                    .setImage(process.env.RedLine)
                    .setDescription(errorMessage);
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // تحديث البيانات (بدون التأثير على الحقول الأخرى)
            let updateQuery = '';
            let updateParams = [];

            switch (type) {
                case 'total':
                    updateQuery = 'UPDATE invites SET total = GREATEST(0, total - ?), last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
                case 'verified':
                    updateQuery = 'UPDATE invites SET verified = GREATEST(0, verified - ?), last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
                case 'unverified':
                    updateQuery = 'UPDATE invites SET unverified = GREATEST(0, unverified - ?), last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
                case 'left':
                    updateQuery = 'UPDATE invites SET left_count = GREATEST(0, left_count - ?), last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
            }

            await dbManager.run(updateQuery, updateParams);

            // تحديث اسم المستخدم إذا تغير
            if (userData.username !== targetUser.tag) {
                await dbManager.run(
                    'UPDATE invites SET username = ? WHERE user_id = ?',
                    [targetUser.tag, targetUser.id]
                );
            }

            // جلب البيانات المحدثة
            const updatedData = await dbManager.get('SELECT * FROM invites WHERE user_id = ?', [targetUser.id]);

            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('✅ Successfully Removed')
                .setDescription(`Removed **${amount}** **${getTypeName(type)}** points from <@${targetUser.id}>.`)
                .setImage(process.env.BlueLine)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Current Total', value: `\`${updatedData.total}\``, inline: true },
                    { name: 'Current Verified', value: `\`${updatedData.verified}\``, inline: true },
                    { name: 'Current Unverified', value: `\`${updatedData.unverified}\``, inline: true },
                    { name: 'Current Left', value: `\`${updatedData.left_count}\``, inline: true },
                    { name: 'Removed by', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp()
                .setFooter({ 
                    text: `Requested by ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error in remove command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while removing points.')
                .addFields(
                    { name: 'Details', value: error.message.substring(0, 1000) }
                );
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};

// دالة مساعدة للحصول على اسم النوع بالإنجليزية
function getTypeName(type) {
    switch (type) {
        case 'total': return 'Total';
        case 'verified': return 'Verified';
        case 'unverified': return 'Unverified';
        case 'left': return 'Left';
        default: return type;
    }
}