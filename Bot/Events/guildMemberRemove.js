const { EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        try {
            console.log(`🚪 [Member Leave] ${member.user.tag} left`);

            const inviterSystem = client.inviterSystem;

            // الحصول على بيانات الداعي من قاعدة البيانات
            const inviterId = await dbManager.getMemberInviter(member.id);

            // الحصول على حالة التحقق الأخيرة للعضو
            const wasVerified = await dbManager.getMemberVerificationStatus(member.id);

            // تحديث قاعدة البيانات (يحتسب فوراً بدون شرط زمني)
            await inviterSystem.addLeftMember(member, wasVerified);

            // إرسال إشعار المغادرة
            await sendLeaveNotification(member, inviterId, wasVerified, client);
        } catch (error) {
            console.error(`⚠️ [Member Leave Error] ${error.message}`);
        }
    }
};

async function sendLeaveNotification(member, inviterId, wasVerified, client) {
    try {
        // البحث عن قناة welcome أولاً، ثم القنوات الأخرى
        let logChannel = null;

        // البحث في logChannels المخزنة في العميل
        if (client.logChannels && client.logChannels[member.guild.id]) {
            const guildChannels = client.logChannels[member.guild.id];
            if (guildChannels.leave) {
                logChannel = await client.channels.fetch(guildChannels.leave.id).catch(() => null);
            } else if (guildChannels.main) {
                logChannel = await client.channels.fetch(guildChannels.main.id).catch(() => null);
            }
        }

        // إذا لم توجد في العميل، البحث في قاعدة البيانات
        if (!logChannel && client.dbManager) {
            const logChannels = await client.dbManager.getLogChannels(member.guild.id);
            if (logChannels && logChannels.length > 0) {
                const welcomeChannel = logChannels.find(c => c.channel_type === 'leave');
                const mainChannel = logChannels.find(c => c.channel_type === 'main');

                if (welcomeChannel) {
                    logChannel = await client.channels.fetch(welcomeChannel.channel_id).catch(() => null);
                } else if (mainChannel) {
                    logChannel = await client.channels.fetch(mainChannel.channel_id).catch(() => null);
                }
            }
        }

        if (!logChannel) {
            console.log('❌ No welcome or main channel found for leave notification');
            return;
        }

        // حساب عمر الحساب
        const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));

        const embed = new EmbedBuilder()
        .setColor('#8B0000')
        .setTitle(`<:Bell:1416158884942446682> ${member.user.tag} has left the server`)
        .setDescription([
            `<:InfoAccount:1416157704929546353>Account Age: ${accountAge}\n`,
            `Left At: <t:${Math.floor(Date.now()/1000)}:F>`
        ].join(''))
        .setImage(process.env.RedLine)
        .addFields(
            { name: 'Status', value: wasVerified ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Inviter', value: inviterId !== 'Unknown' ? `<@${inviterId}>` : 'Unknown', inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setFooter({ 
            text: `Server Members: ${member.guild.memberCount} | UserID: ${member.id}`,
            iconURL: member.guild.iconURL() || 'https://cdn.discordapp.com/attachments/1391115389718761565/1394852275968671825/BCO.png'
        });

        await logChannel.send({ embeds: [embed] });
        console.log(`✅ [Member Leave] Sent leave notification for ${member.user.tag}`);
    } catch (error) {
        console.error(`❌ Failed to send leave notification for ${member.user.tag}:`, error);
    }
}