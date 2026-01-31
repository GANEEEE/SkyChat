const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

// التحقق من صلاحية Moderate Role
async function checkModerateRole(interaction) {
    try {
        // جلب Moderate Role من قاعدة البيانات
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
        .setName('addshame')
        .setDescription('Add points to a player in the Shame Leaderboard')
        .addUserOption(option => option
            .setName('user')
            .setDescription('The player to add points to')
            .setRequired(true))
        .addStringOption(option => option
            .setName('type')
            .setDescription('Type of shame')
            .setRequired(true)
            .addChoices(
                { name: 'GIVEAWAY_BAN', value: 'giveaway_ban' },
                { name: 'WARNS', value: 'warns' }
            ))
        .addIntegerOption(option => option
            .setName('points')
            .setDescription('Number of points to add')
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
            await dbManager.addShamePoints(targetUser.id, targetUser.username, type, points);

            // تحديث جميع الليدر بوردات النشطة
            const { updateAllLeaderboards } = require('./6 shameleaderboard');
            await updateAllLeaderboards();

            await interaction.editReply({ 
                content: `✅ Added ${points} ${type} points to ${targetUser.username}` 
            });
        } catch (error) {
            console.error('Error adding shame points:', error);
            await interaction.editReply('An error occurred while adding points.');
        }
    }
};