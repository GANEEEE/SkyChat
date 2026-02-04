const {
  SlashCommandBuilder,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MessageFlags,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType
} = require('discord.js');
const dbManager = require('../Data/database');

// Session manager للـ Leaderboard
class LeaderboardSessionManager {
  constructor() {
      this.sessions = new Map();
      this.collectors = new Map();
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
      const session = this.sessions.get(userId);
      if (session && session.collector) {
          try {
              session.collector.stop();
          } catch (e) {
              console.log('Error stopping collector:', e.message);
          }
      }
      this.collectors.delete(userId);
      return this.sessions.delete(userId);
  }

  setCollector(userId, collector) {
      this.collectors.set(userId, collector);
  }

  getCollector(userId) {
      return this.collectors.get(userId);
  }

  startCleanup() {
      // تنظيف الجلسات القديمة كل 30 دقيقة
      setInterval(() => {
          const now = Date.now();
          let deletedCount = 0;

          for (const [userId, session] of this.sessions.entries()) {
              if (now - session.lastUpdated > 30 * 60 * 1000) {
                  this.deleteSession(userId);
                  deletedCount++;
              }
          }

          if (deletedCount > 0) {
              console.log(`🧹 Cleaned ${deletedCount} old leaderboard sessions`);
          }
      }, 30 * 60 * 1000);
  }
}

const leaderboardSessionManager = new LeaderboardSessionManager();

// Cache للـ avatars
const avatarCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('🏆 Display server leaderboards')
      .setDMPermission(false),

  async execute(interaction) {
      try {
          console.log(`🏆 /leaderboard command by ${interaction.user.tag}`);

          await interaction.deferReply({ ephemeral: false });

          // تمرير interaction للدالة مع نوع الفلتر الافتراضي (XP)
          const players = await this.getAllPlayers(interaction, 'xp');

          if (players.length === 0) {
              return await interaction.editReply({
                  content: '📭 No players found in the leaderboard yet!',
                  allowedMentions: { parse: [] }
              });
          }

          const message = await this.displayLeaderboardPage(interaction, 1, players, true, 'xp');

          // إنشاء collector للأزرار
          const collector = this.createCollector(interaction, message, players);

          // حفظ الجلسة والـ collector
          leaderboardSessionManager.setSession(interaction.user.id, {
              page: 1,
              players: players,
              messageId: message.id,
              channelId: message.channelId,
              totalPages: Math.ceil(players.length / 5),
              collector: collector,
              currentFilter: 'xp'
          });

          leaderboardSessionManager.setCollector(interaction.user.id, collector);

      } catch (error) {
          console.error('Error in leaderboard command:', error);

          if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                  content: '❌ Error loading leaderboard. Please try again.',
                  ephemeral: true
              });
          } else {
              await interaction.editReply({
                  content: '❌ Error loading leaderboard. Please try again.',
                  allowedMentions: { parse: [] }
              });
          }
      }
  },

  createCollector(interaction, message, originalPlayers) {
      const filter = (i) => 
          i.user.id === interaction.user.id && 
          ['lb_next_page', 'lb_prev_page', 'filter_xp', 'filter_coins', 'filter_crystals', 'filter_wishes'].includes(i.customId);

      const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          filter,
          time: 300000 // 5 دقائق
      });

      collector.on('collect', async (buttonInteraction) => {
          try {
              console.log(`🏆 Button clicked: ${buttonInteraction.customId} by ${buttonInteraction.user.tag}`);

              await buttonInteraction.deferUpdate().catch(() => {});

              const userSession = leaderboardSessionManager.getSession(buttonInteraction.user.id);

              if (!userSession) {
                  console.log('❌ No session found, creating new one');
                  return;
              }

              let newPage = 1; // العودة للصفحة الأولى عند تغيير الفلتر
              let newFilter = userSession.currentFilter;

              // تحديد الفلتر الجديد
              if (buttonInteraction.customId.startsWith('filter_')) {
                  switch(buttonInteraction.customId) {
                      case 'filter_xp':
                          newFilter = 'xp';
                          break;
                      case 'filter_coins':
                          newFilter = 'sky_coins';
                          break;
                      case 'filter_crystals':
                          newFilter = 'sky_crystals';
                          break;
                      case 'filter_wishes':
                          newFilter = 'skywell_total';
                          break;
                  }
              } else {
                  newFilter = userSession.currentFilter;

                  switch(buttonInteraction.customId) {
                      case 'lb_next_page':
                          if (userSession.page < userSession.totalPages) {
                              newPage = userSession.page + 1;
                          } else {
                              newPage = userSession.page;
                          }
                          break;

                      case 'lb_prev_page':
                          if (userSession.page > 1) {
                              newPage = userSession.page - 1;
                          } else {
                              newPage = userSession.page;
                          }
                          break;
                  }
              }

              // جلب البيانات المحدثة حسب الفلتر الجديد
              const updatedPlayers = await this.getAllPlayers(buttonInteraction, newFilter);

              // تحديث الصفحة بالبيانات المحدثة
              await this.updateLeaderboardPage(
                  buttonInteraction, 
                  message, 
                  newPage, 
                  updatedPlayers,
                  newFilter
              );

              // تحديث الجلسة بالبيانات المحدثة
              leaderboardSessionManager.setSession(buttonInteraction.user.id, {
                  ...userSession,
                  page: newPage,
                  players: updatedPlayers,
                  totalPages: Math.ceil(updatedPlayers.length / 5),
                  currentFilter: newFilter
              });

          } catch (error) {
              console.error('Error in collector:', error);
              try {
                  await buttonInteraction.followUp({
                      content: '❌ An error occurred. Please try again.',
                      ephemeral: true
                  });
              } catch (e) {
                  console.error('Could not send error message:', e);
              }
          }
      });

      collector.on('end', (collected, reason) => {
          console.log(`🏆 Collector ended for user ${interaction.user.tag}: ${reason}`);

          if (reason === 'time') {
              leaderboardSessionManager.deleteSession(interaction.user.id);
          }
      });

      return collector;
  },

  async getAllPlayers(interaction, filterType = 'xp') {
      try {
          // تحديد الاستعلام حسب نوع الفلتر
          let orderByQuery;
          switch(filterType) {
              case 'xp':
                  orderByQuery = 'xp DESC';
                  break;
              case 'sky_coins':
                  orderByQuery = 'sky_coins DESC';
                  break;
              case 'sky_crystals':
                  orderByQuery = 'sky_crystals DESC';
                  break;
              case 'skywell_total':
                  // لهذا الفلتر نحتاج لدمج بيانات Skywell
                  return await this.getPlayersByWishes(interaction);
              default:
                  orderByQuery = 'xp DESC';
          }

          // جلب كل اللاعبين مع بياناتهم حسب الفلتر
          const levelsQuery = `
              SELECT 
                  user_id, 
                  username, 
                  xp, 
                  level, 
                  sky_coins, 
                  sky_crystals 
              FROM levels 
              ORDER BY ${orderByQuery}
          `;

          const allLevels = await dbManager.all(levelsQuery);

          if (allLevels.length === 0) return [];

          // جلب بيانات Skywell وجلب الصور من Discord API
          const players = await Promise.all(
              allLevels.map(async (user) => {
                  // جلب بيانات Skywell
                  const skywellQuery = `
                      SELECT 
                          total_coins_thrown,
                          total_converted_coins
                      FROM skywell_users 
                      WHERE user_id = $1
                  `;

                  const skywellData = await dbManager.get(skywellQuery, [user.user_id]);

                  const skywellTotal = (skywellData?.total_coins_thrown || 0) + 
                                     (skywellData?.total_converted_coins || 0);

                  // الحصول على صورة المستخدم من Discord API مع cache
                  let avatarURL = avatarCache.get(user.user_id);
                  let username = user.username;

                  if (!avatarURL) {
                      try {
                          // محاولة جلب المستخدم من الـ client
                          const discordUser = await interaction.client.users.fetch(user.user_id).catch(() => null);

                          if (discordUser) {
                              // الحصول على رابط الصورة
                              avatarURL = discordUser.displayAvatarURL({ 
                                  extension: 'png', 
                                  size: 256,
                                  forceStatic: false
                              });
                              username = discordUser.username;

                              // تخزين في cache لمدة 5 دقائق
                              avatarCache.set(user.user_id, avatarURL);
                              setTimeout(() => avatarCache.delete(user.user_id), 5 * 60 * 1000);
                          } else {
                              avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                          }
                      } catch (error) {
                          console.log(`⚠️ Could not fetch user ${user.user_id}:`, error.message);
                          avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                      }
                  }

                  return {
                      userId: user.user_id,
                      username: username,
                      xp: user.xp || 0,
                      level: user.level || 0,
                      sky_coins: user.sky_coins || 0,
                      sky_crystals: user.sky_crystals || 0,
                      skywell_total: skywellTotal,
                      avatarURL: avatarURL,
                      sortValue: this.getSortValue(user, skywellTotal, filterType)
                  };
              })
          );

          // إذا كان الفلتر XP فالعملية تمت بالفعل في SQL
          // ولكن للفلاتر الأخرى قد نحتاج لفرز إضافي
          if (filterType === 'xp') {
              return players; // تم الفرز بالفعل في SQL
          } else {
              // فرز حسب قيمة الفرز المحددة
              return players.sort((a, b) => b.sortValue - a.sortValue);
          }

      } catch (error) {
          console.error('Error getting all players:', error);
          return [];
      }
  },

  // دالة خاصة لجلب اللاعبين حسب الـ Wishes (Skywell)
  async getPlayersByWishes(interaction) {
      try {
          // جلب كل المستخدمين مع دمج بيانات levels و skywell
          const query = `
              SELECT 
                  l.user_id, 
                  l.username, 
                  l.xp, 
                  l.level, 
                  l.sky_coins, 
                  l.sky_crystals,
                  COALESCE(s.total_coins_thrown, 0) as total_coins_thrown,
                  COALESCE(s.total_converted_coins, 0) as total_converted_coins
              FROM levels l
              LEFT JOIN skywell_users s ON l.user_id = s.user_id
              ORDER BY (COALESCE(s.total_coins_thrown, 0) + COALESCE(s.total_converted_coins, 0)) DESC
          `;

          const allData = await dbManager.all(query);

          if (allData.length === 0) return [];

          const players = await Promise.all(
              allData.map(async (user) => {
                  const skywellTotal = (user.total_coins_thrown || 0) + (user.total_converted_coins || 0);

                  // الحصول على صورة المستخدم من Discord API مع cache
                  let avatarURL = avatarCache.get(user.user_id);
                  let username = user.username;

                  if (!avatarURL) {
                      try {
                          const discordUser = await interaction.client.users.fetch(user.user_id).catch(() => null);

                          if (discordUser) {
                              avatarURL = discordUser.displayAvatarURL({ 
                                  extension: 'png', 
                                  size: 256,
                                  forceStatic: false
                              });
                              username = discordUser.username;

                              avatarCache.set(user.user_id, avatarURL);
                              setTimeout(() => avatarCache.delete(user.user_id), 5 * 60 * 1000);
                          } else {
                              avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                          }
                      } catch (error) {
                          console.log(`⚠️ Could not fetch user ${user.user_id}:`, error.message);
                          avatarURL = 'https://cdn.discordapp.com/embed/avatars/0.png';
                      }
                  }

                  return {
                      userId: user.user_id,
                      username: username,
                      xp: user.xp || 0,
                      level: user.level || 0,
                      sky_coins: user.sky_coins || 0,
                      sky_crystals: user.sky_crystals || 0,
                      skywell_total: skywellTotal,
                      avatarURL: avatarURL,
                      sortValue: skywellTotal
                  };
              })
          );

          return players;

      } catch (error) {
          console.error('Error getting players by wishes:', error);
          return [];
      }
  },

  // دالة للحصول على قيمة الفرز
  getSortValue(user, skywellTotal, filterType) {
      switch(filterType) {
          case 'xp':
              return user.xp || 0;
          case 'sky_coins':
              return user.sky_coins || 0;
          case 'sky_crystals':
              return user.sky_crystals || 0;
          case 'skywell_total':
              return skywellTotal;
          default:
              return user.xp || 0;
      }
  },

  async displayLeaderboardPage(interaction, pageNumber, allPlayers, isNewCommand = false, filterType = 'xp') {
      try {
          const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 }) || 
                           interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 });

          const playersPerPage = 5;
          const totalPages = Math.max(1, Math.ceil(allPlayers.length / playersPerPage));

          if (pageNumber > totalPages) pageNumber = totalPages;
          if (pageNumber < 1) pageNumber = 1;

          const startIndex = (pageNumber - 1) * playersPerPage;
          const endIndex = startIndex + playersPerPage;
          const pagePlayers = allPlayers.slice(startIndex, endIndex);

          // بناء الكونتنر مع الفلتر
          const container = await this.buildLeaderboardContainer(
              pageNumber, 
              totalPages, 
              pagePlayers,
              serverIcon,
              allPlayers.length,
              filterType
          );

          // إرسال أو تعديل الرسالة
          if (isNewCommand) {
              const message = await interaction.editReply({
                  components: [container],
                  flags: MessageFlags.IsComponentsV2,
                  allowedMentions: { parse: [] }
              });
              return message;
          } else {
              await interaction.message.edit({
                  components: [container],
                  flags: MessageFlags.IsComponentsV2,
                  allowedMentions: { parse: [] }
              });
              return interaction.message;
          }

      } catch (error) {
          console.error('Error in displayLeaderboardPage:', error);
          throw error;
      }
  },

  async updateLeaderboardPage(interaction, message, pageNumber, allPlayers, filterType = 'xp') {
      try {
          const serverIcon = interaction.guild.iconURL({ extension: 'png', size: 256 }) || 
                           interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 });

          const playersPerPage = 5;
          const totalPages = Math.max(1, Math.ceil(allPlayers.length / playersPerPage));

          if (pageNumber > totalPages) pageNumber = totalPages;
          if (pageNumber < 1) pageNumber = 1;

          const startIndex = (pageNumber - 1) * playersPerPage;
          const endIndex = startIndex + playersPerPage;
          const pagePlayers = allPlayers.slice(startIndex, endIndex);

          // بناء الكونتنر مع الفلتر
          const container = await this.buildLeaderboardContainer(
              pageNumber, 
              totalPages, 
              pagePlayers,
              serverIcon,
              allPlayers.length,
              filterType
          );

          // تعديل الرسالة
          await message.edit({
              components: [container],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] }
          });

      } catch (error) {
          console.error('Error updating leaderboard page:', error);
          throw error;
      }
  },

  async buildLeaderboardContainer(pageNumber, totalPages, pagePlayers, serverIcon, totalPlayers, filterType = 'xp') {
      const container = new ContainerBuilder()
          .setAccentColor(0x0073ff);

      // ========== السكشن الأول (العنوان) مع thumbnail السيرفر ==========
      const titleText = this.getTitleText(filterType);
      const titleSection = new SectionBuilder()
          .addTextDisplayComponents((textDisplay) =>
              textDisplay.setContent(
                  `## 🏆 **GAMERSKY LEADERBOARD**\n` +
                  `### ${titleText}\n` +
                  `Page ${pageNumber} of ${totalPages} • ${totalPlayers} players total`
              )
          )
          .setThumbnailAccessory((thumbnail) =>
              thumbnail
                  .setDescription('Server Leaderboard')
                  .setURL(serverIcon)
          );

      container.addSectionComponents((section) => titleSection);
      container.addSeparatorComponents((separator) => 
          new SeparatorBuilder().setDivider(true)
      );

      // ========== أزرار الفلاتر (4 أزرار فقط) ==========
      const filterButtons = this.createFilterButtons(filterType);
      container.addActionRowComponents((actionRow) =>
          actionRow.setComponents(filterButtons)
      );

      container.addSeparatorComponents((separator) => 
          new SeparatorBuilder().setDivider(true)
      );

      // ========== إضافة كل لاعب ==========
      for (let i = 0; i < pagePlayers.length; i++) {
          const player = pagePlayers[i];
          const globalRank = ((pageNumber - 1) * 5) + i + 1;
          const rankEmoji = this.getRankEmoji(globalRank);

          const playerSection = new SectionBuilder()
              .addTextDisplayComponents((textDisplay) =>
                  textDisplay.setContent(
                      `## **${rankEmoji} ${player.username}**\n` +
                      `### Level: **${player.level}**\n` +
                      `### <:XP:1468446751282302976>: **${player.xp.toLocaleString()}** ||&|| <:Coins:1468446651965374534> Coins: **${player.sky_coins.toLocaleString()}** ||&|| <:Crystal:1468446688338251793> Crystals: **${player.sky_crystals.toLocaleString()}**\n` +
                      `-# Total Well: **${player.skywell_total.toLocaleString()}**`
                  )
              )
              .setThumbnailAccessory((thumbnail) =>
                  thumbnail
                      .setDescription(`${player.username} - Rank #${globalRank}`)
                      .setURL(player.avatarURL)
              );

          container.addSectionComponents((section) => playerSection);

          // إضافة فاصل بين اللاعبين
          if (i < pagePlayers.length - 1) {
              container.addSeparatorComponents((separator) => 
                  new SeparatorBuilder().setDivider(true)
              );
          }
      }

      // ========== أزرار التنقل ==========
      container.addSeparatorComponents((separator) => 
          new SeparatorBuilder().setDivider(true)
      );

      // سكشن التنقل الرئيسي
      const navigationSection = new SectionBuilder()
          .setButtonAccessory((button) =>
              button
                  .setCustomId('lb_next_page')
                  .setLabel('Next ▶️')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(pageNumber >= totalPages)
          )
          .addTextDisplayComponents((textDisplay) =>
              textDisplay.setContent(`-# Page ${pageNumber} of ${totalPages}`)
          );

      container.addSectionComponents((section) => navigationSection);

      // زر السابق في سطر منفصل
      if (pageNumber > 1) {
          container.addActionRowComponents((actionRow) =>
              actionRow.setComponents(
                  new ButtonBuilder()
                      .setCustomId('lb_prev_page')
                      .setLabel('◀️ Previous')
                      .setStyle(ButtonStyle.Secondary)
              )
          );
      }

      return container;
  },

  // دالة لإنشاء أزرار الفلاتر (4 أزرار فقط)
  createFilterButtons(currentFilter) {
      return [
          new ButtonBuilder()
              .setCustomId('filter_xp')
              .setLabel('XP')
              .setStyle(currentFilter === 'xp' ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setEmoji('⭐'),

          new ButtonBuilder()
              .setCustomId('filter_coins')
              .setLabel('Coins')
              .setStyle(currentFilter === 'sky_coins' ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setEmoji('🪙'),

          new ButtonBuilder()
              .setCustomId('filter_crystals')
              .setLabel('Crystals')
              .setStyle(currentFilter === 'sky_crystals' ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setEmoji('💎'),

          new ButtonBuilder()
              .setCustomId('filter_wishes')
              .setLabel('Wishes')
              .setStyle(currentFilter === 'skywell_total' ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setEmoji('🎯')
      ];
  },

  // دالة للحصول على نص العنوان حسب الفلتر
  getTitleText(filterType) {
      switch(filterType) {
          case 'xp':
              return 'Top Players by XP';
          case 'sky_coins':
              return 'Top Players by Sky Coins';
          case 'sky_crystals':
              return 'Top Players by Sky Crystals';
          case 'skywell_total':
              return 'Top Players by Wishes (Skywell)';
          default:
              return 'Top Players by XP';
      }
  },

  getRankEmoji(rank) {
      switch(rank) {
          case 1: return '🥇';
          case 2: return '🥈';
          case 3: return '🥉';
          case 4:
          case 5: return '🌟';
          case 6:
          case 7:
          case 8: return '⭐';
          case 9:
          case 10: return '✨';
          default: return `#${rank}`;
      }
  }
};