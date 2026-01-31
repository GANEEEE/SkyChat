// Tweets/Tweets.js
const { TwitterApi } = require('twitter-api-v2');
const { EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database'); // تأكد من المسار الصحيح

// تهيئة عميل تويتر
const twitterClient = new TwitterApi({
    appKey: 'k0JjOPE5CtyITKqFMgMdQzOEg',
    appSecret: 'o64zzmAGq7vrvgW4JufwEjENEvgralb9950cM8N9kJUqp7Hbwk',
    accessToken: '1949196284486701056-rgWFu4c3oORypmmii1ZatTEXjP5uif',
    accessSecret: 'MDylXsK0bOparz1eIiPPbrwPB37EBmuID03vNBE6QHAtP'
});

// قائمة الحسابات التي تريد تعقبها
const accountsToTrack = ['MoustafaW85839', 'username2'];

// آخر معرف تغريدة تم نشرها لكل حساب
let lastTweetIds = {};

module.exports = async (client) => {
    try {
        // التحقق من التغريدات الجديدة كل 5 دقائق (لتجنب Rate Limit)
        setInterval(async () => {
            try {
                // جلب قناة Tweets من قاعدة البيانات
                let tweetsChannel = null;

                // البحث في logChannels المخزنة في العميل
                if (client.logChannels) {
                    for (const guildId in client.logChannels) {
                        const guildChannels = client.logChannels[guildId];
                        if (guildChannels.tweets) {
                            tweetsChannel = await client.channels.fetch(guildChannels.tweets.id).catch(() => null);
                            if (tweetsChannel) break;
                        }
                    }
                }

                // إذا لم توجد في العميل، البحث في قاعدة البيانات
                if (!tweetsChannel && client.dbManager) {
                    const allLogChannels = await client.dbManager.all('SELECT * FROM log_channels WHERE channel_type = ?', ['tweets']);
                    if (allLogChannels && allLogChannels.length > 0) {
                        // استخدام أول قناة tweets وجدناها
                        const tweetsChannelData = allLogChannels[0];
                        tweetsChannel = await client.channels.fetch(tweetsChannelData.channel_id).catch(() => null);
                    }
                }

                if (!tweetsChannel) {
                    //console.log('❌ لم يتم العثور على قناة Tweets');
                    return;
                }

                for (const username of accountsToTrack) {
                    try {
                        // جلب بيانات المستخدم
                        const user = await twitterClient.v2.userByUsername(username);
                        if (!user?.data?.id) {
                            console.error(`⚠️ حساب ${username} غير موجود`);
                            continue;
                        }

                        // جلب التغريدات
                        const tweets = await twitterClient.v2.userTimeline(user.data.id, {
                            max_results: 5,
                            exclude: ['replies', 'retweets']
                        });

                        // التحقق من وجود تغريدات
                        if (!tweets?.data?.data?.length) {
                            console.log(`ℹ️ لا توجد تغريدات جديدة لـ ${username}`);
                            continue;
                        }

                        // أخذ أحدث تغريدة
                        const latestTweet = tweets.data.data[0];
                        if (!latestTweet?.id) {
                            console.error(`⚠️ لا يمكن قراءة التغريدة لـ ${username}`);
                            continue;
                        }

                        // التحقق من التغريدة الجديدة
                        if (!lastTweetIds[username] || latestTweet.id !== lastTweetIds[username]) {
                            lastTweetIds[username] = latestTweet.id;

                            // إنشاء رابط التغريدة
                            const tweetUrl = `https://twitter.com/${username}/status/${latestTweet.id}`;

                            // معالجة التاريخ بشكل آمن
                            let tweetDate;
                            try {
                                tweetDate = new Date(latestTweet.created_at);
                                if (isNaN(tweetDate.getTime())) {
                                    throw new Error('Invalid date');
                                }
                            } catch (dateError) {
                                console.error(`⚠️ تاريخ غير صالح، استخدام التاريخ الحالي`);
                                tweetDate = new Date();
                            }
                            const tweetTimestamp = Math.floor(tweetDate.getTime() / 1000);

                            // إنشاء الإيمبد
                            const embed = new EmbedBuilder()
                                .setColor('#1DA1F2')
                                .setAuthor({
                                    name: `${user.data.name} (@${username})`,
                                    iconURL: `https://unavatar.io/twitter/${username}`,
                                    url: `https://twitter.com/${username}`
                                })
                                .setDescription(latestTweet.text || 'لا يوجد نص متاح')
                                .addFields(
                                    { 
                                        name: 'تاريخ النشر', 
                                        value: isValidDate(tweetDate) ? `<t:${tweetTimestamp}:F>` : 'غير متوفر',
                                        inline: true 
                                    },
                                    { 
                                        name: 'الرابط', 
                                        value: `[اضغط هنا](${tweetUrl})`, 
                                        inline: true 
                                    }
                                )
                                .setFooter({
                                    text: 'Twitter',
                                    iconURL: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
                                });

                            // إضافة الطابع الزمني فقط إذا كان التاريخ صالحًا
                            if (isValidDate(tweetDate)) {
                                embed.setTimestamp(tweetDate);
                            }

                            // إرسال الرسالة إلى قناة Tweets
                            try {
                                await tweetsChannel.send({
                                    content: `**تغريدة جديدة من [${user.data.name}](${tweetUrl})**\n${tweetUrl}`,
                                    embeds: [embed]
                                });
                                console.log(`✅ تم إرسال تغريدة من ${username} إلى قناة Tweets`);
                            } catch (sendError) {
                                console.error(`❌ خطأ في إرسال التغريدة: ${sendError.message}`);
                            }
                        }
                    } catch (error) {
                        if (error.code === 429) {
                            const resetTime = error.rateLimit?.reset || Math.floor(Date.now()/1000) + 900;
                            const waitSeconds = Math.max(30, resetTime - Math.floor(Date.now()/1000));
                            console.log(`⏳ حد الطلبات: الانتظار ${waitSeconds} ثانية...`);
                            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
                        } else {
                            console.error(`❌ خطأ في ${username}:`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ خطأ في جلب قناة Tweets:', error.message);
            }
        }, 300000); // كل 5 دقائق
    } catch (error) {
        console.error('🔥 خطأ رئيسي:', error);
    }
};

// دالة مساعدة للتحقق من صحة التاريخ
function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}