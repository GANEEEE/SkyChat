const { EmbedBuilder } = require('discord.js');

// تعريفات الرتب حسب عدد الدعوات المؤكدة
const ROLES_CONFIG = {
    ROLE_5_INVITES: {
        id: process.env.GAMER1,
        minInvites: 5,
        name: 'Rank for 5 invites'
    },
    ROLE_15_INVITES: {
        id: process.env.GAMER2,
        minInvites: 15,
        name: 'Rank for 15 invites'
    },
    ROLE_30_INVITES: {
        id: process.env.GAMER3,
        minInvites: 30,
        name: 'Rank for 30 invites'
    },
    ROLE_50_INVITES: {
        id: process.env.GAMER4,
        minInvites: 50,
        name: 'Rank for 50 invites'
    }
};

async function checkVerifiedRoles(client, userId) {
    try {
        //console.log(`🛠️ Checking user invites and roles: ${userId}`);

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.log('❌ Server not found');
            return false;
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            console.log('❌ Member not found');
            return false;
        }

        // جلب البيانات مباشرة من قاعدة البيانات
        const userData = await client.inviterSystem.dbManager.get(
            'SELECT * FROM invites WHERE user_id = ?',
            [userId]
        );

        //console.log('📊 Raw user data from database:', userData);

        if (!userData || !userData.verified || userData.verified === 0) {
            console.log(`ℹ️ No verified invites for the user ${userId} or verified is 0`);
            return false;
        }

        const verifiedCount = userData.verified;
        //console.log(`✅ ${member.user.tag} has ${verifiedCount} Verified Invites`);

        // تحميل بيانات الرتبة الموثقة من قاعدة البيانات
        let verifiedRole = null;
        try {
            const roleData = await client.inviterSystem.dbManager.get(
                'SELECT * FROM bot_settings WHERE setting_key = ?',
                ['verifiedRole']
            );

            if (roleData) {
                const roleInfo = JSON.parse(roleData.setting_value);
                verifiedRole = guild.roles.cache.get(roleInfo.id);
            }
        } catch (error) {
            console.error('Error loading verified role:', error);
        }

        // التحقق من أن العضو لديه رتبة التحقق المطلوبة
        if (verifiedRole && !member.roles.cache.has(verifiedRole.id)) {
            console.log(`❌ User ${member.user.tag} Does not have the required verification role ${verifiedRole.name}`);
            return false;
        }

        let rolesGranted = 0;

        // معالجة كل رتبة من الرتب المحددة - منح الرتب فقط بدون إزالة
        for (const [roleKey, roleInfo] of Object.entries(ROLES_CONFIG)) {
            if (!roleInfo.id || roleInfo.id === '') continue;

            const hasRole = member.roles.cache.has(roleInfo.id);

            // منح الرتبة فقط إذا كان مؤهلاً لها وليس لديهها بالفعل
            if (verifiedCount >= roleInfo.minInvites && !hasRole) {
                const role = guild.roles.cache.get(roleInfo.id);
                if (!role) {
                    console.log(`❌ Role not found with the ID: ${roleInfo.id}`);
                    continue;
                }

                try {
                    // 1. منح الرتبة الأساسية
                    await member.roles.add(role);
                    console.log(`🎉 Role added "${role.name}" to ${member.user.tag}`);
                    rolesGranted++;

                    // 2. منح رول Skyban مع الرتبة الأساسية
                    const SKYBAN_ROLE_ID = '1380141514293776466';
                    const skybanRole = guild.roles.cache.get(SKYBAN_ROLE_ID);
                    if (skybanRole && !member.roles.cache.has(SKYBAN_ROLE_ID)) {
                        await member.roles.add(skybanRole);
                        console.log(`🎉 Skyban role added to ${member.user.tag} along with ${role.name}`);
                    }

                    // إرسال رسالة إيمبد للقناة
                    await sendRoleGrantedLog(client, guild, member, role, verifiedCount, roleInfo.minInvites);

                } catch (err) {
                    console.error('⚠️ Failed to grant the role:', err.message);
                }
            }
        }

        //console.log(`ℹ️ Role verification completed for ${member.user.tag}, ${rolesGranted} roles granted`);
        return rolesGranted > 0;
    } catch (error) {
        console.error(`❌ Error in checkVerifiedRoles for user ${userId}:`, error);
        return false;
    }
}

async function sendRoleGrantedLog(client, guild, member, role, verifiedCount, requiredInvites) {
    try {
        const logChannels = await client.inviterSystem.dbManager.getLogChannels(guild.id);
        const mainChannel = logChannels.find(c => c.channel_type === 'communitycommands');

        if (mainChannel) {
            const logChannel = await client.channels.fetch(mainChannel.channel_id).catch(() => null);

            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor(role.color || '#00ff00')
                    .setTitle(`<:Bell:1416158884942446682> Role has been granted`)
                    .setDescription(`${role} has been granted to ${member}`)
                    .setImage(process.env.Blueline)
                    .addFields(
                        { name: 'The granted role', value: `${role}`, inline: true },
                        { name: 'Verified', value: verifiedCount.toString(), inline: true },
                        { name: 'Required', value: requiredInvites.toString(), inline: true },
                    )
                    //.setTimestamp()
                    .setThumbnail(member.user.displayAvatarURL())
                    .setFooter({ 
                        text: `Auto Gamers Roles | ${guild.name}`, 
                        iconURL: guild.iconURL() 
                    });

                await logChannel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error('Error sending role granted log:', error);
    }
}

// دالة للتحقق من جميع الأعضاء بشكل دوري
async function checkAllMembersRoles(client) {
    try {
        console.log('🔄 Starting periodic role check for all members...');

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return;

        // جلب جميع المستخدمين من جدول invites (ليس فقط الذين لديهم verified > 0)
        const allUsers = await client.inviterSystem.dbManager.all(
            'SELECT user_id FROM invites WHERE total > 0 OR verified > 0 OR unverified > 0 OR left_count > 0'
        );

        console.log(`📊 Found ${allUsers.length} users in invites table to check`);

        let checked = 0;
        let granted = 0;

        for (const memberData of allUsers) {
            try {
                //console.log(`🔍 Checking user: ${memberData.user_id}`);
                const roleGranted = await checkVerifiedRoles(client, memberData.user_id);
                if (roleGranted) granted++;
                checked++;

                // تأخير بسيط لتجنب rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error checking roles for user ${memberData.user_id}:`, error);
            }
        }

        console.log(`✅ Periodic role check completed: ${checked} members checked, ${granted} roles granted`);
    } catch (error) {
        console.error('Error in periodic role check:', error);
    }
}

module.exports = { checkVerifiedRoles, checkAllMembersRoles };