const dbManager = require('../Data/database');

class InviterSystem {
    constructor(client) {
        this.client = client;
        this.dbManager = dbManager;
        this.inviteCache = new Map();
        this.lastCacheClear = Date.now();
        
        // ⭐ مسح الكاش تلقائياً كل 5 دقائق
        setInterval(() => this.clearInviteCache(), 300000);
    }

    // ⭐ دالة مسح الكاش
    clearInviteCache() {
        const previousSize = this.inviteCache.size;
        this.inviteCache.clear();
        this.lastCacheClear = Date.now();
        
        if (previousSize > 0) {
            console.log(`✅ Cleared ${previousSize} cached invites (auto-cleanup)`);
        }
        return previousSize;
    }

    // ⭐ دالة لتنظيف البيانات القديمة فقط (اختياري)
    clearOldCache(maxAgeMinutes = 10) {
        const now = Date.now();
        let clearedCount = 0;
        
        for (const [code, data] of this.inviteCache.entries()) {
            // مسح البيانات الأقدم من الوقت المحدد
            if (now - data.timestamp > maxAgeMinutes * 60 * 1000) {
                this.inviteCache.delete(code);
                clearedCount++;
            }
        }
        
        if (clearedCount > 0) {
            console.log(`✅ Cleared ${clearedCount} old cached invites (older than ${maxAgeMinutes} minutes)`);
        }
        
        return clearedCount;
    }

    // تحديث بيانات الدعوة للمستخدم
    async updateUserInviteData({ userId, username, inviterId = 'Unknown' }) {
        try {
            // تحديث اسم المستخدم إذا كان متوفراً
            if (username && username !== 'Unknown User') {
                await this.dbManager.updateInviterUsername(userId, username);
            }

            return true;
        } catch (error) {
            console.error('Failed to update user invite data:', error.message);
            return false;
        }
    }

    // زيادة إحصائيات الداعي
    async incrementInviterStats(inviterId, updates) {
        try {
            return await this.dbManager.updateInviterStats(inviterId, updates);
        } catch (error) {
            console.error('Failed to increment inviter stats:', error.message);
            return false;
        }
    }

    // إضافة عضو موثق
    async addVerifiedMember(member) {
        try {
            const inviterId = await this.dbManager.getMemberInviter(member.id);

            // تحديث حالة التحقق
            await this.dbManager.updateMemberVerification(member.id, member.guild.id, true);

            // تحديث إحصائيات الداعي
            if (inviterId !== 'Unknown') {
                await this.incrementInviterStats(inviterId, {
                    verified: 1,
                    unverified: -1
                });
            }

            return true;
        } catch (error) {
            console.error('Failed to add verified member:', error.message);
            return false;
        }
    }

    // إضافة عضو غير موثق
    async addUnverifiedMember(member) {
        try {
            const inviterId = await this.dbManager.getMemberInviter(member.id);

            // تحديث حالة التحقق
            await this.dbManager.updateMemberVerification(member.id, member.guild.id, false);

            // تحديث إحصائيات الداعي
            if (inviterId !== 'Unknown') {
                await this.incrementInviterStats(inviterId, {
                    unverified: 1,
                    verified: -1
                });
            }

            return true;
        } catch (error) {
            console.error('Failed to add unverified member:', error.message);
            return false;
        }
    }

    // إضافة عضو غادر - يحسب فوراً بدون شرط زمني
    async addLeftMember(member, wasVerified) {
        try {
            const inviterId = await this.dbManager.getMemberInviter(member.id);

            if (inviterId !== 'Unknown') {
                // تحديث إحصائيات الداعي
                await this.incrementInviterStats(inviterId, {
                    left: 1
                });

                // تقليل العدد بناءً على حالة التحقق
                if (wasVerified) {
                    await this.incrementInviterStats(inviterId, {
                        verified: -1
                    });
                } else {
                    await this.incrementInviterStats(inviterId, {
                        unverified: -1
                    });
                }
            }

            // حذف حالة التحقق للعضو المغادر
            await this.dbManager.run(
                'DELETE FROM member_verification_status WHERE member_id = ?',
                [member.id]
            );

            return true;
        } catch (error) {
            console.error('Failed to add left member:', error.message);
            return false;
        }
    }

    // الحصول على إحصائيات الداعي
    async getInviterStats(inviterId) {
        try {
            return await this.dbManager.getInviterStats(inviterId);
        } catch (error) {
            console.error('Failed to get inviter stats:', error.message);
            return { total: 0, verified: 0, unverified: 0, left: 0 };
        }
    }

    // تسجيل دخول العضو (يمنع العد المزدوج)
    async recordMemberJoin(memberId, inviterId = 'Unknown') {
        try {
            return await this.dbManager.recordMemberJoin(memberId, inviterId);
        } catch (error) {
            console.error('Failed to record member join:', error.message);
            return false;
        }
    }

    // الحصول على معلومات الداعي للعضو
    async getMemberInviter(memberId) {
        try {
            return await this.dbManager.getMemberInviter(memberId);
        } catch (error) {
            console.error('Failed to get member inviter:', error.message);
            return 'Unknown';
        }
    }

    // التحقق مما إذا كان يجب عد العضو كمغادر (دائماً نعم)
    async shouldCountAsLeft(memberId) {
        return true;
    }

    // ⭐ ⭐ ⭐ التعديل هنا - تحديث استخدام الدعوة ⭐ ⭐ ⭐
    async updateInviteUsage(guildId, inviteCode, uses, inviterId) {
        try {
            // ⭐ أولاً: نخزن في الكاش للمقارنات السريعة
            this.inviteCache.set(inviteCode, {
                uses: uses,
                inviter: inviterId,
                timestamp: Date.now() // مهم جداً
            });
            
            // ⭐ ثانياً: نحدث الداتابيز للأمان
            return await this.dbManager.updateInviteUsage(guildId, inviteCode, uses, inviterId);
        } catch (error) {
            console.error('Failed to update invite usage:', error.message);
            return false;
        }
    }

    // الحصول على استخدام الدعوات
    async getInviteUsage(guildId) {
        try {
            return await this.dbManager.getInviteUsage(guildId);
        } catch (error) {
            console.error('Failed to get invite usage:', error.message);
            return [];
        }
    }

    // الحصول على أفضل الداعين
    async getTopInviters(limit = 10) {
        try {
            return await this.dbManager.getTopInviters(limit);
        } catch (error) {
            console.error('Failed to get top inviters:', error.message);
            return [];
        }
    }
}

module.exports = InviterSystem;
