const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { google } = require('googleapis');

// إعداد الاتصال بجوجل شيت
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID = process.env.WISHLIST_SHEET;

// متغير علشان نخزن آخر بيانات
let cachedData = [];
let activeCollectors = new Map();
let messageOwners = new Map();
let currentPages = new Map();
let messageChannels = new Map();

// كاش للصور المحملة مسبقاً
const imageCache = {
    starImage: null,
    defaultAvatars: new Map()
};

// تحميل الصور مسبقاً
async function preloadImages() {
    try {
        if (!imageCache.starImage) {
            imageCache.starImage = await loadImage('https://cdn.discordapp.com/attachments/1391115389718761565/1428924731058294879/Stars.png?ex=68f7911c&is=68f63f9c&hm=9b5fe48f7fbdbc899a7477114eac9a677f12316af8ab4ac4365081025dc64038&');
        }
    } catch (error) {
        console.error('Error preloading images:', error);
    }
}

// دالة مساعدة لرسم مستطيل بزوايا مدورة
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// دالة لجلب البيانات من جوجل شيت
async function fetchData() {
    try {
        const sheetsService = google.sheets({ version: 'v4', auth });

        const response = await sheetsService.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'A3:A',
        });

        const rows = response.data.values || [];
        return rows.filter(row => row[0] && row[0].trim() !== '').map(row => row[0].trim());
    } catch (error) {
        console.error('Error fetching data:', error);
        return cachedData;
    }
}

// دالة لإنشاء الصورة مع تحسينات الأداء
async function createLeaderboardImage(data, page = 0, guild) {
    const perPage = 8;
    const reversedData = [...data].reverse();
    const totalPages = Math.ceil(reversedData.length / perPage);
    const startIdx = page * perPage;
    const pageData = reversedData.slice(startIdx, startIdx + perPage);

    const width = 600;
    const height = 650;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية ثابتة بدل التدرج
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 0; // المسافة من الحواف
    ctx.strokeStyle = '#0073ff'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // العنوان بدون صورة النجمة
    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';

    const text = 'Wishlist Leaderboard';
    ctx.fillText(text, width / 2, 60);

    // الفوتر
    ctx.fillStyle = '#666666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${page + 1} of ${totalPages} | ${reversedData.length} Members`, width / 2, height - 30);

    // إذا مفيش بيانات
    if (pageData.length === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.fillText('No records found at this time', width / 2, height / 2);
        return { buffer: canvas.toBuffer('image/png'), totalPages };
    }

    // عرض الأعضاء مع تحسينات الأداء
    const startY = 100;
    const itemHeight = 60;
    const avatarSize = 40;
    const cornerRadius = 12; // نصف قطر الزوايا المدورة

    // جلب الأفاتارات دفعة واحدة
    const avatarPromises = pageData.map(async (username, i) => {
        if (!guild) return null;

        try {
            const members = await guild.members.fetch({ query: username, limit: 1 });
            const member = members.first();
            return member ? member.user.displayAvatarURL({ extension: 'png', size: 64 }) : null;
        } catch (error) {
            console.error('Error fetching member:', username, error);
            return null;
        }
    });

    const avatarUrls = await Promise.all(avatarPromises);

    // رسم العناصر
    for (let i = 0; i < pageData.length; i++) {
        const username = pageData[i];
        const rankNumber = reversedData.length - (startIdx + i);
        const y = startY + (i * itemHeight);

        // خلفية العنصر بزوايا مدورة
        ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#222222';
        drawRoundedRect(ctx, 20, y, width - 40, itemHeight - 10, cornerRadius);
        ctx.fill();

        // الرتبة
        const rankText = `#${rankNumber}`;
        ctx.fillStyle = '#0073ff';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'left';
        const rankWidth = ctx.measureText(rankText).width;
        const rankX = 30;
        ctx.fillText(rankText, rankX, y + 35);

        // الأفاتار
        const avatarX = rankX + rankWidth + 25;

        try {
            const avatarUrl = avatarUrls[i];
            if (avatarUrl) {
                // استخدام الكاش للأفاتارات
                let avatarImage = imageCache.defaultAvatars.get(avatarUrl);
                if (!avatarImage) {
                    avatarImage = await loadImage(avatarUrl);
                    imageCache.defaultAvatars.set(avatarUrl, avatarImage);

                    // تنظيف الكاش إذا زاد عن حد معين
                    if (imageCache.defaultAvatars.size > 50) {
                        const firstKey = imageCache.defaultAvatars.keys().next().value;
                        imageCache.defaultAvatars.delete(firstKey);
                    }
                }

                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX, y + 25, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatarImage, avatarX - avatarSize / 2, y + 25 - avatarSize / 2, avatarSize, avatarSize);
                ctx.restore();
            } else {
                // صورة افتراضية
                ctx.fillStyle = '#444444';
                ctx.beginPath();
                ctx.arc(avatarX, y + 25, avatarSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } catch (error) {
            console.error('Error loading avatar for', username, error);
            ctx.fillStyle = '#444444';
            ctx.beginPath();
            ctx.arc(avatarX, y + 25, avatarSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // الاسم
        const nameX = avatarX + avatarSize / 2 + 15;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';

        let displayName = username;
        const maxNameWidth = width - nameX - 40;

        let nameWidth = ctx.measureText(displayName).width;
        if (nameWidth > maxNameWidth) {
            while (displayName.length > 3 && nameWidth > maxNameWidth) {
                displayName = displayName.substring(0, displayName.length - 4) + '...';
                nameWidth = ctx.measureText(displayName).width;
            }
        }

        ctx.fillText(displayName, nameX, y + 35);
    }

    return { buffer: canvas.toBuffer('image/png'), totalPages };
}

// دالة للتحقق من وجود المستخدم
async function checkUserExistence(interaction) {
    try {
        const username = interaction.user.username;
        const isInList = cachedData.some(name => 
            name.trim().toLowerCase() === username.toLowerCase()
        );

        if (isInList) {
            await interaction.reply({ 
                content: '✅ **You are on the wishlist!**', 
                ephemeral: true 
            });
        } else {
            await interaction.reply({ 
                content: '❌ **You are not on the wishlist!**', 
                ephemeral: true 
            });
        }

    } catch (error) {
        console.error('Error checking user existence:', error);
        await interaction.reply({ 
            content: '⚠️ An error occurred while checking the list.', 
            ephemeral: true 
        });
    }
}

// دالة لإنشاء الأزرار
function createButtons(currentPage, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev_wishpage')
            .setLabel('◀️ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('check_wishlist')
            .setLabel('🔍 Find Me')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('next_wishpage')
            .setLabel('▶️ Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );
}

// التحديث التلقائي مع تحسينات
setInterval(async () => {
    try {
        const newData = await fetchData();

        if (JSON.stringify(newData) !== JSON.stringify(cachedData)) {
            console.log('Data changed, updating cached data');
            cachedData = newData;

            // تحديث الرسائل بشكل غير متزامن
            const updatePromises = Array.from(messageChannels.entries()).map(async ([messageId, channel]) => {
                try {
                    const message = await channel.messages.fetch(messageId);
                    if (!message) {
                        cleanupMessageData(messageId);
                        return;
                    }

                    const currentPage = currentPages.get(messageId) || 0;
                    const { buffer, totalPages } = await createLeaderboardImage(cachedData, currentPage, channel.guild);
                    const attachment = new AttachmentBuilder(buffer, { name: 'wishlist.png' });
                    const row = createButtons(currentPage, totalPages);

                    await message.edit({ files: [attachment], components: [row] });
                } catch (error) {
                    console.error(`Error updating message ${messageId}:`, error);
                    if (error.code === 10008) {
                        cleanupMessageData(messageId);
                    }
                }
            });

            await Promise.allSettled(updatePromises);
        }
    } catch (error) {
        console.error('Error in auto-update:', error);
    }
}, 60000); // زدنا الوقت علشان نخفف الضغط

// دالة لتنظيف البيانات
function cleanupMessageData(messageId) {
    messageOwners.delete(messageId);
    currentPages.delete(messageId);
    messageChannels.delete(messageId);
    const collector = activeCollectors.get(messageId);
    if (collector) {
        collector.stop();
        activeCollectors.delete(messageId);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wishlistleaderboard')
        .setDescription('Shows Live Wishlist Leaderboard'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // تحميل الصور مسبقاً
            await preloadImages();

            const currentData = await fetchData();
            cachedData = currentData;

            // إنشاء الصورة والأزرار
            const { buffer, totalPages } = await createLeaderboardImage(currentData, 0, interaction.guild);
            const attachment = new AttachmentBuilder(buffer, { name: 'wishlist.png' });
            const row = createButtons(0, totalPages);

            const sentMessage = await interaction.editReply({ 
                files: [attachment], 
                components: [row] 
            });

            // حفظ البيانات
            messageOwners.set(sentMessage.id, interaction.user.id);
            messageChannels.set(sentMessage.id, interaction.channel);
            currentPages.set(sentMessage.id, 0);

            // إعداد جامع الأزرار
            this.setupButtonCollector(sentMessage);

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply('⚠️ An error occurred while fetching data from Google Sheets.');
        }
    },

    // إعداد جامع الأزرار
    setupButtonCollector(message) {
        if (activeCollectors.has(message.id)) {
            activeCollectors.get(message.id).stop();
        }

        const collector = message.createMessageComponentCollector({ 
            filter: i => {
                if (i.customId === 'check_wishlist') return true;
                const ownerId = messageOwners.get(message.id);
                return i.user.id === ownerId;
            },
            time: 300000 // 5 دقائق
        });

        activeCollectors.set(message.id, collector);

        collector.on('collect', async i => {
            try {
                if (i.customId === 'check_wishlist') {
                    await checkUserExistence(i);
                }
                else if (i.customId === 'prev_wishpage' || i.customId === 'next_wishpage') {
                    await i.deferUpdate();

                    let currentPage = currentPages.get(message.id) || 0;

                    if (i.customId === 'prev_wishpage') {
                        currentPage = Math.max(0, currentPage - 1);
                    } else {
                        const totalPages = Math.ceil(cachedData.length / 8);
                        currentPage = Math.min(totalPages - 1, currentPage + 1);
                    }

                    currentPages.set(message.id, currentPage);

                    const { buffer, totalPages } = await createLeaderboardImage(cachedData, currentPage, i.guild);
                    const attachment = new AttachmentBuilder(buffer, { name: 'wishlist.png' });
                    const row = createButtons(currentPage, totalPages);

                    await i.editReply({ files: [attachment], components: [row] });
                }
            } catch (error) {
                console.error('Error in button interaction:', error);
                if (error.code === 10062) return;

                try {
                    await i.followUp({ 
                        content: '⚠️ An error occurred while processing your request.', 
                        ephemeral: true 
                    });
                } catch (e) {}
            }
        });

        collector.on('end', (collected, reason) => {
            cleanupMessageData(message.id);
        });
    }
};