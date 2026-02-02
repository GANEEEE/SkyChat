// globalBuff.js - النسخة النهائية
const buffSystem = {
    // ========== ⭐ هنا حط الـ IDs ==========
    roleBuffs: new Map([
        ["1465705033604792558", 0.5],  // ضع الـ ID الحقيقي
        ["1465705074343809096", 0.5],
        ["1465705124176597075", 0.5],// ضع ID آخر
        ["1466171805869019137", 0.5],// ضع ID آخر
        ["1394820196375593122", 0.5],// ضع ID آخر
        ["1441450267965915296", 0.5],// ضع ID آخر
        ["1465800603224510536", 0.5],// ضع ID آخر
    ]),
    // ========== ⭐ ==========

    async getBuff(userId, guild) {
        try {
            const member = await guild.members.fetch(userId);
            let total = 0;
            for (const [roleId, buff] of this.roleBuffs) {
                if (member.roles.cache.has(roleId)) total += buff;
            }
            return total;
        } catch {
            return 0;
        }
    },

    applyBuff(reward, buff) {
        if (!buff) return reward;
        const multiplier = 1 + (buff / 100);
        return {
            xp: Math.floor(reward.xp * multiplier),
            coins: Math.floor(reward.coins * multiplier),
            crystals: reward.crystals || 0
        };
    }
};

console.log(`🎯 Buff System: ${buffSystem.roleBuffs.size} roles ready!`);
module.exports = buffSystem;