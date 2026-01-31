const { SlashCommandBuilder, AttachmentBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');

// تخزين رسالة اللايف ميسيج للسيرفر الواحد
let liveMessageData = null;
let updateInterval = null;
const CURRENT_GUILD_ID = process.env.GUILD_ID || "default_guild_id";

// إعدادات المرونة وإعادة المحاولة
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// دالة لتحميل أول 5 الحاليين من الداتابيز (من auto_roles table)
async function loadCurrentTop5FromDB() {
    try {
        const results = await queryWithRetry(`
            SELECT user_id, username, total_messages as total, position 
            FROM message_auto_roles
            WHERE guild_id = ? 
            ORDER BY position ASC
        `, [CURRENT_GUILD_ID]);

        console.log(`📂 Loaded ${results.length} users from message_auto_roles`);
        return results.map(row => ({
            id: row.user_id,
            username: row.username,
            total: row.total_messages || 0,
            position: row.position
        }));
    } catch (error) {
        console.error('Error loading current top 5 from database:', error);
        return [];
    }
}

// دالة للحصول على أول 5 أعضاء متاحين في السيرفر
async function getAvailableTopUsers(guild, limit = 15) {
    try {
        const users = await queryWithRetry(`
            SELECT user_id, username, sent as total 
            FROM message_stats 
            ORDER BY sent DESC 
            LIMIT ${limit}
        `);

        if (!users || users.length === 0) {
            return [];
        }

        const availableUsers = [];

        // التحقق من وجود كل عضو في السيرفر
        for (const user of users) {
            try {
                const member = await guild.members.fetch(user.user_id).catch(() => null);
                if (member) {
                    availableUsers.push({
                        id: user.user_id,
                        username: user.username,
                        total: user.total || 0
                    });
                }

                // إذا وصلنا لـ 5 أعضاء متاحين، نتوقف
                if (availableUsers.length >= 5) {
                    break;
                }
            } catch (error) {
                console.log(`⚠️ User ${user.user_id} not available in guild`);
                continue;
            }
        }

        console.log(`✅ Found ${availableUsers.length} available users`);
        return availableUsers;
    } catch (error) {
        console.error('Error getting available top users:', error);
        return [];
    }
}

// دالة للمقارنة بين قائمتين (بدون ترتيب)
function hasTop5Changed(previous, current) {
    if (previous.length !== current.length) return true;

    // تحويل المصفوفات لمجموعات من الـ IDs
    const previousIds = new Set(previous.map(user => user.id));
    const currentIds = new Set(current.map(user => user.id));

    // المقارنة بدون اهتمام بالترتيب
    if (previousIds.size !== currentIds.size) return true;

    for (const id of previousIds) {
        if (!currentIds.has(id)) return true;
    }

    return false;
}

// دالة لتحديث الرتب التلقائية (مش بتعتمد على الذاكرة)
async function updateAutoRoles(client) {
    try {
        const TOP_5_ROLE_ID = process.env.Top5Role;
        if (!TOP_5_ROLE_ID) {
            console.log('❌ Top5Role not set in environment variables');
            return;
        }

        const guild = client.guilds.cache.get(CURRENT_GUILD_ID);
        if (!guild) {
            console.log(`❌ Guild ${CURRENT_GUILD_ID} not found`);
            return;
        }

        const role = guild.roles.cache.get(TOP_5_ROLE_ID);
        if (!role) {
            console.log(`❌ Role ${TOP_5_ROLE_ID} not found`);
            return;
        }

        // جلب أول 5 أعضاء متاحين حالياً
        const currentAvailableTop5 = await getAvailableTopUsers(guild);

        if (currentAvailableTop5.length === 0) {
            console.log('ℹ️ No available users found for top 5 roles');
            return;
        }

        // تحميل أول 5 السابقين من الداتابيز
        const previousTop5 = await loadCurrentTop5FromDB();

        // التحقق مما إذا كان هناك تغيير
        const hasChanged = hasTop5Changed(previousTop5, currentAvailableTop5);

        // 🔍 DEBUG LOGS
        console.log('🔍 DEBUG - Previous Users:', previousTop5.map(u => u.username));
        console.log('🔍 DEBUG - Current Users:', currentAvailableTop5.map(u => u.username));
        console.log('🔍 DEBUG - Has Changed:', hasChanged);

        if (!hasChanged) {
            console.log('ℹ️ No changes in top 5 users, skipping updates');
            return;
        }

        console.log(`🔄 Top 5 changed:`, {
            from: previousTop5.map(u => u.username),
            to: currentAvailableTop5.map(u => u.username)
        });

        // الأعضاء الذين يجب إزالة الرتبة منهم
        const usersToRemove = previousTop5.filter(prevUser => 
            !currentAvailableTop5.some(currUser => currUser.id === prevUser.id)
        );

        // الأعضاء الذين يجب منحهم الرتبة
        const usersToAdd = currentAvailableTop5.filter(currUser => 
            !previousTop5.some(prevUser => prevUser.id === currUser.id)
        );

        // إزالة الرتبة
        for (const user of usersToRemove) {
            try {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member && member.roles.cache.has(TOP_5_ROLE_ID)) {
                    await member.roles.remove(role);
                    console.log(`🔻 Removed Top5 role from ${member.user.username}`);
                }
            } catch (error) {
                console.log(`❌ Could not remove role from user ${user.id}:`, error.message);
            }
        }

        // منح الرتبة
        for (const user of usersToAdd) {
            try {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member && !member.roles.cache.has(TOP_5_ROLE_ID)) {
                    await member.roles.add(role);
                    console.log(`🔺 Added Top5 role to ${member.user.username}`);
                }
            } catch (error) {
                console.log(`❌ Could not add role to user ${user.id}:`, error.message);
            }
        }

        console.log(`✅ Auto roles update completed`);

    } catch (error) {
        console.error('❌ Error in auto roles update:', error);
    }
}

// دالة لتحميل المستخدمين المرتبين حسب عدد الرسائل (لللايف ميسيج فقط)
async function getSortedUsers() {
    try {
        const users = await queryWithRetry(`
            SELECT user_id, username, sent as total 
            FROM message_stats 
            ORDER BY sent DESC 
            LIMIT 10
        `);
        return users.map(user => ({
            id: user.user_id,
            username: user.username,
            total: user.total || 0
        }));
    } catch (error) {
        console.error('Error getting sorted message users:', error);
        return [];
    }
}

// تنسيق الأرقام الكبيرة
function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// دالة لإنشاء تدرج لوني
function createGradient(ctx, x, y, width, height, colorStops) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    colorStops.forEach(stop => {
        gradient.addColorStop(stop.position, stop.color);
    });
    return gradient;
}

// دالة لإنشاء صورة الـ Live Message Leaderboard
async function createLiveMessageImage(users, client) {
    const width = 1100;
    const height = 800;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية ثابتة
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 0;
    ctx.strokeStyle = '#0073ff';
    ctx.lineWidth = 5;

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // العنوان
    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Top 10 Message Leaders', width / 2, 60);

    // إذا مفيش بيانات
    if (users.length === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No message records yet. Start chatting!', width / 2, height / 2);
        return canvas.toBuffer('image/png');
    }

    // عرض الأعضاء
    const startY = 100;
    const itemHeight = 65;
    const cornerRadius = 12;

    // دالة مساعدة لرسم مستطيل بحواف مستديرة
    function roundRect(x, y, width, height, radius) {
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

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const rank = i + 1;
        const y = startY + (i * itemHeight);

        // خلفية العنصر بحواف مستديرة
        ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#222222';
        roundRect(20, y, width - 40, itemHeight - 5, cornerRadius);
        ctx.fill();

        // إحداثيات العنصر
        const itemX = 20;
        const itemWidth = width - 40;
        const itemCenterX = itemX + itemWidth / 2;

        // الرتبة - متوسطة رأسياً ومتزنة أفقيًا
        ctx.textAlign = 'center';
        let rankColor = '#FFD700'; // دهبي افتراضي للكل

        // أول 5 ياخدوا تدرج لوني
        if (rank <= 5) {
            const gradient = createGradient(ctx, itemX + 30, y, 0, itemHeight, [
                { position: 0, color: '#ff0007' },   // أحمر من فوق
                { position: 1, color: '#5600ff' }    // أزرق من تحت
            ]);
            rankColor = gradient;
        }

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 24px Arial';
        ctx.fillText(`#${rank}`, itemX + 50, y + itemHeight / 2 + 10);

        // محاولة جلب صورة المستخدم
        try {
            const member = await client.guilds.cache.get(CURRENT_GUILD_ID)?.members.fetch(user.id).catch((error) => {
                console.log(`⚠️ Member ${user.id} (${user.username}) not found in guild, skipping avatar`);
                return null;
            });

            // إحداثيات الصورة - متوسطة رأسياً
            const avatarX = itemX + 120;
            const avatarY = y + itemHeight / 2;
            const avatarSize = 50;

            if (member) {
                const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 128 }));
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
                ctx.restore();
            } else {
                // صورة افتراضية
                ctx.fillStyle = '#444444';
                ctx.beginPath();
                ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        } catch (error) {
            console.error('Error loading avatar for', user.username, error);
            // صورة افتراضية في حالة الخطأ
            const avatarX = itemX + 120;
            const avatarY = y + itemHeight / 2;
            const avatarSize = 50;
            ctx.fillStyle = '#444444';
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // اسم المستخدم - متوسطة رأسياً
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'left';

        let displayName = user.username;
        if (displayName.length > 15) {
            displayName = displayName.substring(0, 15) + '...';
        }

        ctx.fillText(displayName, itemX + 155, y + itemHeight / 2 + 10);

        // عدد الرسائل - متوسطة رأسياً
        ctx.fillStyle = '#00FF88';
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${formatNumber(user.total)} Messages`, itemX + itemWidth - 30, y + itemHeight / 2 + 10);
    }

    return canvas.toBuffer('image/png');
}

// دالة لتحديث الـ Live Message Leaderboard
async function updateLiveMessage(client) {
    if (!liveMessageData) return false;

    try {
        const { channelId, messageId } = liveMessageData;
        const channel = await client.channels.fetch(channelId);

        if (!channel) {
            console.log('Channel not found');
            liveMessageData = null;
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'message');
            return false;
        }

        const users = await getSortedUsers();
        const buffer = await createLiveMessageImage(users, client);
        const attachment = new AttachmentBuilder(buffer, { name: 'message_leaderboard.png' });

        try {
            const message = await channel.messages.fetch(messageId);
            await message.edit({ files: [attachment] });

            console.log('✅ Live message leaderboard updated');
            return true;
        } catch (error) {
            console.log('Message not found:', error.message);
            liveMessageData = null;
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'message');
            return false;
        }

    } catch (error) {
        console.error('Error updating live message:', error.message);
        return false;
    }
}

// دالة للتحقق من التحديثات
async function checkForMessageUpdates(client) {
    try {
        if (!liveMessageData) return;
        await updateLiveMessage(client);
    } catch (error) {
        console.error('❌ Error checking for message updates:', error.message);
    }
}

// دالة لتحميل الـ live message من الداتابيز
async function loadLiveMessageMessage(client) {
    try {
        const liveData = await dbManager.getLiveLeaderboard(CURRENT_GUILD_ID, 'message');
        if (!liveData) return;

        try {
            const channel = await client.channels.fetch(liveData.channel_id);
            const message = await channel.messages.fetch(liveData.message_id);

            liveMessageData = {
                channelId: liveData.channel_id,
                messageId: liveData.message_id
            };

            console.log('✅ Loaded live message');

        } catch (error) {
            console.log('❌ Live message not found, deleting from DB');
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'message');
        }

    } catch (error) {
        console.error('Error loading live message:', error);
    }
}

// دالة الاتصال بالداتابيز مع إعادة المحاولة
async function queryWithRetry(sql, params = [], retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await dbManager.all(sql, params);
            return result;
        } catch (error) {
            console.log(`❌ Database query attempt ${attempt}/${retries} failed:`, error.message);
            if (attempt === retries) {
                console.log('💥 All retry attempts failed');
                return [];
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        }
    }
}

// بدء نظام الـ Live Message
function startLiveMessageSystem(client) {
    loadLiveMessageMessage(client).then(() => {
        if (updateInterval) clearInterval(updateInterval);

        updateInterval = setInterval(() => checkForMessageUpdates(client), 1800000);
        console.log('🚀 Live Message system started - checking every 30 minutes');

        setTimeout(() => checkForMessageUpdates(client), 5000);
    });
}

// دالة لاختبار التحديث يدوياً
async function forceMessageUpdate(client) {
    console.log('🔧 Force updating message leaderboard');
    return await updateLiveMessage(client);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('livemessage')
        .setDescription('Setup live message leaderboard in a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send live message updates')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('channel');

            if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
                return interaction.editReply({ content: 'I don\'t have permission to send messages in that channel!' });
            }

            const users = await getSortedUsers();
            const buffer = await createLiveMessageImage(users, interaction.client);
            const attachment = new AttachmentBuilder(buffer, { name: 'message_leaderboard.png' });

            const message = await channel.send({ files: [attachment] });

            // حفظ البيانات
            liveMessageData = {
                channelId: channel.id,
                messageId: message.id
            };

            // حفظ في الداتابيز
            await dbManager.saveLiveLeaderboard(CURRENT_GUILD_ID, 'message', channel.id, message.id);

            await interaction.editReply({ 
                content: `✅ Live message leaderboard has been setup in ${channel}! It will update every 30 minutes.` 
            });

            console.log(`✅ Live message setup in channel ${channel.id}`);

        } catch (error) {
            console.error('❌ Error setting up live message:', error.message);
            await interaction.editReply('❌ An error occurred while setting up the live message leaderboard.');
        }
    },

    startLiveMessageSystem,
    forceMessageUpdate,
    updateAutoRoles  // علشان تقدر تستدعيها من بره لو محتاج
};