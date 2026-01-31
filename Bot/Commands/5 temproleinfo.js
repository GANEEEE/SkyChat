const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temproleinfo')
        .setDescription('Check your temporary roles or specific user roles')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check specific user roles (leave empty for your roles)')
                .setRequired(false)),

    async execute(interaction, client) {
        // التحقق من أن dbManager متاح
        if (!client.dbManager) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Database Error')
                .setImage(process.env.RedLine)
                .setDescription('`Database connection is not available. Please try again later.`');
            return interaction.reply({ 
                embeds: [embed], 
                flags: MessageFlags.Ephemeral 
            });
        }

        const targetUser = interaction.options.getUser('user');

        try {
            // عرض رولات المستخدم المحدد أو المستخدم نفسه
            await showUserTempRoles(interaction, client, targetUser || interaction.user);
        } catch (error) {
            console.error('Error in temproleinfo command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while fetching temporary roles information.');

            await interaction.reply({ 
                embeds: [errorEmbed], 
                flags: MessageFlags.Ephemeral 
            });
        }
    }
};

// دالة لعرض الرولات المؤقتة لمستخدم معين
async function showUserTempRoles(interaction, client, targetUser) {
    const guildId = interaction.guild.id;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ User Not Found')
            .setImage(process.env.OrangeLine)
            .setDescription('The specified user is not in this server.');
        return interaction.reply({ 
            embeds: [embed], 
            flags: MessageFlags.Ephemeral 
        });
    }

    const tempRoles = await client.dbManager.all(`
        SELECT * FROM temp_roles 
        WHERE user_id = $1 AND guild_id = $2 AND expires_at > NOW()
        ORDER BY expires_at ASC
    `, [targetUser.id, guildId]);

    if (tempRoles.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('<:Infobg:1412839140407378062> No Temporary Roles')
            .setImage(process.env.BlueLine)
            .setDescription(`<:Dot:1417280000960368640> ${targetUser} doesn't have any temporary roles.`);
        return interaction.reply({ 
            embeds: [embed], 
            flags: MessageFlags.Ephemeral 
        });
    }

    let description = `${targetUser} Temprole/s: \n\n`;

    for (const tempRole of tempRoles) {
        const role = await interaction.guild.roles.fetch(tempRole.role_id).catch(() => null);
        const expiresAt = new Date(tempRole.expires_at);
        const now = new Date();
        const timeLeft = expiresAt.getTime() - now.getTime();

        if (!role) continue;

        const assignedBy = await client.users.fetch(tempRole.assigned_by).catch(() => null);

        // حساب الوقت المتبقي بشكل مقروء مع دعم للأسابيع والشهور والسنين
        const years = Math.floor(timeLeft / (1000 * 60 * 60 * 24 * 365));
        const months = Math.floor((timeLeft % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30));
        const weeks = Math.floor((timeLeft % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24 * 7));
        const days = Math.floor((timeLeft % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        let timeLeftString = '';
        if (years > 0) timeLeftString += `${years}y `;
        if (months > 0) timeLeftString += `${months}mo `;
        if (weeks > 0) timeLeftString += `${weeks}w `;
        if (days > 0) timeLeftString += `${days}d `;
        if (hours > 0) timeLeftString += `${hours}h `;
        if (minutes > 0) timeLeftString += `${minutes}m `;
        if (seconds > 0 || timeLeftString === '') timeLeftString += `${seconds}s`;

        description += `<:Dot:1417280000960368640> Role: <@&${role.id}>\n`; // هنا التغيير - رول منشن
        description += `<:Dot:1417280000960368640> Expire At: <t:${Math.floor(expiresAt.getTime() / 1000)}:F>\n`;
        description += `<:Dot:1417280000960368640> Duration: **${timeLeftString}**\n\n`;
        //description += `<:Dot:1417280000960368640> Assigned By: ${assignedBy?.tag || 'Unknown'}\n\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`**<:Alarm:1429538046986158220> Temprole Info**`)
        .setColor(process.env.Bluecolor)
        .setDescription(description)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setImage(process.env.BlueLine)

    await interaction.reply({ 
        embeds: [embed]
    });
}

// دالة مساعدة للتعامل مع تفاعلات الأزرار (تم إزالة الزر ولكن قد تحتاج الدالة لأغراض أخرى)
async function handleTempRoleInfoButtons(interaction, client) {
    if (!interaction.isButton()) return;

    // تم إزالة معالجة زر الـ Refresh
}

module.exports.handleButtons = handleTempRoleInfoButtons;