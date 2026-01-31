const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');
const twemoji = require('twemoji');

// تخزين رسائل الليدر بورد وجامعي الأزرار
let leaderboardMessages = new Map();
let activeCollectors = new Map();

// دالة مساعدة لرسم مستطيل بحواف مستديرة
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}

// caching للإيموجي
const emojiCache = new Map();
async function drawEmoji(ctx, emoji, x, y, size) {
    try {
        let image;
        if (emojiCache.has(emoji)) {
            image = emojiCache.get(emoji);
        } else {
            const codepoint = twemoji.convert.toCodePoint(emoji);
            const url = `https://twemoji.maxcdn.com/v/latest/72x72/${codepoint}.png`;
            image = await loadImage(url);
            emojiCache.set(emoji, image);
        }
        ctx.drawImage(image, x, y, size, size);
    } catch (error) {
        console.warn(`Failed to load emoji: ${emoji}`, error);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${size}px Arial`;
        ctx.fillText(emoji, x, y + size);
    }
}

// ترتيب المستخدمين
async function getSortedUsers() {
    try {
        const users = await dbManager.all('SELECT * FROM shame_points ORDER BY total DESC');
        return users.map(user => ({
            id: user.user_id,
            username: user.username,
            giveaway_ban: user.giveaway_ban,
            warns: user.warns,
            total: user.total
        }));
    } catch (error) {
        console.error('Error getting sorted users:', error);
        return [];
    }
}

// إنشاء صورة الليدر بورد
async function createLeaderboardImage(sortedUsers, page = 0, perPage = 10) {
    const width = 1100;
    const height = 1150;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة حمراء داكنة - ستايل يناسب العار
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#1a0000');
    bgGradient.addColorStop(0.5, '#2a0000');
    bgGradient.addColorStop(1, '#1a0000');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 0; // المسافة من الحواف
    ctx.strokeStyle = '#8B0000'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // العنوان الرئيسي
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Hall Of Shame Leaderboard', width / 2, 80);

    // مسافة بين العنوان والهيدر
    const headerY = 130;

    // الهيدر - الأعمدة
    const columnWidths = [80, 300, 200, 200, 200];
    const columnHeaders = ['Rank', 'Member', 'Total', 'Giveaway Bans', 'Warnings'];
    const headerEmojis = ['', '', '🥀', '🚫', '⚠'];

    // خلفية الهيدر
    ctx.fillStyle = '#8B000020';
    drawRoundedRect(ctx, 30, headerY, width - 60, 80, 10);
    ctx.fill();

    // إطار الهيدر
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 30, headerY, width - 60, 80, 10);
    ctx.stroke();

    // كتابة عناوين الأعمدة مع الايموجي فوق والنص تحت
    let currentX = 50;
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';

    for (let i = 0; i < columnHeaders.length; i++) {
        if (i === 0) {
            // عمود الرتبة - نص فقط
            ctx.fillText(columnHeaders[i], currentX + (columnWidths[i] / 2), headerY + 50);
            currentX += columnWidths[i];
        } else if (i === 1) {
            // عمود اللاعب - نص فقط
            ctx.fillText(columnHeaders[i], currentX + (columnWidths[i] / 2), headerY + 50);
            currentX += columnWidths[i];
        } else {
            // الأعمدة الأخرى - ايموجي فوق والنص تحت
            const emoji = headerEmojis[i];
            const text = columnHeaders[i];
            const centerX = currentX + (columnWidths[i] / 2);

            // رسم الايموجي في الأعلى
            await drawEmoji(ctx, emoji, centerX - 18, headerY + 12, 35);

            // رسم النص تحت الايموجي
            ctx.fillText(text, centerX, headerY + 70);

            currentX += columnWidths[i];
        }
    }

    // بيانات اللاعبين
    const startIdx = page * perPage;
    const endIdx = startIdx + perPage;
    const pageData = sortedUsers.slice(startIdx, endIdx);
    const totalPages = Math.ceil(sortedUsers.length / perPage);

    // إذا مفيش بيانات
    if (pageData.length === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No data available yet', width / 2, height / 2);
        return canvas.toBuffer('image/png');
    }

    // رسم كل لاعب في الجدول
    const startY = headerY + 110;
    const rowHeight = 75;

    for (let i = 0; i < pageData.length; i++) {
        const user = pageData[i];
        const rank = startIdx + i + 1;
        const gap = 10; // المسافة بين الصفوف
        const y = startY + (i * (rowHeight + gap));

        // خلفية الصف
        ctx.fillStyle = rank <= 3 ? '#8B000010' : '#00000020';
        drawRoundedRect(ctx, 30, y, width - 60, rowHeight, 8);
        ctx.fill();

        // إطار الصف
        ctx.strokeStyle = rank === 1 ? '#8B0000' : 
                         rank === 2 ? '#B22222' : 
                         rank === 3 ? '#DC143C' : '#FFFFFF10';
        ctx.lineWidth = 1;
        drawRoundedRect(ctx, 30, y, width - 60, rowHeight, 8);
        ctx.stroke();

        currentX = 50;

        // عمود الرتبة - أرقام عادية ملونة
        let rankColor = '#FFFFFF';
        if (rank === 1) rankColor = '#8B0000'; // أحمر داكن
        else if (rank === 2) rankColor = '#B22222'; // أحمر ناري
        else if (rank === 3) rankColor = '#DC143C'; // قرمزي

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        const rankText = rank.toString();
        ctx.fillText(rankText, currentX + (columnWidths[0] / 2), y + 42);
        currentX += columnWidths[0];

        // عمود اللاعب (الاسم) - توسيط
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        let username = user.username || `User ${user.id}`;
        if (ctx.measureText(username).width > 230) {
            while (ctx.measureText(username + '...').width > 230 && username.length > 3) {
                username = username.slice(0, -1);
            }
            username += '...';
        }
        ctx.fillText(username, currentX + (columnWidths[1] / 2), y + 42);
        currentX += columnWidths[1];

        // الأعمدة الرقمية - ايموجي فوق والرقم تحت
        const stats = [
            user.total || 0,
            user.giveaway_ban || 0,
            user.warns || 0
        ];

        ctx.textAlign = 'center';

        for (let j = 0; j < stats.length; j++) {
            const centerX = currentX + (columnWidths[j + 2] / 2);

            // رسم الرقم تحت الايموجي
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 28px Arial';
            ctx.fillText(stats[j].toString(), centerX, y + 45);

            currentX += columnWidths[j + 2];
        }

        /*// خط فاصل بين الصفوف
        if (i < pageData.length - 1) {
            ctx.strokeStyle = '#FFFFFF10';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(50, y + rowHeight);
            ctx.lineTo(width - 50, y + rowHeight);
            ctx.stroke();
        }*/
    }

    // معلومات الصفحة في الأسفل
    const footerY = height - 30;
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${page + 1} of ${totalPages} • ${sortedUsers.length} Member/s`, width / 2, footerY);

    /*// خط فاصل فوق الفوتر
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, footerY - 30);
    ctx.lineTo(width - 100, footerY - 30);
    ctx.stroke();*/

    return canvas.toBuffer('image/png');
}

// إنشاء صورة الخطأ
async function createErrorImage(title, message) {
    const width = 600;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const errorGradient = ctx.createLinearGradient(0, 0, width, height);
    errorGradient.addColorStop(0, '#1a0f0f');
    errorGradient.addColorStop(1, '#2a1a1a');
    ctx.fillStyle = errorGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    await drawEmoji(ctx, '❌', width / 2 - 20, 40, 40);

    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 100);

    ctx.fillStyle = '#CCCCCC';
    ctx.font = '16px Arial';

    const words = message.split(' ');
    let line = '';
    let y = 130;
    const maxWidth = width - 100;

    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, width / 2, y);
            line = word + ' ';
            y += 25;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, width / 2, y);

    return canvas.toBuffer('image/png');
}

// إنشاء أزرار التنقل
function createActionRow(currentPage, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('◀️ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('check_stats')
            .setLabel('Find Me')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔍'),
        new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );
}

// إعداد جامع الأزرار
function setupButtonCollector(message, interaction) {
    if (activeCollectors.has(message.id)) {
        const oldCollector = activeCollectors.get(message.id);
        if (!oldCollector.ended) {
            oldCollector.stop();
        }
        activeCollectors.delete(message.id);
    }

    const collector = message.createMessageComponentCollector({ 
        filter: i => i.user.id === interaction.user.id,
        time: 300000
    });

    activeCollectors.set(message.id, collector);

    collector.on('collect', async i => {
        try {
            if (i.customId === 'check_stats') {
                await i.deferReply({ ephemeral: true });

                try {
                    const userStats = await dbManager.get('SELECT * FROM shame_points WHERE user_id = ?', [i.user.id]);

                    if (!userStats) {
                        return await i.followUp({ 
                            content: '✅ Clean record! You dont have any shame points.', 
                            ephemeral: true 
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x8B0000)
                        .setDescription(`**<:Shame:1412839253544534087> Hall of Shame statistics:**`)
                        .setThumbnail(i.user.displayAvatarURL({ dynamic: true, size: 128 }))
                        .addFields(
                            { name: '🥀 Total Points', value: `\`${userStats.total || 0}\``, inline: true },
                            { name: '🚫 Giveaway Bans', value: `\`${userStats.giveaway_ban || 0}\``, inline: true },
                            { name: '⚠️ Warnings', value: `\`${userStats.warns || 0}\``, inline: true }
                        );

                    await i.followUp({ embeds: [embed], ephemeral: true });

                } catch (error) {
                    console.error('Error in Find Me:', error);
                    await i.followUp({ 
                        content: '❌ Error loading your stats. Please try again later.', 
                        ephemeral: true 
                    });
                }

            } else if (i.customId === 'prev_page' || i.customId === 'next_page') {
                await i.deferUpdate();

                const currentData = leaderboardMessages.get(message.id);
                if (!currentData) {
                    await i.followUp({ content: 'Session expired, Please use the command again.', ephemeral: true });
                    return;
                }

                let newPage = currentData.currentPage;

                if (i.customId === 'prev_page') {
                    newPage = Math.max(0, newPage - 1);
                } else {
                    newPage = Math.min(currentData.totalPages - 1, newPage + 1);
                }

                const buffer = await createLeaderboardImage(currentData.sortedUsers, newPage);
                const attachment = new AttachmentBuilder(buffer, { name: 'shame_leaderboard.png' });
                const row = createActionRow(newPage, currentData.totalPages);

                leaderboardMessages.set(message.id, {
                    ...currentData,
                    currentPage: newPage
                });

                await i.editReply({ files: [attachment], components: [row] });
                // إزالة هذا السطر - لا تعيد إنشاء الـ collector
                // setupButtonCollector(message, interaction);
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
        leaderboardMessages.delete(message.id);

        if (reason === 'time') {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('◀️ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('check_stats')
                    .setLabel('Find Me')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔍')
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            message.edit({ components: [disabledRow] }).catch(console.error);
        }
    });
}

// تحديث جميع الليدر بوردات النشطة
async function updateAllLeaderboards() {
    for (const [messageId, data] of leaderboardMessages.entries()) {
        try {
            const channel = data.channel;
            const message = await channel.messages.fetch(messageId);
            const buffer = await createLeaderboardImage(data.sortedUsers, data.currentPage);
            const attachment = new AttachmentBuilder(buffer, { name: 'shame_leaderboard.png' });

            const row = createActionRow(data.currentPage, data.totalPages);
            await message.edit({ files: [attachment], components: [row] });
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            leaderboardMessages.delete(messageId);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shameleaderboard')
        .setDescription('Display Hall Of Shame leaderboard'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const sortedUsers = await getSortedUsers();

            if (sortedUsers.length === 0) {
                const buffer = await createErrorImage('Clean Records', 'No shame data available yet. Everyone is clean!');
                const attachment = new AttachmentBuilder(buffer, { name: 'shame_leaderboard.png' });
                return interaction.editReply({ files: [attachment] });
            }

            const buffer = await createLeaderboardImage(sortedUsers, 0);
            const attachment = new AttachmentBuilder(buffer, { name: 'shame_leaderboard.png' });
            const row = createActionRow(0, Math.ceil(sortedUsers.length / 10));

            const message = await interaction.editReply({ files: [attachment], components: [row] });

            leaderboardMessages.set(message.id, {
                channel: message.channel,
                sortedUsers: sortedUsers,
                currentPage: 0,
                totalPages: Math.ceil(sortedUsers.length / 10)
            });

            setupButtonCollector(message, interaction);
        } catch (error) {
            console.error('Error:', error);
            const buffer = await createErrorImage('Error', 'An error occurred while loading leaderboard.');
            const attachment = new AttachmentBuilder(buffer, { name: 'shame_leaderboard.png' });
            await interaction.editReply({ files: [attachment] });
        }
    },

    updateAllLeaderboards
};