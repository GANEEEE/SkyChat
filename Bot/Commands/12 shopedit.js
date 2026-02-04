const {
    SlashCommandBuilder,
    SectionBuilder,
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    SeparatorBuilder,
    MessageFlags,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle
} = require('discord.js');
const dbManager = require('../Data/database');

// إدارة الجلسات
class ShopSessionManager {
    constructor() {
        this.sessions = new Map();
        this.startCleanup();
    }

    getSession(userId) {
        return this.sessions.get(userId);
    }

    setSession(userId, sessionData) {
        this.sessions.set(userId, {
            ...sessionData,
            lastUpdated: Date.now()
        });
    }

    deleteSession(userId) {
        return this.sessions.delete(userId);
    }

    hasSession(userId) {
        return this.sessions.has(userId);
    }

    // تنسيق الأرقام
    formatNumber(num) {
        if (!num || num === 0) return '0';

        if (num >= 1000000) {
            const formatted = (num / 1000000).toFixed(1);
            return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M';
        } else if (num >= 1000) {
            return Math.floor(num / 1000) + 'K';
        }
        return num.toString();
    }

    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            let deletedCount = 0;

            for (const [userId, session] of this.sessions.entries()) {
                if (now - session.lastUpdated > 30 * 60 * 1000) {
                    this.sessions.delete(userId);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`🧹 Cleaned up ${deletedCount} old shop sessions`);
            }
        }, 5 * 60 * 1000);
    }
}

const shopSessionManager = new ShopSessionManager();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shopedit')
        .setDescription('🛠️ Manage server shop - Admin only')
        .setDMPermission(false),

    async execute(interaction, client) {
        try {
            console.log(`🛠️ /shopedit command by ${interaction.user.tag}`);

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine || '')
                    .setDescription('Moderation role not assigned. Please configure the role using `/setrole`.');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // تحقق إذا المستخدم عنده الصلاحية
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setImage(process.env.RedLine || '')
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // جلب المنتجات النشطة
            const items = await dbManager.getActiveShopItems();

            if (items.length === 0) {
                await this.displayEmptyShop(interaction);
                return;
            }

            // عرض الصفحة الأولى
            await this.displayShopPage(interaction, 1, items, true);

        } catch (error) {
            console.error('Error executing shopedit command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('❌ **Error loading shop**\nPlease try again later')
                .setTimestamp();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ 
                    embeds: [errorEmbed], 
                    components: [],
                    allowedMentions: { parse: [] }
                });
            } else {
                await interaction.reply({ 
                    embeds: [errorEmbed], 
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }
        }
    },

    async displayEmptyShop(interaction) {
        const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });

        const firstSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    '# 🛠️ **Shop Management**\n' +
                    '### Admin interface only\n*Shop is currently empty*'
                )
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`${interaction.guild.name} - Shop Management`)
                    .setURL(serverIcon)
            );

        const fourthSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent('**Page:** 0/0')
            )
            .setButtonAccessory((button) =>
                button
                    .setCustomId('add_item')
                    .setLabel('Add first product')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji({name: '➕'})
            );

        const separator = new SeparatorBuilder().setDivider(true);

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => firstSection)
            .addSeparatorComponents((separator) => separator)
            .addSectionComponents((section) => fourthSection);

        const response = await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: false,
            allowedMentions: { parse: [] },
            fetchReply: true
        });

        // حفظ الجلسة
        shopSessionManager.setSession(interaction.user.id, {
            page: 1,
            items: [],
            messageId: response.id,
            channelId: interaction.channelId,
            totalPages: 1
        });
    },

    async displayShopPage(interaction, pageNumber, allItems, isNewCommand = false) {
        try {
            const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });
            const itemsPerPage = 3;
            const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

            // تصحيح رقم الصفحة
            if (pageNumber > totalPages) {
                pageNumber = totalPages;
            }
            if (pageNumber < 1) {
                pageNumber = 1;
            }

            const startIndex = (pageNumber - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageItems = allItems.slice(startIndex, endIndex);

            console.log(`📊 Displaying page ${pageNumber}/${totalPages}, items: ${pageItems.length}, total: ${allItems.length}`);

            // بناء الـ Container
            const container = this.buildShopContainer(
                interaction, 
                pageNumber, 
                totalPages, 
                pageItems, 
                serverIcon
            );

            const userSession = shopSessionManager.getSession(interaction.user.id);

            // محاولة تعديل الرسالة الأصلية
            if (userSession && userSession.messageId && userSession.channelId && !isNewCommand) {
                try {
                    const channel = await interaction.guild.channels.fetch(userSession.channelId);
                    const message = await channel.messages.fetch(userSession.messageId);

                    if (message.author.id === interaction.client.user.id) {
                        await message.edit({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2,
                            allowedMentions: { parse: [] }
                        });

                        shopSessionManager.setSession(interaction.user.id, {
                            ...userSession,
                            page: pageNumber,
                            items: allItems,
                            totalPages: totalPages
                        });

                        if (interaction.isButton() || interaction.isModalSubmit()) {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.deferUpdate().catch(() => {});
                            }
                        }

                        return;
                    }
                } catch (error) {
                    console.log('⚠️ Could not edit original message:', error.message);
                }
            }

            // إرسال رد جديد
            let response;

            if (interaction.isModalSubmit()) {
                if (!interaction.replied && !interaction.deferred) {
                    response = await interaction.reply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                        ephemeral: false,
                        allowedMentions: { parse: [] },
                        fetchReply: true
                    });
                } else {
                    response = await interaction.editReply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2,
                        allowedMentions: { parse: [] },
                        fetchReply: true
                    });
                }
            } else if (interaction.deferred || interaction.replied) {
                response = await interaction.editReply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                    fetchReply: true
                });
            } else {
                response = await interaction.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    ephemeral: false,
                    allowedMentions: { parse: [] },
                    fetchReply: true
                });
            }

            // حفظ/تحديث الجلسة
            shopSessionManager.setSession(interaction.user.id, {
                page: pageNumber,
                items: allItems,
                messageId: response.id,
                channelId: response.channelId || interaction.channelId,
                totalPages: totalPages
            });

        } catch (error) {
            console.error('Error in displayShopPage:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Error displaying shop. Please use `/shopedit` again.',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }
        }
    },

    buildShopContainer(interaction, pageNumber, totalPages, pageItems, serverIcon) {
        const firstSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    '# 🛠️ **Shop Management**\n' +
                    '### Admin interface only\nBrowse available products below'
                )
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`${interaction.guild.name} - Shop Management`)
                    .setURL(serverIcon)
            );

        const separator = new SeparatorBuilder().setDivider(true);

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => firstSection)
            .addSeparatorComponents((separator) => separator);

        // إضافة المنتجات
        for (const item of pageItems) {
            const emoji = item.item_emoji && item.item_emoji.trim() !== '' ? item.item_emoji : '';
            const role = interaction.guild.roles.cache.get(item.role_id);
            const roleMention = role ? `<@&${item.role_id}>` : `Role ${item.role_id}`;

            // بناء النص الرئيسي للمنتج
            let itemContent = `### **${emoji}${emoji ? ' ' : ''}${roleMention}**\n`;

            if (item.description) {
                itemContent += `${item.description}\n`;
            }

            // السعر
            let priceText = '';
            if (item.is_on_sale && item.current_discount > 0) {
                const discountedCoins = item.discounted_price_coins || Math.floor(item.original_price_coins * (1 - item.current_discount/100));
                const discountedCrystals = item.discounted_price_crystals || Math.floor(item.original_price_crystals * (1 - item.current_discount/100));

                let originalText = '';
                if (item.original_price_coins > 0) originalText += `**${shopSessionManager.formatNumber(item.original_price_coins)} <:Coins:1468446651965374534>**`;
                if (item.original_price_crystals > 0) {
                    if (originalText) originalText += ' & ';
                    originalText += `**${shopSessionManager.formatNumber(item.original_price_crystals)} <:Crystal:1468446688338251793>**`;
                }

                let discountedText = '';
                if (discountedCoins > 0) discountedText += `**${shopSessionManager.formatNumber(discountedCoins)} <:Coins:1468446651965374534>**`;
                if (discountedCrystals > 0) {
                    if (discountedText) discountedText += ' & ';
                    discountedText += `**${shopSessionManager.formatNumber(discountedCrystals)} <:Crystal:1468446688338251793>**`;
                }

                priceText = `Price: ~~${originalText}~~ **${discountedText}** (-${item.current_discount}%)`;
            } else {
                if (item.original_price_coins > 0 && item.original_price_crystals > 0) {
                    priceText = `Price: **${shopSessionManager.formatNumber(item.original_price_coins)} <:Coins:1468446651965374534>** & **${shopSessionManager.formatNumber(item.original_price_crystals)} <:Crystal:1468446688338251793>**`;
                } else if (item.original_price_coins > 0) {
                    priceText = `Price: **${shopSessionManager.formatNumber(item.original_price_coins)} <:Coins:1468446651965374534>**`;
                } else if (item.original_price_crystals > 0) {
                    priceText = `Price: **${shopSessionManager.formatNumber(item.original_price_crystals)} <:Crystal:1468446688338251793>**`;
                } else {
                    priceText = 'Price: **Free**';
                }
            }

            // المخزون
            let stockText = '';
            if (item.quantity === -1) {
                stockText = 'Stock: **♾️ Unlimited**';
            } else {
                stockText = `Stock: **${item.quantity}**`;
            }

            // Buff Information
            let buffInfo = '';
            if (item.buff_type) {
                const buffEmoji = this.getBuffEmoji(item.buff_type);
                const buffName = this.getBuffName(item.buff_type);
                buffInfo = `${buffEmoji} **${buffName}** (${item.buff_duration_minutes || 0} minutes)`;
            }

            // Discount chance
            let discountInfo = '';
            if (item.discount_chance > 0) {
                discountInfo = `Discount Chance: **${item.discount_chance}%**`;
            }

            // ⭐⭐⭐ الحل: دمج كل المعلومات في content واحد ⭐⭐⭐
            let detailsContent = priceText + '\n' + stockText + '\n';

            if (buffInfo) {
                detailsContent += buffInfo + '\n';
            }

            if (discountInfo) {
                detailsContent += discountInfo + '\n';
            }

            const itemSection = new SectionBuilder()
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(itemContent.trim())
                )
                .setButtonAccessory((button) =>
                    button
                        .setCustomId(`delete_item_${item.id}`)
                        .setLabel('Delete')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji({name: '🗑️'})
                );

            // Details section
            const detailsSection = new SectionBuilder()
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(detailsContent.trim())
                )
                .setButtonAccessory((button) =>
                    button
                        .setCustomId(`edit_item_${item.id}`)
                        .setLabel('Edit')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji({name: '✏️'})
                );

            container
                .addSectionComponents((section) => itemSection)
                .addSectionComponents((section) => detailsSection)
                .addSeparatorComponents((separator) => separator);
        }

        // =============== قسم التنقل المعدل ===============
        const navigationSection = new SectionBuilder();

        navigationSection.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(`-# Page: ${pageNumber} of ${totalPages}`)
        );

        navigationSection.setButtonAccessory((button) =>
            button
                .setCustomId('add_item')
                .setLabel('Add Product')
                .setStyle(ButtonStyle.Success)
                .setEmoji({name: '➕'})
        );

        container.addSectionComponents((section) => navigationSection);

        // =============== ActionRow جديد لأزرار Prev/Next ===============
        if (pageNumber > 1 || pageNumber < totalPages) {
            const buttons = [];

            if (pageNumber > 1) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            if (pageNumber < totalPages) {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            if (buttons.length > 0) {
                container.addActionRowComponents((actionRow) => actionRow.setComponents(buttons));
            }
        }

        return container;
    },

    async buttonHandler(interaction) {
        try {
            console.log(`🛠️ Shop edit button clicked: ${interaction.customId} by ${interaction.user.tag}`);

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (moderateRoleData) {
                const roleInfo = JSON.parse(moderateRoleData.setting_value);
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const hasModerateRole = member.roles.cache.has(roleInfo.id);

                if (!hasModerateRole) {
                    return await interaction.reply({
                        content: `❌ You need the <@&${roleInfo.id}> role to use shop management.`,
                        ephemeral: true
                    });
                }
            }

            // استرجاع الجلسة
            const userSession = shopSessionManager.getSession(interaction.user.id);

            // تحقق من ملكية الرسالة
            if (userSession && userSession.messageId) {
                try {
                    const channel = await interaction.guild.channels.fetch(userSession.channelId);
                    const message = await channel.messages.fetch(userSession.messageId);

                    if (message.author.id !== interaction.client.user.id) {
                        shopSessionManager.deleteSession(interaction.user.id);
                        const items = await dbManager.getActiveShopItems();
                        return await this.displayShopPage(interaction, 1, items, true);
                    }
                } catch (error) {
                    shopSessionManager.deleteSession(interaction.user.id);
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, true);
                }
            }

            // معالجة الأزرار
            if (interaction.customId === 'add_item') {
                const modal = this.createAddItemModal();
                return await interaction.showModal(modal);
            }
            else if (interaction.customId.startsWith('edit_item_')) {
                const itemId = interaction.customId.replace('edit_item_', '');
                return await this.handleEditItemButton(interaction, itemId);
            }
            else if (interaction.customId === 'prev_page') {
                if (!userSession) {
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, true);
                }

                const newPage = userSession.page - 1;
                if (newPage >= 1) {
                    await interaction.deferUpdate().catch(() => {});
                    return await this.displayShopPage(interaction, newPage, userSession.items);
                }
            }
            else if (interaction.customId === 'next_page') {
                if (!userSession) {
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, true);
                }

                const newPage = userSession.page + 1;
                if (newPage <= userSession.totalPages) {
                    await interaction.deferUpdate().catch(() => {});
                    return await this.displayShopPage(interaction, newPage, userSession.items);
                }
            }
            else if (interaction.customId.startsWith('delete_item_')) {
                const itemId = interaction.customId.replace('delete_item_', '');
                return await this.handleDeleteItemButton(interaction, itemId);
            }

        } catch (error) {
            console.error('Error in shop edit button handler:', error);

            if (error.code === 10062 || error.code === 40060) {
                console.log('⚠️ Interaction expired or already handled');
                return;
            }

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred. Please try again.',
                        ephemeral: true,
                        allowedMentions: { parse: [] }
                    });
                }
            } catch (e) {
                console.log('⚠️ Could not send error message:', e.message);
            }
        }
    },

    async handleEditItemButton(interaction, itemId) {
        try {
            console.log(`✏️ Handling edit for item ${itemId}`);

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (moderateRoleData) {
                const roleInfo = JSON.parse(moderateRoleData.setting_value);
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const hasModerateRole = member.roles.cache.has(roleInfo.id);

                if (!hasModerateRole) {
                    return await interaction.reply({
                        content: `❌ You need the <@&${roleInfo.id}> role to edit shop items.`,
                        ephemeral: true
                    });
                }
            }

            const item = await dbManager.getShopItemById(itemId);

            if (!item) {
                console.log(`❌ Item ${itemId} not found`);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Product not found! It might have been deleted.',
                        ephemeral: true,
                        allowedMentions: { parse: [] }
                    });
                }
                return;
            }

            // فتح المودال
            const modal = this.createEditItemModal(itemId, item);
            return await interaction.showModal(modal);

        } catch (error) {
            console.error('Error in handleEditItemButton:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Error loading product data. Please try again.',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }
        }
    },

    async handleDeleteItemButton(interaction, itemId) {
        try {
            console.log(`🗑️ Handling delete for item ${itemId}`);

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (moderateRoleData) {
                const roleInfo = JSON.parse(moderateRoleData.setting_value);
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const hasModerateRole = member.roles.cache.has(roleInfo.id);

                if (!hasModerateRole) {
                    return await interaction.reply({
                        content: `❌ You need the <@&${roleInfo.id}> role to delete shop items.`,
                        ephemeral: true
                    });
                }
            }

            await interaction.deferUpdate();

            const result = await dbManager.deleteShopItem(itemId);

            console.log('Delete result:', result);

            if (!result || !result.success) {
                console.error('Delete failed');
                const items = await dbManager.getActiveShopItems();
                const userSession = shopSessionManager.getSession(interaction.user.id);
                const currentPage = userSession?.page || 1;
                return await this.displayShopPage(interaction, currentPage, items);
            }

            const items = await dbManager.getActiveShopItems();
            const userSession = shopSessionManager.getSession(interaction.user.id);
            let currentPage = 1;

            if (userSession) {
                const itemsPerPage = 3;
                const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
                currentPage = Math.min(userSession.page, totalPages) || 1;
            }

            return await this.displayShopPage(interaction, currentPage, items);

        } catch (error) {
            console.error('Error in handleDeleteItemButton:', error);

            const items = await dbManager.getActiveShopItems();
            const userSession = shopSessionManager.getSession(interaction.user.id);
            const currentPage = userSession?.page || 1;
            return await this.displayShopPage(interaction, currentPage, items);
        }
    },

    createAddItemModal() {
        const modal = new ModalBuilder()
            .setCustomId('shop_add_item_modal')
            .setTitle('🛒 Add New Product');

        const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('Role ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('123456789012345678')
            .setRequired(true)
            .setMaxLength(20);

        const itemEmojiInput = new TextInputBuilder()
            .setCustomId('item_emoji')
            .setLabel('Product Emoji (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Leave empty for no emoji')
            .setRequired(false)
            .setMaxLength(10);

        const priceInput = new TextInputBuilder()
            .setCustomId('price')
            .setLabel('Price (ex: 100co or 50cr or 10co 5cr)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('100co or 50cr or 10co 5cr')
            .setRequired(true)
            .setMaxLength(20);

        const quantityInput = new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('Quantity')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('10 or unlimited')
            .setRequired(true)
            .setMaxLength(10);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description (optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Describe the benefits of this role...')
            .setRequired(false)
            .setMaxLength(200);

        modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(itemEmojiInput),
            new ActionRowBuilder().addComponents(priceInput),
            new ActionRowBuilder().addComponents(quantityInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        return modal;
    },

    createEditItemModal(itemId, item) {
        const modal = new ModalBuilder()
            .setCustomId(`shop_edit_item_modal_${itemId}`)
            .setTitle('✏️ Edit Shop Product');

        // Row 1: Discount Chance
        const discountChanceRow = new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('discount_chance')
                .setLabel('Discount Chance % (0-100)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('0 = no random discount')
                .setValue(item.discount_chance ? item.discount_chance.toString() : '0')
                .setRequired(false)
                .setMaxLength(3)
        );

        // Row 2: Price
        let currentPrice = '';
        if (item.original_price_coins > 0 && item.original_price_crystals > 0) {
            currentPrice = `${item.original_price_coins}co ${item.original_price_crystals}cr`;
        } else if (item.original_price_coins > 0) {
            currentPrice = `${item.original_price_coins}co`;
        } else if (item.original_price_crystals > 0) {
            currentPrice = `${item.original_price_crystals}cr`;
        } else {
            currentPrice = '0co';
        }

        const priceRow = new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('price')
                .setLabel('Price (100co or 50cr or 10co 5cr)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('100co or 50cr or 10co 5cr')
                .setValue(currentPrice)
                .setRequired(true)
                .setMaxLength(20)
        );

        // Row 3: Quantity
        const quantityValue = item.quantity === -1 ? 'unlimited' : item.quantity.toString();
        const quantityRow = new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('quantity')
                .setLabel('Quantity')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('10 or unlimited')
                .setValue(quantityValue)
                .setRequired(true)
                .setMaxLength(10)
        );

        // Row 4: Buff Type (Text Input بدلاً من Select Menu)
        const buffTypeValue = item.buff_type || 'none';
        const buffTypeRow = new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('buff_type')
                .setLabel('Buff Type')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('double_xp, double_coins, double_luck, or none')
                .setValue(buffTypeValue)
                .setRequired(false)
                .setMaxLength(20)
        );

        // Row 5: Buff Duration
        const buffDurationRow = new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('buff_duration_minutes')
                .setLabel('Buff Duration in minutes (0 = none)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('0 = no buff, 60 = one hour')
                .setValue(item.buff_duration_minutes ? item.buff_duration_minutes.toString() : '0')
                .setRequired(false)
                .setMaxLength(4)
        );

        modal.addComponents(discountChanceRow, priceRow, quantityRow, buffTypeRow, buffDurationRow);

        return modal;
    },

    async modalHandler(interaction) {
        try {
            console.log('🔍 Modal submitted:', interaction.customId);

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (moderateRoleData) {
                const roleInfo = JSON.parse(moderateRoleData.setting_value);
                const member = await interaction.guild.members.fetch(interaction.user.id);
                const hasModerateRole = member.roles.cache.has(roleInfo.id);

                if (!hasModerateRole) {
                    if (!interaction.replied && !interaction.deferred) {
                        return await interaction.reply({
                            content: `❌ You need the <@&${roleInfo.id}> role to manage shop items.`,
                            ephemeral: true
                        });
                    }
                }
            }

            if (interaction.customId === 'shop_add_item_modal') {
                await this.handleAddItemModal(interaction);
            }
            else if (interaction.customId.startsWith('shop_edit_item_modal_')) {
                const itemId = interaction.customId.replace('shop_edit_item_modal_', '');
                console.log(`✏️ Processing edit for item ${itemId}`);
                await this.handleEditItemModal(interaction, itemId);
            }

        } catch (error) {
            console.error('❌ Error in shop modal handler:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ **Error:** ${error.message || 'An unexpected error occurred.'}`,
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }
        }
    },

    async handleAddItemModal(interaction) {
        try {
            const roleId = interaction.fields.getTextInputValue('role_id')?.trim();
            const itemEmoji = interaction.fields.getTextInputValue('item_emoji')?.trim() || '';
            const priceInput = interaction.fields.getTextInputValue('price')?.trim();
            const quantityInput = interaction.fields.getTextInputValue('quantity')?.trim();
            const description = interaction.fields.getTextInputValue('description')?.trim() || null;

            console.log('🔍 Add item data:', { roleId, itemEmoji, priceInput, quantityInput, description });

            if (!roleId || !priceInput || !quantityInput) {
                return await interaction.reply({
                    content: '❌ **Required fields missing!**\nPlease fill all required fields.',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            try {
                const role = await interaction.guild.roles.fetch(roleId);
                if (!role) {
                    return await interaction.reply({
                        content: '❌ **Role not found!**\nPlease check the role ID.',
                        ephemeral: true,
                        allowedMentions: { parse: [] }
                    });
                }
            } catch (error) {
                return await interaction.reply({
                    content: '❌ **Invalid role ID!**',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const price = this.parsePriceInput(priceInput);
            if (!price) {
                return await interaction.reply({
                    content: '❌ **Invalid price format!**\nUse: `100co` for coins or `50cr` for crystals\nOr: `100co 50cr` or `50cr 100co` for both',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const quantity = this.parseQuantityInput(quantityInput);
            if (quantity === null) {
                return await interaction.reply({
                    content: '❌ **Invalid quantity!**\nUse number or "unlimited"',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const result = await dbManager.addShopItem({
                role_id: roleId,
                item_emoji: itemEmoji || null,
                original_price_coins: price.coins,
                original_price_crystals: price.crystals,
                quantity: quantity,
                description: description,
                created_by: interaction.user.id
            });

            console.log('🔍 Add item result:', result);

            if (!result || !result.success) {
                let errorMessage = '❌ **Failed to add product to shop!**';

                if (result?.error?.includes('unique')) {
                    errorMessage = `❌ **Error:** This role already exists in the shop!`;
                } else if (result?.error) {
                    errorMessage = `❌ **Error:** ${result.error}`;
                }

                return await interaction.reply({
                    content: errorMessage,
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const items = await dbManager.getActiveShopItems();
            const userSession = shopSessionManager.getSession(interaction.user.id);
            const currentPage = userSession?.page || 1;

            await this.displayShopPage(interaction, currentPage, items);

        } catch (error) {
            console.error('Error in handleAddItemModal:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ **Error:** ${error.message}`,
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }
        }
    },

    async handleEditItemModal(interaction, itemId) {
        try {
            console.log(`✏️ Starting edit process for item ${itemId}`);

            // الحصول على القيم من المودال
            const discountChance = interaction.fields.getTextInputValue('discount_chance')?.trim();
            const priceInput = interaction.fields.getTextInputValue('price')?.trim();
            const quantityInput = interaction.fields.getTextInputValue('quantity')?.trim();
            const buffType = interaction.fields.getTextInputValue('buff_type')?.trim();
            const buffDuration = interaction.fields.getTextInputValue('buff_duration_minutes')?.trim();

            console.log('✏️ Edit form data:', { 
                itemId, 
                discountChance,
                priceInput, 
                quantityInput,
                buffType,
                buffDuration
            });

            if (!priceInput || !quantityInput) {
                console.log('❌ Missing required fields in edit form');
                return await interaction.reply({
                    content: '❌ **Required fields missing!**\nPrice and quantity are required.',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const price = this.parsePriceInput(priceInput);
            if (!price) {
                console.log('❌ Invalid price format in edit:', priceInput);
                return await interaction.reply({
                    content: '❌ **Invalid price format!**\nUse: `100co` for coins or `50cr` for crystals\nOr: `100co 50cr` or `50cr 100co` for both',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            // التحقق من discount_chance
            const discountChanceNum = parseInt(discountChance) || 0;
            if (discountChanceNum < 0 || discountChanceNum > 100) {
                return await interaction.reply({
                    content: '❌ **Invalid discount chance!**\nMust be between 0-100',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const quantity = this.parseQuantityInput(quantityInput);
            if (quantity === null) {
                console.log('❌ Invalid quantity in edit:', quantityInput);
                return await interaction.reply({
                    content: '❌ **Invalid quantity!**\nUse number or "unlimited"',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            // ⭐⭐ التعديل هنا: معالجة الـ Buff Type ⭐⭐
            let buffTypeFinal = null;
            if (buffType && buffType.trim() !== '') {
                // تحويل المسافات إلى underscores
                const processedBuffType = buffType.trim().toLowerCase().replace(/\s+/g, '_');

                // التحقق من صحة نوع الـ Buff
                const validBuffTypes = ['double_xp', 'double_coins', 'double_luck', 'none'];

                if (processedBuffType === 'none') {
                    buffTypeFinal = null;
                } 
                else if (validBuffTypes.includes(processedBuffType)) {
                    buffTypeFinal = processedBuffType;
                }
                else {
                    // رسالة خطأ توضيحية
                    return await interaction.reply({
                        content: `❌ **Invalid buff type!**\nYou entered: "${buffType}"\n\n**Valid types:**\n• double_xp (or "double xp")\n• double_coins (or "double coins")\n• double_luck (or "double luck")\n• none`,
                        ephemeral: true,
                        allowedMentions: { parse: [] }
                    });
                }
            }

            // Validate buff duration
            const buffDurationNum = parseInt(buffDuration) || 0;
            if (buffDurationNum < 0 || buffDurationNum > 1440) {
                return await interaction.reply({
                    content: '❌ **Invalid buff duration!**\nMust be between 0-1440 minutes (24 hours)',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const finalBuffDuration = buffTypeFinal ? buffDurationNum : 0;

            // Get current item
            const currentItem = await dbManager.getShopItemById(itemId);
            if (!currentItem) {
                return await interaction.reply({
                    content: '❌ **Product not found!**',
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            // Update data
            const updateData = {
                discount_chance: discountChanceNum,
                original_price_coins: price.coins,
                original_price_crystals: price.crystals,
                quantity: quantity,
                buff_type: buffTypeFinal,
                buff_duration_minutes: finalBuffDuration
            };

            // Recalculate discounted price if on sale
            if (currentItem.current_discount > 0) {
                const discountPercentage = currentItem.current_discount;
                const discountedCoins = Math.floor(price.coins * (1 - discountPercentage/100));
                const discountedCrystals = Math.floor(price.crystals * (1 - discountPercentage/100));

                updateData.discounted_price_coins = discountedCoins;
                updateData.discounted_price_crystals = discountedCrystals;
                updateData.is_on_sale = true;

                console.log(`💰 Recalculated discounted price for ${discountPercentage}% off: ${discountedCoins} coins, ${discountedCrystals} crystals`);
            } else {
                updateData.discounted_price_coins = 0;
                updateData.discounted_price_crystals = 0;
                updateData.is_on_sale = false;
            }

            console.log(`✏️ Updating item ${itemId} in database...`);
            const result = await dbManager.updateShopItem(itemId, updateData);

            console.log('✏️ Update result:', result);

            if (!result || !result.success) {
                console.error('❌ Database update failed:', result?.error);
                return await interaction.reply({
                    content: '❌ **Failed to update product!**\n' + (result?.error || 'Database error'),
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }

            const items = await dbManager.getActiveShopItems();
            const userSession = shopSessionManager.getSession(interaction.user.id);
            let currentPage = 1;

            if (userSession) {
                const itemsPerPage = 3;
                const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
                currentPage = Math.min(userSession.page, totalPages) || 1;
            }

            await this.displayShopPage(interaction, currentPage, items);

        } catch (error) {
            console.error('❌ Error in handleEditItemModal:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ **Error:** ${error.message || 'Failed to update product.'}`,
                    ephemeral: true,
                    allowedMentions: { parse: [] }
                });
            }
        }
    },

    parsePriceInput(priceInput) {
        try {
            const priceInputStr = priceInput.toLowerCase().trim();
            console.log('🔍 Parsing price input:', priceInputStr);

            let coins = 0;
            let crystals = 0;

            const parts = priceInputStr.split(/\s+/);

            for (const part of parts) {
                const trimmed = part.trim();

                if (trimmed.endsWith('co')) {
                    const amount = parseInt(trimmed.replace('co', ''));
                    if (!isNaN(amount) && amount >= 0) {
                        coins = amount;
                    }
                }
                else if (trimmed.endsWith('cr')) {
                    const amount = parseInt(trimmed.replace('cr', ''));
                    if (!isNaN(amount) && amount >= 0) {
                        crystals = amount;
                    }
                }
                else if (/^\d+$/.test(trimmed)) {
                    const amount = parseInt(trimmed);
                    if (!isNaN(amount) && amount >= 0) {
                        coins = amount;
                    }
                }
            }

            if (coins === 0 && crystals === 0) {
                console.log('❌ No valid price found');
                return null;
            }

            console.log(`✅ Parsed price: ${coins} coins, ${crystals} crystals`);
            return { coins, crystals };

        } catch (error) {
            console.error('Error parsing price:', error);
            return null;
        }
    },

    parseQuantityInput(quantityInput) {
        try {
            const quantityStr = quantityInput.toLowerCase().trim();
            console.log('🔍 Parsing quantity input:', quantityStr);

            if (quantityStr === 'infinity' || quantityStr === 'inf' || quantityStr === 'unlimited') {
                return -1;
            }

            const quantity = parseInt(quantityStr);
            if (isNaN(quantity) || quantity < -1) return null;

            return quantity;

        } catch (error) {
            console.error('Error parsing quantity:', error);
            return null;
        }
    },

    // Helper functions for Buffs
    getBuffEmoji(buffType) {
        const emojis = {
            'double_xp': '⚡',
            'double_coins': '💰',
            'double_luck': '🍀'
        };
        return emojis[buffType] || '🎁';
    },

    getBuffName(buffType) {
        const names = {
            'double_xp': 'Double XP',
            'double_coins': 'Double Coins',
            'double_luck': 'Double Luck'
        };
        return names[buffType] || buffType;
    }
};