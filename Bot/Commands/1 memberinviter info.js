const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const dbManager = require('../Data/database'); // تأكد من المسار الصحيح

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invitedmemberinfo')
        .setDescription('Get information about an invited member')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('member_id')
                .setDescription('The ID of the member to get information about')
                .setRequired(true)),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من أن المستخدم لديه Moderate Role
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setImage(process.env.RedLine)
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

            const memberId = interaction.options.getString('member_id');

            // التحقق من صحة الآيدي
            if (!this.isValidSnowflake(memberId)) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Invalid ID')
                    .setImage(process.env.RedLine)
                    .setDescription('Please provide a valid Discord ID (18-digit number).');
                return interaction.editReply({ embeds: [embed] });
            }

            // جلب معلومات العضو من الداتابيز
            const memberInfo = await this.getMemberInfo(memberId, interaction.guild, client);

            if (!memberInfo.found) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Member Not Found')
                    .setImage(process.env.RedLine)
                    .setDescription('This member ID was not found in the database.');
                return interaction.editReply({ embeds: [embed] });
            }

            // بناء الـ Embed
            const infoEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('<:Leaderboard:1412843835318599810> Invited Member Information')
                .setThumbnail(memberInfo.avatar || null)
                .addFields(
                    { 
                        name: 'Member', 
                        value: `${memberInfo.mention} (\`${memberInfo.id}\`)`, 
                        inline: false 
                    },
                    { 
                        name: 'Current Status', 
                        value: memberInfo.status, 
                        inline: true 
                    }
                )
                .setImage(process.env.BlueLine);
            // إضافة معلومات التحقق
            infoEmbed.addFields(
                { 
                    name: 'Verification Status', 
                    value: memberInfo.verified ? '✅ Verified' : '❌ Not Verified', 
                    inline: true 
                }
            );
            
            // إضافة معلومات الداعي إذا كانت متوفرة
            if (memberInfo.inviter) {
                infoEmbed.addFields(
                    { 
                        name: '<:Invites:1412839239812648990> The Inviter', 
                        value: `${memberInfo.inviter.mention} (\`${memberInfo.inviter.id}\`)`, 
                        inline: false 
                    },
                );
            } else {
                infoEmbed.addFields(
                    { 
                        name: '<:Invites:1412839239812648990> The Inviter', 
                        value: memberInfo.inviterType || 'Unknown', 
                        inline: false 
                    }
                );
            }

            await interaction.editReply({ embeds: [infoEmbed] });

        } catch (error) {
            console.error('Error in invitedmemberinfo command:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ An error occurred.')
                        .setDescription('An error occurred while fetching member information, please try again later.')
                        .setImage(process.env.RedLine)
                ]
            });
        }
    },

    // ===== الدوال المساعدة ===== //
    isValidSnowflake(id) {
        return /^\d{17,20}$/.test(id);
    },

    async getMemberInfo(memberId, guild, client) {
        try {
            // 1. جلب معلومات الانضمام من الداتابيز
            const joinHistory = await dbManager.get(
                'SELECT * FROM member_join_history WHERE member_id = ?',
                [memberId]
            );

            if (!joinHistory) {
                return { found: false };
            }

            // 2. محاولة جلب معلومات العضو من السيرفر
            let guildMember, user, status, avatar;

            try {
                guildMember = await guild.members.fetch(memberId);
                user = guildMember.user;
                status = '🟢 In Server';
                avatar = user.displayAvatarURL({ format: 'png', dynamic: true });
            } catch (error) {
                // العضو غير موجود في السيرفر
                try {
                    user = await client.users.fetch(memberId);
                    avatar = user.displayAvatarURL({ format: 'png', dynamic: true });
                } catch {
                    avatar = null;
                }
                status = '🔴 Left Server';
            }

            // 3. جلب معلومات الداعي
            let inviter = null;
            let inviterType = null;
            let inviterStats = null;

            if (joinHistory.inviter_id && joinHistory.inviter_id !== 'Unknown' && joinHistory.inviter_id !== 'Vanity URL') {
                try {
                    const inviterUser = await client.users.fetch(joinHistory.inviter_id).catch(() => null);
                    inviter = {
                        id: joinHistory.inviter_id,
                        mention: `<@${joinHistory.inviter_id}>`,
                        username: inviterUser ? inviterUser.tag : 'Unknown User'
                    };

                    // جلب إحصائيات الداعي
                    inviterStats = await client.inviterSystem.getInviterStats(joinHistory.inviter_id) || {
                        total: 0,
                        verified: 0,
                        unverified: 0
                    };
                } catch (error) {
                    console.log('⚠️ Could not fetch inviter info:', error.message);
                }
            } else {
                inviterType = joinHistory.inviter_id || 'Unknown';
            }

            // 4. جلب حالة التحقق
            const verificationStatus = await dbManager.getMemberVerificationStatus(memberId);

            return {
                found: true,
                id: memberId,
                mention: `<@${memberId}>`,
                username: user ? user.tag : 'Unknown User',
                avatar: avatar,
                joinDate: joinHistory.join_timestamp,
                status: status,
                inviter: inviter,
                inviterType: inviterType,
                inviterStats: inviterStats,
                verified: verificationStatus
            };

        } catch (error) {
            console.error('Error in getMemberInfo:', error);
            return { found: false };
        }
    }
};