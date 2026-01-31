const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// تخزين رسائل الليست وجامعي الأزرار
let tempRoleListMessages = new Map();
let activeTempRoleCollectors = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temprolelist')
        .setDescription('Show all users with temporary roles in the server')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Filter by specific role (optional)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number (default: 1)')
                .setRequired(false)
                .setMinValue(1)),

    async execute(interaction, client) {
        // التحقق من أن dbManager متاح
        if (!client.dbManager) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Database Error')
                .setImage(process.env.RedLine)
                .setDescription('`Database connection is not available, please try again later`');
            return interaction.reply({ 
                embeds: [embed], 
                flags: MessageFlags.Ephemeral 
            });
        }

        await interaction.deferReply();

        const guildId = interaction.guild.id;
        const roleFilter = interaction.options.getRole('role');
        const pageNumber = interaction.options.getInteger('page') || 1;

        try {
            // عرض قائمة المستخدمين مع الرولات المؤقتة
            const result = await showTempRolesList(interaction, client, guildId, roleFilter, pageNumber);

            const message = await interaction.editReply(result);

            // حفظ حالة الرسالة
            tempRoleListMessages.set(message.id, {
                channel: message.channel,
                userId: interaction.user.id,
                guildId: guildId,
                roleFilter: roleFilter ? roleFilter.id : null,
                currentPage: pageNumber,
                totalPages: result.totalPages
            });

            // إعداد جامع الأزرار
            setupButtonCollector(message, client);

        } catch (error) {
            console.error('Error in temprolelist command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while fetching temporary roles list');

            await interaction.editReply({ 
                embeds: [errorEmbed]
            });
        }
    },

    // دالة للتعامل مع تفاعلات الأزرار (إذا كنت تريدها منفصلة)
    async handleButtons(interaction, client) {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('temprolelist_')) return;

        await handleButtonInteraction(interaction, client);
    }
};

// دالة لعرض قائمة المستخدمين مع الرولات المؤقتة
async function showTempRolesList(interaction, client, guildId, roleFilter, pageNumber) {
    const itemsPerPage = 10;

    let query;
    let queryParams;

    if (roleFilter) {
        // فلترة حسب رول معين
        query = `
            SELECT DISTINCT user_id, role_id, expires_at, assigned_by
            FROM temp_roles 
            WHERE guild_id = $1 AND role_id = $2 AND expires_at > NOW()
            ORDER BY expires_at ASC
        `;
        queryParams = [guildId, roleFilter.id];
    } else {
        // جميع الرولات المؤقتة
        query = `
            SELECT DISTINCT user_id, role_id, expires_at, assigned_by
            FROM temp_roles 
            WHERE guild_id = $1 AND expires_at > NOW()
            ORDER BY expires_at ASC
        `;
        queryParams = [guildId];
    }

    const tempRoles = await client.dbManager.all(query, queryParams);

    if (tempRoles.length === 0) {
        return {
            embeds: [
                new EmbedBuilder()
                    .setColor('#0073ff')
                    .setTitle('<:Infobg:1412839140407378062> No Temporary Roles Found')
                    .setImage(process.env.BlueLine)
                    .setDescription(`<:Dot:1417280000960368640> ${roleFilter ? `No users found with the role ${roleFilter}` : 'No temporary roles found in this server'}`)
            ],
            components: []
        };
    }

    // تجميع البيانات حسب المستخدم
    const usersMap = new Map();

    for (const tempRole of tempRoles) {
        const userId = tempRole.user_id;

        if (!usersMap.has(userId)) {
            usersMap.set(userId, {
                roles: [],
                earliestExpiry: null,
                roleCount: 0
            });
        }

        const userData = usersMap.get(userId);
        userData.roles.push({
            roleId: tempRole.role_id,
            expiresAt: new Date(tempRole.expires_at),
            assignedBy: tempRole.assigned_by
        });

        // تحديث أقرب وقت انتهاء
        const expiryTime = new Date(tempRole.expires_at).getTime();
        if (!userData.earliestExpiry || expiryTime < userData.earliestExpiry) {
            userData.earliestExpiry = expiryTime;
        }

        userData.roleCount++;
    }

    // تحويل الماب إلى مصفوفة وفرزها حسب أقرب وقت انتهاء
    const usersArray = Array.from(usersMap.entries()).map(([userId, data]) => ({
        userId,
        ...data
    })).sort((a, b) => a.earliestExpiry - b.earliestExpiry);

    // حساب معلومات الترقيم الصفحي
    const totalPages = Math.ceil(usersArray.length / itemsPerPage);
    const actualPage = Math.min(pageNumber, totalPages);
    const startIndex = (actualPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, usersArray.length);
    const pageUsers = usersArray.slice(startIndex, endIndex);

    let description = '';

    if (roleFilter) {
        description += `<:Dot:1417280000960368640> **Filter:** Showing users with ${roleFilter}\n\n`;
    }

    description += `<:Dot:1417280000960368640> **Total Users:** ${usersArray.length}\n`;
    description += `<:Dot:1417280000960368640> **Total Temporary Roles:** ${tempRoles.length}\n\n`;

    // تجميع جميع عمليات جلب المستخدمين
    const fetchPromises = pageUsers.map(async (userData, i) => {
        const userNumber = startIndex + i + 1;

        try {
            const user = await interaction.client.users.fetch(userData.userId);

            // حساب الوقت المتبقي لأقرب رول ينتهي
            const now = new Date();
            const timeLeft = userData.earliestExpiry - now.getTime();

            // تنسيق الوقت المتبقي
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

            let userEntry = `**${userNumber}) <@${user.id}>**\n`;
            userEntry += `<:Dot:1417280000960368640> Roles: **${userData.roleCount}** temporary role(s)\n`;

            // إذا كان هناك فلتر، نعرض فقط الرول المحدد
            if (roleFilter) {
                const roleExpiry = userData.roles.find(r => r.roleId === roleFilter.id);
                if (roleExpiry) {
                    userEntry += `<:Dot:1417280000960368640> Expires: <t:${Math.floor(roleExpiry.expiresAt.getTime() / 1000)}:R>\n`;
                }
            } else {
                userEntry += `<:Dot:1417280000960368640> Next Expiry: **${timeLeftString}**\n`;
            }

            userEntry += `\n`;
            return userEntry;
        } catch (error) {
            console.error(`Error fetching user ${userData.userId}:`, error);
            return ''; // إرجاع سلسلة فارغة إذا فشل جلب المستخدم
        }
    });

    // انتظار جميع عمليات الجلب
    const userEntries = await Promise.all(fetchPromises);
    description += userEntries.join('');

    // إنشاء الـ Embed
    const embed = new EmbedBuilder()
        .setTitle(`<:Alarm:1429538046986158220> **Temporary Roles List**`)
        .setColor(process.env.Bluecolor)
        .setDescription(description)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setImage(process.env.BlueLine);

    // إنشاء أزرار التنقل
    const row = new ActionRowBuilder();

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('temprolelist_first')
            .setLabel('⏪ First')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(actualPage === 1)
    );

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('temprolelist_prev')
            .setLabel('◀️ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(actualPage === 1)
    );

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('temprolelist_next')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(actualPage === totalPages)
    );

    row.addComponents(
        new ButtonBuilder()
            .setCustomId('temprolelist_last')
            .setLabel('Last ⏩')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(actualPage === totalPages)
    );

    return {
        embeds: [embed],
        components: [row],
        totalPages: totalPages,
        usersArrayLength: usersArray.length
    };
}

// إعداد جامع الأزرار
function setupButtonCollector(message, client) {
    // إيقاف جامع قديم إذا كان موجوداً
    if (activeTempRoleCollectors.has(message.id)) {
        const oldCollector = activeTempRoleCollectors.get(message.id);
        if (!oldCollector.ended) {
            oldCollector.stop();
        }
        activeTempRoleCollectors.delete(message.id);
    }

    // إنشاء جامع جديد
    const collector = message.createMessageComponentCollector({ 
        filter: i => {
            const data = tempRoleListMessages.get(message.id);
            return data && i.user.id === data.userId;
        },
        time: 300000 // 5 دقائق
    });

    activeTempRoleCollectors.set(message.id, collector);

    collector.on('collect', async i => {
        try {
            await handleButtonInteraction(i, client);
        } catch (error) {
            console.error('Error in button collector:', error);
        }
    });

    collector.on('end', (collected, reason) => {
        console.log(`TempRoleList collector ended for message ${message.id}. Reason: ${reason}`);
        activeTempRoleCollectors.delete(message.id);
        tempRoleListMessages.delete(message.id);

        if (reason === 'time') {
            // تعطيل الأزرار عند انتهاء الوقت
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('temprolelist_first')
                    .setLabel('⏪ First')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('temprolelist_prev')
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('temprolelist_next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('temprolelist_last')
                    .setLabel('Last ⏩')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            message.edit({ components: [disabledRow] }).catch(console.error);
        }
    });
}

// دالة للتعامل مع تفاعلات الأزرار
async function handleButtonInteraction(interaction, client) {
    await interaction.deferUpdate();

    const data = tempRoleListMessages.get(interaction.message.id);
    if (!data) {
        await interaction.followUp({ content: 'Session expired. Please use the command again.', ephemeral: true });
        return;
    }

    let newPage = data.currentPage;

    switch(interaction.customId) {
        case 'temprolelist_first':
            newPage = 1;
            break;
        case 'temprolelist_prev':
            newPage = Math.max(1, data.currentPage - 1);
            break;
        case 'temprolelist_next':
            newPage = data.currentPage + 1;
            break;
        case 'temprolelist_last':
            newPage = data.totalPages;
            break;
        default:
            return;
    }

    // جلب الرول إذا كان هناك فلتر
    let roleFilter = null;
    if (data.roleFilter) {
        try {
            roleFilter = await interaction.guild.roles.fetch(data.roleFilter);
        } catch (error) {
            console.error('Error fetching role:', error);
            // استمر بدون فلتر إذا فشل جلب الرول
        }
    }

    // توليد الليست الجديدة
    const result = await showTempRolesList(interaction, client, data.guildId, roleFilter, newPage);

    // تحديث البيانات
    tempRoleListMessages.set(interaction.message.id, {
        ...data,
        currentPage: newPage,
        totalPages: result.totalPages
    });

    await interaction.editReply(result);
}