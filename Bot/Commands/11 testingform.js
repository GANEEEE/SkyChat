const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ChannelType } = require('discord.js');
const dbManager = require('../Data/database');

// تعريف الثوابت في الأعلى
const CHANNEL_ID = '1437536430665760809'; // القناة اللي هتتبعت فيها الطلبات
const THREADS_CHANNEL_ID = '1433584953479663747'; // القناة اللي هتفتح فيها الثريدات
const STAFF_ROLE_IDS = ['1394856511901143191', '1394011072708743229']; // array of staff role IDs - ضيف أي رول ستاف إضافي هنا
const TRANSCRIPT_CHANNEL_ID = '1433584897439699105'; // قناة حفظ الـ transcripts

function extractAppId(steamUrl) {
    const match = steamUrl.match(/app\/(\d+)/);
    return match ? match[1] : null;
}

// الدوال الجديدة للـ panel settings
async function savePanelInfo(channelId, messageId, gameLink = null) {
    await dbManager.run(
        `INSERT INTO tester_panel_settings 
         (panel_channel_id, panel_message_id, current_game_link) 
         VALUES ($1, $2, $3)
         ON CONFLICT (id) 
         DO UPDATE SET 
            panel_channel_id = EXCLUDED.panel_channel_id,
            panel_message_id = EXCLUDED.panel_message_id,
            current_game_link = EXCLUDED.current_game_link,
            updated_at = CURRENT_TIMESTAMP`,
        [channelId, messageId, gameLink]
    );
}

async function getPanelInfo() {
    const result = await dbManager.get(
        'SELECT panel_channel_id, panel_message_id, current_game_link FROM tester_panel_settings WHERE id = 1'
    );
    return result;
}

async function updateGameLink(gameLink) {
    await dbManager.run(
        'UPDATE tester_panel_settings SET current_game_link = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [gameLink]
    );
}

async function getGameLink() {
    const result = await dbManager.get(
        'SELECT current_game_link FROM tester_panel_settings WHERE id = 1'
    );
    return result ? result.current_game_link : null;
}

// تعريف الدوال خارج الـ module.exports
async function handleApproval(interaction, user, applicationData) {
    try {
        // التحقق من عدد الثريدات النشطة
        const activeThreads = await dbManager.all(
            'SELECT COUNT(*) as count FROM tester_applications WHERE thread_status = $1',
            ['active']
        );

        const activeCount = activeThreads[0]?.count || 0;
        const MAX_ACTIVE_THREADS = 5;

        if (activeCount >= MAX_ACTIVE_THREADS) {
            // جلب بيانات الـ 5 ثريدات النشطة
            const activeApplications = await dbManager.all(
                'SELECT user_tag, thread_id FROM tester_applications WHERE thread_status = $1 ORDER BY processed_at DESC LIMIT 5',
                ['active']
            );

            let activeList = 'Currently active testers:\n';
            activeApplications.forEach((app, index) => {
                activeList += `${index + 1}. ${app.user_tag}\n`;
            });

            const limitEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ Maximum Active Threads Reached')
                .setDescription(`Cannot create new thread. Maximum of ${MAX_ACTIVE_THREADS} active threads allowed.`)
                .addFields(
                    { name: 'Active Testers', value: activeList, inline: false }
                )
                .setFooter({ text: 'Please close some threads before approving new applications' })
                .setImage(process.env.OrangeLine)

            await interaction.editReply({ 
                content: ' ',
                embeds: [limitEmbed] 
            });
            return;
        }

        const channel = await interaction.client.channels.fetch(THREADS_CHANNEL_ID);

        const thread = await channel.threads.create({
            name: 'tester-lab-' + user.username + '-' + Date.now().toString().slice(-4),
            autoArchiveDuration: 10080,
            type: ChannelType.PrivateThread,
            reason: 'Tester approval for ' + user.tag
        });

        // إضافة المستخدم والأدمن للثريد
        await thread.members.add(user.id);
        await thread.members.add(interaction.user.id);

        const threadEmbed = new EmbedBuilder()
            .setColor(process.env.Bluecolor)
            .setTitle('🧪 The Tester Lab')
            .setDescription(`Welcome to the testing lab **${user}**\nYou’re now part of our testing team\nThanks for helping us improve our projects.`)
            .addFields(
                //{ name: '👤 Tester', value: user + ' (' + user.tag + ')', inline: false },
                { name: '📝 Report Prototype', value: '```markdown\nGame Tester Report\n\nGame Title: [Game Name]\n\nUI / UX Feedback\n\n[Short and clear point #1]\n[Short and clear point #2]\n[Short and clear point #3]\n\n---\n\nGameplay & Features\n\n[Comment about gameplay mechanics or balance]\n[Suggestion for improvement or feature idea]\n\n---\n\nBugs & Technical Issues\n\n[Brief description of the bug or issue]\n[Steps to reproduce it, if possible]\n\n---\n\nOverall Impression\n\nShort summary of your experience, Example: \n"The game feels smooth and enjoyable. Excited to see future updates!"\n```', inline: false },
                //{ name: '📅 Approved At', value: '<t:' + Math.floor(Date.now() / 1000) + ':F>', inline: false },
                { name: '💡 Important Notes', value: '```• Testers have two weeks to submit their detailed review after being accepted.\n• The deadline can be extended in special cases, but not for a long period.\n• Sharing any gameplay footage, screenshots, or information publicly is strictly prohibited unless explicitly permitted.\n• Any irrelevant or unhelpful information will result in disqualification```', inline: false },
            )
            //.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            //.setImage(process.env.BlueLine)

        // أزرار إدارة الثريد
        const closeButton = new ButtonBuilder()
            .setCustomId('close_thread_options_' + thread.id)
            .setLabel('Close Lab')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔒');

        const threadActionRow = new ActionRowBuilder().addComponents(closeButton);

        // إرسال رسالة المنشن كـ spoiler مع منشن جميع رولز الستاف
        const staffMentions = STAFF_ROLE_IDS.map(roleId => `<@&${roleId}>`).join(' ');

        const mentionMessage = await thread.send({
            content: `||${staffMentions}||\n`
        });

        // إرسال الإمبدد بعد المنشن
        await thread.send({
            content: ' ',
            embeds: [threadEmbed],
            components: [threadActionRow]
        });

        await dbManager.run(
            'UPDATE tester_applications SET status = $1, processed_by = $2, thread_id = $3, thread_status = $4 WHERE user_id = $5',
            ['approved', interaction.user.id, thread.id, 'active', user.id]
        );

        await interaction.editReply({ 
            content: '✅ Application approved and private thread created for ' + user.tag + '.'
        });

    } catch (error) {
        console.error('Error creating thread:', error);
        await interaction.editReply({ content: '❌ Error creating private thread.' });
    }
}

async function handleRejection(interaction, user, applicationData) {
    await dbManager.run(
        'UPDATE tester_applications SET status = $1, processed_by = $2 WHERE user_id = $3',
        ['rejected', interaction.user.id, user.id]
    );

    await interaction.editReply({ 
        content: '❌ Application rejected for ' + user.tag + '.'
    });
}

// دالة للتحقق إذا اليوزر عنده صلاحيات ستاف
function hasStaffRole(member) {
    if (!member) return false;
    return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

async function createTranscript(thread, closeReason = 'No reason provided') {
    try {
        // تجميع الرسائل من الثريد
        const messages = await thread.messages.fetch({ limit: 100 });

        let transcript = `# Transcript for Thread: ${thread.name}\n`;
        transcript += `Created: ${thread.createdAt}\n`;
        transcript += `Closed: ${new Date().toISOString()}\n`;
        transcript += `Close Reason: ${closeReason}\n\n`;
        transcript += `Participants:\n`;

        // جمع المشاركين
        const members = await thread.members.fetch();
        members.forEach(member => {
            if (!member.user.bot) {
                transcript += `- ${member.user.tag} (${member.user.id})\n`;
            }
        });
        transcript += '\n';

        messages.reverse().forEach(message => {
            if (!message.author.bot) {
                transcript += `[${message.createdAt.toISOString()}] ${message.author.tag}: ${message.content}\n`;
                if (message.embeds.length > 0) {
                    transcript += `[Embed: ${message.embeds[0].title || 'No Title'}]\n`;
                }
                if (message.attachments.size > 0) {
                    transcript += `[Attachment: ${message.attachments.first().name}]\n`;
                }
                transcript += '\n';
            }
        });

        return transcript;
    } catch (error) {
        console.error('Error creating transcript:', error);
        return 'Error generating transcript';
    }
}

// دالة جديدة لعرض خيارات الإغلاق
async function showCloseOptions(interaction, threadId) {
    const confirmEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('🔒 Close Thread')
        .setDescription('How would you like to close this thread?')
        .addFields(
            { name: '🔒 Close', value: 'Close the thread immediately without providing a reason', inline: false },
            { name: '📝 Close With Reason', value: 'Close the thread and provide a reason for closure', inline: false }
        )
        .setImage(process.env.OrangeLine)

    const closeWithoutReasonButton = new ButtonBuilder()
        .setCustomId('close_without_reason_' + threadId)
        .setLabel('Close')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒');

    const closeWithReasonButton = new ButtonBuilder()
        .setCustomId('close_with_reason_' + threadId)
        .setLabel('Close With Reason')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝');

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_close_' + threadId)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

    const actionRow = new ActionRowBuilder().addComponents(closeWithoutReasonButton, closeWithReasonButton, cancelButton);

    await interaction.reply({
        content: ' ',
        embeds: [confirmEmbed],
        components: [actionRow],
        flags: 64
    });
}

// دالة جديدة لعرض تأكيد الإغلاق
async function showCloseConfirmation(interaction, threadId, withReason = false) {
    const action = withReason ? 'with reason' : 'without reason';

    const confirmEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ Confirm Thread Closure')
        .setDescription(`Are you sure you want to close this thread ${action}?`)
        .addFields(
            { name: '📌 Note', value: 'This action cannot be undone. The thread will be archived and locked.', inline: false }
        )
        .setImage(process.env.OrangeLine)

    const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_close_${withReason ? 'with_reason_' : 'without_reason_'}${threadId}`)
        .setLabel('Yes, Close Thread')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔒');

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_final_' + threadId)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

    const actionRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.update({
        content: ' ',
        embeds: [confirmEmbed],
        components: [actionRow]
    });
}

// دالة جديدة لعمل مودال إدخال السبب
async function showReasonModal(interaction, threadId) {
    const modal = new ModalBuilder()
        .setCustomId('close_reason_modal_' + threadId)
        .setTitle('Thread Closure Reason');

    const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Why are you closing this thread?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Provide a reason for closing this thread...')
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(500);

    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
}

// دالة إغلاق الثريد الأساسية
async function closeThread(interaction, threadId, closeReason = 'No reason provided') {
    try {
        const thread = await interaction.client.channels.fetch(threadId);
        if (thread && thread.isThread()) {
            // عمل transcript قبل الإغلاق
            const transcript = await createTranscript(thread, closeReason);

            // حفظ الـ transcript في قناة مخصصة
            const transcriptChannel = await interaction.client.channels.fetch(TRANSCRIPT_CHANNEL_ID);
            const transcriptFile = Buffer.from(transcript, 'utf8');

            const transcriptEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('📄 Thread Transcript')
                //.setDescription(`Transcript for: ${thread.name}`)
                .addFields(
                    { name: 'Thread Name', value: thread.name, inline: false },
                    { name: 'Created', value: `<t:${Math.floor(thread.createdAt.getTime() / 1000)}:F>`, inline: false },
                    { name: 'Closed', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                    { name: 'Close Reason', value: closeReason, inline: false }
                )
                .setImage(process.env.BlueLine)

            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                files: [{
                    attachment: transcriptFile,
                    name: `transcript-${thread.name}-${Date.now()}.txt`
                }]
            });

            // إرسال رسالة إغلاق في الثريد نفسه
            const closeEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔒 Thread Closed')
                .setDescription('This thread has been closed and archived.')
                .addFields(
                    { name: 'Closed By', value: interaction.user.toString(), inline: true },
                    { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: 'Reason', value: closeReason, inline: false }
                )
                .setImage(process.env.OrangeLine)

            await thread.send({
                content: ' ',
                embeds: [closeEmbed]
            });

            await thread.setLocked(true);
            await thread.setArchived(true);

            await dbManager.run(
                'UPDATE tester_applications SET thread_status = $1 WHERE thread_id = $2',
                ['closed', threadId]
            );

            return true;
        }
        return false;
    } catch (error) {
        console.error('Error closing thread:', error);
        throw error;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testerspanel')
        .setDescription('Sign up to become a game tester panel'),

    async execute(interaction, client) {
        // التحقق من صلاحيات الستاف - نفس النظام القديم
        /*if (!hasStaffRole(interaction.member)) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                flags: 64
            });
        }*/

        // التحقق من moderate role زي ما في الـ addinvites command
        try {
            // جلب Moderate Role من قاعدة البيانات
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return await interaction.reply({ embeds: [embed], flags: 64 });
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
                    .setDescription(`This command is available only for <@&${roleInfo.id}>`);
                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

        } catch (error) {
            console.error('Error checking moderate role:', error);
            return await interaction.reply({
                content: '❌ Error checking permissions.',
                flags: 64
            });
        }

        // الباقي زي ما هو...
        const channel = interaction.channel;

        // جيب الـ game link من الجدول الجديد
        let GAME_LINK = await getGameLink();
        if (!GAME_LINK) {
            GAME_LINK = 'https://store.steampowered.com/app/3794610/Goblin_Vyke/';
            await updateGameLink(GAME_LINK);
        }

        // أضف كود الصورة هنا
        let gameHeaderImage = process.env.BlueLine;
        try {
            const axios = require('axios');
            const appId = extractAppId(GAME_LINK);
            const appDetailsResponse = await axios.get(
                `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=US&l=en`
            );

            const details = appDetailsResponse.data[appId];
            if (details && details.success) {
                gameHeaderImage = details.data.header_image;
            }
        } catch (error) {
            console.error('Error fetching game details:', error);
        }

        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('Game Tester Application')
            .setDescription('**🧪 Interested in becoming a Game Tester?**\nClick the button below `Apply Now`\nAnd help shape the future of our games!')
            .addFields(
                { name: '🎯 Prototype', value: '```markdown\nGame Tester Report\n\nGame Title: [Game Name]\n\nUI / UX Feedback\n\n[Short and clear point #1]\n[Short and clear point #2]\n[Short and clear point #3]\n\n---\n\nGameplay & Features\n\n[Comment about gameplay mechanics or balance]\n[Suggestion for improvement or feature idea]\n\n---\n\nBugs & Technical Issues\n\n[Brief description of the bug or issue]\n[Steps to reproduce it, if possible]\n\n---\n\nOverall Impression\n\nShort summary of your experience, Example: \n"The game feels smooth and enjoyable. Excited to see future updates!"\n```', inline: false },
                { name: '📋 Application Includes', value: '```• Steam Link Profile\n• Favorite Game Genres\n• Why do you want to be a tester?\n• Any Previous Experience?```', inline: false },
                { name: '🎯 Benefits', value: '```• Get tester role\n• Early access to new features```', inline: false },
                { name: '💡 Notes',    value: '```• The review period will last for at least 1 month.\n\n• The deadline can be shortened to one week if no information is submitted within this time, the participant will be disqualified.\n\n• Sharing or revealing any (gameplay footage - screenshots - internal information) is strictly prohibited unless explicit permission has been granted.\n\n• Any irrelevant or low-quality responses may lead to disqualification from the testing program.```',
                 inline: false  },
                { name: 'Game Link', value: `${GAME_LINK}`, inline: false },
            )
            .setImage(gameHeaderImage)

        const button = new ButtonBuilder()
            .setCustomId('apply_tester')
            .setLabel('Apply Now')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🥼');

        const gameLinkButton = new ButtonBuilder()
        .setLabel('View Game')
        .setStyle(ButtonStyle.Link)
        .setURL(GAME_LINK)
        .setEmoji('🎮');

        const row = new ActionRowBuilder().addComponents(button, gameLinkButton);

        // جيب معلومات الـ panel
        const panelInfo = await getPanelInfo();

        if (panelInfo && panelInfo.panel_channel_id === channel.id) {
            try {
                // عدل الرسالة القديمة
                const oldMessage = await channel.messages.fetch(panelInfo.panel_message_id);
                await oldMessage.edit({ 
                    content: ' ',
                    embeds: [embed],
                    components: [row]
                });

                // حدث الـ game link لو اتغير
                await updateGameLink(GAME_LINK);

                await interaction.reply({ 
                    content: '✅ Tester panel has been updated!',
                    flags: 64 
                });

            } catch (error) {
                // لو الرسالة مش موجودة، أنشئ جديدة
                const newMessage = await channel.send({ 
                    content: ' ',
                    embeds: [embed],
                    components: [row]
                });

                await savePanelInfo(channel.id, newMessage.id, GAME_LINK);
                await interaction.reply({ 
                    content: '✅ New tester panel has been created!',
                    flags: 64 
                });
            }
        } else {
            // مفيش panel، أنشئ جديد
            const newMessage = await channel.send({ 
                content: ' ',
                embeds: [embed],
                components: [row]
            });

            await savePanelInfo(channel.id, newMessage.id, GAME_LINK);
            await interaction.reply({ 
                content: '✅ Tester panel has been created!',
                flags: 64 
            });
        }
    },

    buttonHandler: async (interaction) => {
        // التحقق من صلاحيات الستاف للأزرار الإدارية - نفس النظام القديم
        if (interaction.customId.startsWith('approve_') || 
            interaction.customId.startsWith('reject_') || 
            interaction.customId.startsWith('redecied_') ||
            interaction.customId.startsWith('close_thread_options_') ||
            interaction.customId.startsWith('close_without_reason_') ||
            interaction.customId.startsWith('close_with_reason_') ||
            interaction.customId.startsWith('confirm_close_')) {

            if (!hasStaffRole(interaction.member)) {
                return await interaction.reply({
                    content: '❌ You do not have permission to use this button.',
                    flags: 64
                });
            }
        }

        if (interaction.customId === 'apply_tester') {
            const existingApplication = await dbManager.get(
                'SELECT * FROM tester_applications WHERE user_id = $1 AND status = $2',
                [interaction.user.id, 'pending']
            );

            if (existingApplication) {
                return await interaction.reply({ 
                    content: '❌ You already have a pending application. Please wait for it to be reviewed.', 
                    flags: 64 
                });
            }

            const modal = new ModalBuilder()
                .setCustomId('tester_application_form')
                .setTitle('Game Tester Application Form');

            const steamLinkInput = new TextInputBuilder()
                .setCustomId('steam_link')
                .setLabel('Steam Profile Link')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://steamcommunity.com/id/yourprofile')
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(100);

            const genresInput = new TextInputBuilder()
                .setCustomId('favorite_genres')
                .setLabel('Favorite Game Genres')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Idle - Cooking - Horror - RPG - etc...')
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(100);

            const reviewInput = new TextInputBuilder()
                .setCustomId('personal_review')
                .setLabel('Why Join as a Tester?')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Share your thoughts, motivation, and what makes you a good tester...')
                .setRequired(true)
                .setMinLength(20)
                .setMaxLength(1000);

            const experienceInput = new TextInputBuilder()
                .setCustomId('previous_experience')
                .setLabel('Previous Testing Experience')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Yes - No (Add details if yes)')
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(100);

            const firstActionRow = new ActionRowBuilder().addComponents(steamLinkInput);
            const secondActionRow = new ActionRowBuilder().addComponents(genresInput);
            const thirdActionRow = new ActionRowBuilder().addComponents(reviewInput);
            const fourthActionRow = new ActionRowBuilder().addComponents(experienceInput);

            modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

            await interaction.showModal(modal);
        }
        else if (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('reject_')) {
            await interaction.deferReply({ flags: 64 });

            const action = interaction.customId.split('_')[0];
            const userId = interaction.customId.split('_')[1];

            try {
                const user = await interaction.client.users.fetch(userId);

                const applicationData = await dbManager.get(
                    'SELECT * FROM tester_applications WHERE user_id = $1 AND status = $2',
                    [userId, 'pending']
                );

                if (!applicationData) {
                    return await interaction.editReply({
                        content: '❌ Application data not found or already processed.'
                    });
                }

                if (action === 'approve') {
                    await handleApproval(interaction, user, applicationData);
                } else if (action === 'reject') {
                    await handleRejection(interaction, user, applicationData);
                }

                const originalEmbed = interaction.message.embeds[0];
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor(action === 'approve' ? '#00FF88' : '#FF4444')
                    .setTitle('🎮 Application ' + (action === 'approve' ? 'Approved' : 'Rejected'))
                    .setDescription(action === 'approve' ? 
                        'Application has been approved and thread created.' : 
                        'Application has been rejected.'
                    )
                    .setImage(process.env.BlueLine)

                // إضافة زر Redecide
                const redeciedButton = new ButtonBuilder()
                    .setCustomId('redecied_' + userId)
                    .setLabel('Redecide')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄');

                const actionRow = new ActionRowBuilder().addComponents(redeciedButton);

                await interaction.message.edit({ 
                    embeds: [updatedEmbed], 
                    components: [actionRow] 
                });

            } catch (error) {
                console.error('Error processing application action:', error);
                await interaction.editReply({ content: '❌ Error processing this action.' });
            }
        }
        else if (interaction.customId.startsWith('redecied_')) {
            await interaction.deferReply({ flags: 64 });

            const userId = interaction.customId.replace('redecied_', '');

            try {
                const user = await interaction.client.users.fetch(userId);

                // جلب بيانات الطلب علشان نعرف إذا كان فيه thread
                const applicationData = await dbManager.get(
                    'SELECT * FROM tester_applications WHERE user_id = $1',
                    [userId]
                );

                // إذا كان فيه thread نشط، نمسحه
                if (applicationData && applicationData.thread_id && applicationData.thread_status === 'active') {
                    try {
                        const thread = await interaction.client.channels.fetch(applicationData.thread_id);
                        if (thread && thread.isThread()) {
                            // عمل transcript قبل الإغلاق
                            const transcript = await createTranscript(thread, 'Decision reset by staff');

                            // حفظ الـ transcript - استخدام TRANSCRIPT_CHANNEL_ID من الأعلى
                            const transcriptChannel = await interaction.client.channels.fetch(TRANSCRIPT_CHANNEL_ID);
                            const transcriptFile = Buffer.from(transcript, 'utf8');

                            const transcriptEmbed = new EmbedBuilder()
                                .setColor(process.env.Bluecolor)
                                .setTitle('📄 Thread Transcript (Redecided)')
                                .addFields(
                                    { name: 'Thread Name', value: thread.name, inline: false },
                                    { name: 'Created', value: `<t:${Math.floor(thread.createdAt.getTime() / 1000)}:F>`, inline: false },
                                    { name: 'Closed', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                                    //{ name: 'Reason', value: 'Decision reset by staff', inline: false }
                                )
                                .setImage(process.env.BlueLine)

                            await transcriptChannel.send({
                                embeds: [transcriptEmbed],
                                files: [{
                                    attachment: transcriptFile,
                                    name: `transcript-redecided-${thread.name}-${Date.now()}.txt`
                                }]
                            });

                            await thread.setLocked(true);
                            await thread.setArchived(true);
                        }
                    } catch (threadError) {
                        console.error('Error closing thread during redecied:', threadError);
                    }
                }

                // إعادة تعيين حالة الطلب لـ pending ومسح بيانات الـ thread
                await dbManager.run(
                    'UPDATE tester_applications SET status = $1, processed_by = NULL, processed_at = NULL, thread_id = NULL, thread_status = NULL WHERE user_id = $2',
                    ['pending', userId]
                );

                const originalEmbed = interaction.message.embeds[0];
                const updatedEmbed = EmbedBuilder.from(originalEmbed)
                    .setColor('#0073ff')
                    .setTitle('🔄 Decision Reset')
                    //.setDescription('Application decision has been reset.\nYou can now approve or reject again.')
                    .addFields(
                        { name: 'Applicant', value: user.tag, inline: true },
                        { name: 'Thread Status', value: applicationData?.thread_id ? 'Thread closed and archived' : 'No active thread', inline: true }
                    )
                    .setImage(process.env.BlueLine)

                // إعادة الأزرار الأصلية
                const approveButton = new ButtonBuilder()
                    .setCustomId('approve_' + userId)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('✅');

                const rejectButton = new ButtonBuilder()
                    .setCustomId('reject_' + userId)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌');

                const actionRow = new ActionRowBuilder().addComponents(approveButton, rejectButton);

                await interaction.message.edit({ 
                    embeds: [updatedEmbed], 
                    components: [actionRow] 
                });

                await interaction.editReply({ 
                    content: '✅ Decision reset successfully' + 
                            (applicationData?.thread_id ? ' and thread archived.' : '')
                });

            } catch (error) {
                console.error('Error resetting decision:', error);
                await interaction.editReply({ content: '❌ Error resetting decision.' });
            }
        }
        // النظام الجديد للإغلاق مع التأكيد والسبب
        else if (interaction.customId.startsWith('close_thread_options_')) {
            const threadId = interaction.customId.replace('close_thread_options_', '');
            await showCloseOptions(interaction, threadId);
        }
        else if (interaction.customId.startsWith('close_without_reason_')) {
            const threadId = interaction.customId.replace('close_without_reason_', '');
            await showCloseConfirmation(interaction, threadId, false);
        }
        else if (interaction.customId.startsWith('close_with_reason_')) {
            const threadId = interaction.customId.replace('close_with_reason_', '');
            await showReasonModal(interaction, threadId);
        }
        else if (interaction.customId.startsWith('cancel_close_')) {
            await interaction.update({
                content: '❌ Thread will remain open.',
                embeds: [],
                components: []
            });
        }
        else if (interaction.customId.startsWith('cancel_final_')) {
            await interaction.update({
                content: '❌ Thread will remain open.',
                embeds: [],
                components: []
            });
        }
        else if (interaction.customId.startsWith('confirm_close_without_reason_')) {
            await interaction.deferReply({ flags: 64 });

            const threadId = interaction.customId.replace('confirm_close_without_reason_', '');

            try {
                const success = await closeThread(interaction, threadId, 'No reason provided');

                if (success) {
                    await interaction.editReply({
                        content: '✅ Thread closed successfully without reason and transcript saved.'
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Thread not found or already closed.'
                    });
                }
            } catch (error) {
                console.error('Error closing thread:', error);
                await interaction.editReply({
                    content: '❌ Error closing thread.'
                });
            }
        }
        else if (interaction.customId.startsWith('confirm_close_with_reason_')) {
            // هذه الحالة بتكون بعد إدخال السبب في المودال
            // بتكون معالجة في الـ modalHandler
        }
    },

    modalHandler: async (interaction) => {
        if (interaction.customId === 'tester_application_form') {
            await interaction.deferReply({ flags: 64 });

            try {
                const steamLink = interaction.fields.getTextInputValue('steam_link');
                const favoriteGenres = interaction.fields.getTextInputValue('favorite_genres');
                const personalReview = interaction.fields.getTextInputValue('personal_review');
                const previousExperience = interaction.fields.getTextInputValue('previous_experience');

                // التحقق مرة تانيه علشان نتأكد
                const existingApplication = await dbManager.get(
                    'SELECT * FROM tester_applications WHERE user_id = $1 AND status = $2',
                    [interaction.user.id, 'pending']
                );

                if (existingApplication) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ Application Already Exists')
                        .setDescription('You already have a pending application. Please wait for it to be reviewed.')
                        .setImage(process.env.RedLine)
                    return await interaction.editReply({ embeds: [errorEmbed] });
                }

                // استخدام UPSERT بدل INSERT علشان نتجنب الـ duplicate
                await dbManager.run(
                    `INSERT INTO tester_applications (user_id, user_tag, status) 
                     VALUES ($1, $2, $3) 
                     ON CONFLICT (user_id) 
                     DO UPDATE SET user_tag = $2, status = $3, submitted_at = CURRENT_TIMESTAMP`,
                    [interaction.user.id, interaction.user.tag, 'pending']
                );

                const applicationResult = await dbManager.get(
                    'SELECT id FROM tester_applications WHERE user_id = $1 AND status = $2 ORDER BY id DESC LIMIT 1',
                    [interaction.user.id, 'pending']
                );

                const applicationId = applicationResult ? applicationResult.id : 'N/A';

                const applicationEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('🧪 New Game Tester Application')
                    .setDescription('**Application Submitted by ' + interaction.user.tag + '**')
                    .addFields(
                        { name: '👨‍💻 Applicant Info', value: 'User: ' + `${interaction.user}` + '\nUser ID: ' + `**${interaction.user.id}**`, inline: false },
                        { name: '🔗 Steam Profile', value: steamLink || 'Not provided', inline: false },
                        { name: '🎯 Favorite Genres', value: favoriteGenres || 'Not provided', inline: false },
                        { name: '📝 Previous Experience?', value: previousExperience || 'Not provided', inline: false },
                        { name: '💭 Personal Review & Motivation', value: personalReview.length > 1024 ? personalReview.substring(0, 1020) + '...' : personalReview || 'Not provided', inline: false },
                        //{ name: 'Application ID', value: '[' + applicationId + ']', inline: false }
                    )
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setImage(process.env.BlueLine)

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('approve_' + interaction.user.id)
                            .setLabel('Approve')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId('reject_' + interaction.user.id)
                            .setLabel('Reject')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌')
                    );

                const channel = await interaction.client.channels.fetch(CHANNEL_ID);

                // إرسال الرسالة كرساءة عادية مش مرتبطة بالأمر
                const applicationMessage = await channel.send({ 
                    embeds: [applicationEmbed], 
                    components: [actionRow] 
                });

                if (applicationId !== 'N/A') {
                    await dbManager.run(
                        'UPDATE tester_applications SET message_id = $1 WHERE id = $2',
                        [applicationMessage.id, applicationId]
                    );
                }

                const successEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('Application Submitted Successfully!')
                    .setDescription('Your game tester application has been received and is under review.')
                    //.setFooter({ text: 'Thank you for your interest!' })
                    .setImage(process.env.BlueLine)

                await interaction.editReply({ embeds: [successEmbed] });

            } catch (error) {
                console.error('Error submitting application:', error);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Application Error')
                    .setDescription('There was an error submitting your application. Please try again later.')
                    .setImage(process.env.RedLine)

                await interaction.editReply({ embeds: [errorEmbed] });
            }
        }
        // معالجة مودال سبب الإغلاق
        else if (interaction.customId.startsWith('close_reason_modal_')) {
            await interaction.deferReply({ flags: 64 });

            const threadId = interaction.customId.replace('close_reason_modal_', '');
            const closeReason = interaction.fields.getTextInputValue('close_reason');

            try {
                const success = await closeThread(interaction, threadId, closeReason);

                if (success) {
                    await interaction.editReply({
                        content: '✅ Thread closed successfully with reason and transcript saved.'
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Thread not found or already closed.'
                    });
                }
            } catch (error) {
                console.error('Error closing thread with reason:', error);
                await interaction.editReply({
                    content: '❌ Error closing thread.'
                });
            }
        }
    },

    // تعريف الدوال علشان تبقى متاحة
    handleApproval: handleApproval,
    handleRejection: handleRejection,
    closeThread: closeThread,
    hasStaffRole: hasStaffRole
};