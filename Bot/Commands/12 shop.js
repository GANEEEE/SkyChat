const {
    SlashCommandBuilder,
    SectionBuilder,
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    SeparatorBuilder,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder
} = require('discord.js');
const dbManager = require('../Data/database');
const { couponSystem } = require('../LevelSystem/couponsystem');
const skyBreakGuard = require('../System/SkyBreak');
const skyPassGuard = require('../System/SkyPass');
const messageGuard = require('../System/SkyOG');
const colorsMessageGuard = require('../System/SkyColors');

const SHOP_LOG_CHANNEL_ID = '1434904222805004411';

// Shop session management
class ShopSessionManager {
    constructor() {
        this.sessions = new Map(); // User shopping sessions
        this.refundTimers = new Map(); // 5-second refund timers
        this.purchaseMessages = new Map(); // Track purchase messages by messageId
        this.client = null;
        this.startCleanup();
    }

    // Format numbers: 30,000 → 30K, 1,500,000 → 1.5M
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

    // Add refund request (5 seconds)
    addRefundRequest(userId, itemId, roleId, refundMessageId, refundChannelId, purchaseId) {
        console.log(`📝 Setting up refund timer for user ${userId}, message: ${refundMessageId}, purchase: ${purchaseId}`);

        const timer = setTimeout(() => {
            console.log(`⏰ Refund timer expired for purchase: ${purchaseId}`);
            this.removeRefundRequest(userId);
        }, 30000); // 30 seconds

        this.refundTimers.set(userId, {
            itemId,
            roleId,
            timer,
            timestamp: Date.now(),
            refundMessageId,
            refundChannelId,
            purchaseId
        });

        console.log(`✅ Refund timer set for user ${userId}, total timers: ${this.refundTimers.size}`);
    }

    removeRefundRequest(userId) {
        const refund = this.refundTimers.get(userId);
        if (refund) {
            clearTimeout(refund.timer);
            this.refundTimers.delete(userId);
            console.log(`✅ Removed refund request for user ${userId}`);
        }
    }

    hasRefundRequest(userId) {
        return this.refundTimers.has(userId);
    }

    getRefundRequest(userId) {
        return this.refundTimers.get(userId);
    }

    // Register purchase message
    registerPurchaseMessage(messageId, purchaseData, client) {
        console.log(`📝 Registering purchase message ${messageId} for user ${purchaseData.userId}`);

        this.client = client;

        this.purchaseMessages.set(messageId, {
            ...purchaseData,
            timestamp: Date.now()
        });

        console.log(`✅ Registered purchase message ${messageId}, total tracked: ${this.purchaseMessages.size}`);

        return messageId;
    }

    // Update message to celebration state
    async updateMessageToCelebration(messageId) {
        try {
            const purchaseData = this.purchaseMessages.get(messageId);
            if (!purchaseData) {
                console.log(`❌ No purchase data found for message ${messageId}`);
                return false;
            }

            console.log(`🎉 Updating message ${messageId} to celebration for user ${purchaseData.username}`);

            const channel = await this.client.channels.fetch(purchaseData.channelId);
            if (!channel) {
                console.log(`❌ Channel not found: ${purchaseData.channelId}`);
                return false;
            }

            const message = await channel.messages.fetch(messageId);
            if (!message) {
                console.log(`❌ Message not found: ${messageId}`);
                return false;
            }

            // الحصول على المستخدم من خلال الـ client
            let userAvatar;
            try {
                const user = await this.client.users.fetch(purchaseData.userId);
                userAvatar = user.displayAvatarURL({ extension: 'png', size: 256 });
            } catch (error) {
                console.log('⚠️ Could not fetch user avatar, using default');
                userAvatar = channel.guild.iconURL({ extension: 'png', size: 256 });
            }

            // Create celebration container
            const celebrationContainer = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addSectionComponents((section) => 
                    section
                        .addTextDisplayComponents((textDisplay) => 
                            textDisplay.setContent(
                                `## **🎉 PURCHASE COMPLETE 🎉**\n\n` +
                                `**Item:** <@&${purchaseData.roleId}>\n` +
                                `**Buyer:** ${purchaseData.username}\n` +
                                `**Cost:** ${purchaseData.finalPriceCoins > 0 ? `${this.formatNumber(purchaseData.finalPriceCoins)} <:Coins:1468446651965374534>` : ''}` +
                                `${purchaseData.finalPriceCoins > 0 && purchaseData.finalPriceCrystals > 0 ? ' + ' : ''}` +
                                `${purchaseData.finalPriceCrystals > 0 ? `${this.formatNumber(purchaseData.finalPriceCrystals)} <:Crystal:1468446688338251793>` : ''}\n` +
                                `${purchaseData.couponDiscount > 0 ? `**Coupon:** 🎟️ ${purchaseData.couponDiscount}% OFF\n` : ''}` +
                                `${purchaseData.shopDiscount > 0 ? `**Sale:** 🔥 ${purchaseData.shopDiscount}% OFF\n` : ''}` +
                                `**Status:** ✅ **PURCHASED**\n\n` +
                                `🎁 **Enjoy your new role!** 🎁`
                            )
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription('Purchase Complete!')
                                .setURL(userAvatar) // استخدام avatar المستخدم
                        )
                );

            await message.edit({
                components: [celebrationContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });

            console.log(`✅ Successfully updated message ${messageId} to celebration`);

            // ⭐⭐⭐ أرسل تأكيد الشراء للقناة الآن ⭐⭐⭐
            console.log(`📤 Sending purchase confirmation to log channel after refund period ended...`);

            await sendPurchaseToLogChannelV2(this.client, {
                userId: purchaseData.userId,
                username: purchaseData.username,
                roleId: purchaseData.roleId,
                finalPriceCoins: purchaseData.finalPriceCoins,
                finalPriceCrystals: purchaseData.finalPriceCrystals,
                couponDiscount: purchaseData.couponDiscount,
                shopDiscount: purchaseData.shopDiscount,
                avatarURL: purchaseData.avatarURL,
                purchaseId: purchaseData.purchaseId
            });

            this.purchaseMessages.delete(messageId);

            return true;

        } catch (error) {
            console.error(`❌ Error updating message ${messageId} to celebration:`, error.message);
            return false;
        }
    }

    // Cancel message tracking (on refund)
    cancelPurchaseMessage(messageId) {
        if (this.purchaseMessages.has(messageId)) {
            this.purchaseMessages.delete(messageId);
            console.log(`✅ Cancelled purchase message ${messageId}`);
            return true;
        }
        return false;
    }

    getPurchaseByMessageId(messageId) {
        return this.purchaseMessages.get(messageId);
    }

    isMessageTracked(messageId) {
        return this.purchaseMessages.has(messageId);
    }

    // Handle purchase timeout
    async handlePurchaseTimeout(messageId) {
        try {
            const purchaseData = this.purchaseMessages.get(messageId);
            if (!purchaseData) {
                console.log(`❌ No purchase data found for message ${messageId}`);
                return;
            }

            console.log(`⏰ Refund timeout for message ${messageId}, user ${purchaseData.userId}, purchase: ${purchaseData.purchaseId}`);

            this.purchaseMessages.delete(messageId);
            this.removeRefundRequest(purchaseData.userId);

            return purchaseData;

        } catch (error) {
            console.error(`❌ Error handling purchase timeout:`, error);
        }
    }

    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            let deletedCount = 0;
            let refundDeletedCount = 0;
            let messageDeletedCount = 0;

            // Clean old sessions (30 minutes)
            for (const [userId, session] of this.sessions.entries()) {
                if (now - session.lastUpdated > 30 * 60 * 1000) {
                    this.sessions.delete(userId);
                    deletedCount++;
                }
            }

            // Clean old refund requests (10 seconds)
            for (const [userId, refund] of this.refundTimers.entries()) {
                if (now - refund.timestamp > 10000) {
                    this.removeRefundRequest(userId);
                    refundDeletedCount++;
                }
            }

            // Clean old purchase messages (1 minute)
            for (const [messageId, purchaseData] of this.purchaseMessages.entries()) {
                if (now - purchaseData.timestamp > 60000) {
                    this.purchaseMessages.delete(messageId);
                    messageDeletedCount++;
                }
            }

            if (deletedCount > 0 || refundDeletedCount > 0 || messageDeletedCount > 0) {
                console.log(`🧹 Cleaned ${deletedCount} shop sessions, ${refundDeletedCount} refund requests, ${messageDeletedCount} purchase messages`);
            }
        }, 5 * 60 * 1000);
    }
}

const shopSessionManager = new ShopSessionManager();

// ⭐⭐⭐ هنا حط الدالة كاملة ⭐⭐⭐
async function sendPurchaseToLogChannelV2(client, purchaseData) {
    try {
        // 1. جلب القناة
        const logChannel = await client.channels.fetch(SHOP_LOG_CHANNEL_ID);
        if (!logChannel) {
            console.error('❌ Shop log channel not found');
            return false;
        }

        // 2. بناء Section بـ Text Display
        const logSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## 🛒 **PURCHASE CONFIRMED** 🛒\n\n` +
                    `**Buyer:** <@${purchaseData.userId}> (${purchaseData.username})\n` +
                    `**Item:** <@&${purchaseData.roleId}>\n` +
                    `**Cost:** ` +
                    (purchaseData.finalPriceCoins > 0 ? `**${shopSessionManager.formatNumber(purchaseData.finalPriceCoins)}** <:Coins:1468446651965374534>` : '') +
                    (purchaseData.finalPriceCoins > 0 && purchaseData.finalPriceCrystals > 0 ? ' + ' : '') +
                    (purchaseData.finalPriceCrystals > 0 ? `**${shopSessionManager.formatNumber(purchaseData.finalPriceCrystals)}** <:Crystal:1468446688338251793>` : '') + '\n' +
                    `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    (purchaseData.couponDiscount > 0 ? `🎟️ **Coupon:** ${purchaseData.couponDiscount}% OFF\n` : '') +
                    (purchaseData.shopDiscount > 0 ? `🔥 **Shop Sale:** ${purchaseData.shopDiscount}% OFF\n` : '') +
                    `\n✅ **Transaction Completed Successfully**`
                )
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`Purchase by ${purchaseData.username}`)
                    .setURL(purchaseData.avatarURL || client.user.displayAvatarURL({ extension: 'png', size: 256 }))
            );

        // 3. بناء Container
        const logContainer = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => logSection);

        // 4. إرسال الرسالة
        await logChannel.send({
            components: [logContainer],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        console.log(`✅ Purchase logged in channel: ${SHOP_LOG_CHANNEL_ID}`);
        return true;

    } catch (error) {
        console.error('❌ Failed to send purchase to log channel:', error.message);
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('🛒 Browse and purchase items from the shop')
        .setDMPermission(false),

    async execute(interaction) {
        try {
            console.log(`🛒 /shop command by ${interaction.user.tag}`);

            const userData = await dbManager.getUserProfile(interaction.user.id);
            if (!userData) {
                return await interaction.reply({
                    content: '❌ **No Account Found**\nSend a message in chat to create your account first.',
                    ephemeral: true
                });
            }

            // Get active coupons
            const activeCoupons = await couponSystem.getActiveCoupons(interaction.user.id);
            userData.activeCoupons = activeCoupons.length;

            const items = await dbManager.getActiveShopItems();
            if (items.length === 0) {
                return await this.displayEmptyShop(interaction, userData);
            }

            await this.displayShopPage(interaction, 1, items, userData, true);

        } catch (error) {
            console.error('Error executing shop command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setDescription('❌ **An error occurred while loading the shop**\nPlease try again later')
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

    async displayEmptyShop(interaction, userData) {
        const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });

        // Build user info text
        let userInfoText = `# 🛒 **GAMERSKY SHOP**\n` +
                         `### Welcome to our server shop!\n\n` +
            `<:Coins:1468446651965374534> Coins: **${userData.sky_coins.toLocaleString()}**\n` +
            `<:Crystal:1468446688338251793> Crystals: **${userData.sky_crystals.toLocaleString()}**`;

        // Add coupons if they have any
        if (userData.activeCoupons && userData.activeCoupons > 0) {
            userInfoText += `\n🎟️ Active Coupons: **${userData.activeCoupons}**`;
        }

        const firstSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(userInfoText)
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`${interaction.guild.name} Shop`)
                    .setURL(serverIcon)
            );

        const secondSection = new SectionBuilder()
            .setButtonAccessory((button) =>
                button
                    .setCustomId('shop_refresh')
                    .setLabel('Check back later')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            )
        
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent('❌ **Shop is currently empty!**')
            );

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => firstSection)
            .addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true))
            .addSectionComponents((section) => secondSection);

        const response = await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: false,
            fetchReply: true,
            allowedMentions: { parse: [] }
        });

        shopSessionManager.setSession(interaction.user.id, {
            page: 1,
            items: [],
            messageId: response.id,
            channelId: interaction.channelId,
            totalPages: 1,
            userData: userData
        });
    },

    async displayShopPage(interaction, pageNumber, allItems, userData, isNewCommand = false) {
        try {
            const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });
            const itemsPerPage = 5;
            const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

            if (pageNumber > totalPages) pageNumber = totalPages;
            if (pageNumber < 1) pageNumber = 1;

            const startIndex = (pageNumber - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const pageItems = allItems.slice(startIndex, endIndex);

            const container = await this.buildShopContainer(
                interaction, 
                pageNumber, 
                totalPages, 
                pageItems, 
                userData, 
                serverIcon
            );

            const userSession = shopSessionManager.getSession(interaction.user.id);

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
                            totalPages: totalPages,
                            userData: userData
                        });

                        if (interaction.isButton()) {
                            await interaction.deferUpdate().catch(() => {});
                        }

                        return;
                    }
                } catch (error) {
                    console.log('⚠️ Could not edit original message:', error.message);
                }
            }

            let response;

            if (interaction.deferred || interaction.replied) {
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

            shopSessionManager.setSession(interaction.user.id, {
                page: pageNumber,
                items: allItems,
                messageId: response.id,
                channelId: response.channelId || interaction.channelId,
                totalPages: totalPages,
                userData: userData
            });

        } catch (error) {
            console.error('Error in displayShopPage:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Error displaying shop. Please use `/shop` again.',
                    ephemeral: true
                });
            }
        }
    },

    async buildShopContainer(interaction, pageNumber, totalPages, pageItems, userData, serverIcon) {
        // Build user info text
        let userInfoText = `# 🛒 **GAMERSKY SHOP**\n` +
                         `### Welcome to our server shop, browse and purchase items\n\n` +
            `<:Coins:1468446651965374534> Coins: **${userData.sky_coins.toLocaleString()}**\n` +
            `<:Crystal:1468446688338251793> Crystals: **${userData.sky_crystals.toLocaleString()}**`;

        // Add coupons if they have any
        if (userData.activeCoupons && userData.activeCoupons > 0) {
            userInfoText += `\n🎟️ Active Coupons: **${userData.activeCoupons}**`;
        }

        const firstSection = new SectionBuilder()
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(userInfoText)
            )
            .setThumbnailAccessory((thumbnail) =>
                thumbnail
                    .setDescription(`${interaction.guild.name} Shop`)
                    .setURL(serverIcon)
            );

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addSectionComponents((section) => firstSection)
            .addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));

        for (const item of pageItems) {
            const emoji = item.item_emoji && item.item_emoji.trim() !== '' ? item.item_emoji : '';
            const role = interaction.guild.roles.cache.get(item.role_id);
            const roleMention = role ? `<@&${item.role_id}>` : `Unknown Role`;

            const member = interaction.guild.members.cache.get(interaction.user.id);
            const hasRole = member ? member.roles.cache.has(item.role_id) : false;

            const hasRefundRequest = shopSessionManager.hasRefundRequest(interaction.user.id);
            const refundData = shopSessionManager.getRefundRequest(interaction.user.id);
            const isRefundForThisItem = hasRefundRequest && refundData && refundData.roleId === item.role_id;

            let originalPriceCoins = item.original_price_coins;
            let originalPriceCrystals = item.original_price_crystals;
            let finalPriceCoins = originalPriceCoins;
            let finalPriceCrystals = originalPriceCrystals;

            let hasCoupon = false;
            let couponDiscount = 0;
            let bestCouponCode = 'nocoupon';

            const activeCoupons = await couponSystem.getActiveCoupons(interaction.user.id);
            if (activeCoupons.length > 0) {
                hasCoupon = true;
                const bestCoupon = activeCoupons[0];
                couponDiscount = bestCoupon.discount_percentage;
                bestCouponCode = bestCoupon.coupon_code;

                if (couponDiscount > 0) {
                    finalPriceCoins = Math.floor(originalPriceCoins * (1 - couponDiscount/100));
                    finalPriceCrystals = Math.floor(originalPriceCrystals * (1 - couponDiscount/100));
                }
            }

            // Apply shop discount first
            if (item.is_on_sale && item.current_discount > 0) {
                let salePriceCoins = item.discounted_price_coins || Math.floor(originalPriceCoins * (1 - item.current_discount/100));
                let salePriceCrystals = item.discounted_price_crystals || Math.floor(originalPriceCrystals * (1 - item.current_discount/100));

                if (hasCoupon && couponDiscount > 0) {
                    finalPriceCoins = Math.floor(salePriceCoins * (1 - couponDiscount/100));
                    finalPriceCrystals = Math.floor(salePriceCrystals * (1 - couponDiscount/100));
                } else {
                    finalPriceCoins = salePriceCoins;
                    finalPriceCrystals = salePriceCrystals;
                }
            } else if (hasCoupon && couponDiscount > 0) {
                finalPriceCoins = Math.floor(originalPriceCoins * (1 - couponDiscount/100));
                finalPriceCrystals = Math.floor(originalPriceCrystals * (1 - couponDiscount/100));
            }

            // Build price text for button (with K/M formatting)
            let priceTextForButton = '';

            if (finalPriceCoins > 0 && finalPriceCrystals > 0) {
                priceTextForButton = `${shopSessionManager.formatNumber(finalPriceCoins)} Coins & ${shopSessionManager.formatNumber(finalPriceCrystals)} Crystal`;
            } else if (finalPriceCoins > 0) {
                priceTextForButton = `${shopSessionManager.formatNumber(finalPriceCoins)} Coins`;
            } else if (finalPriceCrystals > 0) {
                priceTextForButton = `${shopSessionManager.formatNumber(finalPriceCrystals)} Crystals`;
            } else {
                priceTextForButton = 'FREE';
            }

            const canAfford = userData.sky_coins >= finalPriceCoins && 
                             userData.sky_crystals >= finalPriceCrystals;

            let stockText = '';
            if (item.quantity === -1) {
                stockText = '♾️ Unlimited stock';
            } else if (item.quantity === 0) {
                stockText = '🔴 Out of Stock';
            } else if (item.quantity <= 2) {
                stockText = `🟡 Limited stock **${item.quantity}**`;
            } else {
                stockText = `Stock: **${item.quantity}**`;
            }

            const isAvailable = item.quantity === -1 || item.quantity > 0;
            const canPurchase = canAfford && isAvailable && !hasRole && !isRefundForThisItem;

            let roleAndDescription = `### ${emoji}${emoji ? ' ' : ''}${roleMention}\n`;

            if (item.description && item.description.trim() !== '') {
                roleAndDescription += `${item.description}\n\n`;
            }

            let displayedPriceText = '';

            if (hasCoupon && couponDiscount > 0) {
                if (item.is_on_sale && item.current_discount > 0) {
                    // حالة: كوبون + تخفيض في المحل
                    const totalDiscount = couponDiscount + item.current_discount;

                    let originalParts = [];
                    let finalParts = [];

                    // الكوينز
                    if (originalPriceCoins > 0) {
                        originalParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534>`);
                        finalParts.push(`${shopSessionManager.formatNumber(finalPriceCoins)} <:Coins:1468446651965374534>`);
                    }

                    // الكريستال
                    if (originalPriceCrystals > 0) {
                        originalParts.push(`${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                        finalParts.push(`${shopSessionManager.formatNumber(finalPriceCrystals)} <:Crystal:1468446688338251793>`);
                    }

                    displayedPriceText = `**Price:** ~~${originalParts.join(' + ')}~~ → **${finalParts.join(' + ')}** 🎟️ **(-${totalDiscount}%)**`;
                } else {
                    // حالة: كوبون فقط
                    let originalParts = [];
                    let finalParts = [];

                    if (originalPriceCoins > 0) {
                        originalParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534>`);
                        finalParts.push(`${shopSessionManager.formatNumber(finalPriceCoins)} <:Coins:1468446651965374534>`);
                    }

                    if (originalPriceCrystals > 0) {
                        originalParts.push(`${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                        finalParts.push(`${shopSessionManager.formatNumber(finalPriceCrystals)} <:Crystal:1468446688338251793>`);
                    }

                    displayedPriceText = `**Price:** ~~${originalParts.join(' + ')}~~ → **${finalParts.join(' + ')}** 🎟️ **(-${couponDiscount}%)**`;
                }
            } else if (item.is_on_sale && item.current_discount > 0) {
                // حالة: تخفيض في المحل فقط
                const salePriceCoins = item.discounted_price_coins || Math.floor(originalPriceCoins * (1 - item.current_discount/100));
                const salePriceCrystals = item.discounted_price_crystals || Math.floor(originalPriceCrystals * (1 - item.current_discount/100));

                let originalParts = [];
                let finalParts = [];

                if (originalPriceCoins > 0) {
                    originalParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534>`);
                    finalParts.push(`${shopSessionManager.formatNumber(salePriceCoins)} <:Coins:1468446651965374534>`);
                }

                if (originalPriceCrystals > 0) {
                    originalParts.push(`${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                    finalParts.push(`${shopSessionManager.formatNumber(salePriceCrystals)} <:Crystal:1468446688338251793>`);
                }

                displayedPriceText = `**Price:** ~~${originalParts.join(' + ')}~~ → **${finalParts.join(' + ')}** **(-${item.current_discount}%)**`;
            } else {
                // حالة: بدون تخفيض
                let priceParts = [];

                if (originalPriceCoins > 0 && originalPriceCrystals > 0) {
                    priceParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534> & ${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                } else if (originalPriceCoins > 0) {
                    priceParts.push(`${shopSessionManager.formatNumber(originalPriceCoins)} <:Coins:1468446651965374534>`);
                } else if (originalPriceCrystals > 0) {
                    priceParts.push(`${shopSessionManager.formatNumber(originalPriceCrystals)} <:Crystal:1468446688338251793>`);
                } else {
                    priceParts.push('FREE 🎁');
                }

                displayedPriceText = `**Price:** ${priceParts.join('')}`;
            }

            roleAndDescription += displayedPriceText + '\n';

            // Purchase status
            let purchaseStatus = '';
            if (hasRole) {
                purchaseStatus = '-# ✅ Purchased';
            }
            if (isRefundForThisItem) {
                purchaseStatus = '-# ⚠️ Refund pending...';
            }

            const itemSection = new SectionBuilder();

            // دمج كل النصوص في content واحد
            let sectionContent = roleAndDescription.trim() + '\n';
            sectionContent += stockText + '\n';

            if (purchaseStatus.trim() !== '') {
                sectionContent += purchaseStatus + '\n';
            }

            // إضافة كل المحتوى مرة واحدة
            itemSection.addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(sectionContent.trim())
            );

            // الزرار يضاف كـ Button Accessory
            if (isRefundForThisItem) {
                itemSection.setButtonAccessory((button) =>
                    button
                        .setCustomId(`refund_${item.role_id}_${item.id}`)
                        .setLabel('Refund Pending')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );
            } else if (canPurchase) {
                itemSection.setButtonAccessory((button) =>
                    button
                        .setCustomId(`buy_item_${item.id}_${bestCouponCode}`)
                        .setLabel(`BUY (${priceTextForButton})`)
                        .setStyle(ButtonStyle.Success)
                );
            } else {
                itemSection.setButtonAccessory((button) =>
                    button
                        .setCustomId(`buy_item_${item.id}_nocoupon`)
                        .setLabel(`BUY (${priceTextForButton})`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            }

            container
                .addSectionComponents((section) => itemSection)
                .addSeparatorComponents((separator) => new SeparatorBuilder().setDivider(true));
        }

        const navigationSection = new SectionBuilder();

        navigationSection.setButtonAccessory((button) =>
            button
                .setCustomId('shop_next_page')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageNumber >= totalPages)
        );

        navigationSection.addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(`-# Page ${pageNumber} of ${totalPages}`)
        );

        container.addSectionComponents((section) => navigationSection);

        if (pageNumber > 1) {
            container.addActionRowComponents((actionRow) =>
                actionRow.setComponents(
                    new ButtonBuilder()
                        .setCustomId('shop_prev_page')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Secondary)
                )
            );
        }

        return container;
    },

    async buttonHandler(interaction) {
        try {
            console.log(`🛒 Shop button clicked: ${interaction.customId} by ${interaction.user.tag}`);

            const userSession = shopSessionManager.getSession(interaction.user.id);

            if (userSession && userSession.messageId) {
                try {
                    const channel = await interaction.guild.channels.fetch(userSession.channelId);
                    const message = await channel.messages.fetch(userSession.messageId);

                    if (message.author.id !== interaction.client.user.id) {
                        shopSessionManager.deleteSession(interaction.user.id);
                        const userData = await dbManager.getUserProfile(interaction.user.id);
                        const items = await dbManager.getActiveShopItems();
                        return await this.displayShopPage(interaction, 1, items, userData, true);
                    }
                } catch (error) {
                    shopSessionManager.deleteSession(interaction.user.id);
                    const userData = await dbManager.getUserProfile(interaction.user.id);
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, userData, true);
                }
            }

            if (interaction.customId === 'shop_next_page') {
                if (!userSession) {
                    const userData = await dbManager.getUserProfile(interaction.user.id);
                    const items = await dbManager.getActiveShopItems();
                    return await this.displayShopPage(interaction, 1, items, userData, true);
                }
                const newPage = userSession.page + 1;
                if (newPage <= userSession.totalPages) {
                    await interaction.deferUpdate().catch(() => {});
                    return await this.displayShopPage(interaction, newPage, userSession.items, userSession.userData);
                }
            }
                if (interaction.customId === 'shop_prev_page') {
                    if (!userSession) {
                        const userData = await dbManager.getUserProfile(interaction.user.id);
                        const items = await dbManager.getActiveShopItems();
                        return await this.displayShopPage(interaction, 1, items, userData, true);
                    }

                    const newPage = userSession.page - 1;
                    if (newPage >= 1) {
                        await interaction.deferUpdate().catch(() => {});
                        return await this.displayShopPage(interaction, newPage, userSession.items, userSession.userData);
                    }
                }
            else if (interaction.customId.startsWith('buy_item_')) {
                return await this.handlePurchase(interaction, interaction.customId);
            }
            else if (interaction.customId.startsWith('refund_')) {
                return await this.handleRefund(interaction);
            }

        } catch (error) {
            console.error('Error in shop button handler:', error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred. Please try again.',
                    ephemeral: true
                });
            }
        }
    },

    async handlePurchase(interaction, fullCustomId) {
        try {
            await interaction.deferUpdate();

            const parts = fullCustomId.split('_');
            if (parts.length < 3) {
                return await interaction.followUp({
                    content: '❌ Invalid purchase request.',
                    ephemeral: true
                });
            }

            const itemId = parts[2];
            const couponCode = parts[3] !== 'nocoupon' ? parts[3] : null;

            const item = await dbManager.getShopItemById(itemId);
            if (!item) {
                return await interaction.followUp({
                    content: '❌ Item not found or has been removed.',
                    ephemeral: true
                });
            }

            // ============ 🔒 **SKY BREAK SECURITY CHECK** ============
            console.log(`🔍 Checking Sky Break security for ${interaction.user.tag}`);

            const securityCheck = await skyBreakGuard.validatePurchase(
                interaction.user,
                interaction.guild,
                item.role_id
            );

            console.log(`📊 Security check result:`, {
                allowed: securityCheck.allowed,
                isSkyBreak: securityCheck.isSkyBreak,
                hasChampionRest: securityCheck.hasChampionRest
            });

            if (!securityCheck.allowed && securityCheck.isSkyBreak) {
                console.log(`🚫 PURCHASE BLOCKED for ${interaction.user.tag}: Missing ChampionRest`);

                return await interaction.followUp({
                    embeds: [securityCheck.embed],
                    ephemeral: false
                });
            }

            if (securityCheck.allowed && securityCheck.isSkyBreak) {
                console.log(`✅ Sky Break purchase allowed for ${interaction.user.tag}`);
                console.log(`ℹ️ ChampionRest will be removed after refund period`);
            }
            // ============ **END SECURITY CHECK** ============

            // ============ 🔒 **MESSAGE REQUIREMENT CHECK** ============
            console.log(`🔍 Checking message requirements for ${interaction.user.tag}`);

            const requirementCheck = await messageGuard.validatePurchase(
                interaction.user,
                interaction.guild,
                item.role_id
            );

            console.log(`📊 Message check result:`, {
                allowed: requirementCheck.allowed,
                isTargetRole: requirementCheck.isTargetRole,
                hasEnoughMessages: requirementCheck.hasEnoughMessages
            });

            if (!requirementCheck.allowed && requirementCheck.isTargetRole) {
                console.log(`🚫 PURCHASE BLOCKED for ${interaction.user.tag}: Not enough messages`);

                return await interaction.followUp({
                    embeds: [requirementCheck.embed],
                    ephemeral: false
                });
            }

            if (requirementCheck.allowed && requirementCheck.isTargetRole) {
                console.log(`✅ Message requirement satisfied for ${interaction.user.tag}`);
            }
            // ============ **END MESSAGE CHECK** ============

            // ============ 🎨 **COLORS MESSAGE REQUIREMENT CHECK** ============
            console.log(`🎨 Checking Colors message requirements for ${interaction.user.tag}`);

            const colorsCheck = await colorsMessageGuard.validatePurchase(
                interaction.user,
                interaction.guild,
                item.role_id
            );

            console.log(`🎨 Colors check result:`, {
                allowed: colorsCheck.allowed,
                isColorsRole: colorsCheck.isColorsRole,
                hasEnoughMessages: colorsCheck.hasEnoughMessages
            });

            if (!colorsCheck.allowed && colorsCheck.isColorsRole) {
                console.log(`🚫 COLORS PURCHASE BLOCKED for ${interaction.user.tag}: Not enough messages for Colors`);

                return await interaction.followUp({
                    embeds: [colorsCheck.embed],
                    ephemeral: false
                });
            }

            if (colorsCheck.allowed && colorsCheck.isColorsRole) {
                console.log(`✅ Colors message requirement satisfied for ${interaction.user.tag}`);
            }
            // ============ **END COLORS CHECK** ============

            let couponDiscount = 0;
            let couponId = null;

            if (couponCode && couponCode !== 'nocoupon') {
                const validation = await couponSystem.validateCoupon(interaction.user.id, couponCode);
                if (!validation.valid) {
                    console.log(`❌ Invalid coupon ${couponCode} for user ${interaction.user.tag}`);
                } else {
                    couponDiscount = validation.discountPercentage;
                    couponId = validation.coupon.id;
                }
            }

            const userData = await dbManager.getUserProfile(interaction.user.id);
            if (!userData) {
                return await interaction.followUp({
                    content: '❌ User account not found.',
                    ephemeral: true
                });
            }

            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (member && member.roles.cache.has(item.role_id)) {
                return await interaction.followUp({
                    content: '❌ You already have this role!',
                    ephemeral: true
                });
            }

            if (item.quantity !== -1 && item.quantity <= 0) {
                return await interaction.followUp({
                    content: '❌ This item is out of stock!',
                    ephemeral: true
                });
            }

            // Calculate final price
            let originalPriceCoins = item.original_price_coins;
            let originalPriceCrystals = item.original_price_crystals;
            let finalPriceCoins = originalPriceCoins;
            let finalPriceCrystals = originalPriceCrystals;

            if (item.is_on_sale && item.current_discount > 0) {
                let salePriceCoins = item.discounted_price_coins || Math.floor(originalPriceCoins * (1 - item.current_discount/100));
                let salePriceCrystals = item.discounted_price_crystals || Math.floor(originalPriceCrystals * (1 - item.current_discount/100));

                if (couponDiscount > 0) {
                    finalPriceCoins = Math.floor(salePriceCoins * (1 - couponDiscount/100));
                    finalPriceCrystals = Math.floor(salePriceCrystals * (1 - couponDiscount/100));
                } else {
                    finalPriceCoins = salePriceCoins;
                    finalPriceCrystals = salePriceCrystals;
                }
            } else if (couponDiscount > 0) {
                finalPriceCoins = Math.floor(originalPriceCoins * (1 - couponDiscount/100));
                finalPriceCrystals = Math.floor(originalPriceCrystals * (1 - couponDiscount/100));
            }

            if (userData.sky_coins < finalPriceCoins || userData.sky_crystals < finalPriceCrystals) {
                return await interaction.followUp({
                    content: '❌ You cannot afford this item!',
                    ephemeral: true
                });
            }

            if (shopSessionManager.hasRefundRequest(interaction.user.id)) {
                return await interaction.followUp({
                    content: '❌ You have a pending refund request. Please wait for it to expire.',
                    ephemeral: true
                });
            }

            const role = interaction.guild.roles.cache.get(item.role_id);
            if (!role) {
                return await interaction.followUp({
                    content: '❌ Role not found. Please contact an administrator.',
                    ephemeral: true
                });
            }

            try {
                await member.roles.add(role);
            } catch (roleError) {
                console.error('Error adding role:', roleError);
                return await interaction.followUp({
                    content: '❌ Could not give you the role. Please contact an administrator.',
                    ephemeral: true
                });
            }

            // Deduct money
            await dbManager.run(
                `UPDATE levels 
                 SET sky_coins = sky_coins - ?, 
                     sky_crystals = sky_crystals - ?
                 WHERE user_id = ?`,
                [finalPriceCoins, finalPriceCrystals, interaction.user.id]
            );

            // Reduce stock
            if (item.quantity !== -1 && item.quantity > 0) {
                await dbManager.run(
                    `UPDATE shop_items 
                     SET quantity = quantity - 1
                     WHERE id = ?`,
                    [itemId]
                );
            }

            // Delete coupon after use
            if (couponId) {
                await couponSystem.useCoupon(couponId);
                console.log(`✅ Used coupon for purchase of item ${itemId}`);
            }

            const purchaseId = `purchase_${Date.now()}_${interaction.user.id}_${itemId}`;
            console.log(`🆔 Generated purchase ID: ${purchaseId}`);

            // Build success message
            const successContainer = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addSectionComponents((section) => 
                    section
                        .addTextDisplayComponents((textDisplay) => 
                            textDisplay.setContent(
                                `## ✅ **PURCHASE SUCCESSFUL!**\n\n` +
                                `Item: <@&${item.role_id}>\n` +
                                `Cost: ${finalPriceCoins > 0 ? `**${shopSessionManager.formatNumber(finalPriceCoins)} <:Coins:1468446651965374534>**` : ''}` +
                                `${finalPriceCoins > 0 && finalPriceCrystals > 0 ? ' ||&|| ' : ''}` +
                                `${finalPriceCrystals > 0 ? `**${shopSessionManager.formatNumber(finalPriceCrystals)} <:Crystal:1468446688338251793>**` : ''}` +
                                `${couponDiscount > 0 ? `\nCoupon Used: **🎟️ ${couponDiscount}% OFF**` : ''}` +
                                `${item.is_on_sale && item.current_discount > 0 ? `\nShop Sale: **🔥 ${item.current_discount}% OFF**` : ''}`
                            )
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`${interaction.user.username}'s Purchase`)
                                .setURL(interaction.user.displayAvatarURL({ extension: 'png', size: 256 }))
                        )
                )
                .addSeparatorComponents((separator) => separator.setDivider(true))
                .addSectionComponents((section) => 
                    section
                        .addTextDisplayComponents((textDisplay) => 
                            textDisplay.setContent(`**⚠️ You have 30 seconds to refund this purchase**`)
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId(`refund_${item.role_id}_${itemId}_${purchaseId}`)
                                .setLabel('Refund Purchase')
                                .setStyle(ButtonStyle.Danger)
                        )
                );

            const channel = interaction.channel;
            const refundMessage = await channel.send({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });

            console.log(`📝 Sent purchase message with ID: ${refundMessage.id}, Purchase ID: ${purchaseId}`);

            const purchaseData = {
                itemId: itemId,
                roleId: item.role_id,
                finalPriceCoins: finalPriceCoins,
                finalPriceCrystals: finalPriceCrystals,
                couponDiscount: couponDiscount,
                shopDiscount: item.is_on_sale ? item.current_discount : 0,
                avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: interaction.guild.id,
                purchaseId: purchaseId,
                channelId: refundMessage.channelId,
                messageId: refundMessage.id
            };

            shopSessionManager.registerPurchaseMessage(refundMessage.id, purchaseData, interaction.client);

            shopSessionManager.addRefundRequest(
                interaction.user.id, 
                itemId, 
                item.role_id,
                refundMessage.id,
                refundMessage.channelId,
                purchaseId
            );

            const updateTimeout = setTimeout(async () => {
                try {
                    console.log(`⏰ Timeout triggered for message: ${refundMessage.id}`);

                    if (shopSessionManager.isMessageTracked(refundMessage.id)) {
                        console.log(`✅ Message ${refundMessage.id} is still tracked, updating to celebration...`);

                        // ⭐⭐⭐ APPLY BUFF HERE - بعد انتهاء فترة الـ Refund ⭐⭐⭐
                        if (item.buff_type && item.buff_type !== 'none' && item.buff_duration_minutes > 0) {
                            try {
                                const expiresAt = new Date(Date.now() + item.buff_duration_minutes * 60000);

                                await dbManager.run(
                                    `INSERT INTO active_buffs (user_id, buff_type, duration_minutes, expires_at, shop_item_id, role_id) 
                                     VALUES (?, ?, ?, ?, ?, ?)`,
                                    [
                                        interaction.user.id, 
                                        item.buff_type, 
                                        item.buff_duration_minutes, 
                                        expiresAt,
                                        item.id,
                                        item.role_id
                                    ]
                                );

                                console.log(`🎁 Applied ${item.buff_type} buff for ${item.buff_duration_minutes} minutes to user ${interaction.user.tag}`);
                            } catch (error) {
                                console.error('❌ Error applying buff:', error.message);
                            }
                        }

                        // ============ 🔄 **REMOVE CHAMPIONREST AFTER PURCHASE** ============
                        if (item.role_id === skyBreakGuard.SKY_BREAK_ROLE_ID) {
                            console.log(`🎯 This is a Sky Break purchase - checking ChampionRest removal...`);

                            try {
                                const removalResult = await skyBreakGuard.removeChampionRestAfterPurchase(
                                    interaction.user.id,
                                    interaction.guild
                                );

                                if (removalResult.success) {
                                    if (removalResult.removed) {
                                        console.log(`✅ Successfully removed ChampionRest from ${interaction.user.tag}`);
                                    } else {
                                        console.log(`ℹ️ ${interaction.user.tag} didn't have ChampionRest (already removed or never had)`);
                                    }
                                } else {
                                    console.log(`⚠️ Failed to remove ChampionRest: ${removalResult.error}`);
                                }
                            } catch (removeError) {
                                console.error(`💥 Error in ChampionRest removal:`, removeError);
                            }
                        }
                        // ============ **END CHAMPIONREST REMOVAL** ============

                        // ============ 🎟️ **SKYPASS TEMPROLE CONVERSION** ============
                        if (item.role_id === skyPassGuard.SKY_PASS_ROLE_ID) {
                            console.log(`🎟️ This is a SkyPass purchase - converting to ${skyPassGuard.DURATION} temprole...`);

                            try {
                                const conversionResult = await skyPassGuard.convertToTemprole(
                                    interaction.guild,      // ⭐⭐ الجلد ⭐⭐
                                    interaction.user.id,    // ⭐⭐ الـ ID ⭐⭐
                                    item.role_id           // ⭐⭐ الـ Role ID ⭐⭐
                                );

                                if (conversionResult.success) {
                                    console.log(`✅ Successfully converted SkyPass to temprole for ${interaction.user.tag}`);
                                } else {
                                    console.log(`⚠️ Failed to convert SkyPass: ${conversionResult.error}`);
                                }
                            } catch (skyPassError) {
                                console.error(`💥 Error in SkyPass conversion:`, skyPassError);
                            }
                        }
                        // ============ **END SKYPASS** ============

                        // ثم تحديث الرسالة
                        const updated = await shopSessionManager.updateMessageToCelebration(refundMessage.id);

                        if (updated) {
                            console.log(`✅ Successfully updated message ${refundMessage.id} to celebration`);
                        } else {
                            console.log(`❌ Failed to update message ${refundMessage.id}`);
                        }
                    } else {
                        console.log(`📌 Message ${refundMessage.id} is no longer tracked (probably refunded)`);
                    }

                    shopSessionManager.removeRefundRequest(interaction.user.id);

                    setTimeout(async () => {
                        try {
                            const updatedUserData = await dbManager.getUserProfile(interaction.user.id);
                            const updatedItems = await dbManager.getActiveShopItems();
                            const userSession = shopSessionManager.getSession(interaction.user.id);

                            if (userSession && userSession.messageId && userSession.channelId) {
                                const currentPage = userSession.page || 1;
                                const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });
                                const itemsPerPage = 5;
                                const totalPages = Math.max(1, Math.ceil(updatedItems.length / itemsPerPage));
                                const pageItems = updatedItems.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

                                const container = await this.buildShopContainer(
                                    interaction, 
                                    currentPage, 
                                    totalPages, 
                                    pageItems, 
                                    updatedUserData, 
                                    serverIcon
                                );

                                const shopChannel = await interaction.guild.channels.fetch(userSession.channelId).catch(() => null);
                                if (shopChannel) {
                                    const originalMessage = await shopChannel.messages.fetch(userSession.messageId).catch(() => null);
                                    if (originalMessage) {
                                        await originalMessage.edit({
                                            components: [container],
                                            flags: MessageFlags.IsComponentsV2,
                                            allowedMentions: { parse: [] }
                                        });
                                        console.log(`✅ Shop interface updated successfully`);
                                    }
                                }
                            }
                        } catch (shopUpdateError) {
                            console.error('Error updating shop after timeout:', shopUpdateError.message);
                        }
                    }, 500);

                } catch (error) {
                    console.error('❌ Error in timeout callback:', error);
                }
            }, 30000); // 30 seconds

            const userSession = shopSessionManager.getSession(interaction.user.id);
            if (userSession) {
                userSession.updateTimeout = updateTimeout;
                shopSessionManager.setSession(interaction.user.id, userSession);
            }

            const updatedUserData = await dbManager.getUserProfile(interaction.user.id);
            const updatedItems = await dbManager.getActiveShopItems();
            const currentPage = userSession?.page || 1;

            await this.displayShopPage(interaction, currentPage, updatedItems, updatedUserData);

        } catch (error) {
            console.error('❌ Error in handlePurchase:', error);

            await interaction.followUp({
                content: '❌ An error occurred during purchase. Please try again.',
                ephemeral: true
            });
        }
    },

    async handleRefund(interaction) {
        try {
            console.log(`🔄 Starting refund process for ${interaction.user.tag}`);

            const customId = interaction.customId;
            const parts = customId.split('_');

            if (parts.length < 4) {
                return await interaction.reply({
                    content: '❌ Invalid refund request.',
                    ephemeral: true
                });
            }

            const roleId = parts[1];
            const itemId = parts[2];
            const purchaseId = parts.slice(3).join('_');

            console.log(`🔍 Refund data: roleId=${roleId}, itemId=${itemId}, purchaseId=${purchaseId}`);

            const refundData = shopSessionManager.getRefundRequest(interaction.user.id);
            if (!refundData) {
                console.log(`❌ No refund request found for ${interaction.user.tag}`);
                return await interaction.reply({
                    content: '❌ Refund window has expired! (30 seconds passed)',
                    ephemeral: true
                });
            }

            if (refundData.purchaseId !== purchaseId) {
                console.log(`❌ Purchase ID mismatch: stored=${refundData.purchaseId}, received=${purchaseId}`);
                return await interaction.reply({
                    content: '❌ Invalid refund request.',
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });
            console.log(`✅ Interaction deferred`);

            const userSession = shopSessionManager.getSession(interaction.user.id);
            if (userSession && userSession.updateTimeout) {
                clearTimeout(userSession.updateTimeout);
                delete userSession.updateTimeout;
                shopSessionManager.setSession(interaction.user.id, userSession);
                console.log(`⏹️ Cancelled update timeout for user ${interaction.user.id}`);
            }

            if (refundData.refundMessageId) {
                shopSessionManager.cancelPurchaseMessage(refundData.refundMessageId);
                console.log(`🗑️ Removed purchase tracking for message ${refundData.refundMessageId}`);
            }

            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                console.log(`❌ Member not found: ${interaction.user.id}`);
                return await interaction.editReply({
                    content: '❌ Member not found.',
                    ephemeral: true
                });
            }

            console.log(`✅ Member found: ${member.user.tag}`);

            const role = interaction.guild.roles.cache.get(roleId);
            if (role) {
                try {
                    await member.roles.remove(role);
                    console.log(`✅ Removed role: ${role.name}`);
                } catch (error) {
                    console.error(`❌ Error removing role ${roleId}:`, error);
                    return await interaction.editReply({
                        content: '❌ Could not remove role. Please contact an administrator.',
                        ephemeral: true
                    });
                }
            }

            const item = await dbManager.getShopItemById(itemId);
            if (item) {
                let refundCoins = item.original_price_coins;
                let refundCrystals = item.original_price_crystals;

                if (item.is_on_sale && item.current_discount > 0) {
                    refundCoins = item.discounted_price_coins || Math.floor(item.original_price_coins * (1 - item.current_discount/100));
                    refundCrystals = item.discounted_price_crystals || Math.floor(item.original_price_crystals * (1 - item.current_discount/100));
                }

                console.log(`💰 Refunding: ${refundCoins} coins, ${refundCrystals} crystals`);

                await dbManager.run(
                    `UPDATE levels 
                     SET sky_coins = sky_coins + ?, 
                         sky_crystals = sky_crystals + ?
                     WHERE user_id = ?`,
                    [refundCoins, refundCrystals, interaction.user.id]
                );

                if (item.quantity !== -1) {
                    await dbManager.run(
                        `UPDATE shop_items 
                         SET quantity = quantity + 1
                         WHERE id = ?`,
                        [itemId]
                    );
                }

                console.log(`✅ Money refunded successfully`);
            }

            shopSessionManager.removeRefundRequest(interaction.user.id);
            console.log(`✅ Refund request removed from session`);

            try {
                if (refundData.refundMessageId && refundData.refundChannelId) {
                    const channel = await interaction.guild.channels.fetch(refundData.refundChannelId).catch(() => null);
                    if (channel) {
                        const message = await channel.messages.fetch(refundData.refundMessageId).catch(() => null);
                        if (message && !message.deleted) {
                            await message.delete();
                            console.log(`🗑️ Deleted original purchase message`);
                        }
                    }
                }
            } catch (error) {
                console.log('Could not delete original message:', error.message);
            }

            await interaction.editReply({
                content: '✅ **REFUND COMPLETED!**\nYour money has been returned and the role has been removed.',
                ephemeral: true
            });
            console.log(`✅ Refund confirmation sent`);

            await this.updateShopAfterRefund(interaction);

        } catch (error) {
            console.error('❌ Error in handleRefund:', error);

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: `❌ Refund failed: ${error.message}`,
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: `❌ Refund failed: ${error.message}`,
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error('Could not send error message:', replyError);
            }
        }
    },

    async updateShopAfterRefund(interaction) {
        try {
            console.log(`🔄 Updating shop interface after refund...`);

            const updatedUserData = await dbManager.getUserProfile(interaction.user.id);
            const updatedItems = await dbManager.getActiveShopItems();
            const userSession = shopSessionManager.getSession(interaction.user.id);

            if (userSession) {
                const currentPage = userSession.page || 1;
                const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 });
                const itemsPerPage = 5;
                const totalPages = Math.max(1, Math.ceil(updatedItems.length / itemsPerPage));
                const pageItems = updatedItems.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

                const container = await this.buildShopContainer(
                    interaction, 
                    currentPage, 
                    totalPages, 
                    pageItems, 
                    updatedUserData, 
                    serverIcon
                );

                const channel = interaction.guild.channels.cache.get(userSession.channelId);
                if (channel) {
                    const originalMessage = await channel.messages.fetch(userSession.messageId).catch(() => null);
                    if (originalMessage) {
                        await originalMessage.edit({
                            components: [container],
                            flags: MessageFlags.IsComponentsV2,
                            allowedMentions: { parse: [] }
                        });
                        console.log(`✅ Shop interface updated successfully`);
                    }
                }
            }
        } catch (updateError) {
            console.error('Error updating shop after refund:', updateError.message);
        }
    }
};