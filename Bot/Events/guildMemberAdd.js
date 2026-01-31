const { EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            console.log(`🔔 [Member Join] ${member.user.tag} joined`);

            // معالجة البوتات
            if (member.user.bot) {
                return handleBotJoin(member, client);
            }

            // معالجة الأعضاء العاديين
            await handleMemberJoin(member, client);
        } catch (error) {
            console.error(`⚠️ [Member Join Error] ${error.message}`);
        }
    }
};

async function handleBotJoin(member, client) {
    try {
        const auditLogs = await member.guild.fetchAuditLogs({ type: 28, limit: 10 });
        const botAddEntry = auditLogs.entries.find(entry => 
            entry.target?.id === member.id && (Date.now() - entry.createdTimestamp) < 10000
        );

        const adder = botAddEntry?.executor;
        await sendBotJoinReport(member, adder, client);
    } catch (error) {
        console.error(`⚠️ [Bot Join Error] ${error.message}`);
    }
}

async function sendBotJoinReport(member, adder, client) {
    // البحث عن قناة welcome أولاً، ثم القنوات الأخرى
    let logChannel = null;

    // البحث في logChannels المخزنة في العميل
    if (client.logChannels && client.logChannels[member.guild.id]) {
        const guildChannels = client.logChannels[member.guild.id];
        if (guildChannels.welcome) {
            logChannel = await client.channels.fetch(guildChannels.welcome.id).catch(() => null);
        } else if (guildChannels.main) {
            logChannel = await client.channels.fetch(guildChannels.main.id).catch(() => null);
        }
    }

    // إذا لم توجد في العميل، البحث في قاعدة البيانات
    if (!logChannel && client.dbManager) {
        const logChannels = await client.dbManager.getLogChannels(member.guild.id);
        if (logChannels && logChannels.length > 0) {
            const welcomeChannel = logChannels.find(c => c.channel_type === 'welcome');
            const mainChannel = logChannels.find(c => c.channel_type === 'main');

            if (welcomeChannel) {
                logChannel = await client.channels.fetch(welcomeChannel.channel_id).catch(() => null);
            } else if (mainChannel) {
                logChannel = await client.channels.fetch(mainChannel.channel_id).catch(() => null);
            }
        }
    }

    if (!logChannel) {
        console.log('❌ No welcome or main channel found for bot join report');
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(adder ? '#0073ff' : '#0073ff')
        .setTitle(`<:Bot:1395179279897329776> ${member.user.tag} New Bot Added`)
        //.setDescription(`Time: <t:${Math.floor(Date.now() / 1000)}:F>`)
        .setImage(process.env.BlueLine)
        .addFields(
            { name: 'Added by', value: `${adder ? adder.toString() : 'Unknown'}`, inline: true },
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ 
            text: `${member.guild.name} | Server Members: ${member.guild.memberCount.toString()}`, 
            iconURL: member.guild.iconURL() 
        });

    await logChannel.send({ embeds: [embed] });
    console.log(`✅ [Bot Join] Logged bot addition: ${member.user.tag}`);
}

async function handleMemberJoin(member, client) {
    const inviterSystem = client.inviterSystem;

    // 🔍 التحقق من تاريخ الانضمام الأول (من قاعدة البيانات الحالية)
    const joinHistory = await dbManager.get(
        'SELECT * FROM member_join_history WHERE member_id = ?',
        [member.id]
    );

    // ⭐ تحديث سجل الانضمام
    await updateJoinHistory(member.id, joinHistory);

    // الكشف عن الدعوة المستخدمة
    const { inviterId: newInviterId, inviterMention: newInviterMention } = await detectInviteUsed(member, inviterSystem);

    // ⭐ تحديد نوع الانضمام (أول مرة أم إعادة انضمام)
    const isRejoin = joinHistory && joinHistory.first_join_date !== joinHistory.last_join_date;

    if (isRejoin) {
        console.log(`🔄 [Rejoin] ${member.user.tag} is rejoining the server`);

        // ⭐ استرجاع الداعي الأصلي من قاعدة البيانات
        const originalInviterId = joinHistory.inviter_id;

        // ⭐ تحديث إحصائيات الداعي الأصلي فقط
        if (originalInviterId !== 'Unknown' && originalInviterId !== 'Vanity URL') {
            const isVerified = client.verifiedRole && member.roles.cache.has(client.verifiedRole.id);

            if (isVerified) {
                await inviterSystem.incrementInviterStats(originalInviterId, {
                    total: 1,
                    verified: 1
                });
            } else {
                await inviterSystem.incrementInviterStats(originalInviterId, {
                    total: 1,
                    unverified: 1
                });
            }
            console.log(`✅ [Rejoin] Updated ORIGINAL inviter ${originalInviterId} stats for ${member.user.tag}`);
        }

        // ⭐ إرسال رسالة Rejoin خاصة (كود منفصل)
        await sendRejoinMessage(member, client, originalInviterId, newInviterId, newInviterMention, joinHistory, inviterSystem);

    } else {
        console.log(`🌟 [First Join] ${member.user.tag} joining for the first time`);

        // ⭐ هذا هو الانضمام الأول
        // تحديث بيانات الداعي الجديد (هذا هو الداعي الأصلي الآن)
        if (newInviterId !== 'Unknown' && newInviterId !== 'Vanity URL') {
            await inviterSystem.updateUserInviteData({
                userId: newInviterId,
                username: await getUsername(newInviterId, client)
            });
        }

        // تحديث سجل الانضمام بالداعي الجديد (كأصلي)
        if (newInviterId !== 'Unknown' && newInviterId !== 'Vanity URL') {
            await dbManager.run(
                'UPDATE member_join_history SET inviter_id = ? WHERE member_id = ?',
                [newInviterId, member.id]
            );
        }

        // معالجة الانضمام الأول (كود منفصل)
        await processFirstJoin(member, client, newInviterId, newInviterMention, inviterSystem);
    }
}

async function updateJoinHistory(memberId, existingHistory) {
    const now = new Date().toISOString();

    if (existingHistory) {
        // ⭐ تحديث تاريخ الانضمام الأخير وزيادة العداد
        await dbManager.run(
            'UPDATE member_join_history SET last_join_date = ?, join_count = join_count + 1 WHERE member_id = ?',
            [now, memberId]
        );
    } else {
        // ⭐ إنشاء سجل جديد (الانضمام الأول)
        await dbManager.run(
            'INSERT INTO member_join_history (member_id, first_join_date, last_join_date, inviter_id, join_count) VALUES (?, ?, ?, ?, ?)',
            [memberId, now, now, 'Unknown', 1]
        );
    }
}

async function detectInviteUsed(member, inviterSystem) {
    try {
        console.log(`🔍 [Invite Detection] Starting detection for ${member.user.tag}`);

        const guild = member.guild;
        const newInvites = await guild.invites.fetch().catch((error) => {
            console.log(`❌ Cannot fetch invites (permissions?): ${error.message}`);
            return null;
        });

        if (!newInvites) {
            console.log('❌ Could not fetch invites');
            return { inviterId: 'Unknown', inviterMention: 'Unknown' };
        }

        console.log(`📊 Found ${newInvites.size} invites in guild`);

        const oldUsage = await inviterSystem.getInviteUsage(guild.id);
        console.log(`📊 Found ${oldUsage.length} invite records in database`);

        let inviterId = 'Unknown';
        let inviterMention = 'Unknown';
        let usedInviteCode = 'Unknown';
        let maxIncrease = 0;
        let selectedInvite = null;

        // البحث عن الدعوة التي زاد عدد استخداماتها بشكل أكبر
        for (const [code, invite] of newInvites) {
            const oldInvite = oldUsage.find(u => u.invite_code === code);
            const oldUses = oldInvite?.uses || 0;
            const increase = invite.uses - oldUses;

            console.log(`📊 Invite ${code}: Old uses: ${oldUses}, New uses: ${invite.uses}, Increase: ${increase}, Inviter: ${invite.inviter?.id || 'None'}`);

            // استخدام >= لضمان اختيار أحدث دعوة
            if (increase > 0 && increase >= maxIncrease) {
                maxIncrease = increase;
                selectedInvite = invite;
                usedInviteCode = code;
                console.log(`⭐ New selected invite: ${code} with increase of ${increase}`);
            }
        }

        if (selectedInvite) {
            inviterId = selectedInvite.inviter?.id || 'Vanity URL';
            inviterMention = selectedInvite.inviter?.toString() || 'Vanity URL';

            console.log(`🎯 Exact match found: ${usedInviteCode} increased from ${selectedInvite.uses - maxIncrease} to ${selectedInvite.uses} by ${inviterId}`);

            // تحديث استخدام الدعوة في قاعدة البيانات
            await inviterSystem.updateInviteUsage(
                guild.id, 
                usedInviteCode, 
                selectedInvite.uses, 
                inviterId
            );
            console.log(`✅ Updated invite usage for ${usedInviteCode}: ${selectedInvite.uses} uses by ${inviterId}`);
        } else {
            console.log('ℹ️ No invite usage detected, checking for vanity URL...');

            // التحقق من Vanity URL كحالة احتياطية
            if (guild.vanityURLCode) {
                console.log('🔍 Vanity URL detected:', guild.vanityURLCode);
                inviterId = 'Vanity URL';
                inviterMention = 'Vanity URL';
                usedInviteCode = guild.vanityURLCode;

                // تحديث استخدام Vanity URL في قاعدة البيانات
                const vanityInvite = newInvites.find(inv => inv.code === guild.vanityURLCode);
                if (vanityInvite) {
                    await inviterSystem.updateInviteUsage(
                        guild.id, 
                        guild.vanityURLCode, 
                        vanityInvite.uses, 
                        'Vanity URL'
                    );
                }
            }
        }

        console.log(`📊 [Final Result] Member: ${member.user.tag}, Inviter: ${inviterId}, Code: ${usedInviteCode}`);

        return { inviterId, inviterMention };
    } catch (error) {
        console.error('❌ Error detecting invite used:', error);
        return { inviterId: 'Unknown', inviterMention: 'Unknown' };
    }
}

async function getUsername(userId, client) {
    try {
        if (userId === 'Unknown' || userId === 'Vanity URL') return userId;

        const user = await client.users.fetch(userId);
        return user.tag;
    } catch (error) {
        return 'Unknown User';
    }
}

// ==============================================
// ⭐ كود منفصل لـ First Join (الانضمام الأول)
// ==============================================
async function processFirstJoin(member, client, inviterId, inviterMention, inviterSystem) {
    try {
        if (!inviterId || inviterId === 'Unknown') {
            console.log(`ℹ️ No inviter found for ${member.user.tag} (First Join)`);
            return;
        }

        const isVerified = client.verifiedRole && member.roles.cache.has(client.verifiedRole.id);

        // تحديث حالة التحقق في قاعدة البيانات
        await dbManager.updateMemberVerification(member.id, member.guild.id, isVerified);

        // تحديث إحصائيات الداعي (فقط إذا كان ليس Vanity URL)
        if (inviterId !== 'Vanity URL') {
            if (isVerified) {
                await inviterSystem.incrementInviterStats(inviterId, {
                    total: 1,
                    verified: 1
                });
                console.log(`✅ Updated inviter ${inviterId} stats: +1 total, +1 verified`);
            } else {
                await inviterSystem.incrementInviterStats(inviterId, {
                    total: 1,
                    unverified: 1
                });
                console.log(`✅ Updated inviter ${inviterId} stats: +1 total, +1 unverified`);
            }
        } else {
            console.log(`ℹ️ Vanity URL used for ${member.user.tag}, not counting towards user stats`);
        }

        // إرسال رسالة الترحيب للانضمام الأول (كود منفصل)
        await sendFirstJoinMessage(member, client, inviterId, inviterMention, inviterSystem);

    } catch (error) {
        console.error('❌ Error processing first join:', error);
    }
}

// ==============================================
// ⭐ كود منفصل لـ First Join Message
// ==============================================
async function sendFirstJoinMessage(member, client, inviterId, inviterMention, inviterSystem) {
    try {
        // البحث عن قناة welcome
        let welcomeChannel = await findWelcomeChannel(member.guild.id, client);

        if (!welcomeChannel) {
            console.log('❌ No welcome channel found for first join message');
            return;
        }

        // الحصول على إحصائيات الداعي
        let stats = null;
        if (inviterId !== 'Vanity URL' && inviterId !== 'Unknown') {
            stats = await inviterSystem.getInviterStats(inviterId);
        }

        // إنشاء إيمبد خاص بالانضمام الأول
        const embed = new EmbedBuilder()
            .setColor(process.env.Bluecolor) // لون أزرق للانضمام الأول
            .setTitle(`<:Bell:1416158884942446682> ${member.user.tag} Joined The Server`)
            .setDescription([
                `<:InfoAccount:1416157704929546353> **Account Age:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`
            ].join('\n'))
            .setImage('https://i.ibb.co/9HvyVLYt/Welcome-Banner.png')
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setFooter({ 
                text: `Server Members: ${member.guild.memberCount} | UserID: ${member.id}`, 
                iconURL: member.guild.iconURL() 
            });

        // إضافة حقول الإحصائيات
        if (stats) {
            embed.addFields(
                { name: 'Total Stats', value: `**${stats.total || 0}**`, inline: true },
                { name: 'Verified Stats', value: `**${stats.verified || 0}**`, inline: true },
                { name: '👤 The Inviter', value: `${inviterMention}`, inline: false },
                //{ name: '📅 Joined At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                //{ name: '🎯 Status', value: 'First Time Join! 🎉', inline: false }
            );
        } else {
            embed.addFields(
                { name: '👤 The Inviter', value: `${inviterMention}`, inline: true },
                //{ name: '📅 Joined At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                //{ name: '🎯 Status', value: 'First Time Join! 🎉', inline: true }
            );
        }

        // إرسال الرسالة
        await welcomeChannel.send({ 
            content: `> <:Milo_Welcome:1450988142525153321> Welcome ${member} To **Gamersky Giveaways**!`,
            embeds: [embed] 
        });

        console.log(`✅ [First Join] Welcome message sent for ${member.user.tag}`);
    } catch (error) {
        console.error('❌ Error sending first join message:', error);
    }
}

// ==============================================
// ⭐ كود منفصل لـ Rejoin Message
// ==============================================
async function sendRejoinMessage(member, client, originalInviterId, newInviterId, newInviterMention, joinHistory, inviterSystem) {
    try {
        // البحث عن قناة welcome
        let welcomeChannel = await findWelcomeChannel(member.guild.id, client);

        if (!welcomeChannel) {
            console.log('❌ No welcome channel found for rejoin message');
            return;
        }

        // الحصول على إحصائيات الداعي الأصلي فقط
        let originalInviterStats = null;
        if (originalInviterId !== 'Vanity URL' && originalInviterId !== 'Unknown') {
            originalInviterStats = await inviterSystem.getInviterStats(originalInviterId);
        }

        // الحصول على معلومات الداعي الجديد (للعرض فقط)
        const formattedNewInviter = newInviterId === 'Unknown' || newInviterId === 'Vanity URL' 
            ? newInviterId 
            : `<@${newInviterId}>`;

        // حساب عدد مرات الانضمام
        const joinCount = joinHistory ? joinHistory.join_count : 1;
        const firstJoinDate = joinHistory ? new Date(joinHistory.first_join_date) : new Date();

        // إنشاء إيمبد خاص بإعادة الانضمام
        const embed = new EmbedBuilder()
            .setColor(process.env.Bluecolor) // لون برتقالي/أحمر للـRejoin
            .setTitle(`<:Bell:1416158884942446682> ${member.user.tag} Rejoined The Server`)
            .setDescription([
                `<:InfoAccount:1416157704929546353> **Account Age:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`
                //`**Join Count:** ${joinCount} Times`
            ].join('\n'))
            .setImage('https://i.ibb.co/9HvyVLYt/Welcome-Banner.png')
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .setFooter({ 
                text: `Server Members: ${member.guild.memberCount} | UserID: ${member.id}`, 
                iconURL: member.guild.iconURL() 
            });

        // إضافة حقول الداعي الأصلي والإحصائيات
        if (originalInviterStats) {
            embed.addFields(
                { name: 'Total Stats', value: `${originalInviterStats.total || 0}`, inline: true },
                { name: 'Verified Stats', value: `${originalInviterStats.verified || 0}`, inline: true },
                { name: ' ', value: ` `, inline: false },
                { name: '👤 Original Inviter', value: `<@${originalInviterId}>`, inline: true },
                { name: '👤 New Inviter', value: `${formattedNewInviter}`, inline: true },
                { name: '📅 First Join', value: `<t:${Math.floor(firstJoinDate.getTime() / 1000)}:F>`, inline: false },
                //{ name: '📝 Note', value: 'Rejoin counted for original inviter only ✅', inline: false }
            );
        } else {
            embed.addFields(
                { name: '👤 Original Inviter', value: 'Unknown', inline: true },
                { name: '👤 New Inviter', value: `${formattedNewInviter}`, inline: true },
                { name: '📅 First Join', value: `<t:${Math.floor(firstJoinDate.getTime() / 1000)}:F>`, inline: false },
                //{ name: '📝 Note', value: 'Rejoin - No original inviter stats available', inline: false }
            );
        }

        // إرسال الرسالة
        await welcomeChannel.send({ 
            content: `> <:Milo_Welcome:1450988142525153321> Welcome back ${member}! Great to see you again!`,
            embeds: [embed] 
        });

        console.log(`✅ [Rejoin] Rejoin message sent for ${member.user.tag}`);
    } catch (error) {
        console.error('❌ Error sending rejoin message:', error);
    }
}

// ==============================================
// ⭐ دالة مساعدة للعثور على قناة الترحيب
// ==============================================
async function findWelcomeChannel(guildId, client) {
    let welcomeChannel = null;

    // البحث في logChannels المخزنة في العميل
    if (client.logChannels && client.logChannels[guildId]) {
        const guildChannels = client.logChannels[guildId];
        if (guildChannels.welcome) {
            welcomeChannel = await client.channels.fetch(guildChannels.welcome.id).catch(() => null);
        }
    }

    // إذا لم توجد في العميل، البحث في قاعدة البيانات
    if (!welcomeChannel && client.dbManager) {
        const logChannels = await client.dbManager.getLogChannels(guildId);
        if (logChannels && logChannels.length > 0) {
            const welcomeChannelData = logChannels.find(c => c.channel_type === 'welcome');
            if (welcomeChannelData) {
                welcomeChannel = await client.channels.fetch(welcomeChannelData.channel_id).catch(() => null);
            }
        }
    }

    return welcomeChannel;
}