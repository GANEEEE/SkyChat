const { EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

const CURRENT_GUILD_ID = process.env.GUILD_ID || "default_guild_id";
const TOP_5_ROLE_ID = process.env.Top5Role;

// إعدادات المرونة وإعادة المحاولة
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
let isProcessing = false;

// 🔥 إضافة Singleton علشان منع التكرار
let systemStarted = false;

// دالة لتحميل أول 5 الحاليين من الداتابيز
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

// دالة لحفظ أول 5 جدد في الداتابيز
async function saveCurrentTop5ToDB(top5Users) {
    try {
        // مسح البيانات القديمة
        await queryWithRetry('DELETE FROM message_auto_roles WHERE guild_id = ?', [CURRENT_GUILD_ID]);

        // حفظ البيانات الجديدة
        for (let i = 0; i < top5Users.length; i++) {
            await queryWithRetry(
                `INSERT INTO message_auto_roles (guild_id, user_id, username, total_messages, position) 
                 VALUES (?, ?, ?, ?, ?)`,
                [CURRENT_GUILD_ID, top5Users[i].id, top5Users[i].username, top5Users[i].total, i + 1]
            );
        }
        //console.log(`💾 Saved ${top5Users.length} users to message_auto_roles`);
    } catch (error) {
        console.error('Error saving top 5 to database:', error);
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
        console.log(`🔍 Checking top ${users.length} users from message_stats...`);

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
                    console.log(`✅ Available: ${user.username} (${user.total} messages)`);
                } else {
                    console.log(`🚫 Not in guild: ${user.username}`);
                }

                // إذا وصلنا لـ 5 أعضاء متاحين، نتوقف
                if (availableUsers.length >= 5) {
                    console.log(`🎯 Reached 5 available users, stopping search`);
                    break;
                }
            } catch (error) {
                console.log(`⚠️ Error checking user ${user.user_id}:`, error.message);
                continue;
            }
        }

        console.log(`✅ Final: Found ${availableUsers.length} available users`);
        console.log(`📋 Available users:`, availableUsers.map(u => u.username));
        return availableUsers;
    } catch (error) {
        console.error('Error getting available top users:', error);
        return [];
    }
}

// دالة للمقارنة بين قائمتين
function hasTop5Changed(previous, current) {
    if (previous.length !== current.length) {
        console.log('🔄 Change detected: Different lengths');
        return true;
    }

    // الطريقة الصح للمقارنة (بدون ترتيب)
    const previousIds = new Set(previous.map(user => user.id));
    const currentIds = new Set(current.map(user => user.id));

    // إذا عدد الـ IDs مختلف
    if (previousIds.size !== currentIds.size) {
        console.log('🔄 Change detected: Different ID sets');
        return true;
    }

    // إذا أي ID في previous مش موجود في current
    for (const id of previousIds) {
        if (!currentIds.has(id)) {
            console.log(`🔄 Change detected: ID ${id} missing in current`);
            return true;
        }
    }

    console.log('✅ No changes detected: Same users');
    return false;
}

// الدالة الرئيسية لتحديث الرتب
async function updateMessageRoles(client) {
    if (isProcessing) {
        console.log('ℹ️ Another role update is already in progress, skipping...');
        return;
    }

    isProcessing = true;

    try {
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
            console.log(`❌ Role ${TOP_5_ROLE_ID} not found in guild`);
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

        //console.log('🔍 DEBUG - Previous IDs:', previousTop5.map(u => u.id));
        //console.log('🔍 DEBUG - Current IDs:', currentAvailableTop5.map(u => u.id));
        //console.log('🔍 DEBUG - Has Changed:', hasChanged);
        //console.log('🔍 DEBUG - Previous Users:', previousTop5.map(u => u.username));
        //console.log('🔍 DEBUG - Current Users:', currentAvailableTop5.map(u => u.username));

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
        let usersToAdd = [];

        if (previousTop5.length === 0) {
            // إذا مفيش بيانات سابقة، كل الأعضاء الحاليين جدد
            console.log('🆕 First time setup - adding all current top 5');
            usersToAdd = currentAvailableTop5;
        } else {
            // المنطق العادي
            usersToAdd = currentAvailableTop5.filter(currUser => 
                !previousTop5.some(prevUser => prevUser.id === currUser.id)
            );
        }

        //console.log(`🔍 Users to add:`, usersToAdd.map(u => u.username));
        //console.log(`🔍 Users to remove:`, usersToRemove.map(u => u.username));

        // إزالة الرتبة
        for (const user of usersToRemove) {
            try {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member && member.roles.cache.has(TOP_5_ROLE_ID)) {
                    await member.roles.remove(role);
                    console.log(`🔻 Removed Top5 role from ${member.user.username}`); // ⬅️ غيرت لـ username

                    // إرسال إشعار الإزالة
                    await sendRoleUpdateLog(client, guild, member, role, false);
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
                    console.log(`🔺 Added Top5 role to ${member.user.username}`); // ⬅️ غيرت لـ username

                    // إرسال إشعار الإضافة
                    await sendRoleUpdateLog(client, guild, member, role, true);
                }
            } catch (error) {
                console.log(`❌ Could not add role to user ${user.id}:`, error.message);
            }
        }

        // حفظ أول 5 الجدد في الداتابيز
        await saveCurrentTop5ToDB(currentAvailableTop5);

        console.log(`✅ Role update completed successfully`);

    } catch (error) {
        console.error('❌ Error in auto roles update:', error);
    } finally {
        isProcessing = false;
    }
}

// دالة لإرسال الإشعارات
async function sendRoleUpdateLog(client, guild, member, role, isAdded) {
    try {
        // جلب قناة communitycommands
        let logChannels;
        try {
            logChannels = await queryWithRetry('SELECT * FROM log_channels WHERE guild_id = ? AND channel_type = ?', 
                [guild.id, 'communitycommands']);
        } catch (error) {
            console.log('❌ Failed to fetch log channels');
            return;
        }

        const communityChannel = logChannels.find(c => c.channel_type === 'communitycommands');

        if (communityChannel) {
            const logChannel = await client.channels.fetch(communityChannel.channel_id).catch(() => null);

            if (logChannel) {
                const color = isAdded ? role.color : '#8B0000';
                const title = isAdded ? '<:Bell:1416158884942446682> Role has been granted' : '❌ Role has been removed';
                const description = isAdded ? 
                    `${role} has been granted to ${member}` : 
                    `${role} has been removed from ${member}`;

                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(title)
                    .setDescription(description)
                    .setImage(process.env.BlueLine || '')
                    .addFields(
                        { name: 'Role', value: role.name, inline: true },
                        { name: 'Action', value: isAdded ? 'Added' : 'Removed', inline: true }
                    )
                    .setThumbnail(member.user.displayAvatarURL())
                    .setFooter({ 
                        text: `Auto Message Roles | ${guild.name}`, 
                        iconURL: guild.iconURL() 
                    });

                await logChannel.send({ embeds: [embed] });
                //console.log(`📢 Sent ${isAdded ? 'added' : 'removed'} notification for ${member.user.username}`);
            }
        }
    } catch (error) {
        console.error('Error sending role update log:', error);
    }
}

// دالة للتحقق الدوري
async function checkRolesPeriodically(client) {
    try {
        console.log('🔄 Starting periodic role check...');
        await updateMessageRoles(client);
        console.log('✅ Periodic role check completed');
    } catch (error) {
        console.error('Error in periodic role check:', error);
    }
}

// بدء النظام
async function startAutoMessageRolesSystem(client) {
    if (systemStarted) {
        console.log('🚫 Auto Message Roles system already started, skipping...');
        return;
    }

    systemStarted = true;

    try {
        //console.log('🚀 Auto Message Roles system started');

        // تشغيل التحقق بعد 10 ثواني
        setTimeout(() => checkRolesPeriodically(client), 10000);

        // ثم كل 15 دقيقة
        setInterval(() => checkRolesPeriodically(client), 900000);

    } catch (error) {
        console.error('❌ Failed to start auto roles system:', error);
        systemStarted = false;
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

module.exports = {
    updateMessageRoles,
    checkRolesPeriodically,
    startAutoMessageRolesSystem
};