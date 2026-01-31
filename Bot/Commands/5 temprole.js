const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const parseDuration = require('../System/durationParser');
const { formatDuration } = require('../System/durationParser');
const dbManager = require('../Data/database');

async function execute(interaction, client) {
    // التحقق من أن dbManager متاح
    if (!client.dbManager) {
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('❌ Database Error')
            .setImage(process.env.RedLine)
            .setDescription('`Database connection is not available. Please try again later.`');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const guildId = interaction.guild.id;

    // محاولة تعريف الرولات إذا لم تكن معرفة
    if (!client.moderateRoles || !client.moderateRoles[guildId] || !client.modRoles || !client.modRoles[guildId]) {
        await defineGuildRoles(client, guildId);
    }

    const moderateRole = client.moderateRoles?.[guildId];
    const modRole = client.modRoles?.[guildId];

    // التحقق من moderate role أو mod role فقط
    const hasModerateRole = moderateRole && interaction.member.roles.cache.has(moderateRole.id);
    const hasModRole = modRole && interaction.member.roles.cache.has(modRole.id);

    if (!hasModerateRole && !hasModRole) {
        const moderateRoleName = moderateRole ? moderateRole.name : 'Moderate Role';
        const modRoleName = modRole ? modRole.name : 'Mod Role';

        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('⛔ Role Permission Required')
            .setImage(process.env.RedLine)
            .setDescription(`You need either **${moderateRoleName}** or **${modRoleName}** to use this command.`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const member = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');
    const durationStr = interaction.options.getString('duration');

    // التحقق من المدخلات
    if (!member || !role || !durationStr) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Invalid Input')
            .setImage(process.env.OrangeLine)
            .setDescription('Please select a valid user, role, and duration.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // تحليل المدة
    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs <= 0) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ Invalid Duration')
            .setImage(process.env.OrangeLine)
            .setDescription('Please provide a valid duration (e.g., 30s, 10m, 2h, 7d, 1w, or combined like "1w 2d 3h 4m 5s").');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // التحقق من صلاحيات البوت والمستخدم
    const executor = interaction.member;
    const botMember = interaction.guild.members.me;

    // التحقق من هرمية الرتب (لأننا أزلنا صلاحية Administrator)
    if (role.position >= executor.roles.highest.position && interaction.guild.ownerId !== executor.id) {
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('⛔ Role Hierarchy')
            .setImage(process.env.RedLine)
            .setDescription('You cannot assign a role equal or higher than your highest role.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // منع إعطاء moderate role أو mod role
    if ((moderateRole && role.id === moderateRole.id) || 
        (modRole && role.id === modRole.id)) {
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('⛔ Restricted Role')
            .setImage(process.env.RedLine)
            .setDescription('You cannot assign moderator roles using this command.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (role.position >= botMember.roles.highest.position) {
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('⛔ Bot Permissions')
            .setImage(process.env.RedLine)
            .setDescription('I cannot assign this role, because it is higher than my highest role.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('⛔ Bot Permissions')
            .setImage(process.env.RedLine)
            .setDescription('I do not have the **Manage Roles** permission.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        // إعطاء الرول
        await member.roles.add(role);

        // حساب وقت الانتهاء
        const expiresAt = new Date(Date.now() + durationMs);

        // حفظ البيانات في قاعدة البيانات
        const tempRoleData = {
            userId: member.id,
            userName: member.user.tag,
            roleId: role.id,
            roleName: role.name,
            guildId: interaction.guild.id,
            guildName: interaction.guild.name,
            expiresAt: expiresAt,
            duration: durationStr,
            assignedBy: interaction.user.id,
            assignedByName: interaction.user.tag,
            initialMessageId: null,
            channelId: interaction.channelId
        };

        await client.dbManager.addTempRole(tempRoleData);

        // تنسيق المدة للإظهار بالكامل
        const formattedDuration = formatDuration(durationMs);

        // إنشاء رد النجاح
        const successEmbed = new EmbedBuilder()
            .setColor(process.env.Bluecolor)
            .setTitle('<:Alarm:1429538046986158220> Temporary Role Assigned')
            //.setDescription(`Successfully assigned ${role} to ${member}`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setImage(process.env.BlueLine)
            .addFields(
                { name: 'Assigned Role', value: `${role}`, inline: true },
                { name: 'Member', value: `${member}`, inline: true },
                { name: ' ', value: ` `, inline: false },
                { name: 'Duration', value: `**${formattedDuration}**`, inline: false },
                { name: 'Expires At', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>`, inline: true },
                /*{ name: 'Assigned By', value: interaction.user.toString(), inline: true }*/
            )

        await interaction.reply({ embeds: [successEmbed] });
        const initialMessage = await interaction.fetchReply();

        // تحديث البيانات لتخزين معرف الرسالة الأولى
        await client.dbManager.run(
            'UPDATE temp_roles SET initial_message_id = ? WHERE user_id = ? AND role_id = ? AND guild_id = ?',
            [initialMessage.id, member.id, role.id, interaction.guild.id]
        );

        // جدولة إزالة الرول مع حذف الرسالة الأولى
        scheduleRoleRemoval(client, member.id, role.id, interaction.guild.id, expiresAt, durationStr, interaction.user.id, initialMessage.id, interaction.channelId);

    } catch (error) {
        console.error('Error assigning temporary role:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('❌ Error Assigning Role')
            .setImage(process.env.RedLine)
            .setDescription('An error occurred while assigning the role, Please try again.');

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

// ===== جدولة إزالة الرول ===== //
function scheduleRoleRemoval(client, userId, roleId, guildId, expiresAt, durationStr, assignedById, initialMessageId, channelId) {
    const remainingTime = expiresAt.getTime() - Date.now();

    if (remainingTime <= 0) {
        removeRole(client, userId, roleId, guildId, durationStr, assignedById, initialMessageId, channelId);
        return;
    }

    setTimeout(async () => {
        await removeRole(client, userId, roleId, guildId, durationStr, assignedById, initialMessageId, channelId);
    }, remainingTime);
}

async function removeRole(client, userId, roleId, guildId, durationStr, assignedById, initialMessageId, channelId) {
    // 🔒 Create unique lock key for this removal operation
    const lockKey = `removeRole:${userId}:${roleId}:${guildId}`;

    // 🔥 Check if this removal is already in progress
    if (global.roleRemovalLocks && global.roleRemovalLocks[lockKey]) {
        console.log(`⏩ Removal already in progress, skipping: ${userId}-${roleId}`);
        return;
    }

    // Initialize locks object if it doesn't exist
    if (!global.roleRemovalLocks) {
        global.roleRemovalLocks = {};
    }

    // Acquire lock
    global.roleRemovalLocks[lockKey] = true;

    try {
        console.log(`🔒 Lock acquired for: ${lockKey}`);

        // 1. 🔍 Check database first
        const existingRole = await dbManager.get(
            'SELECT * FROM temp_roles WHERE user_id = ? AND role_id = ? AND guild_id = ?',
            [userId, roleId, guildId]
        );

        // If role doesn't exist in DB, it was already removed
        if (!existingRole) {
            console.log(`⏩ Role already removed from database: ${userId}-${roleId}`);
            return;
        }

        // 2. 🗑️ Remove from database immediately
        await dbManager.run(
            'DELETE FROM temp_roles WHERE user_id = ? AND role_id = ? AND guild_id = ?',
            [userId, roleId, guildId]
        );

        //console.log(`🗑️ Database removal completed: ${userId}-${roleId}`);

        // 3. 🏰 Get guild
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            console.log(`❌ Guild ${guildId} not found`);
            return;
        }

        // 4. 👤 Get member and role
        const member = await guild.members.fetch(userId).catch(() => null);
        const role = await guild.roles.fetch(roleId).catch(() => null);

        if (!role) {
            console.log(`❌ Role ${roleId} not found in guild`);
            return;
        }

        // 5. 🎯 Remove role from member if they have it
        let roleWasRemoved = false;
        if (member && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(error => {
                console.error(`❌ Error removing role from member: ${error}`);
            });
            roleWasRemoved = true;
            console.log(`✅ Role removed from user: ${role.name} from ${member.user.tag}`);
        } else {
            console.log(`ℹ️ User ${member?.user?.tag || userId} doesn't have the role ${role.name}`);
        }

        // 6. 🗑️ Try to delete initial message
        try {
            if (initialMessageId && channelId) {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel && channel.isTextBased) {
                    const messageToDelete = await channel.messages.fetch(initialMessageId).catch(() => null);
                    if (messageToDelete && messageToDelete.deletable) {
                        await messageToDelete.delete().catch(error => {
                            //console.error('Cannot delete initial message:', error);
                        });
                        //console.log(`🗑️ Deleted initial message: ${initialMessageId}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error deleting initial message:', error);
        }

        // 7. 📢 Send removal log ONLY if role was actually removed
        if (roleWasRemoved && member) {
            await sendRemovalLog(client, guildId, member, role, durationStr, assignedById);
            //console.log(`📢 Removal log sent for: ${member.user.tag}`);
        } else {
            console.log(`⏩ Skipping removal log - role wasn't removed from user`);
        }

    } catch (error) {
        console.error(`❌ Critical error in removeRole: ${error}`);
    } finally {
        // 🔓 Always release the lock, even if there's an error
        delete global.roleRemovalLocks[lockKey];
        console.log(`🔓 Lock released for: ${lockKey}`);
    }
}

// دالة لإرسال رسالة الإزالة إلى قناة السجل
async function sendRemovalLog(client, guildId, member, role, durationStr, assignedById) {
    try {
        let logChannel = null;

        if (client.logChannels && client.logChannels[guildId]) {
            const guildChannels = client.logChannels[guildId];
            if (guildChannels.communitycommands) {
                logChannel = await client.channels.fetch(guildChannels.communitycommands.id).catch(() => null);
            }
        }

        if (!logChannel && client.dbManager) {
            const logChannels = await client.dbManager.getLogChannels(guildId);
            if (logChannels && logChannels.length > 0) {
                const communityCommandsChannel = logChannels.find(c => c.channel_type === 'communitycommands');
                if (communityCommandsChannel) {
                    logChannel = await client.channels.fetch(communityCommandsChannel.channel_id).catch(() => null);
                }
            }
        }

        if (!logChannel && client.dbManager) {
            const logChannels = await client.dbManager.getLogChannels(guildId);
            if (logChannels && logChannels.length > 0) {
                const modCommandsChannel = logChannels.find(c => c.channel_type === 'modcommands');
                const mainChannel = logChannels.find(c => c.channel_type === 'main');
                const welcomeChannel = logChannels.find(c => c.channel_type === 'welcome');

                if (modCommandsChannel) {
                    logChannel = await client.channels.fetch(modCommandsChannel.channel_id).catch(() => null);
                } else if (mainChannel) {
                    logChannel = await client.channels.fetch(mainChannel.channel_id).catch(() => null);
                } else if (welcomeChannel) {
                    logChannel = await client.channels.fetch(welcomeChannel.channel_id).catch(() => null);
                }
            }
        }

        if (!logChannel) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const possibleChannels = guild.channels.cache.filter(ch => 
                    ch.isTextBased() && 
                    (ch.name.includes('community') || ch.name.includes('commands') || ch.name.includes('general'))
                );

                if (possibleChannels.size > 0) {
                    logChannel = possibleChannels.first();
                } else {
                    const textChannels = guild.channels.cache.filter(ch => ch.isTextBased());
                    if (textChannels.size > 0) {
                        logChannel = textChannels.first();
                    }
                }
            }
        }

        if (logChannel && logChannel.isTextBased && typeof logChannel.send === 'function') {
            const assignedBy = await client.users.fetch(assignedById).catch(() => null);

            // تحويل المدة من الاختصارات إلى الشكل الكامل
            const durationMs = parseDuration(durationStr);
            const fullDuration = formatDuration(durationMs);

            const removeEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('<:Alarm:1429538046986158220> Temporary Role Removed')
                //.setDescription(`${role} removed from ${member.user.toString()}`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setImage(process.env.BlueLine)
                .addFields(
                    { name: 'Assigned Role', value: `${role}`, inline: true },
                    { name: 'Mmeber', value: `${member.user.toString()}`, inline: true },
                    { name: 'Duration', value: fullDuration, inline: false },
                    //{ name: 'Assigned By', value: assignedBy?.toString() || 'Unknown', inline: true }
                )

            await logChannel.send({ embeds: [removeEmbed] }).catch(error => {
                console.error('Error sending removal log message:', error);
            });
        }
    } catch (error) {
        console.error('Error in sendRemovalLog:', error);
    }
}

// ===== استعادة الرولات بعد إعادة التشغيل - معدلة لـ PostgreSQL ===== //
async function restoreTempRoles(client) {
    try {
        if (!client.dbManager) {
            console.error('Database manager not available for restoring temp roles');
            return;
        }

        console.log('🔄 Restoring temporary roles scheduling...');

        // 🔥 التغيير: بس جيب الرولات اللي مدةها أقل من يوم
        const activeTempRoles = await client.dbManager.all(
            'SELECT * FROM temp_roles WHERE expires_at > NOW() AND expires_at <= NOW() + INTERVAL \'1 day\''
        );

        const now = new Date();
        let restoredCount = 0;
        let skippedCount = 0;

        for (const entry of activeTempRoles) {
            try {
                const expiresAt = new Date(entry.expires_at);
                const remainingTime = expiresAt.getTime() - now.getTime();

                // 🔥 التغيير: تأكد إن الرول لسة موجود في الداتابيز قبل الجدولة
                const currentEntry = await client.dbManager.get(
                    'SELECT 1 FROM temp_roles WHERE user_id = ? AND role_id = ? AND guild_id = ?',
                    [entry.user_id, entry.role_id, entry.guild_id]
                );

                if (!currentEntry) {
                    console.log(`⏩ Skipping - role already removed: ${entry.user_id}-${entry.role_id}`);
                    skippedCount++;
                    continue;
                }

                // بس جدد الجدولة للرولات اللي فيها أقل من يوم
                scheduleRoleRemoval(
                    client, 
                    entry.user_id, 
                    entry.role_id, 
                    entry.guild_id, 
                    expiresAt, 
                    entry.duration, 
                    entry.assigned_by,
                    entry.initial_message_id,
                    entry.channel_id
                );

                restoredCount++;
                console.log(`✅ Scheduled role removal for user ${entry.user_id} in ${Math.round(remainingTime / 1000 / 60)} minutes`);

            } catch (error) {
                console.error('Error restoring temp role:', error);
            }
        }

        console.log(`✅ Restored ${restoredCount} roles, skipped ${skippedCount} (long duration/already removed)`);
    } catch (error) {
        console.error('Error in restoreTempRoles:', error);
    }
}

// 🔥 دالة معدلة للتحقق من الرولات المنتهية دورياً - لـ PostgreSQL
/*function startExpiredRolesCleanup(client) {
  // فقط تنظيف الرولات التي انتهت قبل إعادة التشغيل أو فاتتها الجدولة
  setInterval(async () => {
    try {
      // ابحث عن الرولات التي انتهت منذ أكثر من ساعة (PostgreSQL syntax)
      const veryExpiredRoles = await dbManager.all(
        'SELECT * FROM temp_roles WHERE expires_at <= NOW() - INTERVAL \'1 hour\''
      );

      if (veryExpiredRoles.length > 0) {
        console.log(`🧹 Found ${veryExpiredRoles.length} very expired temporary roles to clean up`);

        for (const tempRole of veryExpiredRoles) {
          // تحقق أولاً إذا الرول لسة موجود في الداتابيز
          const stillExists = await dbManager.get(
            'SELECT 1 FROM temp_roles WHERE user_id = $1 AND role_id = $2 AND guild_id = $3',
            [tempRole.user_id, tempRole.role_id, tempRole.guild_id]
          );

          if (stillExists) {
            await removeRole(
              client,
              tempRole.user_id,
              tempRole.role_id,
              tempRole.guild_id,
              tempRole.duration,
              tempRole.assigned_by,
              tempRole.initial_message_id,
              tempRole.channel_id
            );
          }
        }

        console.log(`✅ Cleaned up ${veryExpiredRoles.length} very expired temporary roles`);
      }
    } catch (error) {
      console.error('Error in expired roles cleanup:', error);
    }
  }, 30 * 60 * 1000); // كل 30 دقيقة فقط
}*/

// دالة مساعدة لتعريف رولات السيرفر - معدلة لاستخدام bot_settings
async function defineGuildRoles(client, guildId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        //console.log(`🔍 Loading roles for guild: ${guild.name} (${guildId})`);

        // من قاعدة البيانات باستخدام bot_settings table الموجود
        if (client.dbManager) {
            // جلب moderate role
            const moderateRoleData = await client.dbManager.getBotSetting('moderateRole');
            if (moderateRoleData) {
                try {
                    const roleInfo = JSON.parse(moderateRoleData.setting_value);
                    if (roleInfo.guildId === guildId) {
                        const moderateRole = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (moderateRole) {
                            if (!client.moderateRoles) client.moderateRoles = {};
                            client.moderateRoles[guildId] = moderateRole;
                            //console.log(`✅ Moderate role loaded for guild ${guildId}: ${moderateRole.name}`);
                        } else {
                            //console.log(`❌ Moderate role not found in guild: ${roleInfo.id}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing moderate role data:', error);
                }
            } else {
                console.log(`❌ No moderate role data found in database for guild ${guildId}`);
            }

            // جلب mod role
            const modRoleData = await client.dbManager.getBotSetting('modRole');
            if (modRoleData) {
                try {
                    const roleInfo = JSON.parse(modRoleData.setting_value);
                    if (roleInfo.guildId === guildId) {
                        const modRole = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (modRole) {
                            if (!client.modRoles) client.modRoles = {};
                            client.modRoles[guildId] = modRole;
                            //console.log(`✅ Mod role loaded for guild ${guildId}: ${modRole.name}`);
                        } else {
                            //console.log(`❌ Mod role not found in guild: ${roleInfo.id}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing mod role data:', error);
                }
            } else {
                console.log(`❌ No mod role data found in database for guild ${guildId}`);
            }
        }
    } catch (error) {
        console.error(`Error defining roles for guild ${guildId}:`, error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temprole')
        .setDescription('Give a temporary role to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Target User')
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Role to be given')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g.: 10m, 30s, 2h, 10d, 1w, or combined like "1w 2d 3h 4m 5s")')
                .setRequired(true)),

    execute,
    scheduleRoleRemoval,
    removeRole,
    sendRemovalLog,
    restoreTempRoles,
    //startExpiredRolesCleanup,
    defineGuildRoles
};