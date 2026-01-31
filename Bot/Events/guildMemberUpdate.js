const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'guildMemberUpdate',
    async execute(oldMember, newMember, client) {
        try {
            const verifiedRole = client.verifiedRole;
            if (!verifiedRole) return;

            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;

            const hadVerifiedBefore = oldRoles.has(verifiedRole.id);
            const hasVerifiedNow = newRoles.has(verifiedRole.id);

            // إذا لم تتغير حالة التحقق، لا تفعل شيئاً
            if (hadVerifiedBefore === hasVerifiedNow) return;

            const inviterSystem = client.inviterSystem;

            if (hasVerifiedNow) {
                // أصبح العضو موثقاً الآن
                await inviterSystem.addVerifiedMember(newMember);
                console.log(`✅ [Member Update] ${newMember.user.tag} is now verified`);
            } else {
                // لم يعد العضو موثقاً
                await inviterSystem.addUnverifiedMember(newMember);
                console.log(`⚠️ [Member Update] ${newMember.user.tag} is no longer verified`);
            }
        } catch (error) {
            console.error(`⚠️ [Member Update Error] ${error.message}`);
        }
    }
};