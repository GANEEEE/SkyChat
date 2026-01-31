const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

// التحقق من صلاحية Moderate Role
async function checkModerateRole(interaction) {
    try {
        const moderateRoleData = await dbManager.getBotSetting('moderateRole');

        if (!moderateRoleData) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Moderate Role Not Set')
                .setImage(process.env.RedLine)
                .setDescription('No moderate role is configured, Please set a moderate role first using `/setrole`.');
            await interaction.editReply({ embeds: [embed] });
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
                .setDescription(`This command is available only for <@&${roleInfo.id}>`);
            await interaction.editReply({ embeds: [embed] });
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
        await interaction.editReply({ embeds: [embed] });
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removefame')
        .setDescription('Remove points from a player in the Hall Of Fame"')
        .addUserOption(option => option
            .setName('user')
            .setDescription('The player to remove points from')
            .setRequired(true))
        .addStringOption(option => option
            .setName('type')
            .setDescription('Type of win')
            .setRequired(true)
            .addChoices(
                { name: 'DAILY', value: 'daily' },
                { name: 'SPECIAL', value: 'special' },
                { name: 'VIP', value: 'vip' },
                { name: 'WEEKLY', value: 'weekly' },
                { name: 'HUMBLER', value: 'humbler' }
            ))
        .addIntegerOption(option => option
            .setName('points')
            .setDescription('Number of points to remove')
            .setRequired(true)
            .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // التحقق من صلاحية Moderate Role
        const hasPermission = await checkModerateRole(interaction);
        if (!hasPermission) return;

        const targetUser = interaction.options.getUser('user');
        const type = interaction.options.getString('type');
        const points = interaction.options.getInteger('points');

        try {
            const success = await dbManager.removeFamePoints(targetUser.id, type, points);

            if (!success) {
                return await interaction.editReply({ 
                    content: `❌ Cannot remove points from ${targetUser.username}` 
                });
            }

            // تحديث جميع الليدر بوردات النشطة
            const { updateAllLeaderboards } = require('./2 fameleaderboard');
            await updateAllLeaderboards();

            await interaction.editReply({ 
                content: `✅ Removed ${points} points ${type} from ${targetUser.username}` 
            });
        } catch (error) {
            console.error('Error removing points:', error);
            await interaction.editReply('⚠️ Oops! There was an error removing the points.');
        }
    }
};