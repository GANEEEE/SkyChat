const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');

// تخزين رسائل الليست وجامعي الأزرار
let verifyListMessages = new Map();
let activeCollectors = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verifylist')
        .setDescription('List all verified Steam accounts with pagination')
        .addStringOption(option =>
            option
                .setName('status')
                .setDescription('Filter by verification status')
                .setRequired(false)
                .addChoices(
                    { name: '✅ Verified', value: 'verified' },
                    { name: '🔄 Pending', value: 'pending' },
                    { name: '📋 All', value: 'all' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page number (default: 1)')
                .setRequired(false)
                .setMinValue(1)
        )
        .addIntegerOption(option =>
            option
                .setName('limit')
                .setDescription('Results per page (1-25, default: 10)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(25)
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        try {
            // جلب Moderate Role من قاعدة البيانات
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
                    .setDescription('No moderate role is configured. Please set a moderate role first using `/setrole`.');
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

            // الحصول على خيارات البحث
            const status = interaction.options.getString('status') || 'verified';
            const page = interaction.options.getInteger('page') || 1;
            const limit = interaction.options.getInteger('limit') || 10;

            // عرض الليست
            const result = await this.generateListEmbed(status, page, limit);

            const message = await interaction.editReply(result);

            // حفظ حالة الرسالة
            verifyListMessages.set(message.id, {
                channel: message.channel,
                userId: interaction.user.id,
                status: status,
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(result.totalRecords / limit)
            });

            // إعداد جامع الأزرار
            this.setupButtonCollector(message, interaction);

        } catch (error) {
            console.error('Error in verifylist command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription(`An error occurred while retrieving the list: \`${error.message}\``);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // دالة لتوليد الـ Embed مع الأزرار
    async generateListEmbed(status, page, limit) {
        try {
            // حساب الإزاحة
            const offset = (page - 1) * limit;

            // بناء استعلام SQL بناءً على الحالة
            let countQuery, dataQuery;
            let countParams = [], dataParams = [];

            if (status === 'all') {
                countQuery = 'SELECT COUNT(*) as total FROM discord_verify_steam';
                dataQuery = `
                    SELECT * FROM discord_verify_steam 
                    ORDER BY 
                        CASE WHEN status = 'verified' THEN 1 ELSE 2 END,
                        updated_at DESC
                    LIMIT ? OFFSET ?
                `;
                dataParams = [limit, offset];
            } else {
                countQuery = 'SELECT COUNT(*) as total FROM discord_verify_steam WHERE status = ?';
                countParams = [status];

                dataQuery = `
                    SELECT * FROM discord_verify_steam 
                    WHERE status = ?
                    ORDER BY updated_at DESC
                    LIMIT ? OFFSET ?
                `;
                dataParams = [status, limit, offset];
            }

            // جلب العدد الكلي والبيانات
            const countResult = await dbManager.get(countQuery, countParams);
            const totalRecords = parseInt(countResult.total);

            // إرجاع رسالة إذا لم توجد سجلات
            if (totalRecords === 0) {
                return {
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('📋 No Records Found')
                            .setImage(process.env.RedLine)
                            .setDescription(`No ${status === 'all' ? 'records' : status + ' accounts'} found in the database.`)
                    ],
                    components: []
                };
            }

            const records = await dbManager.all(dataQuery, dataParams);
            const totalPages = Math.ceil(totalRecords / limit);
            const currentPage = Math.min(Math.max(page, 1), totalPages);

            // حساب إحصائيات
            const statsQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
                FROM discord_verify_steam
            `;
            const stats = await dbManager.get(statsQuery);

            // بناء الوصف بشكل منسق
            let description = `\n**📊 Verification Statistics**\n`;
            description += `\`✅\` Verified: **${stats.verified_count}** • \`🔄\` Pending: **${stats.pending_count}** • \`📊\` Total: **${stats.total}**\n\n`;

            description += `**📄 Current Filter:** \`${status.charAt(0).toUpperCase() + status.slice(1)}\`\n`;
            description += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            records.forEach((record, index) => {
                const globalIndex = offset + index + 1;

                // تنسيق الحالة
                let statusEmoji;
                if (record.status === 'verified') {
                    statusEmoji = '✅';
                } else if (record.status === 'pending') {
                    statusEmoji = '🔄';
                } else if (record.status === 'manual') {
                    statusEmoji = '🔧';
                } else {
                    statusEmoji = '❓';
                }

                // تنسيق Steam Info
                const steamName = record.steam_name 
                    ? `**${record.steam_name}**` 
                    : '*Unnamed Account*';

                // تنسيق Discord Info
                const discordInfo = record.discord_id 
                    ? `<@${record.discord_id}>`
                    : '`Not Linked`';

                // تنسيق التواريخ
                const verifiedTime = record.verified_at 
                    ? `<t:${Math.floor(new Date(record.verified_at).getTime() / 1000)}:F>`
                    : '`Not Verified`';

                const addedTime = `<t:${Math.floor(new Date(record.added_at).getTime() / 1000)}:F>`;

                description += `**${globalIndex}) ${discordInfo}** | ${statusEmoji}\n`;
                description += `┣ **Steam ID:** \`${record.steam_id || 'N/A'}\`\n`;
                description += `┣ **Status:** \`${record.status.toUpperCase()}\`\n`;

                if (record.steam_profile_url && record.steam_profile_url !== '#') {
                    description += `┗ **Profile:** [Click Me](${record.steam_profile_url})\n`;
                } else {
                    description += `┗ **Profile:** \`No URL\`\n`;
                }

                description += `\n`;
            });

            // إضافة معلومات الصفحة في نهاية الوصف
            description += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            description += `**📖 Showing** \`${records.length}\` **of** \`${totalRecords}\` **accounts**`;

            // إنشاء الـ Embed
            const embed = new EmbedBuilder()
                .setTitle(`📋 Steam Verification List`)
                .setColor(process.env.Bluecolor || '#0099FF')
                .setDescription(description)
                .setImage(process.env.BlueLine || null)
                .setFooter({ 
                    text: `Page ${currentPage}/${totalPages} | ${totalRecords} Total Accounts`,
                    iconURL: process.env.BotProfile // أو استخدام أيقونة السيرفر إذا متوفرة
                });

            // إنشاء أزرار التنقل
            const row = new ActionRowBuilder();

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('verifylist_first')
                    .setLabel('⏮️ First')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 1)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('verifylist_prev')
                    .setLabel('◀️ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage <= 1)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('verifylist_next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage >= totalPages)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('verifylist_last')
                    .setLabel('Last ⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages)
            );

            return {
                embeds: [embed],
                components: [row],
                totalRecords: totalRecords,
                totalPages: totalPages
            };

        } catch (error) {
            console.error('Error generating list embed:', error);
            throw error;
        }
    },

    // إعداد جامع الأزرار
    setupButtonCollector(message, originalInteraction) {
        // إيقاف جامع قديم إذا كان موجوداً
        if (activeCollectors.has(message.id)) {
            const oldCollector = activeCollectors.get(message.id);
            if (!oldCollector.ended) {
                oldCollector.stop();
            }
            activeCollectors.delete(message.id);
        }

        // إنشاء جامع جديد
        const collector = message.createMessageComponentCollector({ 
            filter: i => {
                const data = verifyListMessages.get(message.id);
                return data && i.user.id === data.userId;
            },
            time: 300000 // 5 دقائق
        });

        activeCollectors.set(message.id, collector);

        collector.on('collect', async i => {
            try {
                await i.deferUpdate();

                const data = verifyListMessages.get(message.id);
                if (!data) {
                    await i.followUp({ content: 'Session expired. Please use the command again.', ephemeral: true });
                    return;
                }

                let newPage = data.currentPage;

                switch(i.customId) {
                    case 'verifylist_first':
                        newPage = 1;
                        break;
                    case 'verifylist_prev':
                        newPage = Math.max(1, data.currentPage - 1);
                        break;
                    case 'verifylist_next':
                        newPage = Math.min(data.totalPages, data.currentPage + 1);
                        break;
                    case 'verifylist_last':
                        newPage = data.totalPages;
                        break;
                }

                if (newPage !== data.currentPage) {
                    const result = await this.generateListEmbed(data.status, newPage, data.limit);

                    await i.editReply(result);

                    // تحديث البيانات
                    verifyListMessages.set(message.id, {
                        ...data,
                        currentPage: newPage,
                        totalPages: result.totalPages
                    });
                }

            } catch (error) {
                console.error('Error handling button interaction:', error);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
                }
            }
        });

        collector.on('end', (collected, reason) => {
            console.log(`Collector ended for message ${message.id}. Reason: ${reason}`);
            activeCollectors.delete(message.id);
            verifyListMessages.delete(message.id);

            if (reason === 'time') {
                // تعطيل الأزرار عند انتهاء الوقت
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('verifylist_first')
                        .setLabel('⏮️ First')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('verifylist_prev')
                        .setLabel('◀️ Prev')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('verifylist_next')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('verifylist_last')
                        .setLabel('Last ⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                message.edit({ components: [disabledRow] }).catch(console.error);
            }
        });
    }
};