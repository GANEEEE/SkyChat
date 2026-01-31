const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addinvites')
        .setDescription('Add invites to a specific user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to give invites to')
                .setRequired(true))
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('The amount of invites to add')
                .setMinValue(1)
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of invites to add')
                .setRequired(true)
                .addChoices(
                    { name: 'Total', value: 'total' },
                    { name: 'Verified', value: 'verified' },
                    { name: 'Unverified', value: 'unverified' },
                    { name: 'Left', value: 'left' }
                )),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const type = interaction.options.getString('type');

        try {
            // جلب Moderate Role من قاعدة البيانات
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

            // التأكد من وجود المستخدم في جدول invites أولاً
            const existingUser = await dbManager.get('SELECT * FROM invites WHERE user_id = ?', [targetUser.id]);

            if (!existingUser) {
                // إذا لم يكن المستخدم موجودًا، إنشاء سجل جديد
                const initialData = {
                    total: type === 'total' ? amount : 0,
                    verified: type === 'verified' ? amount : 0,
                    unverified: type === 'unverified' ? amount : 0,
                    left_count: type === 'left' ? amount : 0
                };

                await dbManager.run(
                    `INSERT INTO invites (user_id, username, total, verified, unverified, left_count) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [targetUser.id, targetUser.tag, initialData.total, 
                     initialData.verified, initialData.unverified, initialData.left_count]
                );

                const successEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('✅ Added Successfully')
                    .setDescription(`Created new record for <@${targetUser.id}> and added **${amount}** ${getTypeName(type)} invites.`)
                    .setImage(process.env.BlueLine)
                    .addFields(
                        { name: 'Added by', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [successEmbed] });
            }

            // إذا كان المستخدم موجودًا، تحديث بياناته
            let updateQuery = '';
            let updateParams = [];

            switch (type) {
                case 'total':
                    updateQuery = 'UPDATE invites SET total = total + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
                case 'verified':
                    updateQuery = 'UPDATE invites SET verified = verified + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
                case 'unverified':
                    updateQuery = 'UPDATE invites SET unverified = unverified + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
                case 'left':
                    updateQuery = 'UPDATE invites SET left_count = left_count + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ?';
                    updateParams = [amount, targetUser.id];
                    break;
                default:
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ Invalid Type')
                        .setImage(process.env.RedLine)
                        .setDescription(`The type "${type}" is not valid, Please use one of: total, verified, unverified, left.`);
                    return interaction.editReply({ embeds: [errorEmbed] });
            }

            await dbManager.run(updateQuery, updateParams);

            // تحديث اسم المستخدم إذا تغير
            if (existingUser.username !== targetUser.tag) {
                await dbManager.run(
                    'UPDATE invites SET username = ? WHERE user_id = ?',
                    [targetUser.tag, targetUser.id]
                );
            }

            // جلب البيانات المحدثة
            const updatedData = await dbManager.get('SELECT * FROM invites WHERE user_id = ?', [targetUser.id]);

            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle(`✅ ${targetUser.tag} received ${amount} ${getTypeName(type)} invites`)
                .setImage(process.env.BLueLine)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Current Total', value: `\`${updatedData.total}\``, inline: true },
                    { name: 'Current Verified', value: `\`${updatedData.verified}\``, inline: true },
                    { name: 'Current Unverified', value: `\`${updatedData.unverified}\``, inline: true },
                    { name: 'Current Left', value: `\`${updatedData.left_count}\``, inline: true },
                    { name: 'Added by', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp()
                .setFooter({ 
                    text: `Requested by ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            await interaction.editReply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error in add command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while adding invites.')
                .setImage(process.env.RedLine)
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