const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const dbManager = require('../Data/database');

const activeTimers = new Map();
const activeCollectors = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('story')
        .setDescription('Start an interactive story puzzle adventure')
        .addStringOption(option =>
            option.setName('story')
                .setDescription('Choose a story to play')
                .setRequired(true)
                .addChoices(
                    { name: 'Ancient Astronomer Adventure', value: 'astronomer' },
                    { name: 'Dark Pyramids Expedition', value: 'pyramids' },
                    { name: 'Jewel Heist Investigation', value: 'heist' },
                    { name: 'Haunted Mansion Mystery', value: 'haunted' },
                    { name: 'City of the Undead', value: 'undead' }
                )),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            const storyType = interaction.options.getString('story');
            const story = this.getStory(storyType);

            // التحقق من وجود القصة
            if (!story) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('❌ STORY NOT FOUND')
                            .setDescription('The selected story could not be found. Please try again.')
                    ]
                });
                return;
            }

            const randomTime = this.generateRandomTime();

            const { embed, components } = this.createStageEmbed(story, story.startingStage, interaction.user, randomTime, 0);

            await interaction.editReply({ 
                embeds: [embed], 
                components: components 
            });

            this.startCountdown(interaction, story, story.startingStage, randomTime, 0);

        } catch (error) {
            console.error('Error in story command:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ SYSTEM ERROR')
                        .setDescription('An error occurred while starting the story. Please try again later.')
                ]
            });
        }
    },

    getStory(storyType) {
        const stories = {
            astronomer: {
                title: 'Ancient Astronomer Journey',
                description: 'Embark on an astronomical journey through time to discover the secrets of the universe and celestial phenomena!',
                color: '#1F618D',
                emoji: '🔭',
                startingStage: '1-1',
                totalStages: 25,
                stages: {
                    '1-1': {
                        title: 'April 14, 1520 – Ancient Observatory',
                        description: 'An ancient astronomer sits before a massive wooden telescope, stones covered in dust, faintly lit candles, creaking wooden doors.',
                        scenario: 'The night observation begins and planets appear in the clear sky. The astronomer prepares to observe the first planet of the night. The air is filled with anticipation as the stars begin to twinkle.',
                        clues: '🔭 **Available Tools:**\n• Massive wooden telescope\n• Candles for lighting\n• Primitive measuring tools\n• Celestial spheres\n• Star charts and manuscripts',
                        question: 'What is the first planet the astronomer observes tonight?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mercury': { points: 1, nextStage: '1-2' },
                            'B. Venus': { points: 2, nextStage: '1-2' },
                            'C. Mars': { points: 3, nextStage: '1-2' },
                            'D. Jupiter': { points: 4, nextStage: '1-2' },
                            'E. Saturn': { points: 0, nextStage: '1-2' }
                        },
                        hints: [
                            'Start with the largest planet visible in tonight\'s sky',
                            'This planet is known for its massive size and distinctive appearance',
                            'It has prominent features but is not the ringed planet'
                        ]
                    },
                    '1-2': {
                        title: 'April 14, 1520 – Ancient Observatory',
                        description: 'The astronomer continues meticulous work in the same location, carefully documenting planetary movements and stellar patterns.',
                        scenario: 'After successfully identifying the first celestial body, the astronomer needs precise angular measurements to calculate planetary positions and trajectories accurately.',
                        clues: '📐 **Measuring Instruments:**\n• Collection of wooden calibration tools\n• Detailed celestial coordinate maps\n• Precision recording instruments\n• Timekeeping devices\n• Angle calculation charts',
                        question: 'Which specialized tool does the astronomer use for precise angle measurements between celestial bodies?',
                        difficulty: 'medium',
                        answers: {
                            'A. Wooden handle': { points: 0, nextStage: '1-3' },
                            'B. Magnetic compass': { points: 1, nextStage: '1-3' },
                            'C. Astrolabe': { points: 4, nextStage: '1-3' },
                            'D. Small refracting telescope': { points: 2, nextStage: '1-3' },
                            'E. Star navigation map': { points: 3, nextStage: '1-3' }
                        },
                        hints: [
                            'This traditional ancient instrument measures star positions with remarkable accuracy',
                            'It features concentric circles and precision markings for angular measurement',
                            'Medieval navigators and astronomers relied on this sophisticated brass instrument'
                        ]
                    },
                    '1-3': {
                        title: 'April 14, 1520 – Ancient Observatory',
                        description: 'The astronomer continues observations under the clear night sky, documenting intricate patterns and movements in the celestial sphere.',
                        scenario: 'Using the precision instrument, the astronomer discovers remarkable patterns and connections between celestial bodies that reveal deeper cosmic mysteries.',
                        clues: '🌌 **Celestial Observations:**\n• Detailed stellar constellation patterns\n• Precise planetary orbital movements\n• Atmospheric light refraction phenomena\n• Meteor shower activity logs\n• Lunar phase documentation',
                        question: 'What significant pattern does the astronomer discover on the celestial sphere through detailed observation?',
                        difficulty: 'medium',
                        answers: {
                            'A. Scattered random stars': { points: 2, nextStage: '1-4' },
                            'B. Astrological zodiac lines': { points: 4, nextStage: '1-4' },
                            'C. Lunar halo formations': { points: 3, nextStage: '1-4' },
                            'D. Unidentified planetary objects': { points: 1, nextStage: '1-4' },
                            'E. Atmospheric distortion patterns': { points: 0, nextStage: '1-4' }
                        },
                        hints: [
                            'Focus reveals intricate connections between constellations and their symbolic representations',
                            'These patterns have been used for centuries in navigation and seasonal predictions',
                            'Ancient civilizations mapped these celestial pathways for both practical and mystical purposes'
                        ]
                    },
                    '1-4': {
                        title: 'April 14, 1520 – Ancient Observatory',
                        description: 'The astronomer must preserve these precious observations for future generations using durable materials that can withstand centuries.',
                        scenario: 'Recognizing the historical significance of these discoveries, the astronomer seeks the most permanent recording medium to ensure knowledge preservation across generations.',
                        clues: '📝 **Recording Materials Analysis:**\n• Various ink composition options\n• Specialized writing implements\n• Long-term preservation techniques\n• Material durability testing\n• Environmental protection methods',
                        question: 'Which material provides the optimal balance of durability and precision for recording these astronomical discoveries?',
                        difficulty: 'medium',
                        answers: {
                            'A. Regular paper sheets': { points: 1, nextStage: '1-5' },
                            'B. Treated leather parchment': { points: 4, nextStage: '1-5' },
                            'C. Stone tablet surfaces': { points: 0, nextStage: '1-5' },
                            'D. Wax impression tablets': { points: 2, nextStage: '1-5' },
                            'E. Papyrus scrolls': { points: 3, nextStage: '1-5' }
                        },
                        hints: [
                            'This material offers exceptional durability while maintaining writing precision',
                            'Historically used for important documents and royal decrees for its longevity',
                            'Properly treated, it can preserve information for millennia without significant degradation'
                        ]
                    },
                    '1-5': {
                        title: 'April 14, 1520 – Ancient Observatory',
                        description: 'A remarkable astronomical event unfolds in the clear night sky, demanding immediate observation and detailed documentation.',
                        scenario: 'After hours of meticulous observation, a rare and spectacular celestial phenomenon begins to manifest, offering unprecedented research opportunities.',
                        clues: '🌠 **Celestial Phenomenon Documentation:**\n• Unusual planetary alignment patterns\n• Extraordinary atmospheric light effects\n• Sudden celestial movement changes\n• Rare orbital intersection events\n• Historical significance assessment',
                        question: 'Which extraordinary astronomical phenomenon does the astronomer have the privilege of observing and documenting first?',
                        difficulty: 'hard',
                        answers: {
                            'A. Lunar eclipse formation': { points: 2, nextStage: '2-1' },
                            'B. Total solar eclipse': { points: 4, nextStage: '2-1' },
                            'C. Meteor shower peak': { points: 1, nextStage: '2-1' },
                            'D. Shooting star spectacle': { points: 0, nextStage: '2-1' },
                            'E. Solar wind visualization': { points: 3, nextStage: '2-1' }
                        },
                        hints: [
                            'This event represents the most dramatic and visually stunning celestial occurrence',
                            'It requires special observation techniques to prevent eye damage while providing maximum scientific value',
                            'Ancient cultures often viewed this phenomenon with both awe and scientific curiosity'
                        ]
                    },
                    '2-1': {
                        title: 'April 15, 1520 – Astronomical Library',
                        description: 'A massive library covered with ancient books, the smell of ink and paper, the astronomer searches through old manuscripts to interpret the phenomena.',
                        scenario: 'The astronomer moves to the great library to consult ancient texts that might explain the celestial events. Dusty manuscripts hold secrets of past astronomical observations.',
                        clues: '📚 **Library Resources:**\n• Ancient Greek astronomical manuscripts\n• Medieval medical texts\n• Mathematical treatises\n• Personal diaries\n• Mythological codices',
                        question: 'Which manuscript does the astronomer search for to understand the celestial phenomena?',
                        difficulty: 'medium',
                        answers: {
                            'A. Greek astronomy manuscript': { points: 4, nextStage: '2-2' },
                            'B. Medical manuscript': { points: 0, nextStage: '2-2' },
                            'C. Mathematics book': { points: 2, nextStage: '2-2' },
                            'D. Personal diary': { points: 1, nextStage: '2-2' },
                            'E. Mythological manuscript': { points: 3, nextStage: '2-2' }
                        },
                        hints: [
                            'Focus on texts specifically about celestial observations',
                            'Consider which civilization made significant early astronomical discoveries',
                            'The most relevant text would deal with planetary movements and stars'
                        ]
                    },
                    '2-2': {
                        title: 'April 15, 1520 – Astronomical Library',
                        description: 'The astronomer carefully examines the ancient manuscript, looking for symbols and patterns that might explain the celestial events.',
                        scenario: 'The fragile pages of the ancient manuscript reveal intricate symbols and diagrams. The astronomer must decipher their meaning to understand the celestial phenomena.',
                        clues: '🔣 **Symbol Analysis:**\n• Star pattern representations\n• Random letter arrangements\n• Mathematical symbols\n• Medical diagrams\n• Abstract line patterns',
                        question: 'What symbols does the astronomer notice in the manuscript that might explain the celestial events?',
                        difficulty: 'medium',
                        answers: {
                            'A. Star symbols': { points: 4, nextStage: '2-3' },
                            'B. Random letters': { points: 0, nextStage: '2-3' },
                            'C. Mathematical symbols': { points: 2, nextStage: '2-3' },
                            'D. Medical diagrams': { points: 1, nextStage: '2-3' },
                            'E. Abstract lines': { points: 3, nextStage: '2-3' }
                        },
                        hints: [
                            'Look for symbols related to celestial bodies',
                            'Consider what would represent constellations and planets',
                            'The most relevant symbols would depict things found in the night sky'
                        ]
                    },
                    '2-3': {
                        title: 'April 15, 1520 – Astronomical Library',
                        description: 'A locked cabinet in the library might contain additional tools or manuscripts that could help interpret the celestial phenomena.',
                        scenario: 'The astronomer discovers a locked cabinet that might hold additional instruments or secret manuscripts. Finding the right key is essential to access its contents.',
                        clues: '🔐 **Cabinet Examination:**\n• Small key mechanisms\n• Wooden stick options\n• Rock tools\n• Thread possibilities\n• Alternative access methods',
                        question: 'What does the astronomer use to open the locked cabinet?',
                        difficulty: 'medium',
                        answers: {
                            'A. Small key': { points: 4, nextStage: '2-4' },
                            'B. Wooden stick': { points: 0, nextStage: '2-4' },
                            'C. Rock': { points: 2, nextStage: '2-4' },
                            'D. Thread': { points: 1, nextStage: '2-4' },
                            'E. Nothing': { points: 3, nextStage: '2-4' }
                        },
                        hints: [
                            'Consider what would be specifically designed for this purpose',
                            'Think about what might be kept in the library for such tasks',
                            'The correct tool would be precise and specifically fitted'
                        ]
                    },
                    '2-4': {
                        title: 'April 15, 1520 – Astronomical Library',
                        description: 'Behind the cabinet, the astronomer makes a significant discovery that could advance understanding of celestial movements.',
                        scenario: 'The cabinet reveals something extraordinary that enhances the astronomer\'s ability to understand and predict celestial phenomena.',
                        clues: '🪐 **Cabinet Contents:**\n• Planetary model device\n• Nautical map\n• Torn paper fragment\n• Gemstone\n• Timekeeping device',
                        question: 'What does the astronomer discover behind the cabinet?',
                        difficulty: 'medium',
                        answers: {
                            'A. Planetary model': { points: 4, nextStage: '2-5' },
                            'B. Nautical map': { points: 2, nextStage: '2-5' },
                            'C. Torn paper': { points: 1, nextStage: '2-5' },
                            'D. Gemstone': { points: 0, nextStage: '2-5' },
                            'E. Clock': { points: 3, nextStage: '2-5' }
                        },
                        hints: [
                            'Consider what would help visualize planetary movements',
                            'Think about educational tools used in astronomy',
                            'The most valuable discovery would demonstrate celestial mechanics'
                        ]
                    },
                    '2-5': {
                        title: 'April 15, 1520 – Astronomical Library',
                        description: 'The planetary model needs to be configured correctly to represent the current celestial alignment.',
                        scenario: 'The intricate planetary model can demonstrate the relationships between celestial bodies. Setting it up correctly is crucial for accurate predictions.',
                        clues: '🪐 **Planetary Model Setup:**\n• Mercury positioning\n• Venus placement\n• Earth alignment\n• Jupiter configuration\n• Mars arrangement',
                        question: 'Which planet does the astronomer place first in the planetary model?',
                        difficulty: 'hard',
                        answers: {
                            'A. Mercury': { points: 1, nextStage: '3-1' },
                            'B. Venus': { points: 2, nextStage: '3-1' },
                            'C. Earth': { points: 3, nextStage: '3-1' },
                            'D. Jupiter': { points: 4, nextStage: '3-1' },
                            'E. Mars': { points: 0, nextStage: '3-1' }
                        },
                        hints: [
                            'Consider which planet has been most prominent in recent observations',
                            'Think about the largest planet in the solar system',
                            'The correct planet would be particularly significant in current celestial events'
                        ]
                    },
                    '3-1': {
                        title: 'April 16, 1520 – Observatory Terrace',
                        description: 'The open terrace provides an unobstructed view of the night sky. Cold winds blow as stars shine clearly.',
                        scenario: 'The astronomer moves to the open terrace for better observation conditions. The large telescope is pointed toward the eastern horizon, ready to reveal celestial secrets.',
                        clues: '🔭 **Telescope Configuration:**\n• Saturn observation\n• Mars tracking\n• Mercury spotting\n• Venus monitoring\n• Lunar focus',
                        question: 'Which planet does the telescope focus on during this observation session?',
                        difficulty: 'medium',
                        answers: {
                            'A. Saturn': { points: 4, nextStage: '3-2' },
                            'B. Mars': { points: 3, nextStage: '3-2' },
                            'C. Mercury': { points: 2, nextStage: '3-2' },
                            'D. Venus': { points: 1, nextStage: '3-2' },
                            'E. Moon': { points: 0, nextStage: '3-2' }
                        },
                        hints: [
                            'Jupiter and the Sun have already been observed recently',
                            'Consider which planet would be most visible and interesting now',
                            'This planet is known for its distinctive rings'
                        ]
                    },
                    '3-2': {
                        title: 'April 16, 1520 – Observatory Terrace',
                        description: 'A remarkable celestial phenomenon begins to unfold, requiring immediate attention and documentation.',
                        scenario: 'As the astronomer observes through the telescope, an extraordinary event manifests in the sky, offering a rare opportunity for study and understanding.',
                        clues: '🌌 **Celestial Event Analysis:**\n• Solar wind patterns\n• Meteor shower activity\n• Lunar eclipse formation\n• Partial solar eclipse\n• Lunar halo phenomenon',
                        question: 'What phenomenon does the astronomer observe during this session?',
                        difficulty: 'medium',
                        answers: {
                            'A. Solar wind': { points: 2, nextStage: '3-3' },
                            'B. Meteor shower': { points: 1, nextStage: '3-3' },
                            'C. Lunar eclipse': { points: 0, nextStage: '3-3' },
                            'D. Partial solar eclipse': { points: 4, nextStage: '3-3' },
                            'E. Lunar halo': { points: 3, nextStage: '3-3' }
                        },
                        hints: [
                            'This event occurs at dawn and involves the Sun',
                            'It\'s a partial rather than complete phenomenon',
                            'Special observation techniques are required to view it safely'
                        ]
                    },
                    '3-3': {
                        title: 'April 16, 1520 – Observatory Terrace',
                        description: 'The astronomer must carefully record the observations on specialized charts for future reference and analysis.',
                        scenario: 'Precise documentation is essential for astronomical research. The astronomer uses detailed charts to record the positions and movements observed.',
                        clues: '🗺️ **Chart Documentation:**\n• Star position mapping\n• Lake location recording\n• Human activity traces\n• Wind direction patterns\n• Random number notation',
                        question: 'What does the astronomer record on the observation charts?',
                        difficulty: 'medium',
                        answers: {
                            'A. Star positions': { points: 4, nextStage: '3-4' },
                            'B. Lake locations': { points: 1, nextStage: '3-4' },
                            'C. Human activities': { points: 0, nextStage: '3-4' },
                            'D. Wind directions': { points: 2, nextStage: '3-4' },
                            'E. Random numbers': { points: 3, nextStage: '3-4' }
                        },
                        hints: [
                            'Focus on what would be most relevant to astronomy',
                            'Consider the primary purpose of astronomical observation',
                            'The most valuable data would relate to celestial bodies'
                        ]
                    },
                    '3-4': {
                        title: 'April 16, 1520 – Observatory Terrace',
                        description: 'Something unusual appears on the horizon, potentially representing a significant astronomical discovery.',
                        scenario: 'While documenting the observations, the astronomer notices something extraordinary on the horizon that doesn\'t match known celestial patterns.',
                        clues: '🌅 **Horizon Observation:**\n• Unusual planetary object\n• Bright sunrise\n• Moon visibility\n• Thick cloud cover\n• Bird formations',
                        question: 'What does the astronomer notice on the horizon?',
                        difficulty: 'medium',
                        answers: {
                            'A. Unusual planet': { points: 4, nextStage: '3-5' },
                            'B. Bright sun': { points: 2, nextStage: '3-5' },
                            'C. Moon': { points: 3, nextStage: '3-5' },
                            'D. Thick clouds': { points: 0, nextStage: '3-5' },
                            'E. Birds': { points: 1, nextStage: '3-5' }
                        },
                        hints: [
                            'This observation is unusual and doesn\'t fit expected patterns',
                            'It represents a potential new discovery',
                            'The object appears planetary but doesn\'t match known planets'
                        ]
                    },
                    '3-5': {
                        title: 'April 16, 1520 – Observatory Terrace',
                        description: 'The astronomer must identify which star might provide guidance about the upcoming celestial phenomenon.',
                        scenario: 'Ancient texts mention specific stars that serve as indicators for major celestial events. Identifying the correct one is crucial for accurate predictions.',
                        clues: '⭐ **Star Identification:**\n• Sirius reference\n• North Star positioning\n• Sirius alternative\n• Aldebaran observation\n• Orion constellation',
                        question: 'Which star serves as a guide for the upcoming phenomenon?',
                        difficulty: 'hard',
                        answers: {
                            'A. Sirius': { points: 4, nextStage: '4-1' },
                            'B. North Star': { points: 2, nextStage: '4-1' },
                            'C. Alternative star': { points: 3, nextStage: '4-1' },
                            'D. Aldebaran': { points: 1, nextStage: '4-1' },
                            'E. Orion': { points: 0, nextStage: '4-1' }
                        },
                        hints: [
                            'This is the brightest star in the night sky',
                            'It\'s often associated with dogs or canine constellations',
                            'Ancient cultures attached great significance to this star'
                        ]
                    },
                    '4-1': {
                        title: 'April 17, 1520 – Celestial Dome',
                        description: 'A large dome decorated with constellation drawings, a central telescope, the astronomer tracks complex celestial paths.',
                        scenario: 'The astronomer moves to the celestial dome for more precise observations. The painted constellations provide context for understanding celestial movements.',
                        clues: '♑ **Constellation Focus:**\n• Capricorn studies\n• Aries observation\n• Scorpio analysis\n• Aquarius monitoring\n• Leo tracking',
                        question: 'Which constellation does the astronomer focus on?',
                        difficulty: 'medium',
                        answers: {
                            'A. Capricorn': { points: 2, nextStage: '4-2' },
                            'B. Aries': { points: 1, nextStage: '4-2' },
                            'C. Scorpio': { points: 4, nextStage: '4-2' },
                            'D. Aquarius': { points: 0, nextStage: '4-2' },
                            'E. Leo': { points: 3, nextStage: '4-2' }
                        },
                        hints: [
                            'This constellation is closest to the unusual planetary object',
                            'It\'s represented by a dangerous creature',
                            'The constellation is associated with mystery and transformation'
                        ]
                    },
                    '4-2': {
                        title: 'April 17, 1520 – Celestial Dome',
                        description: 'A major astronomical event is approaching, requiring careful preparation and observation.',
                        scenario: 'Calculations indicate that a significant celestial event will occur soon. The astronomer must prepare to observe and document this rare occurrence.',
                        clues: '🌑 **Event Prediction:**\n• Total solar eclipse\n• Meteor shower\n• Solar wind event\n• Lunar halo\n• Fog obstruction',
                        question: 'What astronomical phenomenon is approaching?',
                        difficulty: 'medium',
                        answers: {
                            'A. Total solar eclipse': { points: 4, nextStage: '4-3' },
                            'B. Meteor shower': { points: 2, nextStage: '4-3' },
                            'C. Solar wind': { points: 1, nextStage: '4-3' },
                            'D. Lunar halo': { points: 3, nextStage: '4-3' },
                            'E. Fog': { points: 0, nextStage: '4-3' }
                        },
                        hints: [
                            'This is a major event that will occur soon',
                            'It involves the complete obscuring of a celestial body',
                            'Special precautions are needed to observe it safely'
                        ]
                    },
                    '4-3': {
                        title: 'April 17, 1520 – Celestial Dome',
                        description: 'The astronomer needs specialized tools to measure star movements accurately for predicting the upcoming event.',
                        scenario: 'Precise measurements are essential for predicting the exact timing and path of the upcoming celestial event. The right tool must be selected for accurate results.',
                        clues: '📏 **Measurement Tools:**\n• Astrolabe selection\n• Compass use\n• Lens focusing\n• Rock reference\n• Thread alignment',
                        question: 'What tool does the astronomer use to measure star movements?',
                        difficulty: 'medium',
                        answers: {
                            'A. Astrolabe': { points: 4, nextStage: '4-4' },
                            'B. Compass': { points: 2, nextStage: '4-4' },
                            'C. Lens': { points: 1, nextStage: '4-4' },
                            'D. Rock': { points: 0, nextStage: '4-4' },
                            'E. Thread': { points: 3, nextStage: '4-4' }
                        },
                        hints: [
                            'This traditional instrument is designed for angular measurements',
                            'It has been used for centuries by astronomers and navigators',
                            'The tool features precise markings and sighting mechanisms'
                        ]
                    },
                    '4-4': {
                        title: 'April 17, 1520 – Celestial Dome',
                        description: 'Careful documentation in the observation log is essential for preserving knowledge about the celestial events.',
                        scenario: 'The astronomer maintains a detailed logbook recording all observations, calculations, and predictions. This record will be invaluable for future research.',
                        clues: '📓 **Logbook Entries:**\n• Star position records\n• Random number notations\n• Message documentation\n• Plan outlines\n• Map sketches',
                        question: 'What does the astronomer record in the observation log?',
                        difficulty: 'medium',
                        answers: {
                            'A. Star positions': { points: 4, nextStage: '4-5' },
                            'B. Random numbers': { points: 0, nextStage: '4-5' },
                            'C. Messages': { points: 1, nextStage: '4-5' },
                            'D. Plans': { points: 2, nextStage: '4-5' },
                            'E. Maps': { points: 3, nextStage: '4-5' }
                        },
                        hints: [
                            'Focus on what would be most scientifically valuable',
                            'Consider the primary purpose of astronomical observation',
                            'The most important data would relate to celestial coordinates'
                        ]
                    },
                    '4-5': {
                        title: 'April 17, 1520 – Celestial Dome',
                        description: 'As sunset approaches, a particular planet becomes visible and may hold clues about the upcoming celestial event.',
                        scenario: 'The changing sky at sunset reveals celestial bodies that weren\'t visible during daylight. One planet in particular seems significant for understanding the upcoming event.',
                        clues: '🌇 **Sunset Observation:**\n• Venus visibility\n• Mercury spotting\n• Mars appearance\n• Jupiter emergence\n• Saturn recognition',
                        question: 'Which planet appears at sunset?',
                        difficulty: 'hard',
                        answers: {
                            'A. Venus': { points: 3, nextStage: '5-1' },
                            'B. Mercury': { points: 1, nextStage: '5-1' },
                            'C. Mars': { points: 2, nextStage: '5-1' },
                            'D. Jupiter': { points: 4, nextStage: '5-1' },
                            'E. Saturn': { points: 0, nextStage: '5-1' }
                        },
                        hints: [
                            'This is the largest and most prominent planet',
                            'It has been significant in previous observations',
                            'The planet is particularly bright and easily visible'
                        ]
                    },
                    '5-1': {
                        title: 'April 18, 1520 – Central Observatory',
                        description: 'The grand observatory, the astronomer analyzes all previous observations, quiet atmosphere, stars twinkle, midnight approaches, final analysis of celestial movement.',
                        scenario: 'The astronomer synthesizes all previous observations in the central observatory. The quiet night and twinkling stars provide the perfect environment for final calculations.',
                        clues: '🪐 **Planetary Analysis:**\n• Unusual orbital patterns\n• Stationary position\n• Slow movement\n• Unclear characteristics\n• Rapid motion',
                        question: 'What does the astronomer discover about the unusual planet?',
                        difficulty: 'hard',
                        answers: {
                            'A. Unusual orbit': { points: 4, nextStage: '5-2' },
                            'B. Stationary': { points: 1, nextStage: '5-2' },
                            'C. Slow movement': { points: 2, nextStage: '5-2' },
                            'D. Unclear': { points: 0, nextStage: '5-2' },
                            'E. Rapid motion': { points: 3, nextStage: '5-2' }
                        },
                        hints: [
                            'The planet\'s movement doesn\'t follow expected patterns',
                            'Its orbital characteristics are different from known planets',
                            'This discovery could challenge existing astronomical models'
                        ]
                    },
                    '5-2': {
                        title: 'April 18, 1520 – Central Observatory',
                        description: 'The astronomer needs to verify the calculations using precise instruments to ensure accuracy.',
                        scenario: 'Double-checking the calculations is essential for confirming the extraordinary discoveries. The right instrument must be used for verification.',
                        clues: '✅ **Verification Tools:**\n• Astrolabe confirmation\n• Compass checking\n• Clock referencing\n• Map consultation\n• Lens examination',
                        question: 'What does the astronomer use to verify the calculations?',
                        difficulty: 'medium',
                        answers: {
                            'A. Astrolabe': { points: 4, nextStage: '5-3' },
                            'B. Compass': { points: 1, nextStage: '5-3' },
                            'C. Clock': { points: 2, nextStage: '5-3' },
                            'D. Map': { points: 0, nextStage: '5-3' },
                            'E. Lens': { points: 3, nextStage: '5-3' }
                        },
                        hints: [
                            'This instrument provides precise angular measurements',
                            'It has been used consistently throughout the observations',
                            'The tool is essential for astronomical verification'
                        ]
                    },
                    '5-3': {
                        title: 'April 18, 1520 – Central Observatory',
                        description: 'The astronomer must interpret the final phenomenon that explains all the previous observations.',
                        scenario: 'All the observations point toward a major celestial phenomenon that explains the unusual patterns and movements observed over the past days.',
                        clues: '🌌 **Phenomenon Interpretation:**\n• Eclipse explanation\n• Lunar eclipse understanding\n• Meteor shower analysis\n• Solar wind interpretation\n• Lunar halo explanation',
                        question: 'What phenomenon does the astronomer finally interpret?',
                        difficulty: 'hard',
                        answers: {
                            'A. Eclipse': { points: 4, nextStage: '5-4' },
                            'B. Lunar eclipse': { points: 3, nextStage: '5-4' },
                            'C. Meteor shower': { points: 2, nextStage: '5-4' },
                            'D. Solar wind': { points: 1, nextStage: '5-4' },
                            'E. Lunar halo': { points: 0, nextStage: '5-4' }
                        },
                        hints: [
                            'This is the most significant celestial event observed',
                            'It has the greatest impact and explanatory power',
                            'The phenomenon involves the obscuring of one celestial body by another'
                        ]
                    },
                    '5-4': {
                        title: 'April 18, 1520 – Central Observatory',
                        description: 'The astronomer must record a message that captures the significance of the discoveries for future generations.',
                        scenario: 'Recognizing the importance of these discoveries, the astronomer creates a permanent record that will warn and guide future generations.',
                        clues: '📜 **Message Composition:**\n• Warning for future generations\n• Simple note\n• Illustrative description\n• Numerical data\n• Short story',
                        question: 'What message does the astronomer record?',
                        difficulty: 'medium',
                        answers: {
                            'A. Warning for future generations': { points: 4, nextStage: '5-5' },
                            'B. Simple note': { points: 2, nextStage: '5-5' },
                            'C. Illustrative description': { points: 3, nextStage: '5-5' },
                            'D. Numerical data': { points: 0, nextStage: '5-5' },
                            'E. Short story': { points: 1, nextStage: '5-5' }
                        },
                        hints: [
                            'Consider what would be most valuable for people in the future',
                            'Think about protecting others from potential dangers',
                            'The most responsible action would provide guidance and warning'
                        ]
                    },
                    '5-5': {
                        title: 'April 18, 1520 – Central Observatory',
                        description: 'The final puzzle requires identifying which planet points toward the major celestial phenomenon.',
                        scenario: 'All the observations and calculations converge on one planet that serves as the key indicator for the major celestial event about to occur.',
                        clues: '🔑 **Final Planetary Indicator:**\n• Jupiter significance\n• Saturn reference\n• Mars indication\n• Venus suggestion\n• Mercury hint',
                        question: 'Which planet points toward the major celestial phenomenon?',
                        difficulty: 'hard',
                        answers: {
                            'A. Jupiter': { points: 4, nextStage: 'end' },
                            'B. Saturn': { points: 2, nextStage: 'end' },
                            'C. Mars': { points: 1, nextStage: 'end' },
                            'D. Venus': { points: 0, nextStage: 'end' },
                            'E. Mercury': { points: 3, nextStage: 'end' }
                        },
                        hints: [
                            'Use all previous observations to guide your choice',
                            'Consider which planet has been most significant throughout',
                            'This planet has appeared multiple times in critical contexts'
                        ]
                    }
                },
                endings: {
                    '0-25': {
                        title: 'CATASTROPHIC ENDING #1',
                        description: 'The astronomer completely fails to interpret the celestial phenomena, and the significant event passes without any warning or documentation. Valuable knowledge is lost forever.',
                        color: '#FF0000'
                    },
                    '26-50': {
                        title: 'BAD ENDING #2',
                        description: 'Some interpretations prove correct, but the astronomical phenomenon occurs suddenly without proper preparation. Limited understanding is achieved.',
                        color: '#FF4500'
                    },
                    '51-75': {
                        title: 'MEDIUM ENDING #3',
                        description: 'The astronomer partially interprets the phenomenon and manages to warn some local communities. Moderate scientific progress is made.',
                        color: '#FFFF00'
                    },
                    '76-99': {
                        title: 'GOOD ENDING #4',
                        description: 'Accurate interpretation is achieved, and people are properly prepared for the celestial event. Significant scientific understanding is gained.',
                        color: '#00FF00'
                    },
                    '100': {
                        title: 'BEST ENDING #5',
                        description: 'The astronomer analyzes all phenomena with perfect accuracy, ensuring everyone\'s safety and making a major scientific discovery that advances astronomy for generations.',
                        color: '#0000FF'
                    }
                },
                failureEndings: [
                    'Time expired at {time} before you could interpret the crucial astronomical phenomena!',
                    'Calculation errors at {time} led to incorrect astronomical predictions!',
                    'You missed the rare celestial event window at {time} due to delayed observations!',
                    'The astronomical instruments malfunctioned critically at {time}!',
                    'Complete darkness fell at {time}, preventing any further astronomical observations!'
                ]
            },
            pyramids: {
                title: 'Dark Pyramids Expedition',
                description: 'Explore ancient Egyptian pyramids and uncover hidden treasures and mysteries!',
                color: '#CD853F',
                emoji: '🔺',
                startingStage: '1-1',
                totalStages: 30,
                stages: {
                    '1-1': {
                        title: 'May 22, 1920 – Great Pyramid Entrance',
                        description: 'You stand before the massive pyramid entrance, sand blowing in the wind, Sphinx statues watching, a sense of mystery and fear dominates.',
                        scenario: 'You stand at the ominous pyramid entrance. The ancient stones whisper secrets of pharaohs past. Strange sounds echo from within the dark interior.',
                        clues: '🚪 **Entrance Examination:**\n• Old hieroglyphic inscriptions\n• Sand-covered steps\n• Stone slab at the entrance\n• Outside excavation area\n• Ancient torch holders',
                        question: 'Where should you search first at the entrance?',
                        difficulty: 'medium',
                        answers: {
                            'A. Right tunnel': { points: 2, nextStage: '1-2' },
                            'B. Stone door': { points: 4, nextStage: '1-2' },
                            'C. Wooden ladder': { points: 1, nextStage: '1-2' },
                            'D. Pillars': { points: 0, nextStage: '1-2' },
                            'E. Ceiling': { points: 3, nextStage: '1-2' }
                        },
                        hints: [
                            'The main entrance is the key to exploration',
                            'Look for the most stable and intentional structure',
                            'Stone surfaces often hold the main pathways'
                        ]
                    },
                    '1-2': {
                        title: 'May 22, 1920 – Great Pyramid Entrance',
                        description: 'The main door shows signs of age and mysterious markings that might hold clues about the pyramid\'s history.',
                        scenario: 'As you examine the massive door, you notice various markings and signs of wear that tell a story of the pyramid\'s past and what might await inside.',
                        clues: '🔍 **Door Inspection:**\n• Mysterious engraving\n• Rust stains\n• Minor scratches\n• Nothing noticeable\n• Handprint marks',
                        question: 'What do you notice on the door?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious engraving': { points: 4, nextStage: '1-3' },
                            'B. Rust stains': { points: 1, nextStage: '1-3' },
                            'C. Minor scratches': { points: 2, nextStage: '1-3' },
                            'D. Nothing': { points: 0, nextStage: '1-3' },
                            'E. Handprint marks': { points: 3, nextStage: '1-3' }
                        },
                        hints: [
                            'Look for intentional markings rather than natural wear',
                            'Consider what might provide clues about the pyramid',
                            'The most significant finding would be something deliberately created'
                        ]
                    },
                    '1-3': {
                        title: 'May 22, 1920 – Great Pyramid Entrance',
                        description: 'The door appears to be locked or stuck, requiring a specific tool to gain entry to the pyramid.',
                        scenario: 'The heavy door resists your attempts to open it. You need to find the right tool or method to gain access to the mysterious interior.',
                        clues: '🔧 **Entry Methods:**\n• Old key\n• Wooden stick\n• Rock\n• Thread\n• Nothing',
                        question: 'What should you use to open the door?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old key': { points: 4, nextStage: '1-4' },
                            'B. Wooden stick': { points: 1, nextStage: '1-4' },
                            'C. Rock': { points: 0, nextStage: '1-4' },
                            'D. Thread': { points: 2, nextStage: '1-4' },
                            'E. Nothing': { points: 3, nextStage: '1-4' }
                        },
                        hints: [
                            'Consider what would be specifically designed for this purpose',
                            'Think about what might be hidden nearby for this task',
                            'The correct tool would be precise and intentionally placed'
                        ]
                    },
                    '1-4': {
                        title: 'May 22, 1920 – Great Pyramid Entrance',
                        description: 'Entering an ancient pyramid alone might be dangerous. Considering companionship could improve your chances of survival.',
                        scenario: 'The ominous sounds from within suggest you might not be alone in this exploration. Having someone with knowledge of the pyramid could be invaluable.',
                        clues: '👥 **Companion Considerations:**\n• Local guide\n• Nobody\n• Archaeologist\n• Mysterious shadow\n• Guard',
                        question: 'Who should accompany you?',
                        difficulty: 'medium',
                        answers: {
                            'A. Local guide': { points: 4, nextStage: '1-5' },
                            'B. Nobody': { points: 0, nextStage: '1-5' },
                            'C. Archaeologist': { points: 2, nextStage: '1-5' },
                            'D. Mysterious shadow': { points: 3, nextStage: '1-5' },
                            'E. Guard': { points: 1, nextStage: '1-5' }
                        },
                        hints: [
                            'Consider who would have the most knowledge about the pyramid',
                            'Think about practical assistance rather than supernatural',
                            'The most helpful companion would have historical knowledge'
                        ]
                    },
                    '1-5': {
                        title: 'May 22, 1920 – Great Pyramid Entrance',
                        description: 'Multiple passages lead inward from the entrance hall. Choosing the correct one is crucial for safe exploration.',
                        scenario: 'The entrance hall branches off into several corridors and passages. Each seems to lead to different parts of the pyramid with varying levels of danger.',
                        clues: '🚪 **Passage Selection:**\n• Left passage\n• Central passage\n• Right passage\n• Descending passage\n• Ascending passage',
                        question: 'Which passage should you choose to enter?',
                        difficulty: 'hard',
                        answers: {
                            'A. Left passage': { points: 1, nextStage: '2-1' },
                            'B. Central passage': { points: 4, nextStage: '2-1' },
                            'C. Right passage': { points: 0, nextStage: '2-1' },
                            'D. Descending passage': { points: 2, nextStage: '2-1' },
                            'E. Ascending passage': { points: 3, nextStage: '2-1' }
                        },
                        hints: [
                            'Consider which path would be the main ceremonial route',
                            'Think about architectural conventions of ancient Egypt',
                            'The safest path is often the most centrally located'
                        ]
                    },
                    '2-1': {
                        title: 'May 22, 1920 – Grand Gallery',
                        description: 'A massive corridor with high ceilings, intricate hieroglyphics cover the walls, the air is dry and ancient.',
                        scenario: 'You enter the grand gallery, a magnificent corridor that seems to lead deeper into the heart of the pyramid. The walls are covered with stories of pharaohs and gods.',
                        clues: '📜 **Wall Examination:**\n• Royal procession scenes\n• Burial rituals\n• Astronomical charts\n• Animal representations\n• Geometric patterns',
                        question: 'Which hieroglyphic theme should you study first?',
                        difficulty: 'medium',
                        answers: {
                            'A. Royal procession': { points: 4, nextStage: '2-2' },
                            'B. Burial rituals': { points: 2, nextStage: '2-2' },
                            'C. Astronomical charts': { points: 3, nextStage: '2-2' },
                            'D. Animal representations': { points: 1, nextStage: '2-2' },
                            'E. Geometric patterns': { points: 0, nextStage: '2-2' }
                        },
                        hints: [
                            'Focus on what would reveal the pyramid\'s main purpose',
                            'Consider the significance of royal ceremonies',
                            'The most important scenes would involve the pharaoh\'s journey'
                        ]
                    },
                    '2-2': {
                        title: 'May 22, 1920 – Grand Gallery',
                        description: 'The gallery contains several alcoves with artifacts that might hold clues about the pyramid\'s secrets.',
                        scenario: 'Along the grand gallery, you discover several alcoves containing ancient artifacts. Each seems to tell a different part of the pyramid\'s story.',
                        clues: '🏺 **Artifact Analysis:**\n• Canopic jars\n• Funerary masks\n• Sacred tools\n• Offering tables\n• Ritual vessels',
                        question: 'Which artifact provides the most important clues?',
                        difficulty: 'medium',
                        answers: {
                            'A. Canopic jars': { points: 4, nextStage: '2-3' },
                            'B. Funerary masks': { points: 2, nextStage: '2-3' },
                            'C. Sacred tools': { points: 3, nextStage: '2-3' },
                            'D. Offering tables': { points: 1, nextStage: '2-3' },
                            'E. Ritual vessels': { points: 0, nextStage: '2-3' }
                        },
                        hints: [
                            'Consider what would be most closely associated with burial practices',
                            'Think about items that protect internal organs',
                            'These containers have specific animal-headed lids'
                        ]
                    },
                    '2-3': {
                        title: 'May 22, 1920 – Grand Gallery',
                        description: 'A hidden mechanism might reveal secret passages or chambers within the pyramid.',
                        scenario: 'As you examine the walls more closely, you notice a section that seems different from the rest. It might conceal a hidden mechanism.',
                        clues: '⚙️ **Mechanism Discovery:**\n• Moving stone block\n• Rotating symbol\n• Pressure plate\n• Hidden lever\n• Sound-activated mechanism',
                        question: 'What type of mechanism do you discover?',
                        difficulty: 'medium',
                        answers: {
                            'A. Moving stone block': { points: 3, nextStage: '2-4' },
                            'B. Rotating symbol': { points: 4, nextStage: '2-4' },
                            'C. Pressure plate': { points: 2, nextStage: '2-4' },
                            'D. Hidden lever': { points: 1, nextStage: '2-4' },
                            'E. Sound-activated': { points: 0, nextStage: '2-4' }
                        },
                        hints: [
                            'Look for something that requires specific alignment',
                            'Consider astronomical symbols and their positions',
                            'This mechanism involves turning something to the correct orientation'
                        ]
                    },
                    '2-4': {
                        title: 'May 22, 1920 – Grand Gallery',
                        description: 'The mechanism reveals a hidden chamber containing ancient records and maps.',
                        scenario: 'Successfully activating the mechanism reveals a previously hidden chamber. Inside, you find ancient records that might reveal the pyramid\'s deepest secrets.',
                        clues: '🗺️ **Chamber Contents:**\n• Star charts\n• Burial chamber maps\n• Treasure inventories\n• Construction plans\n• Religious texts',
                        question: 'What do you find in the hidden chamber?',
                        difficulty: 'medium',
                        answers: {
                            'A. Star charts': { points: 4, nextStage: '2-5' },
                            'B. Burial chamber maps': { points: 3, nextStage: '2-5' },
                            'C. Treasure inventories': { points: 2, nextStage: '2-5' },
                            'D. Construction plans': { points: 1, nextStage: '2-5' },
                            'E. Religious texts': { points: 0, nextStage: '2-5' }
                        },
                        hints: [
                            'Consider what would help navigate within the pyramid',
                            'Think about celestial guidance used by ancient Egyptians',
                            'These charts would show stellar alignments'
                        ]
                    },
                    '2-5': {
                        title: 'May 22, 1920 – Grand Gallery',
                        description: 'The star charts need to be interpreted to find the correct path to the main burial chamber.',
                        scenario: 'The ancient star charts show celestial alignments that correspond to specific passages within the pyramid. Interpreting them correctly is crucial for finding the main chamber.',
                        clues: '⭐ **Star Chart Interpretation:**\n• Orion\'s Belt alignment\n• Sirius rising\n• Pole star position\n• Planetary conjunction\n• Lunar cycle',
                        question: 'Which celestial alignment is most significant for finding the burial chamber?',
                        difficulty: 'hard',
                        answers: {
                            'A. Orion\'s Belt': { points: 4, nextStage: '3-1' },
                            'B. Sirius rising': { points: 3, nextStage: '3-1' },
                            'C. Pole star': { points: 2, nextStage: '3-1' },
                            'D. Planetary conjunction': { points: 1, nextStage: '3-1' },
                            'E. Lunar cycle': { points: 0, nextStage: '3-1' }
                        },
                        hints: [
                            'Consider the association with Osiris in Egyptian mythology',
                            'This constellation is often linked with the afterlife',
                            'The three stars are particularly significant'
                        ]
                    },
                    '3-1': {
                        title: 'May 23, 1920 – Ascending Passage',
                        description: 'A narrow passage leading upward, the air becomes thinner, strange symbols glow faintly on the walls.',
                        scenario: 'You begin ascending through a narrow passage that seems to lead toward the upper chambers of the pyramid. The walls are covered with glowing symbols that pulse with ancient energy.',
                        clues: '🔣 **Symbol Analysis:**\n• Ankh symbols\n• Eye of Horus\n• Scarab beetles\n• Solar disks\n• Feather of Ma\'at',
                        question: 'Which symbol appears most frequently and seems most important?',
                        difficulty: 'medium',
                        answers: {
                            'A. Ankh': { points: 3, nextStage: '3-2' },
                            'B. Eye of Horus': { points: 4, nextStage: '3-2' },
                            'C. Scarab': { points: 2, nextStage: '3-2' },
                            'D. Solar disk': { points: 1, nextStage: '3-2' },
                            'E. Feather': { points: 0, nextStage: '3-2' }
                        },
                        hints: [
                            'Consider protection and royal power symbols',
                            'This symbol is associated with healing and protection',
                            'It represents the eye of a falcon-headed god'
                        ]
                    },
                    '3-2': {
                        title: 'May 23, 1920 – Ascending Passage',
                        description: 'The passage contains several traps designed to protect the inner chambers from intruders.',
                        scenario: 'As you proceed upward, you notice several pressure plates and suspicious markings on the floor. The ancient builders installed traps to protect the sacred chambers.',
                        clues: '⚠️ **Trap Identification:**\n• Falling block trap\n• Arrow mechanism\n• Pit trap\n• Rolling stone\n• Gas release',
                        question: 'What type of trap do you encounter first?',
                        difficulty: 'medium',
                        answers: {
                            'A. Falling block': { points: 3, nextStage: '3-3' },
                            'B. Arrow mechanism': { points: 4, nextStage: '3-3' },
                            'C. Pit trap': { points: 2, nextStage: '3-3' },
                            'D. Rolling stone': { points: 1, nextStage: '3-3' },
                            'E. Gas release': { points: 0, nextStage: '3-3' }
                        },
                        hints: [
                            'Look for small holes in the walls at chest height',
                            'Consider what would be most effective in narrow passages',
                            'This trap projects sharp objects horizontally'
                        ]
                    },
                    '3-3': {
                        title: 'May 23, 1920 – Ascending Passage',
                        description: 'A hidden inscription might reveal how to safely bypass the traps in the passage.',
                        scenario: 'Carefully examining the walls, you discover a faint inscription that seems to provide instructions for navigating the traps safely.',
                        clues: '📝 **Inscription Translation:**\n• Step only on marked stones\n• Avoid shadows\n• Follow the light\n• Move during specific hours\n• Use specific tools',
                        question: 'What does the inscription advise?',
                        difficulty: 'medium',
                        answers: {
                            'A. Step on marked stones': { points: 4, nextStage: '3-4' },
                            'B. Avoid shadows': { points: 2, nextStage: '3-4' },
                            'C. Follow the light': { points: 3, nextStage: '3-4' },
                            'D. Specific hours': { points: 1, nextStage: '3-4' },
                            'E. Use tools': { points: 0, nextStage: '3-4' }
                        },
                        hints: [
                            'Consider practical advice for trap avoidance',
                            'Look for visual indicators on the floor',
                            'The safest path would be physically marked'
                        ]
                    },
                    '3-4': {
                        title: 'May 23, 1920 – Ascending Passage',
                        description: 'The passage leads to a chamber with a sealed door that requires solving a puzzle to open.',
                        scenario: 'You reach the end of the ascending passage and find yourself before a massive sealed door. It appears to be locked with an intricate puzzle mechanism.',
                        clues: '🧩 **Door Puzzle:**\n• Symbol alignment\n• Weight pressure\n• Celestial alignment\n• Sound resonance\n• Light reflection',
                        question: 'What type of puzzle secures the door?',
                        difficulty: 'medium',
                        answers: {
                            'A. Symbol alignment': { points: 4, nextStage: '3-5' },
                            'B. Weight pressure': { points: 2, nextStage: '3-5' },
                            'C. Celestial alignment': { points: 3, nextStage: '3-5' },
                            'D. Sound resonance': { points: 1, nextStage: '3-5' },
                            'E. Light reflection': { points: 0, nextStage: '3-5' }
                        },
                        hints: [
                            'Consider the Egyptian emphasis on symbolic meaning',
                            'Look for matching patterns around the door frame',
                            'This involves rotating symbols to match a specific pattern'
                        ]
                    },
                    '3-5': {
                        title: 'May 23, 1920 – Ascending Passage',
                        description: 'Solving the puzzle requires understanding ancient Egyptian religious symbolism.',
                        scenario: 'The door puzzle features symbols from Egyptian mythology. Understanding their meanings and relationships is key to solving the puzzle and gaining access.',
                        clues: '☥ **Symbolic Relationships:**\n• Ra and sun disk\n• Osiris and crook\n• Anubis and scales\n• Isis and throne\n• Horus and eye',
                        question: 'Which symbolic relationship is most important for solving the puzzle?',
                        difficulty: 'hard',
                        answers: {
                            'A. Ra and sun': { points: 3, nextStage: '4-1' },
                            'B. Osiris and crook': { points: 2, nextStage: '4-1' },
                            'C. Anubis and scales': { points: 4, nextStage: '4-1' },
                            'D. Isis and throne': { points: 1, nextStage: '4-1' },
                            'E. Horus and eye': { points: 0, nextStage: '4-1' }
                        },
                        hints: [
                            'Consider the god associated with burial practices',
                            'Think about judgment and the weighing of the heart',
                            'This jackal-headed god is the guardian of the dead'
                        ]
                    },
                    '4-1': {
                        title: 'May 23, 1920 – Queen\'s Chamber',
                        description: 'A beautifully decorated chamber with star-covered ceiling, though it was never used for burial, it holds important clues.',
                        scenario: 'You enter the Queen\'s Chamber, a beautifully decorated room with a stunning star-patterned ceiling. Though not a burial chamber, it contains important astronomical alignments.',
                        clues: '🌌 **Chamber Features:**\n• Star map ceiling\n• Shaft alignments\n• Resonance properties\n• Temperature stability\n• Acoustic perfection',
                        question: 'What is the most remarkable feature of this chamber?',
                        difficulty: 'medium',
                        answers: {
                            'A. Star map ceiling': { points: 4, nextStage: '4-2' },
                            'B. Shaft alignments': { points: 3, nextStage: '4-2' },
                            'C. Resonance properties': { points: 2, nextStage: '4-2' },
                            'D. Temperature stability': { points: 1, nextStage: '4-2' },
                            'E. Acoustic perfection': { points: 0, nextStage: '4-2' }
                        },
                        hints: [
                            'Consider the astronomical significance',
                            'Look upward at the most visually striking feature',
                            'This feature shows detailed celestial patterns'
                        ]
                    },
                    '4-2': {
                        title: 'May 23, 1920 – Queen\'s Chamber',
                        description: 'The chamber contains shafts that align with specific stars, revealing their astronomical purpose.',
                        scenario: 'You notice two small shafts leading from the chamber outward. They seem to be precisely aligned with specific celestial bodies, revealing the pyramid\'s astronomical sophistication.',
                        clues: '⭐ **Shaft Alignments:**\n• Sirius alignment\n• Orion\'s Belt\n• North Star\n• Venus position\n• Zodiac constellations',
                        question: 'Which celestial body does the southern shaft align with?',
                        difficulty: 'medium',
                        answers: {
                            'A. Sirius': { points: 4, nextStage: '4-3' },
                            'B. Orion\'s Belt': { points: 3, nextStage: '4-3' },
                            'C. North Star': { points: 2, nextStage: '4-3' },
                            'D. Venus': { points: 1, nextStage: '4-3' },
                            'E. Zodiac': { points: 0, nextStage: '4-3' }
                        },
                        hints: [
                            'Consider the importance in Egyptian mythology',
                            'This is the brightest star in the night sky',
                            'Associated with the goddess Isis'
                        ]
                    },
                    '4-3': {
                        title: 'May 23, 1920 – Queen\'s Chamber',
                        description: 'A hidden compartment in the chamber wall contains ancient measuring instruments.',
                        scenario: 'While examining the chamber walls, you discover a hidden compartment containing precision instruments used by the ancient builders.',
                        clues: '📏 **Ancient Instruments:**\n• Cubit measuring rods\n• Leveling tools\n• Astronomical alignment devices\n• Stone cutting tools\n• Drawing instruments',
                        question: 'What type of instruments do you find?',
                        difficulty: 'medium',
                        answers: {
                            'A. Cubit rods': { points: 4, nextStage: '4-4' },
                            'B. Leveling tools': { points: 3, nextStage: '4-4' },
                            'C. Astronomical devices': { points: 2, nextStage: '4-4' },
                            'D. Stone cutting tools': { points: 1, nextStage: '4-4' },
                            'E. Drawing instruments': { points: 0, nextStage: '4-4' }
                        },
                        hints: [
                            'Consider the precision required for pyramid construction',
                            'Think about standard measurement units',
                            'These rods represent the fundamental unit of length'
                        ]
                    },
                    '4-4': {
                        title: 'May 23, 1920 – Queen\'s Chamber',
                        description: 'The instruments include a mysterious device that seems to measure celestial movements.',
                        scenario: 'Among the measuring instruments, you find a sophisticated device that appears to track celestial movements with remarkable precision.',
                        clues: '🌠 **Celestial Device:**\n• Stone calendar\n• Star tracking mechanism\n• Solar alignment tool\n• Lunar phase calculator\n• Planetary motion tracker',
                        question: 'What does this device measure?',
                        difficulty: 'medium',
                        answers: {
                            'A. Stone calendar': { points: 3, nextStage: '4-5' },
                            'B. Star tracking': { points: 4, nextStage: '4-5' },
                            'C. Solar alignment': { points: 2, nextStage: '4-5' },
                            'D. Lunar phases': { points: 1, nextStage: '4-5' },
                            'E. Planetary motion': { points: 0, nextStage: '4-5' }
                        },
                        hints: [
                            'Consider the pyramid\'s astronomical alignments',
                            'Think about precise stellar observations',
                            'This would involve tracking specific stars over time'
                        ]
                    },
                    '4-5': {
                        title: 'May 23, 1920 – Queen\'s Chamber',
                        description: 'The device reveals a specific date that might be significant for accessing the king\'s chamber.',
                        scenario: 'After studying the celestial device, you realize it points to a specific date when certain astronomical alignments occur that might reveal access to the king\'s chamber.',
                        clues: '📅 **Significant Date:**\n• Summer solstice\n• Winter solstice\n• Equinox\n• Sirius rising\n• Orion alignment',
                        question: 'Which astronomical event is most significant?',
                        difficulty: 'hard',
                        answers: {
                            'A. Summer solstice': { points: 2, nextStage: '5-1' },
                            'B. Winter solstice': { points: 3, nextStage: '5-1' },
                            'C. Equinox': { points: 1, nextStage: '5-1' },
                            'D. Sirius rising': { points: 4, nextStage: '5-1' },
                            'E. Orion alignment': { points: 0, nextStage: '5-1' }
                        },
                        hints: [
                            'Consider the Egyptian calendar system',
                            'This event marked the new year in ancient Egypt',
                            'Associated with the Nile flooding cycle'
                        ]
                    },
                    '5-1': {
                        title: 'May 24, 1920 – Grand Gallery Top',
                        description: 'You reach the top of the grand gallery before the entrance to the king\'s chamber, the air is thick with anticipation.',
                        scenario: 'You stand at the top of the grand gallery, before the final passage leading to the king\'s chamber. The moment of truth approaches as you prepare to enter the most sacred space.',
                        clues: '🚪 **Final Passage:**\n• Low corridor\n• Antechamber\n• Portcullis slots\n• Stress-relieving chambers\n• Granite plugs',
                        question: 'What obstacle blocks the entrance to the king\'s chamber?',
                        difficulty: 'medium',
                        answers: {
                            'A. Low corridor': { points: 2, nextStage: '5-2' },
                            'B. Antechamber': { points: 3, nextStage: '5-2' },
                            'C. Portcullis slots': { points: 4, nextStage: '5-2' },
                            'D. Stress-relieving chambers': { points: 1, nextStage: '5-2' },
                            'E. Granite plugs': { points: 0, nextStage: '5-2' }
                        },
                        hints: [
                            'Consider security measures for the burial chamber',
                            'Look for evidence of sliding stone barriers',
                            'These would have held massive granite blocks'
                        ]
                    },
                    '5-2': {
                        title: 'May 24, 1920 – Antechamber',
                        description: 'A small chamber with intricate mechanisms that once held securing devices for the king\'s chamber.',
                        scenario: 'You enter the antechamber, a small space with complex mechanisms that once secured the entrance to the king\'s chamber. The system is both ingenious and formidable.',
                        clues: '⚙️ **Security System:**\n• Granite portcullises\n• Lever system\n• Counterweights\n• Rope mechanisms\n• Stone plugs',
                        question: 'How was the entrance originally secured?',
                        difficulty: 'medium',
                        answers: {
                            'A. Granite portcullises': { points: 4, nextStage: '5-3' },
                            'B. Lever system': { points: 3, nextStage: '5-3' },
                            'C. Counterweights': { points: 2, nextStage: '5-3' },
                            'D. Rope mechanisms': { points: 1, nextStage: '5-3' },
                            'E. Stone plugs': { points: 0, nextStage: '5-3' }
                        },
                        hints: [
                            'Consider massive stone barriers',
                            'Think about sliding blocks from above',
                            'These would be massive granite slabs'
                        ]
                    },
                    '5-3': {
                        title: 'May 24, 1920 – Antechamber',
                        description: 'The mechanisms show signs of ancient tampering, suggesting the chamber was entered long ago.',
                        scenario: 'As you examine the security mechanisms, you notice signs that they were bypassed in antiquity. Someone else has been here before you, long ago.',
                        clues: '🔍 **Tampering Evidence:**\n• Drill marks\n• Broken mechanisms\n• Displaced stones\n• Ancient tools left behind\n• Inscriptions of intruders',
                        question: 'What evidence of ancient entry do you find?',
                        difficulty: 'medium',
                        answers: {
                            'A. Drill marks': { points: 3, nextStage: '5-4' },
                            'B. Broken mechanisms': { points: 4, nextStage: '5-4' },
                            'C. Displaced stones': { points: 2, nextStage: '5-4' },
                            'D. Ancient tools': { points: 1, nextStage: '5-4' },
                            'E. Intruder inscriptions': { points: 0, nextStage: '5-4' }
                        },
                        hints: [
                            'Look for damage to the security system',
                            'Consider what would indicate forced entry',
                            'This would show physical damage to the mechanisms'
                        ]
                    },
                    '5-4': {
                        title: 'May 24, 1920 – Antechamber',
                        description: 'Despite the ancient breach, the chamber still holds secrets waiting to be discovered.',
                        scenario: 'Though the chamber was entered in antiquity, you sense that not all its secrets were discovered. The true purpose of the pyramid might still be hidden.',
                        clues: '🤫 **Remaining Secrets:**\n• Hidden chambers\n• Astronomical codes\n• Mathematical principles\n• Religious mysteries\n• Construction techniques',
                        question: 'What might still remain undiscovered?',
                        difficulty: 'medium',
                        answers: {
                            'A. Hidden chambers': { points: 4, nextStage: '5-5' },
                            'B. Astronomical codes': { points: 3, nextStage: '5-5' },
                            'C. Mathematical principles': { points: 2, nextStage: '5-5' },
                            'D. Religious mysteries': { points: 1, nextStage: '5-5' },
                            'E. Construction techniques': { points: 0, nextStage: '5-5' }
                        },
                        hints: [
                            'Consider recent archaeological discoveries',
                            'Think about spaces that might have been missed',
                            'This involves chambers not yet found by explorers'
                        ]
                    },
                    '5-5': {
                        title: 'May 24, 1920 – Antechamber',
                        description: 'The final decision: proceed into the king\'s chamber or search for hidden passages that might reveal greater secrets.',
                        scenario: 'You stand before the entrance to the king\'s chamber. Should you enter the known chamber or search for hidden passages that might lead to undiscovered secrets of the pyramid?',
                        clues: '🔍 **Final Choice:**\n• Enter king\'s chamber\n• Search for hidden passages\n• Examine ceiling\n• Check floor patterns\n• Study wall vibrations',
                        question: 'What should you do first?',
                        difficulty: 'hard',
                        answers: {
                            'A. Enter king\'s chamber': { points: 2, nextStage: '6-1' },
                            'B. Search for hidden passages': { points: 4, nextStage: '6-1' },
                            'C. Examine ceiling': { points: 3, nextStage: '6-1' },
                            'D. Check floor patterns': { points: 1, nextStage: '6-1' },
                            'E. Study wall vibrations': { points: 0, nextStage: '6-1' }
                        },
                        hints: [
                            'Consider the possibility of undiscovered areas',
                            'Think like a modern archaeologist',
                            'The greatest discoveries often come from looking where others haven\'t'
                        ]
                    },
                    '6-1': {
                        title: 'May 24, 1920 – King\'s Chamber',
                        description: 'The magnificent chamber built entirely of granite, containing a sarcophagus but no lid, the air is still and ancient.',
                        scenario: 'You enter the king\'s chamber, a magnificent space built from massive granite blocks. The only object in the room is an empty sarcophagus, but the chamber still holds mysteries.',
                        clues: '⚰️ **Chamber Examination:**\n• Sarcophagus details\n• Wall construction\n• Ceiling stones\n• Floor patterns\n• Air shafts',
                        question: 'What is most remarkable about this chamber?',
                        difficulty: 'medium',
                        answers: {
                            'A. Sarcophagus': { points: 3, nextStage: '6-2' },
                            'B. Wall construction': { points: 4, nextStage: '6-2' },
                            'C. Ceiling stones': { points: 2, nextStage: '6-2' },
                            'D. Floor patterns': { points: 1, nextStage: '6-2' },
                            'E. Air shafts': { points: 0, nextStage: '6-2' }
                        },
                        hints: [
                            'Consider the engineering marvel',
                            'Look at the massive stones and their precision',
                            'The construction technique is extraordinary'
                        ]
                    },
                    '6-2': {
                        title: 'May 24, 1920 – King\'s Chamber',
                        description: 'The sarcophagus shows signs of being opened in antiquity, but its original contents remain a mystery.',
                        scenario: 'The sarcophagus shows clear signs of having been opened long ago. Whatever it contained was removed, but clues might remain about its original contents.',
                        clues: '🔎 **Sarcophagus Clues:**\n• Tool marks\n• Residual materials\n• Inscriptions\n• Size and shape\n• Alignment',
                        question: 'What provides the best clues about the original contents?',
                        difficulty: 'medium',
                        answers: {
                            'A. Tool marks': { points: 2, nextStage: '6-3' },
                            'B. Residual materials': { points: 4, nextStage: '6-3' },
                            'C. Inscriptions': { points: 3, nextStage: '6-3' },
                            'D. Size and shape': { points: 1, nextStage: '6-3' },
                            'E. Alignment': { points: 0, nextStage: '6-3' }
                        },
                        hints: [
                            'Consider scientific analysis possibilities',
                            'Think about microscopic evidence',
                            'This could reveal organic materials'
                        ]
                    },
                    '6-3': {
                        title: 'May 24, 1920 – King\'s Chamber',
                        description: 'The chamber\'s construction suggests it might have purposes beyond mere burial, possibly astronomical or spiritual.',
                        scenario: 'As you study the chamber more carefully, you realize its construction and alignment suggest purposes beyond being just a burial place. It might be a sophisticated astronomical instrument.',
                        clues: '🌌 **Advanced Purpose:**\n• Resonance chamber\n• Energy focus point\n• Astronomical observatory\n• Spiritual transformation\n• Mathematical demonstration',
                        question: 'What additional purpose might this chamber serve?',
                        difficulty: 'medium',
                        answers: {
                            'A. Resonance chamber': { points: 3, nextStage: '6-4' },
                            'B. Energy focus': { points: 2, nextStage: '6-4' },
                            'C. Astronomical observatory': { points: 4, nextStage: '6-4' },
                            'D. Spiritual transformation': { points: 1, nextStage: '6-4' },
                            'E. Mathematical demonstration': { points: 0, nextStage: '6-4' }
                        },
                        hints: [
                            'Consider the shaft alignments',
                            'Think about precise astronomical observations',
                            'This would involve tracking specific celestial events'
                        ]
                    },
                    '6-4': {
                        title: 'May 24, 1920 – King\'s Chamber',
                        description: 'A discovery in the chamber suggests the pyramid might be part of a larger complex with other pyramids.',
                        scenario: 'You find evidence suggesting this pyramid was not built in isolation but as part of a larger complex with specific relationships to other pyramids on the Giza plateau.',
                        clues: '🏗️ **Complex Relationships:**\n• Alignment with other pyramids\n• Size proportions\n• Construction timeline\n• Astronomical connections\n• Geological positioning',
                        question: 'What is the most significant relationship?',
                        difficulty: 'medium',
                        answers: {
                            'A. Alignment with others': { points: 4, nextStage: '6-5' },
                            'B. Size proportions': { points: 3, nextStage: '6-5' },
                            'C. Construction timeline': { points: 2, nextStage: '6-5' },
                            'D. Astronomical connections': { points: 1, nextStage: '6-5' },
                            'E. Geological positioning': { points: 0, nextStage: '6-5' }
                        },
                        hints: [
                            'Consider the layout of the Giza complex',
                            'Think about celestial correlations',
                            'This reflects the pattern of Orion\'s Belt'
                        ]
                    },
                    '6-5': {
                        title: 'May 24, 1920 – King\'s Chamber',
                        description: 'The final revelation: the true purpose of the pyramid might be as a initiation chamber for spiritual transformation.',
                        scenario: 'All the evidence converges on a startling conclusion: the pyramid might not have been primarily a tomb but rather an initiation chamber for spiritual transformation and astronomical education.',
                        clues: '✨ **Final Revelation:**\n• Tomb theory\n• Energy generator\n• Initiation chamber\n• Astronomical calculator\n• Message to future',
                        question: 'What is the most compelling theory about the pyramid\'s purpose?',
                        difficulty: 'hard',
                        answers: {
                            'A. Tomb theory': { points: 2, nextStage: 'end' },
                            'B. Energy generator': { points: 1, nextStage: 'end' },
                            'C. Initiation chamber': { points: 4, nextStage: 'end' },
                            'D. Astronomical calculator': { points: 3, nextStage: 'end' },
                            'E. Message to future': { points: 0, nextStage: 'end' }
                        },
                        hints: [
                            'Consider the combination of all discovered evidence',
                            'Think about spiritual and astronomical purposes combined',
                            'This involves transformation and enlightenment'
                        ]
                    }
                },
                endings: {
                        '0-12': {
                            title: 'BLOODY ENDING #1',
                            description: 'You wandered into the pyramid and every trap claimed its victim. Darkness surrounds you, treasures forever out of reach.',
                            color: '#8B0000'
                        },
                        '13-24': {
                            title: 'BAD ENDING #2',
                            description: 'You barely escaped several deadly traps, leaving behind most treasures. The echoes of the pyramid haunt your journey.',
                            color: '#FF4500'
                        },
                        '25-36': {
                            title: 'BORING ENDING #3',
                            description: 'You managed to grab a few treasures and solve some puzzles, but the pyramid still holds many secrets you missed.',
                            color: '#FF6347'
                        },
                        '37-48': {
                            title: 'BELOW AVERAGE ENDING #4',
                            description: 'A handful of puzzles were solved and treasures collected, but your adventure felt incomplete.',
                            color: '#FFA500'
                        },
                        '49-60': {
                            title: 'BRIGHT ENDING #5',
                            description: 'You solved most puzzles and collected most treasures. A satisfying journey, yet a few mysteries remain.',
                            color: '#FFFF00'
                        },
                        '61-72': {
                            title: 'BRILLIANT ENDING #6',
                            description: 'Almost all treasures and secrets were discovered. The pyramid’s story unfolds before your eyes.',
                            color: '#ADFF2F'
                        },
                        '73-84': {
                            title: 'BEST ENDING #7',
                            description: 'You uncovered every chamber and solved nearly all puzzles, walking away with the greatest knowledge the pyramid offers.',
                            color: '#7CFC00'
                        },
                        '85-96': {
                            title: 'BEAUTIFUL ENDING #8',
                            description: 'Every secret, every treasure is now yours. The pyramid acknowledges your mastery.',
                            color: '#32CD32'
                        },
                        '97-119': {
                            title: 'BOUNDLESS ENDING #9',
                            description: 'You went beyond expectations, revealing hidden chambers, mastering puzzles, and claiming all treasures.',
                            color: '#228B22'
                        },
                        '120': {
                            title: 'BRAVURA ENDING #10',
                            description: 'Perfection achieved! Every secret uncovered, every treasure collected. The pyramid’s legacy is now yours.',
                            color: '#008000'
                        }
                    },
                failureEndings: [
                    'The pyramid traps sealed you inside forever at {time}!',
                    'Ancient curses fell upon you at {time}!',
                    'You triggered a deadly trap at {time}!',
                    'A sandstorm covered the pyramid entrance at {time}!',
                    'You got lost in the endless pyramid corridors at {time}!'
                ]
            },
            heist: {
                title: 'The Jewel Heist Investigation',
                description: 'Solve the mysterious jewel theft in 19th century London with Sherlock Holmes!',
                color: '#2F4F4F',
                emoji: '🔍',
                startingStage: '1-1',
                totalStages: 35,
                stages: {
                    '1-1': {
                        title: 'March 12, 1800 – Jewel Museum',
                        description: 'Midnight, theft alarm sounds, light fog in the streets, lamps barely illuminate. The guard found the door strangely locked, Holmes and Watson are present to investigate.',
                        scenario: 'The museum stands silent in the foggy London night. A precious jewel has been stolen, and only your keen observation skills can solve this mystery.',
                        clues: '🚪 **Entry Point Analysis:**\n• Door handle scratches\n• Lock mechanism\n• Floor markings\n• Window fragments\n• Ceiling access points',
                        question: 'Where did the guard find signs of tampering?',
                        difficulty: 'medium',
                        answers: {
                            'A. Handle': { points: 2, nextStage: '1-2' },
                            'B. Lock': { points: 4, nextStage: '1-2' },
                            'C. Floor': { points: 0, nextStage: '1-2' },
                            'D. Windows': { points: 1, nextStage: '1-2' },
                            'E. Ceiling': { points: 3, nextStage: '1-2' }
                        },
                        hints: [
                            'The main door is usually the primary target',
                            'Look for professional tools marks',
                            'The most secure point is often the most targeted'
                        ]
                    },
                    '1-2': {
                        title: 'March 12, 1800 – Jewel Museum',
                        description: 'The museum displays show signs of professional work, the thief knew exactly what to take and how to avoid detection.',
                        scenario: 'The display cases show precise, professional work. This was no ordinary thief but someone with specific knowledge and skills.',
                        clues: '💎 **Display Examination:**\n• Glass cutting marks\n• Lock picking evidence\n• Alarm bypass signs\n• Motion sensor avoidance\n• Laser beam deactivation',
                        question: 'How was the jewel case opened?',
                        difficulty: 'medium',
                        answers: {
                            'A. Glass cutting': { points: 4, nextStage: '1-3' },
                            'B. Lock picking': { points: 3, nextStage: '1-3' },
                            'C. Alarm bypass': { points: 2, nextStage: '1-3' },
                            'D. Sensor avoidance': { points: 1, nextStage: '1-3' },
                            'E. Laser deactivation': { points: 0, nextStage: '1-3' }
                        },
                        hints: [
                            'Look for the most direct method',
                            'Consider what would leave physical evidence',
                            'This method would show clean, precise cuts'
                        ]
                    },
                    '1-3': {
                        title: 'March 12, 1800 – Jewel Museum',
                        description: 'Footprints and other traces left behind might reveal the thief\'s identity or methods.',
                        scenario: 'The thief left subtle traces despite their professionalism. Every criminal makes mistakes, and these clues could lead to their identity.',
                        clues: '👣 **Trace Evidence:**\n• Shoe prints\n• Glove fibers\n• Tool marks\n• Soil samples\n• Hair strands',
                        question: 'What is the most valuable trace evidence found?',
                        difficulty: 'medium',
                        answers: {
                            'A. Shoe prints': { points: 4, nextStage: '1-4' },
                            'B. Glove fibers': { points: 2, nextStage: '1-4' },
                            'C. Tool marks': { points: 3, nextStage: '1-4' },
                            'D. Soil samples': { points: 1, nextStage: '1-4' },
                            'E. Hair strands': { points: 0, nextStage: '1-4' }
                        },
                        hints: [
                            'Consider what can be most specifically identified',
                            'Look for something that can be matched to a specific brand',
                            'This evidence can reveal size, weight, and walking style'
                        ]
                    },
                    '1-4': {
                        title: 'March 12, 1800 – Jewel Museum',
                        description: 'The museum\'s security system has logs that might reveal the exact time of the theft.',
                        scenario: 'The security system maintains detailed logs of all activities. Analyzing these records could pinpoint the exact time of the theft.',
                        clues: '⏰ **Time Analysis:**\n• Alarm trigger time\n• Guard patrol logs\n• Camera timestamps\n• Motion sensor records\n• Door access logs',
                        question: 'Which log is most crucial for timing the theft?',
                        difficulty: 'medium',
                        answers: {
                            'A. Alarm trigger': { points: 4, nextStage: '1-5' },
                            'B. Guard patrol': { points: 2, nextStage: '1-5' },
                            'C. Camera timestamps': { points: 3, nextStage: '1-5' },
                            'D. Motion sensors': { points: 1, nextStage: '1-5' },
                            'E. Door access': { points: 0, nextStage: '1-5' }
                        },
                        hints: [
                            'Consider what would directly indicate the theft moment',
                            'Look for the system designed to detect intrusions',
                            'This would be the first system to react'
                        ]
                    },
                    '1-5': {
                        title: 'March 12, 1800 – Jewel Museum',
                        description: 'Witnesses in the area might have seen something suspicious around the time of the theft.',
                        scenario: 'Despite the late hour, there might have been people in the area who saw something unusual. Gathering witness statements could provide valuable leads.',
                        clues: '👁️ **Witness Accounts:**\n• Street vendor\n• Night watchman\n• Carriage driver\n• Local resident\n• Police constable',
                        question: 'Who is most likely to have witnessed something?',
                        difficulty: 'hard',
                        answers: {
                            'A. Street vendor': { points: 1, nextStage: '2-1' },
                            'B. Night watchman': { points: 4, nextStage: '2-1' },
                            'C. Carriage driver': { points: 2, nextStage: '2-1' },
                            'D. Local resident': { points: 3, nextStage: '2-1' },
                            'E. Police constable': { points: 0, nextStage: '2-1' }
                        },
                        hints: [
                            'Consider who would be most alert at night',
                            'Think about professional observers',
                            'This person\'s job is specifically to watch for suspicious activity'
                        ]
                    },
                    '2-1': {
                        title: 'March 13, 1800 – Foggy Streets',
                        description: 'Holmes tracks the criminal\'s trail through dark streets and thick fog, sounds of hesitant footsteps, the criminal moves intermittently.',
                        scenario: 'You follow Holmes through the foggy streets, tracking the criminal\'s movements. The fog makes visibility poor, but Holmes\'s keen senses pick up every clue.',
                        clues: '🌫️ **Street Investigation:**\n• Footprint patterns\n• Dropped items\n• Disturbed surfaces\n• Scent traces\n• Sound echoes',
                        question: 'What is the first trace the criminal left in the street?',
                        difficulty: 'medium',
                        answers: {
                            'A. Footprints': { points: 4, nextStage: '2-2' },
                            'B. Dropped items': { points: 2, nextStage: '2-2' },
                            'C. Disturbed surfaces': { points: 3, nextStage: '2-2' },
                            'D. Scent traces': { points: 1, nextStage: '2-2' },
                            'E. Sound echoes': { points: 0, nextStage: '2-2' }
                        },
                        hints: [
                            'Consider the most obvious physical evidence',
                            'Look for something that would be clearly visible',
                            'This would show the direction of movement'
                        ]
                    },
                    '2-2': {
                        title: 'March 13, 1800 – Foggy Streets',
                        description: 'Which street seems to be where the criminal hid? The fog makes every shadow suspicious.',
                        scenario: 'The criminal seems to have chosen hiding spots carefully in the fog-covered streets. Each dark alley and doorway could conceal the thief.',
                        clues: '🏙️ **Hiding Spot Analysis:**\n• Dark side street\n• Main street\n• Riverfront area\n• Market square\n• Residential alley',
                        question: 'Which street did the criminal hide in?',
                        difficulty: 'medium',
                        answers: {
                            'A. Dark side street': { points: 4, nextStage: '2-3' },
                            'B. Main street': { points: 2, nextStage: '2-3' },
                            'C. Riverfront': { points: 1, nextStage: '2-3' },
                            'D. Market square': { points: 0, nextStage: '2-3' },
                            'E. Residential alley': { points: 3, nextStage: '2-3' }
                        },
                        hints: [
                            'Consider what would provide the best concealment',
                            'Think about isolation from witnesses',
                            'This would be away from main traffic areas'
                        ]
                    },
                    '2-3': {
                        title: 'March 13, 1800 – Foggy Streets',
                        description: 'Possible suspects emerge from the criminal underworld of London.',
                        scenario: 'Holmes considers various suspects from London\'s criminal underworld. Each has the skills, but who had the motive and opportunity?',
                        clues: '🕵️ **Suspect Profiles:**\n• Mysterious merchant\n• Doorman\n• Former guard\n• Visitor\n• Beggar',
                        question: 'Who are the suspects?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious merchant': { points: 1, nextStage: '2-4' },
                            'B. Doorman': { points: 2, nextStage: '2-4' },
                            'C. Former guard': { points: 4, nextStage: '2-4' },
                            'D. Visitor': { points: 0, nextStage: '2-4' },
                            'E. Beggar': { points: 3, nextStage: '2-4' }
                        },
                        hints: [
                            'Consider who would have knowledge of the place',
                            'Think about inside access',
                            'This person would know security procedures'
                        ]
                    },
                    '2-4': {
                        title: 'March 13, 1800 – Foggy Streets',
                        description: 'The criminal left something behind that could reveal their movements.',
                        scenario: 'In their haste, the criminal dropped something that could provide crucial clues about their identity and plans.',
                        clues: '🔑 **Dropped Evidence:**\n• Keys\n• Old book\n• Hat\n• Sunglasses\n• Thread',
                        question: 'What did the criminal leave behind?',
                        difficulty: 'medium',
                        answers: {
                            'A. Keys': { points: 4, nextStage: '2-5' },
                            'B. Old book': { points: 0, nextStage: '2-5' },
                            'C. Hat': { points: 1, nextStage: '2-5' },
                            'D. Sunglasses': { points: 2, nextStage: '2-5' },
                            'E. Thread': { points: 3, nextStage: '2-5' }
                        },
                        hints: [
                            'Consider what could be used to understand movements',
                            'Think about practical utility',
                            'This could provide access to other locations'
                        ]
                    },
                    '2-5': {
                        title: 'March 13, 1800 – Foggy Streets',
                        description: 'Where does the criminal plan to escape? The Thames provides many possibilities.',
                        scenario: 'The criminal seems to be heading toward the river, where multiple escape routes are possible. Determining the planned escape method is crucial.',
                        clues: '🌊 **Escape Route Analysis:**\n• Across the river\n• By train\n• Walking in street\n• By ship\n• Nearby hideout',
                        question: 'Where does the criminal plan to escape?',
                        difficulty: 'hard',
                        answers: {
                            'A. Across river': { points: 4, nextStage: '3-1' },
                            'B. By train': { points: 1, nextStage: '3-1' },
                            'C. Walking': { points: 0, nextStage: '3-1' },
                            'D. By ship': { points: 3, nextStage: '3-1' },
                            'E. Nearby hideout': { points: 2, nextStage: '3-1' }
                        },
                        hints: [
                            'Consider the least monitored route',
                            'Think about quickest escape from pursuit',
                            'This would provide multiple crossing points'
                        ]
                    },
                    '3-1': {
                        title: 'March 14, 1800 – Old Port',
                        description: 'The criminal attempts escape via small boat, wave sounds, sea smell, ship lights sway with wave movement.',
                        scenario: 'You arrive at the old port where the criminal seems to be attempting a river escape. The dark waters and fog create a perfect cover for getaway.',
                        clues: '⚓ **Port Investigation:**\n• Large footprints on dock\n• Wood fragment\n• Torn rope\n• Paper\n• Stone',
                        question: 'What evidence of the criminal is found on the dock?',
                        difficulty: 'medium',
                        answers: {
                            'A. Large footprints': { points: 4, nextStage: '3-2' },
                            'B. Wood fragment': { points: 1, nextStage: '3-2' },
                            'C. Torn rope': { points: 2, nextStage: '3-2' },
                            'D. Paper': { points: 0, nextStage: '3-2' },
                            'E. Stone': { points: 3, nextStage: '3-2' }
                        },
                        hints: [
                            'Look for clear evidence on the ground',
                            'Consider what would be most visible',
                            'This would show size and direction clearly'
                        ]
                    },
                    '3-2': {
                        title: 'March 14, 1800 – Old Port',
                        description: 'Suspicious characters on the ship might be involved in the criminal\'s plans.',
                        scenario: 'Various people on the ships in port could be accomplices or involved in the criminal\'s escape plan. Holmes observes them carefully.',
                        clues: '👥 **Suspicious Characters:**\n• Mysterious sailor\n• Ship captain\n• Man in black hat\n• Merchant\n• Beggar',
                        question: 'Which character on the ship seems suspicious?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious sailor': { points: 1, nextStage: '3-3' },
                            'B. Ship captain': { points: 2, nextStage: '3-3' },
                            'C. Man in black hat': { points: 4, nextStage: '3-3' },
                            'D. Merchant': { points: 0, nextStage: '3-3' },
                            'E. Beggar': { points: 3, nextStage: '3-3' }
                        },
                        hints: [
                            'Consider who would stand out as unusual',
                            'Look for someone trying not to be noticed',
                            'This person appears with mysterious demeanor'
                        ]
                    },
                    '3-3': {
                        title: 'March 14, 1800 – Old Port',
                        description: 'Suspicious cargo on the ship might contain the stolen jewels or other evidence.',
                        scenario: 'The ships carry various cargoes, some of which might conceal the stolen jewels or provide evidence of the criminal\'s plans.',
                        clues: '📦 **Cargo Inspection:**\n• Wooden crates\n• Barrels\n• Large jewelry box\n• Travel bags\n• Wheat sacks',
                        question: 'Which cargo seems suspicious?',
                        difficulty: 'medium',
                        answers: {
                            'A. Wooden crates': { points: 3, nextStage: '3-4' },
                            'B. Barrels': { points: 2, nextStage: '3-4' },
                            'C. Large jewelry box': { points: 4, nextStage: '3-4' },
                            'D. Travel bags': { points: 1, nextStage: '3-4' },
                            'E. Wheat sacks': { points: 0, nextStage: '3-4' }
                        },
                        hints: [
                            'Consider what the criminal would want to steal',
                            'Think about value and concealment',
                            'This would be specifically designed for valuable items'
                        ]
                    },
                    '3-4': {
                        title: 'March 14, 1800 – Old Port',
                        description: 'A hidden message found on the ship might reveal the criminal\'s plans.',
                        scenario: 'While searching the ship, you discover a hidden message that could reveal the criminal\'s escape route and ultimate destination.',
                        clues: '📜 **Hidden Message:**\n• Encrypted message\n• Notebook\n• Discarded paper\n• Keys\n• Map',
                        question: 'What hidden message is found?',
                        difficulty: 'medium',
                        answers: {
                            'A. Encrypted message': { points: 2, nextStage: '3-5' },
                            'B. Notebook': { points: 0, nextStage: '3-5' },
                            'C. Discarded paper': { points: 1, nextStage: '3-5' },
                            'D. Keys': { points: 3, nextStage: '3-5' },
                            'E. Map': { points: 4, nextStage: '3-5' }
                        },
                        hints: [
                            'Consider what would show the criminal\'s plan',
                            'Think about visual representation of routes',
                            'This would show geographical information'
                        ]
                    },
                    '3-5': {
                        title: 'March 14, 1800 – Old Port',
                        description: 'Which ship is the criminal leaving on? Small vessels offer more discreet escape.',
                        scenario: 'Multiple ships are preparing to depart. The criminal would choose one that offers both speed and discretion for escape.',
                        clues: '⛵ **Ship Selection:**\n• Small ship\n• Large steamer\n• Wooden boat\n• Fishing boat\n• Old ship',
                        question: 'Which ship is the criminal departing on?',
                        difficulty: 'hard',
                        answers: {
                            'A. Small ship': { points: 4, nextStage: '4-1' },
                            'B. Large steamer': { points: 1, nextStage: '4-1' },
                            'C. Wooden boat': { points: 0, nextStage: '4-1' },
                            'D. Fishing boat': { points: 3, nextStage: '4-1' },
                            'E. Old ship': { points: 2, nextStage: '4-1' }
                        },
                        hints: [
                            'Consider the least monitored vessel',
                            'Think about ease of quick departure',
                            'This would be fast but not draw attention'
                        ]
                    },
                    '4-1': {
                        title: 'March 15, 1800 – Abandoned Palace',
                        description: 'The criminal hides in an abandoned palace, wind sounds through broken windows, shadows move on walls, fear and fog fill rooms.',
                        scenario: 'The trail leads to an abandoned palace where the criminal seems to be hiding. The decaying grandeur provides perfect cover but also many dangers.',
                        clues: '🏰 **Palace Investigation:**\n• Heavy shoe footprints\n• Light shoe prints\n• Hand prints\n• Wall scratches\n• Ash',
                        question: 'What evidence of movement is found inside?',
                        difficulty: 'medium',
                        answers: {
                            'A. Heavy shoe prints': { points: 4, nextStage: '4-2' },
                            'B. Light shoe prints': { points: 2, nextStage: '4-2' },
                            'C. Hand prints': { points: 0, nextStage: '4-2' },
                            'D. Wall scratches': { points: 3, nextStage: '4-2' },
                            'E. Ash': { points: 1, nextStage: '4-2' }
                        },
                        hints: [
                            'Look for clear evidence of someone moving through',
                            'Consider weight and purpose',
                            'This would indicate deliberate movement'
                        ]
                    },
                    '4-2': {
                        title: 'March 15, 1800 – Abandoned Palace',
                        description: 'Holmes finds something on the table that reveals the criminal\'s plans.',
                        scenario: 'In one of the palace rooms, you find evidence left on a table that provides crucial insights into the criminal\'s next moves.',
                        clues: '🕵️ **Table Discovery:**\n• Hidden map\n• Old book\n• Broken candle\n• Glasses\n• Pen',
                        question: 'What does Holmes find on the table?',
                        difficulty: 'medium',
                        answers: {
                            'A. Hidden map': { points: 4, nextStage: '4-3' },
                            'B. Old book': { points: 1, nextStage: '4-3' },
                            'C. Broken candle': { points: 0, nextStage: '4-3' },
                            'D. Glasses': { points: 2, nextStage: '4-3' },
                            'E. Pen': { points: 3, nextStage: '4-3' }
                        },
                        hints: [
                            'Consider what would reveal plans',
                            'Think about navigation aids',
                            'This would show routes and locations'
                        ]
                    },
                    '4-3': {
                        title: 'March 15, 1800 – Abandoned Palace',
                        description: 'Which room seems to be the surveillance center? Large rooms offer strategic advantage.',
                        scenario: 'The criminal would choose a room that provides both visibility and security for planning the next moves.',
                        clues: '👀 **Surveillance Center:**\n• Great hall\n• Library\n• Courtyard\n• Bedroom\n• Kitchen',
                        question: 'Which room seems to be the surveillance center?',
                        difficulty: 'medium',
                        answers: {
                            'A. Great hall': { points: 4, nextStage: '4-4' },
                            'B. Library': { points: 2, nextStage: '4-4' },
                            'C. Courtyard': { points: 0, nextStage: '4-4' },
                            'D. Bedroom': { points: 1, nextStage: '4-4' },
                            'E. Kitchen': { points: 3, nextStage: '4-4' }
                        },
                        hints: [
                            'Consider the largest room for overview',
                            'Think about strategic positioning',
                            'This would allow viewing multiple approaches'
                        ]
                    },
                    '4-4': {
                        title: 'March 15, 1800 – Abandoned Palace',
                        description: 'Watson discovers something that helps decode the criminal\'s plans.',
                        scenario: 'Watson makes an important discovery that could help unravel the criminal\'s encrypted messages and understand their ultimate plan.',
                        clues: '🔍 **Watson\'s Discovery:**\n• Encrypted message\n• Money bag\n• Pen\n• Glass piece\n• Folded paper',
                        question: 'What does Watson discover?',
                        difficulty: 'medium',
                        answers: {
                            'A. Encrypted message': { points: 4, nextStage: '4-5' },
                            'B. Money bag': { points: 1, nextStage: '4-5' },
                            'C. Pen': { points: 0, nextStage: '4-5' },
                            'D. Glass piece': { points: 2, nextStage: '4-5' },
                            'E. Folded paper': { points: 3, nextStage: '4-5' }
                        },
                        hints: [
                            'Consider what would help understand written plans',
                            'Think about decoding evidence',
                            'This would require decryption skills'
                        ]
                    },
                    '4-5': {
                        title: 'March 15, 1800 – Abandoned Palace',
                        description: 'Who is helping the criminal? Palace staff would have access and knowledge.',
                        scenario: 'The criminal seems to have inside help. Someone with knowledge of the palace and its secrets must be assisting in the hideout.',
                        clues: '🤝 **Accomplice Identification:**\n• Palace servant\n• Neighbor\n• Former guard\n• Visitor\n• Mysterious person',
                        question: 'Who is helping the criminal?',
                        difficulty: 'hard',
                        answers: {
                            'A. Palace servant': { points: 4, nextStage: '5-1' },
                            'B. Neighbor': { points: 1, nextStage: '5-1' },
                            'C. Former guard': { points: 2, nextStage: '5-1' },
                            'D. Visitor': { points: 0, nextStage: '5-1' },
                            'E. Mysterious person': { points: 3, nextStage: '5-1' }
                        },
                        hints: [
                            'Consider who would have palace access',
                            'Think about knowledge of hidden passages',
                            'This person would know the building intimately'
                        ]
                    },
                    '5-1': {
                        title: 'March 16, 1800 – Dark Forest',
                        description: 'The forest is foggy, night animal sounds, tall trees block criminal view, ground wet with dew, danger and tension feel.',
                        scenario: 'The pursuit leads into a dark, foggy forest where the criminal could be hiding anywhere. Every shadow could conceal danger.',
                        clues: '🌲 **Forest Tracking:**\n• Large clear footprints\n• Small prints\n• Animal prints\n• No prints\n• Double prints',
                        question: 'What evidence of the criminal\'s path is found?',
                        difficulty: 'medium',
                        answers: {
                            'A. Large clear prints': { points: 4, nextStage: '5-2' },
                            'B. Small prints': { points: 2, nextStage: '5-2' },
                            'C. Animal prints': { points: 1, nextStage: '5-2' },
                            'D. No prints': { points: 0, nextStage: '5-2' },
                            'E. Double prints': { points: 3, nextStage: '5-2' }
                        },
                        hints: [
                            'Look for the clearest trail evidence',
                            'Consider what would lead to the next location',
                            'This would show definite human passage'
                        ]
                    },
                    '5-2': {
                        title: 'March 16, 1800 – Dark Forest',
                        description: 'Holmes finds something on the ground that reveals the criminal\'s plans.',
                        scenario: 'In the forest, Holmes discovers something dropped by the criminal that provides crucial information about their intentions.',
                        clues: '🔎 **Ground Discovery:**\n• Empty box\n• Torn thread\n• Encrypted message\n• Stone\n• Wood piece',
                        question: 'What does Holmes find on the ground?',
                        difficulty: 'medium',
                        answers: {
                            'A. Empty box': { points: 3, nextStage: '5-3' },
                            'B. Torn thread': { points: 2, nextStage: '5-3' },
                            'C. Encrypted message': { points: 4, nextStage: '5-3' },
                            'D. Stone': { points: 1, nextStage: '5-3' },
                            'E. Wood piece': { points: 0, nextStage: '5-3' }
                        },
                        hints: [
                            'Consider what would reveal the criminal\'s plans',
                            'Think about written evidence',
                            'This would require decoding but contain valuable information'
                        ]
                    },
                    '5-3': {
                        title: 'March 16, 1800 – Dark Forest',
                        description: 'Marks on trees might be signals or clues left by the criminal.',
                        scenario: 'Strange marks on trees could be signals for accomplices or clues about the criminal\'s intended route through the forest.',
                        clues: '🌳 **Tree Markings:**\n• Hidden symbols\n• Scratches\n• Numbers\n• Random lines\n• Letters',
                        question: 'What do the marks on trees indicate?',
                        difficulty: 'medium',
                        answers: {
                            'A. Hidden symbols': { points: 4, nextStage: '5-4' },
                            'B. Scratches': { points: 2, nextStage: '5-4' },
                            'C. Numbers': { points: 1, nextStage: '5-4' },
                            'D. Random lines': { points: 0, nextStage: '5-4' },
                            'E. Letters': { points: 3, nextStage: '5-4' }
                        },
                        hints: [
                            'Consider covert communication methods',
                            'Think about quick movement signals',
                            'This would be intentional but discreet markings'
                        ]
                    },
                    '5-4': {
                        title: 'March 16, 1800 – Dark Forest',
                        description: 'Someone was nearby who might have seen the criminal pass through.',
                        scenario: 'In the remote forest, there might have been someone who witnessed the criminal\'s passage or could provide information about hiding spots.',
                        clues: '👤 **Witness Possibilities:**\n• Mysterious hunter\n• Forest guard\n• Beggar\n• Merchant\n• Ordinary hunter',
                        question: 'Who might have been nearby?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious hunter': { points: 2, nextStage: '5-5' },
                            'B. Forest guard': { points: 4, nextStage: '5-5' },
                            'C. Beggar': { points: 0, nextStage: '5-5' },
                            'D. Merchant': { points: 1, nextStage: '5-5' },
                            'E. Ordinary hunter': { points: 3, nextStage: '5-5' }
                        },
                        hints: [
                            'Consider who would be monitoring the area',
                            'Think about official observers',
                            'This person would have responsibility for the forest'
                        ]
                    },
                    '5-5': {
                        title: 'March 16, 1800 – Dark Forest',
                        description: 'The criminal\'s current location might be a hidden shelter in the forest.',
                        scenario: 'The criminal seems to have reached a hiding place in the forest. Determining the exact location is crucial for the final apprehension.',
                        clues: '🏠 **Hideout Location:**\n• Abandoned hut\n• Cave\n• Hilltop\n• Large tree\n• River side',
                        question: 'Where is the criminal currently hiding?',
                        difficulty: 'hard',
                        answers: {
                            'A. Abandoned hut': { points: 4, nextStage: '6-1' },
                            'B. Cave': { points: 1, nextStage: '6-1' },
                            'C. Hilltop': { points: 2, nextStage: '6-1' },
                            'D. Large tree': { points: 0, nextStage: '6-1' },
                            'E. River side': { points: 3, nextStage: '6-1' }
                        },
                        hints: [
                            'Consider concealed but accessible locations',
                            'Think about places that provide cover',
                            'This would be a man-made shelter'
                        ]
                    },
                    '6-1': {
                        title: 'March 17, 1800 – Old Monastery',
                        description: 'Old monastery, dark corridors, candles flicker, damp smell, Holmes follows clues between old rooms and libraries.',
                        scenario: 'The investigation leads to an ancient monastery where the criminal might be hiding among the shadows and secrets of the old building.',
                        clues: '⛪ **Monastery Search:**\n• Criminal\'s notebook\n• Old book\n• Paper\n• Map\n• Box',
                        question: 'What is found in the archives?',
                        difficulty: 'medium',
                        answers: {
                            'A. Criminal\'s notebook': { points: 4, nextStage: '6-2' },
                            'B. Old book': { points: 1, nextStage: '6-2' },
                            'C. Paper': { points: 0, nextStage: '6-2' },
                            'D. Map': { points: 3, nextStage: '6-2' },
                            'E. Box': { points: 2, nextStage: '6-2' }
                        },
                        hints: [
                            'Look for personal belongings',
                            'Consider what would contain personal plans',
                            'This would be carried by the criminal'
                        ]
                    },
                    '6-2': {
                        title: 'March 17, 1800 – Old Monastery',
                        description: 'Monitoring the entrance is crucial for catching the criminal entering or leaving.',
                        scenario: 'The monastery has multiple entrances. Choosing the right one to monitor could determine success in catching the criminal.',
                        clues: '🚨 **Entrance Surveillance:**\n• Guard surveillance\n• Wait outside\n• Window monitoring\n• Nothing\n• Criminal follow',
                        question: 'How is the entrance monitored?',
                        difficulty: 'medium',
                        answers: {
                            'A. Guard surveillance': { points: 4, nextStage: '6-3' },
                            'B. Wait outside': { points: 2, nextStage: '6-3' },
                            'C. Window monitoring': { points: 3, nextStage: '6-3' },
                            'D. Nothing': { points: 0, nextStage: '6-3' },
                            'E. Criminal follow': { points: 1, nextStage: '6-3' }
                        },
                        hints: [
                            'Consider the most critical entry point',
                            'Think about professional observation',
                            'This would involve systematic watching'
                        ]
                    },
                    '6-3': {
                        title: 'March 17, 1800 – Old Monastery',
                        description: 'Setting a trap might lure the criminal into revealing themselves.',
                        scenario: 'Holmes considers setting a clever trap that could force the criminal to make a move and reveal their position.',
                        clues: '🎣 **Trap Setting:**\n• Leave trap\n• Shouting\n• Financial lure\n• Fake message\n• Secret surveillance',
                        question: 'How to lure the criminal?',
                        difficulty: 'medium',
                        answers: {
                            'A. Leave trap': { points: 4, nextStage: '6-4' },
                            'B. Shouting': { points: 0, nextStage: '6-4' },
                            'C. Financial lure': { points: 2, nextStage: '6-4' },
                            'D. Fake message': { points: 3, nextStage: '6-4' },
                            'E. Secret surveillance': { points: 1, nextStage: '6-4' }
                        },
                        hints: [
                            'Consider what would force criminal action',
                            'Think about clever deception',
                            'This would create a situation the criminal must respond to'
                        ]
                    },
                    '6-4': {
                        title: 'March 17, 1800 – Old Monastery',
                        description: 'Encrypted messages need to be decoded to understand the criminal\'s plans.',
                        scenario: 'The encrypted messages found throughout the investigation hold the key to understanding the criminal\'s ultimate plan and destination.',
                        clues: '🔐 **Message Decryption:**\n• Decode encryption\n• Ignore\n• Send copy\n• Partial reading\n• Destroy',
                        question: 'How to handle encrypted messages?',
                        difficulty: 'medium',
                        answers: {
                            'A. Decode encryption': { points: 4, nextStage: '6-5' },
                            'B. Ignore': { points: 0, nextStage: '6-5' },
                            'C. Send copy': { points: 1, nextStage: '6-5' },
                            'D. Partial reading': { points: 2, nextStage: '6-5' },
                            'E. Destroy': { points: 3, nextStage: '6-5' }
                        },
                        hints: [
                            'Consider what would reveal the plans',
                            'Think about analytical approach',
                            'This would require cryptanalysis skills'
                        ]
                    },
                    '6-5': {
                        title: 'March 17, 1800 – Old Monastery',
                        description: 'Which room contains the criminal? Strategic guessing based on previous evidence.',
                        scenario: 'Based on all the evidence gathered, Holmes deduces which room in the monastery most likely contains the criminal.',
                        clues: '🚪 **Room Deduction:**\n• Main room\n• Cellar\n• Tower\n• Library\n• Great hall',
                        question: 'Which room contains the criminal?',
                        difficulty: 'hard',
                        answers: {
                            'A. Main room': { points: 4, nextStage: '7-1' },
                            'B. Cellar': { points: 3, nextStage: '7-1' },
                            'B. Tower': { points: 2, nextStage: '7-1' },
                            'D. Library': { points: 1, nextStage: '7-1' },
                            'E. Great hall': { points: 0, nextStage: '7-1' }
                        },
                        hints: [
                            'Consider smart deduction from previous evidence',
                            'Think about the most likely hiding place',
                            'This would be the central and most strategic room'
                        ]
                    },
                    '7-1': {
                        title: 'March 18, 1800 – Final Confrontation',
                        description: 'Abandoned square, thick fog, moon illuminates, tension peaks, Holmes confronts criminal directly.',
                        scenario: 'The final confrontation occurs in an abandoned square where Holmes directly faces the criminal. The tension reaches its peak as the mystery unravels.',
                        clues: '⚔️ **Final Pursuit:**\n• Large shoe prints\n• Small prints\n• Thread\n• Stone\n• Tool',
                        question: 'What are the criminal\'s final footsteps?',
                        difficulty: 'medium',
                        answers: {
                            'A. Large shoe prints': { points: 4, nextStage: '7-2' },
                            'B. Small prints': { points: 1, nextStage: '7-2' },
                            'C. Thread': { points: 0, nextStage: '7-2' },
                            'D. Stone': { points: 2, nextStage: '7-2' },
                            'E. Tool': { points: 3, nextStage: '7-2' }
                        },
                        hints: [
                            'Look for direct evidence of location',
                            'Consider what would show exact position',
                            'This would provide clear directional evidence'
                        ]
                    },
                    '7-2': {
                        title: 'March 18, 1800 – Final Confrontation',
                        description: 'Final evidence reveals the criminal\'s identity and methods.',
                        scenario: 'The final pieces of evidence come together to completely reveal the criminal\'s identity, methods, and motives.',
                        clues: '🔫 **Final Evidence:**\n• Gun\n• Map\n• Message\n• Bag\n• Nothing',
                        question: 'What is the final evidence?',
                        difficulty: 'medium',
                        answers: {
                            'A. Gun': { points: 4, nextStage: '7-3' },
                            'B. Map': { points: 2, nextStage: '7-3' },
                            'C. Message': { points: 3, nextStage: '7-3' },
                            'D. Bag': { points: 1, nextStage: '7-3' },
                            'E. Nothing': { points: 0, nextStage: '7-3' }
                        },
                        hints: [
                            'Consider the crime weapon',
                            'Think about what would prove guilt',
                            'This would be the tool of the crime'
                        ]
                    },
                    '7-3': {
                        title: 'March 18, 1800 – Final Confrontation',
                        description: 'Weapon analysis might reveal fingerprints or other identifying marks.',
                        scenario: 'The weapon found at the scene could contain crucial evidence like fingerprints that would definitively identify the criminal.',
                        clues: '🔬 **Weapon Analysis:**\n• Fingerprint traces\n• Clean\n• Single mark\n• Worn\n• Breaks',
                        question: 'What does weapon analysis reveal?',
                        difficulty: 'medium',
                        answers: {
                            'A. Fingerprint traces': { points: 4, nextStage: '7-4' },
                            'B. Clean': { points: 1, nextStage: '7-4' },
                            'C. Single mark': { points: 2, nextStage: '7-4' },
                            'D. Worn': { points: 0, nextStage: '7-4' },
                            'E. Breaks': { points: 3, nextStage: '7-4' }
                        },
                        hints: [
                            'Consider what would identify the culprit',
                            'Think about forensic evidence',
                            'This would provide biological identification'
                        ]
                    },
                    '7-4': {
                        title: 'March 18, 1800 – Final Confrontation',
                        description: 'Interrogating the accomplice might confirm the criminal\'s identity.',
                        scenario: 'The accomplice captured earlier might provide the final confirmation needed to completely solve the case and identify the mastermind.',
                        clues: '🗣️ **Accomplice Interrogation:**\n• Confession\n• Lies\n• Hesitation\n• Evasion\n• Escape',
                        question: 'How does the accomplice respond?',
                        difficulty: 'medium',
                        answers: {
                            'A. Confession': { points: 4, nextStage: '7-5' },
                            'B. Lies': { points: 0, nextStage: '7-5' },
                            'C. Hesitation': { points: 1, nextStage: '7-5' },
                            'D. Evasion': { points: 2, nextStage: '7-5' },
                            'E. Escape': { points: 3, nextStage: '7-5' }
                        },
                        hints: [
                            'Consider what would help the investigation',
                            'Think about cooperation',
                            'This would provide direct evidence and confirmation'
                        ]
                    },
                    '7-5': {
                        title: 'March 18, 1800 – Final Confrontation',
                        description: 'The final revelation: who is the true criminal and mastermind behind the theft?',
                        scenario: 'All the evidence converges to reveal the true criminal mastermind behind the sophisticated jewel theft.',
                        clues: '🕵️ **Final Revelation:**\n• Main criminal\n• Accomplice\n• Mysterious partner\n• Unknown\n• Former guard',
                        question: 'Who is the true criminal mastermind?',
                        difficulty: 'hard',
                        answers: {
                            'A. Main criminal': { points: 4, nextStage: 'end' },
                            'B. Accomplice': { points: 2, nextStage: 'end' },
                            'C. Mysterious partner': { points: 1, nextStage: 'end' },
                            'D. Unknown': { points: 0, nextStage: 'end' },
                            'E. Former guard': { points: 3, nextStage: 'end' }
                        },
                        hints: [
                            'Use all previous evidence to guide choice',
                            'Consider who has been most significant throughout',
                            'This person has appeared multiple times in critical contexts'
                        ]
                    }
                },
                endings: {
                    '0-9': {
                        title: 'CATASTROPHIC ENDING #1',
                        description: 'The criminal escapes and the jewel is lost forever, leaving the case unsolved.',
                        color: '#8B0000'
                    },
                    '10-18': {
                        title: 'VERY BAD ENDING #2',
                        description: 'The criminal escapes but some evidence is recovered, though insufficient for solving the case.',
                        color: '#FF4500'
                    },
                    '19-27': {
                        title: 'BAD ENDING #3',
                        description: 'The criminal escapes partially, leaving some clues behind.',
                        color: '#FF6347'
                    },
                    '28-36': {
                        title: 'BELOW AVERAGE ENDING #4',
                        description: 'The criminal is caught by accident, with minimal evidence recovered.',
                        color: '#FFA500'
                    },
                    '37-45': {
                        title: 'AVERAGE ENDING #5',
                        description: 'The criminal is caught, but some secrets are lost.',
                        color: '#FFFF00'
                    },
                    '46-54': {
                        title: 'GOOD ENDING #6',
                        description: 'The criminal is caught, but some evidence is missing.',
                        color: '#ADFF2F'
                    },
                    '55-63': {
                        title: 'VERY GOOD ENDING #7',
                        description: 'The criminal is caught with most jewels recovered.',
                        color: '#7CFC00'
                    },
                    '64-72': {
                        title: 'EXCELLENT ENDING #8',
                        description: 'The criminal is caught with complete recovery.',
                        color: '#32CD32'
                    },
                    '73-81': {
                        title: 'SUPERIOR ENDING #9',
                        description: 'The criminal is caught along with accomplices.',
                        color: '#228B22'
                    },
                    '82-90': {
                        title: 'PROFESSIONAL ENDING #10',
                        description: 'All involved are caught.',
                        color: '#008000'
                    },
                    '91-99': {
                        title: 'GENIUS ENDING #11',
                        description: 'The criminal is caught, all evidence recovered, jewels safe.',
                        color: '#006400'
                    },
                    '100-108': {
                        title: 'BRILLIANT ENDING #12',
                        description: 'The criminal is caught before the theft, all evidence preserved.',
                        color: '#004d00'
                    },
                    '109-117': {
                        title: 'AMAZING ENDING #13',
                        description: 'Holmes solves the case before theft, criminal caught, all evidence preserved.',
                        color: '#003300'
                    },
                    '118-139': {
                        title: 'LEGENDARY ENDING #14',
                        description: 'All secrets revealed, criminal caught, jewels safe.',
                        color: '#002200'
                    },
                    '140': {
                        title: 'ULTIMATE ENDING #15',
                        description: 'Holmes solves the case completely before any loss, city safe, all secrets revealed.',
                        color: '#001100'
                    }
                },
                failureEndings: [
                    'The criminal escaped at {time}, leaving no traces!',
                    'Crucial evidence was lost at {time}!',
                    'The investigation reached a dead end at {time}!',
                    'The fog covered all tracks at {time}!',
                    'The museum closed the case at {time} due to lack of progress!'
                ]
            },
    
            haunted: {
                title: 'Haunted Mansion Mystery',
                description: 'Explore a haunted mansion and uncover its terrifying secrets across multiple floors!',
                color: '#2F4F4F',
                emoji: '👻',
                startingStage: '1-1',
                totalStages: 40,
                stages: {
                    '1-1': {
                        title: 'October 31, 1780 – Abandoned Mansion Entrance',
                        description: 'A massive broken wooden door, howling winds, dry leaves flying, strange sounds from inside, dark and foggy atmosphere.',
                        scenario: 'You stand before the ominous mansion entrance. The broken door creaks ominously as wind whistles through the gaps. Strange sounds echo from within the dark interior.',
                        clues: '🚪 **Entrance Examination:**\n• Old carpet on the porch\n• Decaying wooden steps\n• Stone slab at the door\n• Outside grass area\n• Thick dust accumulation',
                        question: 'Where should you place your foot first when entering?',
                        difficulty: 'medium',
                        answers: {
                            'A. On the old carpet': { points: 2, nextStage: '1-2' },
                            'B. On the decaying steps': { points: 0, nextStage: '1-2' },
                            'C. On the stone at the door': { points: 4, nextStage: '1-2' },
                            'D. On the outside grass': { points: 1, nextStage: '1-2' },
                            'E. On the dust': { points: 3, nextStage: '1-2' }
                        },
                        hints: [
                            'The safest entry point would be the most stable surface',
                            'Consider what would provide the most secure footing',
                            'Stone surfaces often remain solid even when wood decays'
                        ]
                    },
                    '1-2': {
                        title: 'October 31, 1780 – Abandoned Mansion Entrance',
                        description: 'The main door shows signs of age and mysterious markings that might hold clues about the mansion\'s history.',
                        scenario: 'As you examine the massive door, you notice various markings and signs of wear that tell a story of the mansion\'s past and what might await inside.',
                        clues: '🔍 **Door Inspection:**\n• Mysterious engraving\n• Rust stains\n• Minor scratches\n• Nothing noticeable\n• Handprint marks',
                        question: 'What do you notice on the door?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious engraving': { points: 4, nextStage: '1-3' },
                            'B. Rust stains': { points: 1, nextStage: '1-3' },
                            'C. Minor scratches': { points: 2, nextStage: '1-3' },
                            'D. Nothing': { points: 0, nextStage: '1-3' },
                            'E. Handprint marks': { points: 3, nextStage: '1-3' }
                        },
                        hints: [
                            'Look for intentional markings rather than natural wear',
                            'Consider what might provide clues about the mansion',
                            'The most significant finding would be something deliberately created'
                        ]
                    },
                    '1-3': {
                        title: 'October 31, 1780 – Abandoned Mansion Entrance',
                        description: 'The door appears to be locked or stuck, requiring a specific tool to gain entry to the mansion.',
                        scenario: 'The heavy door resists your attempts to open it. You need to find the right tool or method to gain access to the mysterious interior.',
                        clues: '🔧 **Entry Methods:**\n• Old key\n• Wooden stick\n• Rock\n• Thread\n• Nothing',
                        question: 'What should you use to open the door?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old key': { points: 4, nextStage: '1-4' },
                            'B. Wooden stick': { points: 1, nextStage: '1-4' },
                            'C. Rock': { points: 0, nextStage: '1-4' },
                            'D. Thread': { points: 2, nextStage: '1-4' },
                            'E. Nothing': { points: 3, nextStage: '1-4' }
                        },
                        hints: [
                            'Consider what would be specifically designed for this purpose',
                            'Think about what might be hidden nearby for this task',
                            'The correct tool would be precise and intentionally placed'
                        ]
                    },
                    '1-4': {
                        title: 'October 31, 1780 – Abandoned Mansion Entrance',
                        description: 'Entering a haunted mansion alone might be dangerous. Considering companionship could improve your chances of survival.',
                        scenario: 'The ominous sounds from within suggest you might not be alone in this exploration. Having someone with knowledge of the mansion could be invaluable.',
                        clues: '👥 **Companion Considerations:**\n• Old servant\n• Nobody\n• Dog\n• Mysterious shadow\n• Ghost',
                        question: 'Who should accompany you?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old servant': { points: 4, nextStage: '1-5' },
                            'B. Nobody': { points: 0, nextStage: '1-5' },
                            'C. Dog': { points: 2, nextStage: '1-5' },
                            'D. Mysterious shadow': { points: 3, nextStage: '1-5' },
                            'E. Ghost': { points: 1, nextStage: '1-5' }
                        },
                        hints: [
                            'Consider who would have the most knowledge about the mansion',
                            'Think about practical assistance rather than supernatural',
                            'The most helpful companion would have historical knowledge'
                        ]
                    },
                    '1-5': {
                        title: 'October 31, 1780 – Abandoned Mansion Entrance',
                        description: 'Multiple doors lead inward from the entrance hall. Choosing the correct one is crucial for safe exploration.',
                        scenario: 'The entrance hall branches off into several corridors and doors. Each seems to lead to different parts of the mansion with varying levels of danger.',
                        clues: '🚪 **Door Selection:**\n• Left door\n• Central door\n• Right door\n• Back door\n• No door',
                        question: 'Which door should you choose to enter?',
                        difficulty: 'hard',
                        answers: {
                            'A. Left door': { points: 1, nextStage: '2-1' },
                            'B. Central door': { points: 4, nextStage: '2-1' },
                            'C. Right door': { points: 0, nextStage: '2-1' },
                            'D. Back door': { points: 2, nextStage: '2-1' },
                            'E. No door': { points: 3, nextStage: '2-1' }
                        },
                        hints: [
                            'Consider which path would be the main ceremonial route',
                            'Think about architectural conventions of the era',
                            'The safest path is often the most centrally located'
                        ]
                    },
                    '2-1': {
                        title: 'October 31, 1780 – Grand Hall',
                        description: 'A wide hall with shattered statues, faintly lit candles, footsteps echoing, doors creaking, feeling of awe and confusion.',
                        scenario: 'You enter the grand hall, a vast space filled with broken statues and flickering candles. Every sound echoes ominously through the cavernous space.',
                        clues: '🏛️ **Hall Examination:**\n• Old king statue\n• Female statue\n• Animal statue\n• Broken statue\n• Unknown statue',
                        question: 'Which statue should you examine?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old king statue': { points: 4, nextStage: '2-2' },
                            'B. Female statue': { points: 1, nextStage: '2-2' },
                            'C. Animal statue': { points: 2, nextStage: '2-2' },
                            'D. Broken statue': { points: 3, nextStage: '2-2' },
                            'E. Unknown statue': { points: 0, nextStage: '2-2' }
                        },
                        hints: [
                            'Focus on the most important-looking statue',
                            'Consider historical significance',
                            'This would be the most prominent figure'
                        ]
                    },
                    '2-2': {
                        title: 'October 31, 1780 – Grand Hall',
                        description: 'The floor shows signs of recent activity and possible clues about the mansion\'s current inhabitants.',
                        scenario: 'As you examine the floor, you notice evidence that suggests someone or something has been moving through the hall recently.',
                        clues: '👣 **Floor Evidence:**\n• Footprints\n• Dust\n• Blood\n• Nothing\n• Small pits',
                        question: 'What do you notice around the floor?',
                        difficulty: 'medium',
                        answers: {
                            'A. Footprints': { points: 4, nextStage: '2-3' },
                            'B. Dust': { points: 1, nextStage: '2-3' },
                            'C. Blood': { points: 2, nextStage: '2-3' },
                            'D. Nothing': { points: 0, nextStage: '2-3' },
                            'E. Small pits': { points: 3, nextStage: '2-3' }
                        },
                        hints: [
                            'Look for evidence of recent passage',
                            'Consider what would show movement',
                            'This would indicate someone walked through recently'
                        ]
                    },
                    '2-3': {
                        title: 'October 31, 1780 – Grand Hall',
                        description: 'Choosing the right tool to examine the room could reveal hidden secrets.',
                        scenario: 'The hall contains many shadows and hidden corners. The right tool could help you discover secrets that aren\'t immediately visible.',
                        clues: '💡 **Examination Tools:**\n• Lamp\n• Stick\n• Rock\n• Thread\n• Hand',
                        question: 'What should you use to examine the room?',
                        difficulty: 'medium',
                        answers: {
                            'A. Lamp': { points: 4, nextStage: '2-4' },
                            'B. Stick': { points: 1, nextStage: '2-4' },
                            'C. Rock': { points: 0, nextStage: '2-4' },
                            'D. Thread': { points: 3, nextStage: '2-4' },
                            'E. Hand': { points: 2, nextStage: '2-4' }
                        },
                        hints: [
                            'Consider what would reveal details in the darkness',
                            'Think about illumination',
                            'This would help you see clearly in the dim light'
                        ]
                    },
                    '2-4': {
                        title: 'October 31, 1780 – Grand Hall',
                        description: 'Shadows seem to move and take shape, possibly indicating supernatural presence.',
                        scenario: 'As you watch, the shadows in the hall seem to move and form shapes that might be trying to communicate or guide you.',
                        clues: '👻 **Shadow Observation:**\n• Mysterious ghost\n• Servant\n• Nobody\n• Animal\n• Statue',
                        question: 'Who appears in the shadows?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious ghost': { points: 4, nextStage: '2-5' },
                            'B. Servant': { points: 2, nextStage: '2-5' },
                            'C. Nobody': { points: 0, nextStage: '2-5' },
                            'D. Animal': { points: 1, nextStage: '2-5' },
                            'E. Statue': { points: 3, nextStage: '2-5' }
                        },
                        hints: [
                            'Consider supernatural possibilities',
                            'Think about what would be most significant',
                            'This would be an apparition rather than a living person'
                        ]
                    },
                    '2-5': {
                        title: 'October 31, 1780 – Grand Hall',
                        description: 'Choosing the right door to continue could lead to safety or danger.',
                        scenario: 'Multiple doors lead from the grand hall to different parts of the mansion. Each choice could lead to discovery or peril.',
                        clues: '🚪 **Door Choice:**\n• Left door\n• Middle door\n• Right door\n• Back door\n• Upper door',
                        question: 'Which door should you choose to continue?',
                        difficulty: 'hard',
                        answers: {
                            'A. Left door': { points: 2, nextStage: '3-1' },
                            'B. Middle door': { points: 4, nextStage: '3-1' },
                            'C. Right door': { points: 0, nextStage: '3-1' },
                            'D. Back door': { points: 1, nextStage: '3-1' },
                            'E. Upper door': { points: 3, nextStage: '3-1' }
                        },
                        hints: [
                            'Consider the main architectural flow',
                            'Think about traditional mansion layouts',
                            'The central path is often the main route'
                        ]
                    },
                    '3-1': {
                        title: 'October 31, 1780 – Ancient Library',
                        description: 'Shelves filled with old books, thick dust, papers flying from air movement, faint sounds, feeling of anxiety and curiosity.',
                        scenario: 'You enter the ancient library, where shelves groan under the weight of centuries-old books. The air smells of dust and decaying paper.',
                        clues: '📚 **Shelf Selection:**\n• Archive shelf\n• Novel shelf\n• Science shelf\n• Abandoned shelf\n• Random shelf',
                        question: 'Which shelf should you examine first?',
                        difficulty: 'medium',
                        answers: {
                            'A. Archive shelf': { points: 4, nextStage: '3-2' },
                            'B. Novel shelf': { points: 1, nextStage: '3-2' },
                            'C. Science shelf': { points: 2, nextStage: '3-2' },
                            'D. Abandoned shelf': { points: 3, nextStage: '3-2' },
                            'E. Random shelf': { points: 0, nextStage: '3-2' }
                        },
                        hints: [
                            'Consider where important records would be kept',
                            'Think about historical documents',
                            'This would contain official records and secrets'
                        ]
                    },
                    '3-2': {
                        title: 'October 31, 1780 – Ancient Library',
                        description: 'Certain books might contain hidden clues or secret passages.',
                        scenario: 'Among the thousands of books, some might hold special significance or conceal hidden mechanisms.',
                        clues: '📖 **Book Selection:**\n• Mystery book\n• Cookbook\n• Mathematics book\n• Poetry book\n• Other old book',
                        question: 'Which book should you open?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mystery book': { points: 4, nextStage: '3-3' },
                            'B. Cookbook': { points: 0, nextStage: '3-3' },
                            'C. Mathematics book': { points: 1, nextStage: '3-3' },
                            'D. Poetry book': { points: 2, nextStage: '3-3' },
                            'E. Other old book': { points: 3, nextStage: '3-3' }
                        },
                        hints: [
                            'Choose the book that seems most intriguing',
                            'Consider what might contain secrets',
                            'This would have an ominous or mysterious appearance'
                        ]
                    },
                    '3-3': {
                        title: 'October 31, 1780 – Ancient Library',
                        description: 'Behind certain books, hidden compartments might contain valuable clues.',
                        scenario: 'As you examine the books, you discover that some conceal hidden spaces behind them in the shelves.',
                        clues: '🗝️ **Hidden Discovery:**\n• Old key\n• Thread\n• Rock\n• Paper\n• Engraving',
                        question: 'What do you discover behind the book?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old key': { points: 4, nextStage: '3-4' },
                            'B. Thread': { points: 1, nextStage: '3-4' },
                            'C. Rock': { points: 2, nextStage: '3-4' },
                            'D. Paper': { points: 0, nextStage: '3-4' },
                            'E. Engraving': { points: 3, nextStage: '3-4' }
                        },
                        hints: [
                            'Consider what would be useful for progression',
                            'Think about practical items',
                            'This could unlock new areas'
                        ]
                    },
                    '3-4': {
                        title: 'October 31, 1780 – Ancient Library',
                        description: 'Certain statues in the library might serve as guides or guardians.',
                        scenario: 'The library contains several statues that seem to watch over the room. One might hold special significance.',
                        clues: '🗿 **Statue Guidance:**\n• Guardian statue\n• Queen statue\n• Animal statue\n• Unknown statue\n• Nothing',
                        question: 'Which statue guides you?',
                        difficulty: 'medium',
                        answers: {
                            'A. Guardian statue': { points: 4, nextStage: '3-5' },
                            'B. Queen statue': { points: 1, nextStage: '3-5' },
                            'C. Animal statue': { points: 0, nextStage: '3-5' },
                            'D. Unknown statue': { points: 2, nextStage: '3-5' },
                            'E. Nothing': { points: 3, nextStage: '3-5' }
                        },
                        hints: [
                            'Consider protective figures',
                            'Think about what would show the way',
                            'This statue would have a commanding presence'
                        ]
                    },
                    '3-5': {
                        title: 'October 31, 1780 – Ancient Library',
                        description: 'Pressing the right symbol might reveal hidden passages or secrets.',
                        scenario: 'You discover symbols on the library walls that seem to be part of a mechanism. Pressing the correct one might reveal hidden secrets.',
                        clues: '🔣 **Symbol Selection:**\n• Sun\n• Moon\n• Star\n• Lion\n• Random lines',
                        question: 'Which symbol should you press?',
                        difficulty: 'hard',
                        answers: {
                            'A. Sun': { points: 2, nextStage: '4-1' },
                            'B. Moon': { points: 0, nextStage: '4-1' },
                            'C. Star': { points: 4, nextStage: '4-1' },
                            'D. Lion': { points: 1, nextStage: '4-1' },
                            'E. Random lines': { points: 3, nextStage: '4-1' }
                        },
                        hints: [
                            'Consider celestial guidance',
                            'Think about navigation symbols',
                            'This symbol often represents guidance and direction'
                        ]
                    },
                    '4-1': {
                        title: 'October 31, 1780 – Dark Corridor',
                        description: 'A long corridor covered with warning engravings, whispering sounds in the air, feeling of danger and awe.',
                        scenario: 'You enter a dark, narrow corridor where the walls are covered with ominous warning symbols. The air feels thick with supernatural energy.',
                        clues: '⚠️ **Symbol Focus:**\n• Sun symbols\n• Moon symbols\n• Star symbols\n• Lion symbols\n• Random lines',
                        question: 'Which symbols should you focus on?',
                        difficulty: 'medium',
                        answers: {
                            'A. Sun symbols': { points: 2, nextStage: '4-2' },
                            'B. Moon symbols': { points: 1, nextStage: '4-2' },
                            'C. Star symbols': { points: 4, nextStage: '4-2' },
                            'D. Lion symbols': { points: 0, nextStage: '4-2' },
                            'E. Random lines': { points: 3, nextStage: '4-2' }
                        },
                        hints: [
                            'Consider what guided you previously',
                            'Think about consistent patterns',
                            'This symbol has appeared before as important'
                        ]
                    },
                    '4-2': {
                        title: 'October 31, 1780 – Dark Corridor',
                        description: 'The floor might conceal traps that could be dangerous if triggered.',
                        scenario: 'As you proceed carefully, you notice that the corridor floor shows signs of possible traps and hidden mechanisms.',
                        clues: '🕳️ **Floor Dangers:**\n• Hidden trap\n• Small pits\n• Rock\n• Dust\n• Nothing',
                        question: 'What do you notice on the floor?',
                        difficulty: 'medium',
                        answers: {
                            'A. Hidden trap': { points: 4, nextStage: '4-3' },
                            'B. Small pits': { points: 1, nextStage: '4-3' },
                            'C. Rock': { points: 2, nextStage: '4-3' },
                            'D. Dust': { points: 0, nextStage: '4-3' },
                            'E. Nothing': { points: 3, nextStage: '4-3' }
                        },
                        hints: [
                            'Be cautious of deliberate dangers',
                            'Think about security measures',
                            'This would be designed to protect something'
                        ]
                    },
                    '4-3': {
                        title: 'October 31, 1780 – Dark Corridor',
                        description: 'Choosing the right tool to navigate safely could prevent disaster.',
                        scenario: 'The corridor\'s traps require careful navigation. The right tool could help you avoid triggering them.',
                        clues: '🛡️ **Navigation Tools:**\n• Stick\n• Rock\n• Rope\n• Your hand\n• Brush',
                        question: 'What should you use to navigate safely?',
                        difficulty: 'medium',
                        answers: {
                            'A. Stick': { points: 4, nextStage: '4-4' },
                            'B. Rock': { points: 0, nextStage: '4-4' },
                            'C. Rope': { points: 2, nextStage: '4-4' },
                            'D. Your hand': { points: 3, nextStage: '4-4' },
                            'E. Brush': { points: 1, nextStage: '4-4' }
                        },
                        hints: [
                            'Consider what would allow safe testing',
                            'Think about reach and safety',
                            'This would let you test surfaces from a distance'
                        ]
                    },
                    '4-4': {
                        title: 'October 31, 1780 – Dark Corridor',
                        description: 'Shadows seem to be watching and possibly guiding your path.',
                        scenario: 'The shadows in the corridor seem to move with purpose, almost as if they\'re trying to show you the safe path forward.',
                        clues: '👥 **Shadow Guidance:**\n• Ghost\n• Nobody\n• Mysterious shadow\n• Statue\n• Bird',
                        question: 'Who is watching from the shadows?',
                        difficulty: 'medium',
                        answers: {
                            'A. Ghost': { points: 4, nextStage: '4-5' },
                            'B. Nobody': { points: 0, nextStage: '4-5' },
                            'C. Mysterious shadow': { points: 2, nextStage: '4-5' },
                            'D. Statue': { points: 1, nextStage: '4-5' },
                            'E. Bird': { points: 3, nextStage: '4-5' }
                        },
                        hints: [
                            'Consider supernatural assistance',
                            'Think about what has appeared before',
                            'This entity has been guiding you previously'
                        ]
                    },
                    '4-5': {
                        title: 'October 31, 1780 – Dark Corridor',
                        description: 'Pressing the right symbol might open the way forward or reveal secrets.',
                        scenario: 'You reach the end of the corridor where several symbols are engraved. Choosing the correct one might open the path ahead.',
                        clues: '🔘 **Final Symbol:**\n• Star\n• Sun\n• Moon\n• Lion\n• Random lines',
                        question: 'Which symbol should you press to proceed?',
                        difficulty: 'hard',
                        answers: {
                            'A. Star': { points: 4, nextStage: '5-1' },
                            'B. Sun': { points: 2, nextStage: '5-1' },
                            'C. Moon': { points: 0, nextStage: '5-1' },
                            'D. Lion': { points: 1, nextStage: '5-1' },
                            'E. Random lines': { points: 3, nextStage: '5-1' }
                        },
                        hints: [
                            'Follow the consistent pattern',
                            'Think about what has worked before',
                            'This symbol has been key throughout the mansion'
                        ]
                    },
                    '5-1': {
                        title: 'October 31, 1780 – Haunted Hall',
                        description: 'A large hall with shattered columns, internal fog, faint sounds, feeling of danger escalating, every step echoes.',
                        scenario: 'You enter a massive hall where shattered columns rise toward the shadowy ceiling. Fog swirls around your feet as faint whispers echo through the space.',
                        clues: '🏰 **Statue Examination:**\n• Ra statue\n• Anubis statue\n• Horus statue\n• Other statue\n• Nothing',
                        question: 'Which statue should you examine?',
                        difficulty: 'medium',
                        answers: {
                            'A. Ra statue': { points: 4, nextStage: '5-2' },
                            'B. Anubis statue': { points: 1, nextStage: '5-2' },
                            'C. Horus statue': { points: 2, nextStage: '5-2' },
                            'D. Other statue': { points: 0, nextStage: '5-2' },
                            'E. Nothing': { points: 3, nextStage: '5-2' }
                        },
                        hints: [
                            'Focus on the sun god',
                            'Consider Egyptian mythology',
                            'This deity is associated with power and leadership'
                        ]
                    },
                    '5-2': {
                        title: 'October 31, 1780 – Haunted Hall',
                        description: 'Certain engravings might hold clues about the hall\'s purpose and secrets.',
                        scenario: 'The walls are covered with intricate engravings that seem to tell a story or provide clues about the mansion\'s mysteries.',
                        clues: '📜 **Engraving Analysis:**\n• Sun lines\n• Moon lines\n• Star lines\n• Animal lines\n• Random lines',
                        question: 'Which engravings should you analyze?',
                        difficulty: 'medium',
                        answers: {
                            'A. Sun lines': { points: 4, nextStage: '5-3' },
                            'B. Moon lines': { points: 2, nextStage: '5-3' },
                            'C. Star lines': { points: 3, nextStage: '5-3' },
                            'D. Animal lines': { points: 0, nextStage: '5-3' },
                            'E. Random lines': { points: 1, nextStage: '5-3' }
                        },
                        hints: [
                            'Follow the consistent theme',
                            'Think about light and guidance',
                            'This has been a recurring important symbol'
                        ]
                    },
                    '5-3': {
                        title: 'October 31, 1780 – Haunted Hall',
                        description: 'The floor might conceal hidden compartments or clues.',
                        scenario: 'As you examine the hall floor, you notice certain areas that seem different, possibly concealing hidden spaces.',
                        clues: '🔍 **Floor Discovery:**\n• Old key\n• Rock\n• Thread\n• Paper\n• Nothing',
                        question: 'What do you discover on the floor?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old key': { points: 4, nextStage: '5-4' },
                            'B. Rock': { points: 1, nextStage: '5-4' },
                            'C. Thread': { points: 0, nextStage: '5-4' },
                            'D. Paper': { points: 2, nextStage: '5-4' },
                            'E. Nothing': { points: 3, nextStage: '5-4' }
                        },
                        hints: [
                            'Look for useful items',
                            'Think about what could open new areas',
                            'This would be a practical tool for progression'
                        ]
                    },
                    '5-4': {
                        title: 'October 31, 1780 – Haunted Hall',
                        description: 'Shadows seem to be protecting something or guiding you toward it.',
                        scenario: 'The shadows in the hall seem to converge around a particular area, as if protecting something important or showing you where to go.',
                        clues: '👻 **Shadow Presence:**\n• Mysterious ghost\n• Statue\n• Nobody\n• Bird\n• Shadow',
                        question: 'Who appears in the shadows?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious ghost': { points: 4, nextStage: '5-5' },
                            'B. Statue': { points: 2, nextStage: '5-5' },
                            'C. Nobody': { points: 0, nextStage: '5-5' },
                            'D. Bird': { points: 1, nextStage: '5-5' },
                            'E. Shadow': { points: 3, nextStage: '5-5' }
                        },
                        hints: [
                            'Consider supernatural guidance',
                            'Think about consistent helpers',
                            'This entity has been assisting you throughout'
                        ]
                    },
                    '5-5': {
                        title: 'October 31, 1780 – Haunted Hall',
                        description: 'Choosing the right door could lead to safety or reveal the final secrets.',
                        scenario: 'Multiple doors lead from the hall. Your choice could determine whether you find safety or uncover the mansion\'s ultimate secrets.',
                        clues: '🚪 **Final Door Choice:**\n• Middle door\n• Left door\n• Right door\n• Back door\n• Ceiling',
                        question: 'Which door should you choose?',
                        difficulty: 'hard',
                        answers: {
                            'A. Middle door': { points: 4, nextStage: '6-1' },
                            'B. Left door': { points: 1, nextStage: '6-1' },
                            'C. Right door': { points: 0, nextStage: '6-1' },
                            'D. Back door': { points: 2, nextStage: '6-1' },
                            'E. Ceiling': { points: 3, nextStage: '6-1' }
                        },
                        hints: [
                            'Follow the main path',
                            'Think about architectural logic',
                            'The central route is usually most important'
                        ]
                    },
                    '6-1': {
                        title: 'October 31, 1780 – Lower Corridor',
                        description: 'A narrow corridor leads to ancient rooms, water dripping sounds, walls covered with mold and ancient engravings.',
                        scenario: 'You descend into a lower corridor where the air is damp and cold. Water drips somewhere in the darkness as you proceed carefully.',
                        clues: '🔣 **Symbol Focus:**\n• Sun symbols\n• Moon symbols\n• Star symbols\n• Lion symbols\n• Random lines',
                        question: 'Which symbols appear most frequently?',
                        difficulty: 'medium',
                        answers: {
                            'A. Sun symbols': { points: 2, nextStage: '6-2' },
                            'B. Moon symbols': { points: 1, nextStage: '6-2' },
                            'C. Star symbols': { points: 4, nextStage: '6-2' },
                            'D. Lion symbols': { points: 0, nextStage: '6-2' },
                            'E. Random lines': { points: 3, nextStage: '6-2' }
                        },
                        hints: [
                            'Follow the established pattern',
                            'Think about guidance symbols',
                            'This has been consistently important'
                        ]
                    },
                    '6-2': {
                        title: 'October 31, 1780 – Lower Corridor',
                        description: 'The floor shows evidence of ancient traps designed to protect secrets.',
                        scenario: 'The corridor floor reveals sophisticated trap mechanisms that were designed to protect whatever lies ahead.',
                        clues: '⚡ **Trap Evidence:**\n• Arrow trap\n• Pit trap\n• Rolling stone\n• Gas release\n• Nothing',
                        question: 'What type of trap is evident?',
                        difficulty: 'medium',
                        answers: {
                            'A. Arrow trap': { points: 4, nextStage: '6-3' },
                            'B. Pit trap': { points: 2, nextStage: '6-3' },
                            'C. Rolling stone': { points: 1, nextStage: '6-3' },
                            'D. Gas release': { points: 0, nextStage: '6-3' },
                            'E. Nothing': { points: 3, nextStage: '6-3' }
                        },
                        hints: [
                            'Look for wall mechanisms',
                            'Think about projectile weapons',
                            'This would involve small holes in walls'
                        ]
                    },
                    '6-3': {
                        title: 'October 31, 1780 – Lower Corridor',
                        description: 'Choosing the right tool could mean the difference between life and death.',
                        scenario: 'Navigating the trapped corridor requires careful tool selection to avoid triggering the ancient mechanisms.',
                        clues: '🛠️ **Safety Tools:**\n• Stick\n• Rock\n• Rope\n• Your hand\n• Brush',
                        question: 'What should you use for safety?',
                        difficulty: 'medium',
                        answers: {
                            'A. Stick': { points: 4, nextStage: '6-4' },
                            'B. Rock': { points: 0, nextStage: '6-4' },
                            'C. Rope': { points: 2, nextStage: '6-4' },
                            'D. Your hand': { points: 3, nextStage: '6-4' },
                            'E. Brush': { points: 1, nextStage: '6-4' }
                        },
                        hints: [
                            'Consider distance and testing',
                            'Think about what you\'ve used before',
                            'This allows safe pressure testing'
                        ]
                    },
                    '6-4': {
                        title: 'October 31, 1780 – Lower Corridor',
                        description: 'Shadows seem to be showing the safe path through the traps.',
                        scenario: 'The shadows in the corridor seem to indicate safe stepping stones and paths through the treacherous floor.',
                        clues: '👥 **Shadow Guidance:**\n• Ghost\n• Nobody\n• Mysterious shadow\n• Statue\n• Bird',
                        question: 'Who guides you through?',
                        difficulty: 'medium',
                        answers: {
                            'A. Ghost': { points: 4, nextStage: '6-5' },
                            'B. Nobody': { points: 0, nextStage: '6-5' },
                            'C. Mysterious shadow': { points: 2, nextStage: '6-5' },
                            'D. Statue': { points: 1, nextStage: '6-5' },
                            'E. Bird': { points: 3, nextStage: '6-5' }
                        },
                        hints: [
                            'Consider your supernatural helper',
                            'Think about consistent guidance',
                            'This entity has been with you throughout'
                        ]
                    },
                    '6-5': {
                        title: 'October 31, 1780 – Lower Corridor',
                        description: 'Pressing the right symbol might deactivate the traps or open the way.',
                        scenario: 'At the corridor\'s end, you find symbols that might control the traps or open the final passage.',
                        clues: '🎯 **Final Symbol:**\n• Star\n• Sun\n• Moon\n• Lion\n• Random lines',
                        question: 'Which symbol should you press?',
                        difficulty: 'hard',
                        answers: {
                            'A. Star': { points: 4, nextStage: '7-1' },
                            'B. Sun': { points: 2, nextStage: '7-1' },
                            'C. Moon': { points: 0, nextStage: '7-1' },
                            'D. Lion': { points: 1, nextStage: '7-1' },
                            'E. Random lines': { points: 3, nextStage: '7-1' }
                        },
                        hints: [
                            'Follow the established pattern',
                            'Think about what has worked consistently',
                            'This symbol has been key to progress'
                        ]
                    },
                    '7-1': {
                        title: 'October 31, 1780 – Upper Floor',
                        description: 'Old rooms, broken furniture, torn curtains, scary sounds, feeling of greatest danger, every step could be fatal.',
                        scenario: 'You reach the upper floors where the mansion\'s most terrifying secrets await. The air feels heavy with ancient evil and unresolved mysteries.',
                        clues: '🏰 **Statue Examination:**\n• Old king statue\n• Queen statue\n• Guardian statue\n• Other statue\n• Nothing',
                        question: 'Which statue should you examine?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old king statue': { points: 4, nextStage: '7-2' },
                            'B. Queen statue': { points: 1, nextStage: '7-2' },
                            'C. Guardian statue': { points: 2, nextStage: '7-2' },
                            'D. Other statue': { points: 0, nextStage: '7-2' },
                            'E. Nothing': { points: 3, nextStage: '7-2' }
                        },
                        hints: [
                            'Focus on the most imposing figure',
                            'Think about leadership and power',
                            'This would be the most regal appearance'
                        ]
                    },
                    '7-2': {
                        title: 'October 31, 1780 – Upper Floor',
                        description: 'Ancient engravings might reveal the final secrets of the mansion.',
                        scenario: 'The walls here are covered with the most intricate and ominous engravings yet, possibly revealing the mansion\'s ultimate truth.',
                        clues: '📜 **Engraving Analysis:**\n• Sun lines\n• Moon lines\n• Star lines\n• Animal lines\n• Random lines',
                        question: 'Which engravings hold the final secrets?',
                        difficulty: 'medium',
                        answers: {
                            'A. Sun lines': { points: 4, nextStage: '7-3' },
                            'B. Moon lines': { points: 2, nextStage: '7-3' },
                            'C. Star lines': { points: 3, nextStage: '7-3' },
                            'D. Animal lines': { points: 0, nextStage: '7-3' },
                            'E. Random lines': { points: 1, nextStage: '7-3' }
                        },
                        hints: [
                            'Follow the consistent theme',
                            'Think about the primary symbol',
                            'This has been the most important throughout'
                        ]
                    },
                    '7-3': {
                        title: 'October 31, 1780 – Upper Floor',
                        description: 'The final discovery might be hidden in the floor or walls.',
                        scenario: 'You sense that the ultimate secret is very close. Careful examination might reveal the final hidden compartment.',
                        clues: '🔍 **Final Discovery:**\n• Old key\n• Rock\n• Thread\n• Paper\n• Nothing',
                        question: 'What is your final discovery?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old key': { points: 4, nextStage: '7-4' },
                            'B. Rock': { points: 1, nextStage: '7-4' },
                            'C. Thread': { points: 0, nextStage: '7-4' },
                            'D. Paper': { points: 2, nextStage: '7-4' },
                            'E. Nothing': { points: 3, nextStage: '7-4' }
                        },
                        hints: [
                            'Look for the most useful item',
                            'Think about what opens final passages',
                            'This would be the key to everything'
                        ]
                    },
                    '7-4': {
                        title: 'October 31, 1780 – Upper Floor',
                        description: 'The final guardian appears to reveal the last secrets.',
                        scenario: 'As you prepare to unlock the final mystery, the mansion\'s ultimate guardian appears to either help or hinder your progress.',
                        clues: '👻 **Final Guardian:**\n• Mysterious ghost\n• Statue\n• Nobody\n• Shadow\n• Bird',
                        question: 'Who is the final guardian?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious ghost': { points: 4, nextStage: '7-5' },
                            'B. Statue': { points: 2, nextStage: '7-5' },
                            'C. Nobody': { points: 0, nextStage: '7-5' },
                            'D. Shadow': { points: 1, nextStage: '7-5' },
                            'E. Bird': { points: 3, nextStage: '7-5' }
                        },
                        hints: [
                            'Consider your constant supernatural helper',
                            'Think about who has guided you',
                            'This entity has been with you from the beginning'
                        ]
                    },
                    '7-5': {
                        title: 'October 31, 1780 – Upper Floor',
                        description: 'The final choice: which door leads to the ultimate secret?',
                        scenario: 'You stand before the final doors. Your choice will determine whether you uncover the mansion\'s greatest secret or face ultimate danger.',
                        clues: '🚪 **Ultimate Choice:**\n• Middle door\n• Left door\n• Right door\n• Back door\n• Ceiling',
                        question: 'Which door holds the ultimate secret?',
                        difficulty: 'hard',
                        answers: {
                            'A. Middle door': { points: 4, nextStage: '8-1' },
                            'B. Left door': { points: 1, nextStage: '8-1' },
                            'C. Right door': { points: 0, nextStage: '8-1' },
                            'D. Back door': { points: 2, nextStage: '8-1' },
                            'E. Ceiling': { points: 3, nextStage: '8-1' }
                        },
                        hints: [
                            'Follow the main architectural flow',
                            'Think about traditional mansion design',
                            'The central path leads to the most important room'
                        ]
                    },
                    '8-1': {
                        title: 'October 31, 1780 – Final Room',
                        description: 'A large room, faint light, ancient treasure hidden, whispering sounds, feeling of horror and awe, you stand before the final treasure.',
                        scenario: 'You enter the final chamber where the mansion\'s ultimate treasure is revealed. The air crackles with ancient power and unresolved mysteries.',
                        clues: '👑 **Treasure Guardian:**\n• Ra statue\n• Anubis statue\n• Horus statue\n• Other statue\n• Nothing',
                        question: 'Which statue guards the treasure?',
                        difficulty: 'medium',
                        answers: {
                            'A. Ra statue': { points: 4, nextStage: '8-2' },
                            'B. Anubis statue': { points: 2, nextStage: '8-2' },
                            'C. Horus statue': { points: 1, nextStage: '8-2' },
                            'D. Other statue': { points: 0, nextStage: '8-2' },
                            'E. Nothing': { points: 3, nextStage: '8-2' }
                        },
                        hints: [
                            'Consider the sun god\'s importance',
                            'Think about supreme power',
                            'This deity represents ultimate authority'
                        ]
                    },
                    '8-2': {
                        title: 'October 31, 1780 – Final Room',
                        description: 'Choosing the right piece of treasure could mean understanding everything.',
                        scenario: 'The room contains multiple ancient treasures, but one holds the key to understanding the mansion\'s complete history.',
                        clues: '💎 **Treasure Selection:**\n• Ancient crown\n• Dagger\n• Ring\n• Small statue\n• Medal',
                        question: 'Which treasure should you choose?',
                        difficulty: 'medium',
                        answers: {
                            'A. Ancient crown': { points: 4, nextStage: '8-3' },
                            'B. Dagger': { points: 2, nextStage: '8-3' },
                            'C. Ring': { points: 3, nextStage: '8-3' },
                            'D. Small statue': { points: 1, nextStage: '8-3' },
                            'E. Medal': { points: 0, nextStage: '8-3' }
                        },
                        hints: [
                            'Consider the most important item',
                            'Think about royal significance',
                            'This represents ultimate authority and power'
                        ]
                    },
                    '8-3': {
                        title: 'October 31, 1780 – Final Room',
                        description: 'The final trap could be deadly if not handled correctly.',
                        scenario: 'The treasure is protected by one final, deadly trap that could end everything if triggered incorrectly.',
                        clues: '☠️ **Final Trap:**\n• Arrow trap\n• Moving stone\n• Rope\n• Fire\n• Nothing',
                        question: 'What is the final trap?',
                        difficulty: 'medium',
                        answers: {
                            'A. Arrow trap': { points: 4, nextStage: '8-4' },
                            'B. Moving stone': { points: 2, nextStage: '8-4' },
                            'C. Rope': { points: 1, nextStage: '8-4' },
                            'D. Fire': { points: 0, nextStage: '8-4' },
                            'E. Nothing': { points: 3, nextStage: '8-4' }
                        },
                        hints: [
                            'Consider what has protected important things before',
                            'Think about immediate danger',
                            'This would project lethal projectiles'
                        ]
                    },
                    '8-4': {
                        title: 'October 31, 1780 – Final Room',
                        description: 'The final message could warn future generations or explain everything.',
                        scenario: 'You discover a final message that could either warn others about the mansion\'s dangers or explain its complete history.',
                        clues: '📜 **Final Message:**\n• Warning for future\n• Simple note\n• Descriptive illustration\n• Numbers\n• Short story',
                        question: 'What is the final message?',
                        difficulty: 'medium',
                        answers: {
                            'A. Warning for future': { points: 4, nextStage: '8-5' },
                            'B. Simple note': { points: 2, nextStage: '8-5' },
                            'C. Descriptive illustration': { points: 3, nextStage: '8-5' },
                            'D. Numbers': { points: 0, nextStage: '8-5' },
                            'E. Short story': { points: 1, nextStage: '8-5' }
                        },
                        hints: [
                            'Consider responsibility to others',
                            'Think about protection and warning',
                            'This would be the most ethical choice'
                        ]
                    },
                    '8-5': {
                        title: 'October 31, 1780 – Final Room',
                        description: 'The final symbol could open the way to escape or reveal ultimate secrets.',
                        scenario: 'One final symbol holds the key to either escaping safely or unlocking the mansion\'s ultimate secret beyond conventional knowledge.',
                        clues: '🔮 **Ultimate Symbol:**\n• Star\n• Sun\n• Moon\n• Lion\n• Random lines',
                        question: 'Which symbol reveals the ultimate secret?',
                        difficulty: 'hard',
                        answers: {
                            'A. Star': { points: 4, nextStage: 'end' },
                            'B. Sun': { points: 2, nextStage: 'end' },
                            'C. Moon': { points: 0, nextStage: 'end' },
                            'D. Lion': { points: 1, nextStage: 'end' },
                            'E. Random lines': { points: 3, nextStage: 'end' }
                        },
                        hints: [
                            'Follow the pattern that guided you throughout',
                            'Think about the consistent theme',
                            'This symbol has been your guide from the beginning'
                        ]
                    }
                },
                endings: {
                    '0-5': {
                        title: 'CATASTROPHIC ENDING #1',
                        description: 'You became trapped inside the haunted mansion forever, joining its eternal residents in endless torment.',
                        color: '#8B0000'
                    },
                    '6-12': {
                        title: 'VERY BAD ENDING #2',
                        description: 'Most traps were activated and you barely escaped with your life, losing most treasures and secrets.',
                        color: '#FF4500'
                    },
                    '13-20': {
                        title: 'BAD ENDING #3',
                        description: 'Some treasures and secrets were lost during a difficult escape from the mansion.',
                        color: '#FF6347'
                    },
                    '21-28': {
                        title: 'BELOW AVERAGE ENDING #4',
                        description: 'You collected a few treasures and escaped with minor difficulties, but much was left behind.',
                        color: '#FFA500'
                    },
                    '29-36': {
                        title: 'AVERAGE ENDING #5',
                        description: 'You solved some puzzles and collected some treasures, escaping with moderate success.',
                        color: '#FFFF00'
                    },
                    '37-44': {
                        title: 'GOOD ENDING #6',
                        description: 'You solved most puzzles and collected most treasures, escaping safely from the mansion.',
                        color: '#ADFF2F'
                    },
                    '45-52': {
                        title: 'VERY GOOD ENDING #7',
                        description: 'You collected most treasures and solved most puzzles, escaping with valuable knowledge.',
                        color: '#7CFC00'
                    },
                    '53-60': {
                        title: 'EXCELLENT ENDING #8',
                        description: 'You solved almost all puzzles and collected almost all treasures from the mansion.',
                        color: '#32CD32'
                    },
                    '61-68': {
                        title: 'SUPERIOR ENDING #9',
                        description: 'You collected all treasures and solved all puzzles within the main mansion areas.',
                        color: '#228B22'
                    },
                    '69-76': {
                        title: 'OUTSTANDING ENDING #10',
                        description: 'You discovered additional secret areas beyond the main mansion rooms.',
                        color: '#008000'
                    },
                    '77-84': {
                        title: 'GENIUS ENDING #11',
                        description: 'You uncovered all ancient secrets and treasures hidden throughout the mansion.',
                        color: '#006400'
                    },
                    '85-92': {
                        title: 'PROFESSIONAL ENDING #12',
                        description: 'You collected all treasures, solved all puzzles, and discovered an additional secret chamber.',
                        color: '#004d00'
                    },
                    '93-100': {
                        title: 'BRILLIANT ENDING #13',
                        description: 'You completely uncovered all mansion secrets, treasures, and hidden knowledge.',
                        color: '#003300'
                    },
                    '101-108': {
                        title: 'AMAZING ENDING #14',
                        description: 'You solved all puzzles, discovered all treasures, and revealed secrets beyond conventional knowledge.',
                        color: '#002200'
                    },
                    '109-116': {
                        title: 'LEGENDARY ENDING #15',
                        description: 'You uncovered ancient secrets, collected all treasures, and escaped safely from the mansion.',
                        color: '#001100'
                    },
                    '117-124': {
                        title: 'MYTHICAL ENDING #16',
                        description: 'You revealed all secrets, treasures, and legends of the haunted mansion.',
                        color: '#000900'
                    },
                    '125-132': {
                        title: 'EPIC ENDING #17',
                        description: 'You uncovered all secrets, collected all treasures, and understood all mysteries of the mansion.',
                        color: '#000600'
                    },
                    '133-140': {
                        title: 'TRUE LEGEND ENDING #18',
                        description: 'You escaped safely, collected all treasures, and uncovered all mansion secrets completely.',
                        color: '#000300'
                    },
                    '141-159': {
                        title: 'SUPER LEGEND ENDING #19',
                        description: 'You uncovered all secrets, escaped safely, and made an astonishing historical discovery.',
                        color: '#000100'
                    },
                    '160': {
                        title: 'ULTIMATE ENDING #20',
                        description: 'You escaped safely, collected all treasures, solved all puzzles, uncovered all haunted mansion secrets, and gained knowledge of ancient century mysteries.',
                        color: '#000000'
                    }
                },
                failureEndings: [
                    'The mansion traps sealed you inside forever at {time}!',
                    'The ghostly curse fell upon you at {time}!',
                    'You triggered a deadly trap at {time}!',
                    'A supernatural storm covered the mansion at {time}!',
                    'You got lost in the endless haunted corridors at {time}!'
                ]
            },
            undead: {
                title: 'City of the Undead',
                description: 'Survive the zombie apocalypse in a 19th century city and uncover the source of the infection!',
                color: '#006400',
                emoji: '🧟',
                startingStage: '1-1',
                totalStages: 45,
                stages: {
                    '1-1': {
                        title: 'October 12, 1890 – Ancient Cemetery',
                        description: 'Thick fog covers the cemetery, smell of dampness and moss, crows circling, strange footsteps appearing between abandoned graves.',
                        scenario: 'The ancient cemetery stands silent under the thick fog. Recent disappearances and strange occurrences suggest something unnatural is awakening the dead.',
                        clues: '⚰️ **Cemetery Investigation:**\n• Central monument markings\n• Old well nearby\n• Cemetery wall examination\n• Main entrance observations\n• Small forest area clues',
                        question: 'Where was the first strange trace found?',
                        difficulty: 'medium',
                        answers: {
                            'A. Near central monument': { points: 4, nextStage: '1-2' },
                            'B. By old well': { points: 2, nextStage: '1-2' },
                            'C. Behind cemetery wall': { points: 1, nextStage: '1-2' },
                            'D. Next to entrance': { points: 0, nextStage: '1-2' },
                            'E. Near small forest': { points: 3, nextStage: '1-2' }
                        },
                        hints: [
                            'The beginning is usually at the center of the cemetery',
                            'Look for the most prominent structure',
                            'Central locations often hold the key clues'
                        ]
                    },
                    '1-2': {
                        title: 'October 12, 1890 – Ancient Cemetery',
                        description: 'Graves show signs of disturbance, some appear to have been opened from the inside rather than outside.',
                        scenario: 'As you examine the graves more closely, you notice something terrifying - some graves appear to have been opened from the inside, as if the occupants forced their way out.',
                        clues: '🪦 **Grave Examination:**\n• Soil disturbance patterns\n• Coffin damage\n• Scratch marks\n• Burial depth\n• Grave marker positions',
                        question: 'What indicates the dead rose from their graves?',
                        difficulty: 'medium',
                        answers: {
                            'A. Soil patterns': { points: 3, nextStage: '1-3' },
                            'B. Coffin damage': { points: 4, nextStage: '1-3' },
                            'C. Scratch marks': { points: 2, nextStage: '1-3' },
                            'D. Burial depth': { points: 1, nextStage: '1-3' },
                            'E. Marker positions': { points: 0, nextStage: '1-3' }
                        },
                        hints: [
                            'Look for evidence of internal pressure',
                            'Consider what would show something breaking out',
                            'This would show wood splintering inward'
                        ]
                    },
                    '1-3': {
                        title: 'October 12, 1890 – Ancient Cemetery',
                        description: 'Strange substances found near the graves might indicate the source of the reanimation.',
                        scenario: 'You discover strange, glowing substances near the disturbed graves. This might be the key to understanding what caused the dead to rise.',
                        clues: '🧪 **Strange Substances:**\n• Green glowing liquid\n• Black tar-like substance\n• White crystalline powder\n• Red viscous fluid\n• Blue mist',
                        question: 'What substance is most closely associated with the reanimation?',
                        difficulty: 'medium',
                        answers: {
                            'A. Green liquid': { points: 4, nextStage: '1-4' },
                            'B. Black substance': { points: 2, nextStage: '1-4' },
                            'C. White powder': { points: 3, nextStage: '1-4' },
                            'D. Red fluid': { points: 1, nextStage: '1-4' },
                            'E. Blue mist': { points: 0, nextStage: '1-4' }
                        },
                        hints: [
                            'Consider classic zombie lore',
                            'Look for something that might be radioactive',
                            'This color is often associated with toxicity'
                        ]
                    },
                    '1-4': {
                        title: 'October 12, 1890 – Ancient Cemetery',
                        description: 'The cemetery keeper\'s journal might contain clues about recent strange occurrences.',
                        scenario: 'You find the cemetery keeper\'s abandoned journal. Its entries might reveal what happened in the days leading up to the outbreak.',
                        clues: '📓 **Journal Entries:**\n• Strange noises\n• Missing bodies\n• Unusual visitors\n• Weather anomalies\n• Animal behavior',
                        question: 'What was the first unusual event recorded?',
                        difficulty: 'medium',
                        answers: {
                            'A. Strange noises': { points: 3, nextStage: '1-5' },
                            'B. Missing bodies': { points: 4, nextStage: '1-5' },
                            'C. Unusual visitors': { points: 2, nextStage: '1-5' },
                            'D. Weather anomalies': { points: 1, nextStage: '1-5' },
                            'E. Animal behavior': { points: 0, nextStage: '1-5' }
                        },
                        hints: [
                            'Consider what would be most directly related',
                            'Think about the core problem',
                            'This would be the most alarming event for a cemetery keeper'
                        ]
                    },
                    '1-5': {
                        title: 'October 12, 1890 – Ancient Cemetery',
                        description: 'Choosing the right equipment from the keeper\'s shed could mean the difference between survival and death.',
                        scenario: 'The cemetery keeper\'s shed contains various tools and equipment. Choosing the right items could be crucial for your survival in the coming outbreak.',
                        clues: '🛠️ **Equipment Selection:**\n• Shovel\n• Lantern\n• First aid kit\n• Weapon\n• Protective clothing',
                        question: 'What is the most important item to take?',
                        difficulty: 'hard',
                        answers: {
                            'A. Shovel': { points: 2, nextStage: '2-1' },
                            'B. Lantern': { points: 1, nextStage: '2-1' },
                            'C. First aid': { points: 3, nextStage: '2-1' },
                            'D. Weapon': { points: 4, nextStage: '2-1' },
                            'E. Protective clothing': { points: 0, nextStage: '2-1' }
                        },
                        hints: [
                            'Consider the immediate threat',
                            'Think about self-defense',
                            'This would be essential for dealing with aggressive threats'
                        ]
                    },
                    '2-1': {
                        title: 'October 13, 1890 – Abandoned Market',
                        description: 'Sounds of abandoned carts moving, scattered goods, fog covers market corners, people hiding in their homes.',
                        scenario: 'The market stands eerily empty, with goods scattered everywhere and carts left abandoned. The fog makes it difficult to see, but sounds suggest you\'re not alone.',
                        clues: '🛒 **Market Investigation:**\n• Middle of market\n• Near grocery store\n• Market fountain area\n• Western entrance\n• Near wood storage',
                        question: 'Where was the first zombie sighted?',
                        difficulty: 'medium',
                        answers: {
                            'A. Middle of market': { points: 4, nextStage: '2-2' },
                            'B. Near grocery store': { points: 2, nextStage: '2-2' },
                            'C. Market fountain': { points: 3, nextStage: '2-2' },
                            'D. Western entrance': { points: 1, nextStage: '2-2' },
                            'E. Near wood storage': { points: 0, nextStage: '2-2' }
                        },
                        hints: [
                            'Consider the largest gathering area',
                            'Think about where people would congregate',
                            'This would be the central trading area'
                        ]
                    },
                    '2-2': {
                        title: 'October 13, 1890 – Abandoned Market',
                        description: 'The zombie left behind traces that could help track its movements.',
                        scenario: 'Despite their mindless nature, the zombies leave traces that could reveal their patterns and help understand the spread of infection.',
                        clues: '🩸 **Zombie Traces:**\n• Frozen blood\n• Piece of cloth\n• Torn shoe\n• Torn paper\n• Stone',
                        question: 'What did the zombie leave behind?',
                        difficulty: 'medium',
                        answers: {
                            'A. Frozen blood': { points: 4, nextStage: '2-3' },
                            'B. Piece of cloth': { points: 1, nextStage: '2-3' },
                            'C. Torn shoe': { points: 2, nextStage: '2-3' },
                            'D. Torn paper': { points: 0, nextStage: '2-3' },
                            'E. Stone': { points: 3, nextStage: '2-3' }
                        },
                        hints: [
                            'Consider biological evidence',
                            'Think about what would be most distinctive',
                            'This would provide clear tracking evidence'
                        ]
                    },
                    '2-3': {
                        title: 'October 13, 1890 – Abandoned Market',
                        description: 'The first person to turn into a zombie might hold clues about the infection source.',
                        scenario: 'Identifying patient zero could be crucial to understanding how the infection spreads and where it originated.',
                        clues: '👤 **First Victim:**\n• Merchant\n• Cart driver\n• Little girl\n• Guard\n• Hunter',
                        question: 'Who was the first to turn into a zombie?',
                        difficulty: 'medium',
                        answers: {
                            'A. Merchant': { points: 2, nextStage: '2-4' },
                            'B. Cart driver': { points: 1, nextStage: '2-4' },
                            'C. Little girl': { points: 4, nextStage: '2-4' },
                            'D. Guard': { points: 3, nextStage: '2-4' },
                            'E. Hunter': { points: 0, nextStage: '2-4' }
                        },
                        hints: [
                            'Consider the most vulnerable target',
                            'Think about who would be least able to resist',
                            'This would be someone with less physical strength'
                        ]
                    },
                    '2-4': {
                        title: 'October 13, 1890 – Abandoned Market',
                        description: 'The zombie\'s escape route could reveal its patterns and hiding places.',
                        scenario: 'Tracking the zombie\'s movement through the market could help predict where others might be gathering or hiding.',
                        clues: '🛣️ **Escape Route:**\n• Narrow alleys\n• Main street\n• Old bridge\n• Nearby square\n• Garden',
                        question: 'Which route did the zombie use to escape?',
                        difficulty: 'medium',
                        answers: {
                            'A. Narrow alleys': { points: 4, nextStage: '2-5' },
                            'B. Main street': { points: 2, nextStage: '2-5' },
                            'C. Old bridge': { points: 3, nextStage: '2-5' },
                            'D. Nearby square': { points: 1, nextStage: '2-5' },
                            'E. Garden': { points: 0, nextStage: '2-5' }
                        },
                        hints: [
                            'Consider the least monitored path',
                            'Think about concealment opportunities',
                            'This would provide cover and multiple escape routes'
                        ]
                    },
                    '2-5': {
                        title: 'October 13, 1890 – Abandoned Market',
                        description: 'The main zombie gathering place might be where the infection is strongest.',
                        scenario: 'The zombies seem to be gathering in a particular location, possibly where the infection originated or where something draws them.',
                        clues: '🏚️ **Gathering Place:**\n• Abandoned church\n• Small market\n• Old palace\n• Port\n• Cemetery',
                        question: 'Where are the zombies gathering?',
                        difficulty: 'hard',
                        answers: {
                            'A. Abandoned church': { points: 4, nextStage: '3-1' },
                            'B. Small market': { points: 2, nextStage: '3-1' },
                            'C. Old palace': { points: 1, nextStage: '3-1' },
                            'D. Port': { points: 3, nextStage: '3-1' },
                            'E. Cemetery': { points: 0, nextStage: '3-1' }
                        },
                        hints: [
                            'Consider large, imposing structures',
                            'Think about places with spiritual significance',
                            'This would be a large, easily defensible building'
                        ]
                    },
                    '3-1': {
                        title: 'October 14, 1890 – Old Port',
                        description: 'Wave sounds crashing, ships shaking, zombies moving between boats.',
                        scenario: 'The old port presents both danger and opportunity. The zombies seem to be attracted to the water, but ships could also provide escape routes.',
                        clues: '⚓ **Port Investigation:**\n• Large footprints on dock\n• Wood fragment\n• Torn rope\n• Paper\n• Stone',
                        question: 'What zombie evidence is found on the dock?',
                        difficulty: 'medium',
                        answers: {
                            'A. Large footprints': { points: 4, nextStage: '3-2' },
                            'B. Wood fragment': { points: 1, nextStage: '3-2' },
                            'C. Torn rope': { points: 2, nextStage: '3-2' },
                            'D. Paper': { points: 0, nextStage: '3-2' },
                            'E. Stone': { points: 3, nextStage: '3-2' }
                        },
                        hints: [
                            'Look for clear physical evidence',
                            'Consider what would show size and weight',
                            'This would indicate recent movement'
                        ]
                    },
                    '3-2': {
                        title: 'October 14, 1890 – Old Port',
                        description: 'Suspicious characters on ships might be involved with the zombies or the infection source.',
                        scenario: 'Among the few remaining people at the port, some behave suspiciously and might know more about the outbreak than they admit.',
                        clues: '👥 **Suspicious Characters:**\n• Mysterious sailor\n• Ship captain\n• Man in black hat\n• Merchant\n• Beggar',
                        question: 'Who seems most suspicious?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious sailor': { points: 1, nextStage: '3-3' },
                            'B. Ship captain': { points: 2, nextStage: '3-3' },
                            'C. Man in black hat': { points: 4, nextStage: '3-3' },
                            'D. Merchant': { points: 0, nextStage: '3-3' },
                            'E. Beggar': { points: 3, nextStage: '3-3' }
                        },
                        hints: [
                            'Consider who stands out as unusual',
                            'Think about mysterious appearances',
                            'This person would be trying to avoid attention'
                        ]
                    },
                    '3-3': {
                        title: 'October 14, 1890 – Old Port',
                        description: 'Suspicious cargo might contain the infection source or related materials.',
                        scenario: 'The ships carry various cargoes, some of which might be connected to the zombie outbreak or contain valuable resources.',
                        clues: '📦 **Cargo Inspection:**\n• Wooden crates\n• Barrels\n• Large jewelry box\n• Travel bags\n• Wheat sacks',
                        question: 'Which cargo seems most suspicious?',
                        difficulty: 'medium',
                        answers: {
                            'A. Wooden crates': { points: 3, nextStage: '3-4' },
                            'B. Barrels': { points: 2, nextStage: '3-4' },
                            'C. Large jewelry box': { points: 4, nextStage: '3-4' },
                            'D. Travel bags': { points: 1, nextStage: '3-4' },
                            'E. Wheat sacks': { points: 0, nextStage: '3-4' }
                        },
                        hints: [
                            'Consider unusual containers',
                            'Think about what might hide secrets',
                            'This would be specifically designed for valuable contents'
                        ]
                    },
                    '3-4': {
                        title: 'October 14, 1890 – Old Port',
                        description: 'Hidden messages might reveal the zombie plans or infection spread.',
                        scenario: 'You discover hidden communications that could reveal how the zombies are being controlled or where the infection is spreading next.',
                        clues: '📜 **Hidden Messages:**\n• Encrypted message\n• Notebook\n• Discarded paper\n• Keys\n• Map',
                        question: 'What hidden message is found?',
                        difficulty: 'medium',
                        answers: {
                            'A. Encrypted message': { points: 2, nextStage: '3-5' },
                            'B. Notebook': { points: 0, nextStage: '3-5' },
                            'C. Discarded paper': { points: 1, nextStage: '3-5' },
                            'D. Keys': { points: 3, nextStage: '3-5' },
                            'E. Map': { points: 4, nextStage: '3-5' }
                        },
                        hints: [
                            'Consider geographical information',
                            'Think about movement patterns',
                            'This would show infection spread routes'
                        ]
                    },
                    '3-5': {
                        title: 'October 14, 1890 – Old Port',
                        description: 'Which ship are the zombies using for escape or spread?',
                        scenario: 'The zombies seem to be attracted to certain ships, either for escape or because something onboard draws them.',
                        clues: '⛵ **Ship Selection:**\n• Small ship\n• Large steamer\n• Wooden boat\n• Fishing boat\n• Old ship',
                        question: 'Which ship are the zombies using?',
                        difficulty: 'hard',
                        answers: {
                            'A. Small ship': { points: 4, nextStage: '4-1' },
                            'B. Large steamer': { points: 1, nextStage: '4-1' },
                            'C. Wooden boat': { points: 0, nextStage: '4-1' },
                            'D. Fishing boat': { points: 3, nextStage: '4-1' },
                            'E. Old ship': { points: 2, nextStage: '4-1' }
                        },
                        hints: [
                            'Consider stealth and accessibility',
                            'Think about what would be least noticeable',
                            'This would allow quick, undetected movement'
                        ]
                    },
                    '4-1': {
                        title: 'October 15, 1890 – Abandoned Palace',
                        description: 'Wind sounds through broken windows, shadows moving on walls, fog filling rooms.',
                        scenario: 'The abandoned palace provides both shelter and danger. Its many rooms could hide secrets about the outbreak or provide safe hiding spots.',
                        clues: '🏰 **Palace Investigation:**\n• Heavy shoe footprints\n• Light shoe prints\n• Hand prints\n• Wall scratches\n• Ash',
                        question: 'What movement evidence is found inside?',
                        difficulty: 'medium',
                        answers: {
                            'A. Heavy shoe footprints': { points: 4, nextStage: '4-2' },
                            'B. Light shoe prints': { points: 2, nextStage: '4-2' },
                            'C. Hand prints': { points: 0, nextStage: '4-2' },
                            'D. Wall scratches': { points: 3, nextStage: '4-2' },
                            'E. Ash': { points: 1, nextStage: '4-2' }
                        },
                        hints: [
                            'Look for clear zombie evidence',
                            'Consider weight and movement patterns',
                            'This would show deliberate, heavy movement'
                        ]
                    },
                    '4-2': {
                        title: 'October 15, 1890 – Abandoned Palace',
                        description: 'Discoveries on tables might reveal zombie plans or infection sources.',
                        scenario: 'The palace rooms contain evidence left behind that could reveal how the zombies think or where they\'re gathering next.',
                        clues: '🕵️ **Table Discoveries:**\n• Hidden map\n• Old book\n• Broken candle\n• Glasses\n• Pen',
                        question: 'What is found on the table?',
                        difficulty: 'medium',
                        answers: {
                            'A. Hidden map': { points: 4, nextStage: '4-3' },
                            'B. Old book': { points: 1, nextStage: '4-3' },
                            'C. Broken candle': { points: 0, nextStage: '4-3' },
                            'D. Glasses': { points: 2, nextStage: '4-3' },
                            'E. Pen': { points: 3, nextStage: '4-3' }
                        },
                        hints: [
                            'Consider strategic information',
                            'Think about navigation and planning',
                            'This would show movement patterns'
                        ]
                    },
                    '4-3': {
                        title: 'October 15, 1890 – Abandoned Palace',
                        description: 'Which room serves as the zombie command center?',
                        scenario: 'The zombies seem to have a central location where they gather and possibly receive commands or directions.',
                        clues: '👀 **Command Center:**\n• Great hall\n• Library\n• Courtyard\n• Bedroom\n• Kitchen',
                        question: 'Which room is the command center?',
                        difficulty: 'medium',
                        answers: {
                            'A. Great hall': { points: 4, nextStage: '4-4' },
                            'B. Library': { points: 2, nextStage: '4-4' },
                            'C. Courtyard': { points: 0, nextStage: '4-4' },
                            'D. Bedroom': { points: 1, nextStage: '4-4' },
                            'E. Kitchen': { points: 3, nextStage: '4-4' }
                        },
                        hints: [
                            'Consider the largest space',
                            'Think about gathering areas',
                            'This would allow monitoring of multiple approaches'
                        ]
                    },
                    '4-4': {
                        title: 'October 15, 1890 – Abandoned Palace',
                        description: 'Discoveries might help decode zombie communications or plans.',
                        scenario: 'You find evidence that could help understand how the zombies communicate or what their ultimate goals might be.',
                        clues: '🔍 **Important Discoveries:**\n• Encrypted message\n• Money bag\n• Pen\n• Glass piece\n• Folded paper',
                        question: 'What important discovery is made?',
                        difficulty: 'medium',
                        answers: {
                            'A. Encrypted message': { points: 4, nextStage: '4-5' },
                            'B. Money bag': { points: 1, nextStage: '4-5' },
                            'C. Pen': { points: 0, nextStage: '4-5' },
                            'D. Glass piece': { points: 2, nextStage: '4-5' },
                            'E. Folded paper': { points: 3, nextStage: '4-5' }
                        },
                        hints: [
                            'Consider communication evidence',
                            'Think about decoding possibilities',
                            'This would require decryption skills'
                        ]
                    },
                    '4-5': {
                        title: 'October 15, 1890 – Abandoned Palace',
                        description: 'Who is helping the zombies from inside the palace?',
                        scenario: 'Evidence suggests that someone with palace knowledge is assisting the zombies, either willingly or under duress.',
                        clues: '🤝 **Inside Help:**\n• Palace servant\n• Neighbor\n• Former guard\n• Visitor\n• Mysterious person',
                        question: 'Who is helping the zombies?',
                        difficulty: 'hard',
                        answers: {
                            'A. Palace servant': { points: 4, nextStage: '5-1' },
                            'B. Neighbor': { points: 1, nextStage: '5-1' },
                            'C. Former guard': { points: 2, nextStage: '5-1' },
                            'D. Visitor': { points: 0, nextStage: '5-1' },
                            'E. Mysterious person': { points: 3, nextStage: '5-1' }
                        },
                        hints: [
                            'Consider who knows the palace best',
                            'Think about access and knowledge',
                            'This person would know all secret passages'
                        ]
                    },
                    '5-1': {
                        title: 'October 16, 1890 – Dark Forest',
                        description: 'Forest is foggy, night animal sounds, tall trees block zombie view, ground wet with dew, danger and tension feel.',
                        scenario: 'The forest provides cover but also conceals dangers. Every shadow could hide zombies, and the fog makes navigation treacherous.',
                        clues: '🌲 **Forest Tracking:**\n• Large clear footprints\n• Small prints\n• Animal prints\n• No prints\n• Double prints',
                        question: 'What evidence of zombie path is found?',
                        difficulty: 'medium',
                        answers: {
                            'A. Large clear footprints': { points: 4, nextStage: '5-2' },
                            'B. Small prints': { points: 2, nextStage: '5-2' },
                            'C. Animal prints': { points: 1, nextStage: '5-2' },
                            'D. No prints': { points: 0, nextStage: '5-2' },
                            'E. Double prints': { points: 3, nextStage: '5-2' }
                        },
                        hints: [
                            'Look for the clearest trail evidence',
                            'Consider what would lead to the next location',
                            'This would show definite human passage'
                        ]
                    },
                    '5-2': {
                        title: 'October 16, 1890 – Dark Forest',
                        description: 'Holmes finds something on the ground that reveals the zombie plans.',
                        scenario: 'In the forest, Holmes discovers something dropped by the zombies that provides crucial information about their intentions.',
                        clues: '🔎 **Ground Discovery:**\n• Empty box\n• Torn thread\n• Encrypted message\n• Stone\n• Wood piece',
                        question: 'What does Holmes find on the ground?',
                        difficulty: 'medium',
                        answers: {
                            'A. Empty box': { points: 3, nextStage: '5-3' },
                            'B. Torn thread': { points: 2, nextStage: '5-3' },
                            'C. Encrypted message': { points: 4, nextStage: '5-3' },
                            'D. Stone': { points: 1, nextStage: '5-3' },
                            'E. Wood piece': { points: 0, nextStage: '5-3' }
                        },
                        hints: [
                            'Consider what would reveal the zombie plans',
                            'Think about written evidence',
                            'This would require decoding but contain valuable information'
                        ]
                    },
                    '5-3': {
                        title: 'October 16, 1890 – Dark Forest',
                        description: 'Marks on trees might be zombie signals or movement clues.',
                        scenario: 'Strange marks on trees could be signals for other zombies or clues about their intended route through the forest.',
                        clues: '🌳 **Tree Markings:**\n• Hidden symbols\n• Scratches\n• Numbers\n• Random lines\n• Letters',
                        question: 'What do the tree marks indicate?',
                        difficulty: 'medium',
                        answers: {
                            'A. Hidden symbols': { points: 4, nextStage: '5-4' },
                            'B. Scratches': { points: 2, nextStage: '5-4' },
                            'C. Numbers': { points: 1, nextStage: '5-4' },
                            'D. Random lines': { points: 0, nextStage: '5-4' },
                            'E. Letters': { points: 3, nextStage: '5-4' }
                        },
                        hints: [
                            'Consider covert communication methods',
                            'Think about quick movement signals',
                            'This would be intentional but discreet markings'
                        ]
                    },
                    '5-4': {
                        title: 'October 16, 1890 – Dark Forest',
                        description: 'Someone was nearby who might have seen the zombies pass through.',
                        scenario: 'In the remote forest, there might have been someone who witnessed the zombie passage or could provide information about hiding spots.',
                        clues: '👤 **Witness Possibilities:**\n• Mysterious hunter\n• Forest guard\n• Beggar\n• Merchant\n• Ordinary hunter',
                        question: 'Who might have been nearby?',
                        difficulty: 'medium',
                        answers: {
                            'A. Mysterious hunter': { points: 2, nextStage: '5-5' },
                            'B. Forest guard': { points: 4, nextStage: '5-5' },
                            'C. Beggar': { points: 0, nextStage: '5-5' },
                            'D. Merchant': { points: 1, nextStage: '5-5' },
                            'E. Ordinary hunter': { points: 3, nextStage: '5-5' }
                        },
                        hints: [
                            'Consider who would be monitoring the area',
                            'Think about official observers',
                            'This person would have responsibility for the forest'
                        ]
                    },
                    '5-5': {
                        title: 'October 16, 1890 – Dark Forest',
                        description: 'The zombie\'s current location might be a hidden shelter in the forest.',
                        scenario: 'The zombies seem to have reached a hiding place in the forest. Determining the exact location is crucial for the final confrontation.',
                        clues: '🏠 **Hideout Location:**\n• Abandoned hut\n• Cave\n• Hilltop\n• Large tree\n• River side',
                        question: 'Where are the zombies currently hiding?',
                        difficulty: 'hard',
                        answers: {
                            'A. Abandoned hut': { points: 4, nextStage: '6-1' },
                            'B. Cave': { points: 1, nextStage: '6-1' },
                            'C. Hilltop': { points: 2, nextStage: '6-1' },
                            'D. Large tree': { points: 0, nextStage: '6-1' },
                            'E. River side': { points: 3, nextStage: '6-1' }
                        },
                        hints: [
                            'Consider concealed but accessible locations',
                            'Think about places that provide cover',
                            'This would be a man-made shelter'
                        ]
                    },
                    '6-1': {
                        title: 'October 17, 1890 – Abandoned Castle',
                        description: 'Walls cracking with wind, doors creaking, shadows moving strangely.',
                        scenario: 'The abandoned castle stands as a formidable fortress. Its crumbling walls and dark corridors could hide the ultimate secret of the zombie outbreak.',
                        clues: '🏰 **Castle Investigation:**\n• Front gate evidence\n• North tower clues\n• Inner courtyard signs\n• Dark cellar traces\n• Castle roof markings',
                        question: 'Where did the zombie evidence begin in the castle?',
                        difficulty: 'medium',
                        answers: {
                            'A. Front gate': { points: 4, nextStage: '6-2' },
                            'B. North tower': { points: 2, nextStage: '6-2' },
                            'C. Inner courtyard': { points: 1, nextStage: '6-2' },
                            'D. Dark cellar': { points: 3, nextStage: '6-2' },
                            'E. Castle roof': { points: 0, nextStage: '6-2' }
                        },
                        hints: [
                            'Consider the main entrance point',
                            'Think about the largest access point',
                            'This would be the primary entry for large groups'
                        ]
                    },
                    '6-2': {
                        title: 'October 17, 1890 – Abandoned Castle',
                        description: 'A tool found near the entrance might help track the zombies.',
                        scenario: 'Near the castle entrance, you find a tool that could be crucial for tracking the zombies or understanding their movements.',
                        clues: '🛠️ **Entrance Tool:**\n• Old key\n• Blood-covered dagger\n• Lantern\n• Torn map\n• Nothing',
                        question: 'What tool is found near the entrance?',
                        difficulty: 'medium',
                        answers: {
                            'A. Old key': { points: 4, nextStage: '6-3' },
                            'B. Blood-covered dagger': { points: 2, nextStage: '6-3' },
                            'C. Lantern': { points: 1, nextStage: '6-3' },
                            'D. Torn map': { points: 3, nextStage: '6-3' },
                            'E. Nothing': { points: 0, nextStage: '6-3' }
                        },
                        hints: [
                            'Consider what would help access new areas',
                            'Think about practical utility',
                            'This could unlock restricted areas'
                        ]
                    },
                    '6-3': {
                        title: 'October 17, 1890 – Abandoned Castle',
                        description: 'Which room seems to be the control center?',
                        scenario: 'The castle contains many rooms, but one seems to serve as the central control point for whatever is happening.',
                        clues: '👀 **Control Center:**\n• Great hall\n• Dining room\n• Bedroom\n• Kitchen\n• Watch tower',
                        question: 'Which room is the control center?',
                        difficulty: 'medium',
                        answers: {
                            'A. Great hall': { points: 4, nextStage: '6-4' },
                            'B. Dining room': { points: 2, nextStage: '6-4' },
                            'C. Bedroom': { points: 1, nextStage: '6-4' },
                            'D. Kitchen': { points: 3, nextStage: '6-4' },
                            'E. Watch tower': { points: 0, nextStage: '6-4' }
                        },
                        hints: [
                            'Consider the largest gathering space',
                            'Think about strategic importance',
                            'This would allow viewing of the entire area'
                        ]
                    },
                    '6-4': {
                        title: 'October 17, 1890 – Abandoned Castle',
                        description: 'The zombies left behind something that reveals their plans.',
                        scenario: 'In their movement through the castle, the zombies left behind evidence that could reveal their ultimate plans or destination.',
                        clues: '🔍 **Left Behind Evidence:**\n• Encrypted message\n• Rope\n• Lantern\n• Torn cloth\n• Old book',
                        question: 'What did the zombies leave behind?',
                        difficulty: 'medium',
                        answers: {
                            'A. Encrypted message': { points: 4, nextStage: '6-5' },
                            'B. Rope': { points: 1, nextStage: '6-5' },
                            'C. Lantern': { points: 0, nextStage: '6-5' },
                            'D. Torn cloth': { points: 2, nextStage: '6-5' },
                            'E. Old book': { points: 3, nextStage: '6-5' }
                        },
                        hints: [
                            'Consider communication evidence',
                            'Think about strategic information',
                            'This would require decoding but contain valuable intel'
                        ]
                    },
                    '6-5': {
                        title: 'October 17, 1890 – Abandoned Castle',
                        description: 'Who is the mastermind behind the zombies in the castle?',
                        scenario: 'Evidence suggests that someone is controlling or leading the zombies from within the castle.',
                        clues: '🧠 **Mastermind Identification:**\n• Zombie leader\n• Accomplice\n• Mysterious partner\n• Unknown\n• Former guard',
                        question: 'Who is the zombie mastermind?',
                        difficulty: 'hard',
                        answers: {
                            'A. Zombie leader': { points: 4, nextStage: '7-1' },
                            'B. Accomplice': { points: 2, nextStage: '7-1' },
                            'C. Mysterious partner': { points: 1, nextStage: '7-1' },
                            'D. Unknown': { points: 0, nextStage: '7-1' },
                            'E. Former guard': { points: 3, nextStage: '7-1' }
                        },
                        hints: [
                            'Consider who has complete access',
                            'Think about knowledge of the castle',
                            'This person would know all security systems'
                        ]
                    },
                    '7-1': {
                        title: 'October 18, 1890 – Abandoned Square',
                        description: 'Thick fog, pale moon illumination, zombie sounds echoing between walls.',
                        scenario: 'The abandoned square becomes the stage for the final confrontation. The fog and pale moonlight create an eerie atmosphere as the tension reaches its peak.',
                        clues: '⚔️ **Final Pursuit:**\n• Large shoe prints\n• Small prints\n• Thread\n• Stone\n• Tool',
                        question: 'What are the final zombie footsteps?',
                        difficulty: 'medium',
                        answers: {
                            'A. Large shoe prints': { points: 4, nextStage: '7-2' },
                            'B. Small prints': { points: 1, nextStage: '7-2' },
                            'C. Thread': { points: 0, nextStage: '7-2' },
                            'D. Stone': { points: 2, nextStage: '7-2' },
                            'E. Tool': { points: 3, nextStage: '7-2' }
                        },
                        hints: [
                            'Look for direct evidence of location',
                            'Consider what would show exact position',
                            'This would provide clear directional evidence'
                        ]
                    },
                    '7-2': {
                        title: 'October 18, 1890 – Abandoned Square',
                        description: 'Final evidence reveals the zombie identity and methods.',
                        scenario: 'The final pieces of evidence come together to completely reveal the zombie leader\'s identity and methods.',
                        clues: '🔫 **Final Evidence:**\n• Gun\n• Map\n• Message\n• Bag\n• Nothing',
                        question: 'What is the final evidence?',
                        difficulty: 'medium',
                        answers: {
                            'A. Gun': { points: 4, nextStage: '7-3' },
                            'B. Map': { points: 2, nextStage: '7-3' },
                            'C. Message': { points: 3, nextStage: '7-3' },
                            'D. Bag': { points: 1, nextStage: '7-3' },
                            'E. Nothing': { points: 0, nextStage: '7-3' }
                        },
                        hints: [
                            'Consider the crime weapon',
                            'Think about what would prove guilt',
                            'This would be the tool of the crime'
                        ]
                    },
                    '7-3': {
                        title: 'October 18, 1890 – Abandoned Square',
                        description: 'Weapon analysis might reveal fingerprints or identifying marks.',
                        scenario: 'The weapon found at the scene could contain crucial evidence like fingerprints that would definitively identify the zombie leader.',
                        clues: '🔬 **Weapon Analysis:**\n• Fingerprint traces\n• Clean\n• Single mark\n• Worn\n• Breaks',
                        question: 'What does weapon analysis reveal?',
                        difficulty: 'medium',
                        answers: {
                            'A. Fingerprint traces': { points: 4, nextStage: '7-4' },
                            'B. Clean': { points: 1, nextStage: '7-4' },
                            'C. Single mark': { points: 2, nextStage: '7-4' },
                            'D. Worn': { points: 0, nextStage: '7-4' },
                            'E. Breaks': { points: 3, nextStage: '7-4' }
                        },
                        hints: [
                            'Consider what would identify the culprit',
                            'Think about forensic evidence',
                            'This would provide biological identification'
                        ]
                    },
                    '7-4': {
                        title: 'October 18, 1890 – Abandoned Square',
                        description: 'Interrogating the accomplice might confirm the zombie leader identity.',
                        scenario: 'The captured accomplice might provide the final confirmation needed to completely solve the case and identify the mastermind.',
                        clues: '🗣️ **Accomplice Interrogation:**\n• Confession\n• Lies\n• Hesitation\n• Evasion\n• Escape',
                        question: 'How does the accomplice respond?',
                        difficulty: 'medium',
                        answers: {
                            'A. Confession': { points: 4, nextStage: '7-5' },
                            'B. Lies': { points: 0, nextStage: '7-5' },
                            'C. Hesitation': { points: 1, nextStage: '7-5' },
                            'D. Evasion': { points: 2, nextStage: '7-5' },
                            'E. Escape': { points: 3, nextStage: '7-5' }
                        },
                        hints: [
                            'Consider what would help the investigation',
                            'Think about cooperation',
                            'This would provide direct evidence and confirmation'
                        ]
                    },
                    '7-5': {
                        title: 'October 18, 1890 – Abandoned Square',
                        description: 'The final revelation: who is the true zombie mastermind?',
                        scenario: 'All the evidence converges to reveal the true mastermind behind the zombie outbreak.',
                        clues: '🕵️ **Final Revelation:**\n• Main zombie leader\n• Accomplice\n• Mysterious partner\n• Unknown\n• Former guard',
                        question: 'Who is the true zombie mastermind?',
                        difficulty: 'hard',
                        answers: {
                            'A. Main zombie leader': { points: 4, nextStage: '8-1' },
                            'B. Accomplice': { points: 2, nextStage: '8-1' },
                            'C. Mysterious partner': { points: 1, nextStage: '8-1' },
                            'D. Unknown': { points: 0, nextStage: '8-1' },
                            'E. Former guard': { points: 3, nextStage: '8-1' }
                        },
                        hints: [
                            'Use all previous evidence to guide choice',
                            'Consider who has been most significant throughout',
                            'This person has appeared multiple times in critical contexts'
                        ]
                    },
                    '8-1': {
                        title: 'October 19, 1890 – Abandoned Hospital',
                        description: 'Decay smells, bed creaking sounds, shadows moving between walls.',
                        scenario: 'The abandoned hospital stands as a monument to the failed attempts to contain the outbreak. Its rooms hold both medical secrets and unimaginable horrors.',
                        clues: '🏥 **Hospital Investigation:**\n• Blood on floor\n• Broken glass\n• Torn book\n• Shoe\n• Blood stains evidence of attack',
                        question: 'What is the first evidence discovered?',
                        difficulty: 'medium',
                        answers: {
                            'A. Blood on floor': { points: 4, nextStage: '8-2' },
                            'B. Broken glass': { points: 2, nextStage: '8-2' },
                            'C. Torn book': { points: 1, nextStage: '8-2' },
                            'D. Shoe': { points: 0, nextStage: '8-2' },
                            'E. Blood stains': { points: 3, nextStage: '8-2' }
                        },
                        hints: [
                            'Look for the most direct evidence',
                            'Consider biological evidence',
                            'This would show clear signs of violence'
                        ]
                    },
                    '8-2': {
                        title: 'October 19, 1890 – Abandoned Hospital',
                        description: 'Which room was most active? Emergency rooms see most action.',
                        scenario: 'The hospital\'s emergency room would have been the center of activity during the initial outbreak, containing crucial evidence.',
                        clues: '🚑 **Active Room:**\n• Emergency department\n• Patient wing\n• Pharmacy\n• Storage\n• Emergency department center of events',
                        question: 'Which room was most active?',
                        difficulty: 'medium',
                        answers: {
                            'A. Emergency department': { points: 4, nextStage: '8-3' },
                            'B. Patient wing': { points: 2, nextStage: '8-3' },
                            'C. Pharmacy': { points: 1, nextStage: '8-3' },
                            'D. Storage': { points: 0, nextStage: '8-3' },
                            'E. Emergency department': { points: 3, nextStage: '8-3' }
                        },
                        hints: [
                            'Consider the main response area',
                            'Think about where emergencies are handled',
                            'This would be the primary treatment area'
                        ]
                    },
                    '8-3': {
                        title: 'October 19, 1890 – Abandoned Hospital',
                        description: 'Which tool was used to spread chaos? Sharp tools are most dangerous.',
                        scenario: 'The hospital contains various medical instruments that could have been used as weapons or tools during the outbreak.',
                        clues: '🩺 **Chaos Tool:**\n• Surgery scissors\n• Moving bed\n• Medicine bottle\n• Chair\n• Sharp and powerful tool',
                        question: 'What tool was used for chaos?',
                        difficulty: 'medium',
                        answers: {
                            'A. Surgery scissors': { points: 4, nextStage: '8-4' },
                            'B. Moving bed': { points: 1, nextStage: '8-4' },
                            'C. Medicine bottle': { points: 2, nextStage: '8-4' },
                            'D. Chair': { points: 0, nextStage: '8-4' },
                            'E. Sharp tool': { points: 3, nextStage: '8-4' }
                        },
                        hints: [
                            'Consider sharp medical instruments',
                            'Think about what would be most effective',
                            'This would be a precise cutting tool'
                        ]
                    },
                    '8-4': {
                        title: 'October 19, 1890 – Abandoned Hospital',
                        description: 'Who was the first victim? Medical staff are most exposed.',
                        scenario: 'The hospital staff would have been on the front lines during the outbreak, making them likely first victims.',
                        clues: '👩‍⚕️ **First Victim:**\n• Nurse\n• Doctor\n• Visitor\n• Patient\n• Closest to main room',
                        question: 'Who was the first victim?',
                        difficulty: 'medium',
                        answers: {
                            'A. Nurse': { points: 4, nextStage: '8-5' },
                            'B. Doctor': { points: 2, nextStage: '8-5' },
                            'C. Visitor': { points: 1, nextStage: '8-5' },
                            'D. Patient': { points: 0, nextStage: '8-5' },
                            'E. Closest person': { points: 3, nextStage: '8-5' }
                        },
                        hints: [
                            'Consider who would be most exposed',
                            'Think about frontline medical staff',
                            'This person would be in direct contact with patients'
                        ]
                    },
                    '8-5': {
                        title: 'October 19, 1890 – Abandoned Hospital',
                        description: 'Who controls the zombies? Mad scientists often experiment.',
                        scenario: 'Evidence points to someone with medical knowledge being behind the zombie control and experiments.',
                        clues: '👨‍🔬 **Controller Identification:**\n• Mad scientist\n• Assistant\n• Angry patient\n• Nurse\n• Unknown',
                        question: 'Who controls the zombies?',
                        difficulty: 'hard',
                        answers: {
                            'A. Mad scientist': { points: 4, nextStage: '9-1' },
                            'B. Assistant': { points: 2, nextStage: '9-1' },
                            'C. Angry patient': { points: 0, nextStage: '9-1' },
                            'D. Nurse': { points: 1, nextStage: '9-1' },
                            'E. Unknown': { points: 3, nextStage: '9-1' }
                        },
                        hints: [
                            'Consider who has scientific knowledge',
                            'Think about experimentation',
                            'This person would have medical expertise'
                        ]
                    },
                    '9-1': {
                        title: 'October 20, 1890 – Abandoned Train Station',
                        description: 'Train creaking sounds, thick fog, lights dim.',
                        scenario: 'The abandoned train station could provide either escape or a trap. The fog and dim lights make every shadow potentially dangerous.',
                        clues: '🚂 **Station Investigation:**\n• Blood on platforms\n• Abandoned bag\n• Glass\n• Piece of cloth\n• Blood evidence of activity',
                        question: 'What is the first evidence seen?',
                        difficulty: 'medium',
                        answers: {
                            'A. Blood on platforms': { points: 4, nextStage: '9-2' },
                            'B. Abandoned bag': { points: 2, nextStage: '9-2' },
                            'C. Glass': { points: 1, nextStage: '9-2' },
                            'D. Piece of cloth': { points: 0, nextStage: '9-2' },
                            'E. Blood evidence': { points: 3, nextStage: '9-2' }
                        },
                        hints: [
                            'Look for biological evidence',
                            'Consider what would indicate violence',
                            'This would show clear signs of struggle'
                        ]
                    },
                    '9-2': {
                        title: 'October 20, 1890 – Abandoned Train Station',
                        description: 'Which abandoned train contains zombies? First trains are closest.',
                        scenario: 'Multiple trains stand abandoned in the station. Determining which one contains zombies is crucial for safety.',
                        clues: '🚆 **Train Selection:**\n• First train\n• Third train\n• Last train\n• Second train\n• First train closest to entrance',
                        question: 'Which train contains zombies?',
                        difficulty: 'medium',
                        answers: {
                            'A. First train': { points: 4, nextStage: '9-3' },
                            'B. Third train': { points: 2, nextStage: '9-3' },
                            'C. Last train': { points: 1, nextStage: '9-3' },
                            'D. Second train': { points: 3, nextStage: '9-3' },
                            'E. First train': { points: 0, nextStage: '9-3' }
                        },
                        hints: [
                            'Consider proximity to entrance',
                            'Think about easy access',
                            'This would be the most accessible carriage'
                        ]
                    },
                    '9-3': {
                        title: 'October 20, 1890 – Abandoned Train Station',
                        description: 'Who were the attack victims? Station staff are most vulnerable.',
                        scenario: 'The train station staff would have been the most likely victims during any attack on the station.',
                        clues: '🎫 **Victim Identification:**\n• Ticket inspector\n• Train driver\n• Passenger\n• Guard\n• Most exposed to zombies',
                        question: 'Who were the victims?',
                        difficulty: 'medium',
                        answers: {
                            'A. Ticket inspector': { points: 4, nextStage: '9-4' },
                            'B. Train driver': { points: 2, nextStage: '9-4' },
                            'C. Passenger': { points: 1, nextStage: '9-4' },
                            'D. Guard': { points: 0, nextStage: '9-4' },
                            'E. Most exposed': { points: 3, nextStage: '9-4' }
                        },
                        hints: [
                            'Consider who would be most at risk',
                            'Think about frontline staff',
                            'This person interacts directly with everyone'
                        ]
                    },
                    '9-4': {
                        title: 'October 20, 1890 – Abandoned Train Station',
                        description: 'Which tool helps escape? Small trains are least monitored.',
                        scenario: 'Choosing the right escape vehicle could mean the difference between survival and becoming another zombie victim.',
                        clues: '🚊 **Escape Vehicle:**\n• Small train\n• Small carts\n• Jump platform\n• Boat\n• Least monitored vehicle',
                        question: 'What helps escape?',
                        difficulty: 'medium',
                        answers: {
                            'A. Small train': { points: 4, nextStage: '9-5' },
                            'B. Small carts': { points: 1, nextStage: '9-5' },
                            'C. Jump platform': { points: 0, nextStage: '9-5' },
                            'D. Boat': { points: 2, nextStage: '9-5' },
                            'E. Least monitored': { points: 3, nextStage: '9-5' }
                        },
                        hints: [
                            'Consider the least watched option',
                            'Think about speed and discretion',
                            'This would provide quickest escape'
                        ]
                    },
                    '9-5': {
                        title: 'October 20, 1890 – Abandoned Train Station',
                        description: 'The final zombie escape? Moving trains are fastest.',
                        scenario: 'The zombies seem to be planning their final escape using the trains. Determining their method is crucial to stopping them.',
                        clues: '🚄 **Final Escape:**\n• Moving train\n• Abandoned carts\n• Underground tunnel\n• North gate\n• Jump platform',
                        question: 'What is the final zombie escape plan?',
                        difficulty: 'hard',
                        answers: {
                            'A. Moving train': { points: 4, nextStage: 'end' },
                            'B. Abandoned carts': { points: 1, nextStage: 'end' },
                            'C. Underground tunnel': { points: 2, nextStage: 'end' },
                            'D. North gate': { points: 3, nextStage: 'end' },
                            'E. Jump platform': { points: 0, nextStage: 'end' }
                        },
                        hints: [
                            'Consider the fastest escape route',
                            'Think about what would be hardest to stop',
                            'This would provide speed and distance'
                        ]
                    }
                },
                endings: {
                    '0-7': {
                        title: 'CATASTROPHIC ENDING #1',
                        description: 'You failed to survive, the city completely turned into zombie hell, and the dead control every corner.',
                        color: '#8B0000'
                    },
                    '8-14': {
                        title: 'VERY BAD ENDING #2',
                        description: 'You barely survived but lost all evidence, the secrets remain shrouded in mystery.',
                        color: '#FF4500'
                    },
                    '15-21': {
                        title: 'BAD ENDING #3',
                        description: 'You survived with some evidence loss, zombies control large areas, you become part of the resistance.',
                        color: '#FF6347'
                    },
                    '22-28': {
                        title: 'BELOW AVERAGE ENDING #4',
                        description: 'You survived and collected some evidence, can warn other residents, but danger still exists.',
                        color: '#FFA500'
                    },
                    '29-35': {
                        title: 'AVERAGE ENDING #5',
                        description: 'Almost complete survival, most evidence preserved, you discover part of the city\'s secret.',
                        color: '#FFFF00'
                    },
                    '36-42': {
                        title: 'GOOD ENDING #6',
                        description: 'Good survival, you uncover important secrets, some zombies still lurk in the shadows.',
                        color: '#ADFF2F'
                    },
                    '43-49': {
                        title: 'VERY GOOD ENDING #7',
                        description: 'Great success, you collect most evidence, can start plan to drive zombies from city.',
                        color: '#7CFC00'
                    },
                    '50-56': {
                        title: 'EXCELLENT ENDING #8',
                        description: 'Excellent survival, almost all evidence in your possession, but you face new challenges against zombies.',
                        color: '#32CD32'
                    },
                    '57-63': {
                        title: 'SUPERIOR ENDING #9',
                        description: 'You uncover the city\'s secret completely, some zombies turn into rational creatures, the city\'s future changes.',
                        color: '#228B22'
                    },
                    '64-70': {
                        title: 'OUTSTANDING ENDING #10',
                        description: 'Complete success, you become city hero, lead resistance against zombies and secure civilian lives.',
                        color: '#008000'
                    },
                    '71-77': {
                        title: 'GENIUS ENDING #11',
                        description: 'Survival with discovery of way to control some zombies, city under your partial influence.',
                        color: '#006400'
                    },
                    '78-84': {
                        title: 'BRILLIANT ENDING #12',
                        description: 'You discover very dangerous secrets, become target for everyone who wants to steal them, survival difficult and future unknown.',
                        color: '#004d00'
                    },
                    '85-91': {
                        title: 'AMAZING ENDING #13',
                        description: 'Excellent success with collecting all evidence, ability to end zombie threat temporarily, but new dangers appear.',
                        color: '#003300'
                    },
                    '92-99': {
                        title: 'LEGENDARY ENDING #14',
                        description: 'You become resistance leader, city begins to recover, but remains under constant threat.',
                        color: '#002200'
                    },
                    '100-107': {
                        title: 'MYTHICAL ENDING #15',
                        description: 'Legendary success, most zombies destroyed, you gain deep knowledge of infection origin.',
                        color: '#001100'
                    },
                    '108-115': {
                        title: 'EPIC ENDING #16',
                        description: 'Greatest survival, new alliances with other residents, ability to build partially safe community.',
                        color: '#000900'
                    },
                    '116-123': {
                        title: 'ULTIMATE ENDING #17',
                        description: 'You discover ancient techniques to neutralize zombies, city witnesses relative stability.',
                        color: '#000600'
                    },
                    '124-131': {
                        title: 'PERFECT ENDING #18',
                        description: 'Amazing success, you succeed in protecting all civilians, city secrets completely revealed.',
                        color: '#000300'
                    },
                    '132-139': {
                        title: 'GODLY ENDING #19',
                        description: 'Superhero, city under your control, most zombies converted to allies, but new danger appears.',
                        color: '#000100'
                    },
                    '140-147': {
                        title: 'DIVINE ENDING #20',
                        description: 'Complete city control, partially happy ending, but new enemies appear on horizon.',
                        color: '#000000'
                    },
                    '148-155': {
                        title: 'ANGELIC ENDING #21',
                        description: 'Survival with discovery of way to convert zombies to city guardians, beginning of new era.',
                        color: '#000000'
                    },
                    '156-163': {
                        title: 'CELESTIAL ENDING #22',
                        description: 'Amazing success, you become city symbol, all zombies under control.',
                        color: '#000000'
                    },
                    '164-171': {
                        title: 'IMMORTAL ENDING #23',
                        description: 'Legendary survival, city returns to life gradually, you achieve almost all goals.',
                        color: '#000000'
                    },
                    '172-179': {
                        title: 'ETERNAL ENDING #24',
                        description: 'You collect all evidence and save everyone, nearly perfect city, danger new distant.',
                        color: '#000000'
                    },
                    '180': {
                        title: 'LEGENDARY PLAYER ENDING #25',
                        description: 'Legendary player, collects all points, all secrets revealed, all zombies under control, perfect ending completely.',
                        color: '#000000'
                    }
                },
                failureEndings: [
                    'The zombie horde overwhelmed you at {time}!',
                    'The infection spread too quickly at {time}!',
                    'You got trapped without escape at {time}!',
                    'The city fell completely at {time}!',
                    'You became one of them at {time}!'
                ]
            }
            // سيتم إضافة القصص الأخرى هنا بنفس النمط...
            // heist, haunted, undead
        };

        return stories[storyType];
    },

    generateRandomTime() {
        const hours = Math.floor(Math.random() * 4) + 8;
        const minutes = Math.floor(Math.random() * 12) * 5;
        return `${hours}:${minutes.toString().padStart(2, '0')}`;
    },

    createStageEmbed(story, stageId, user, randomTime, totalPoints) {
        if (!story || !story.stages || !story.stages[stageId]) {
            return {
                embed: new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ STAGE NOT FOUND')
                    .setDescription('The requested stage could not be found. Please try again.'),
                components: []
            };
        }

        const stage = story.stages[stageId];
        const scenario = stage.scenario.replace('{time}', randomTime);
        const stageNumber = this.getStageNumber(stageId);

        const difficultyIndicator = this.getDifficultyIndicator(stage.difficulty);

        let optionsText = '';
        for (const [option, data] of Object.entries(stage.answers)) {
            optionsText += `${option}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`▛ ${story.emoji} ${story.title} | Stage ${stageId} ▜`)
            .setDescription(`▌ ${stage.description}\n\n` +
                          `\`\`\`${scenario}\`\`\`\n\n` +
                          `${stage.clues}\n\n` +
                          `▌ ─────────────────────────\n\n` +
                          `**Question**\n${stage.question}\n\n` +
                          `**Options:**\n${optionsText}\n` +
                          `▌ ─────────────────────────`)
            .setColor(story.color)
            .addFields(
                { name: 'Difficulty', value: `${difficultyIndicator} ${stage.difficulty}`, inline: true },
                { name: 'Time', value: randomTime, inline: true },
                { name: 'Time Limit', value: '3:00', inline: true }
            )
            .setFooter({ 
                text: `Player: ${user.username} • Stage ${stageNumber} of ${story.totalStages} • Total Points: ${totalPoints}`, 
                iconURL: user.displayAvatarURL() 
            });

        const actionRows = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('answer_A')
                    .setLabel('A')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('answer_B')
                    .setLabel('B')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('answer_C')
                    .setLabel('C')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('answer_D')
                    .setLabel('D')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('answer_E')
                    .setLabel('E')
                    .setStyle(ButtonStyle.Primary)
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('hint_button')
                    .setLabel('💡 Get Hint')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('abort_button')
                    .setLabel('🚨 Abort Mission')
                    .setStyle(ButtonStyle.Danger)
            )
        ];

        return { embed, components: actionRows, stage };
    },

    getStageNumber(stageId) {
        const parts = stageId.split('-');
        return (parseInt(parts[0]) - 1) * 5 + parseInt(parts[1]);
    },

    getDifficultyIndicator(difficulty) {
        switch(difficulty) {
            case 'easy': return '🟩';
            case 'medium': return '🟨';
            case 'hard': return '🟥';
            default: return '🔷';
        }
    },

    startCountdown(interaction, story, stageId, randomTime, totalPoints) {
        const timeLimit = 180;
        const timerId = `${interaction.user.id}-${interaction.id}`;

        // إلغاء أي مؤقت سابق لنفس المستخدم
        if (activeTimers.has(timerId)) {
            clearTimeout(activeTimers.get(timerId));
            activeTimers.delete(timerId);
        }

        const timeout = setTimeout(async () => {
            await this.handleTimeOut(interaction, story, randomTime);
            activeTimers.delete(timerId);

            // إلغاء الcollector المرتبط أيضاً
            if (activeCollectors.has(timerId)) {
                activeCollectors.get(timerId).stop('timeout');
                activeCollectors.delete(timerId);
            }
        }, timeLimit * 1000);

        activeTimers.set(timerId, timeout);
        this.setupStoryCollector(interaction, story, stageId, randomTime, totalPoints, timerId);
    },

    // عدل دالة handleTimeOut لتتأكد من إرسال رسالة واحدة فقط
    async handleTimeOut(interaction, story, randomTime) {
        // تحقق إذا كانت الرسالة لا تزال موجودة قبل الإرسال
        try {
            await interaction.fetchReply();
        } catch (error) {
            // إذا لم تعد الرسالة موجودة، لا تقم بأي شيء
            return;
        }

        const randomIndex = Math.floor(Math.random() * story.failureEndings.length);
        const failureEnding = story.failureEndings[randomIndex].replace('{time}', randomTime);

        try {
            try {
                await interaction.deleteReply();
            } catch (deleteError) {}

            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('⏰ TIME\'S UP!')
                        .setDescription(`**MISSION FAILED**\n\n${failureEnding}\n\n*The mission has ended in failure.*`)
                        .setImage(process.env.RedLine)
                        .setFooter({ 
                            text: `Player: ${interaction.user.username}`, 
                            iconURL: interaction.user.displayAvatarURL() 
                        })
                ]
            });
        } catch (error) {
            console.error('Error in handleTimeOut:', error);
        }
    },

    setupStoryCollector(interaction, story, currentStageId, randomTime, totalPoints, timerId) {
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 180000
        });

        // تخزين الcollector للإدارة
        activeCollectors.set(timerId, collector);

        collector.on('collect', async i => {
            if (i.customId === 'hint_button') {
                await i.deferUpdate();
                const hint = story.stages[currentStageId].hints[
                    Math.floor(Math.random() * story.stages[currentStageId].hints.length)
                ];

                await i.followUp({
                    content: `💡 **HINT:** ${hint}`,
                    ephemeral: true
                });
                return;
            }

            if (i.customId === 'abort_button') {
                await i.deferUpdate();

                // إلغاء المؤقت
                if (activeTimers.has(timerId)) {
                    clearTimeout(activeTimers.get(timerId));
                    activeTimers.delete(timerId);
                }

                collector.stop('abort');
                activeCollectors.delete(timerId);

                const randomIndex = Math.floor(Math.random() * story.failureEndings.length);
                const failureEnding = story.failureEndings[randomIndex].replace('{time}', randomTime);

                try {
                    await interaction.deleteReply().catch(() => {});
                } catch (error) {}

                await interaction.channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('🚨 MISSION ABORTED')
                            .setImage(process.env.RedLine)
                            .setDescription(`**OPERATION CANCELLED**\n\n${failureEnding}\n\n*The mission has been aborted.*`)
                            .setFooter({ 
                                text: `Player: ${interaction.user.username}`, 
                                iconURL: interaction.user.displayAvatarURL() 
                            })
                    ]
                });
                return;
            }

            if (i.customId.startsWith('answer_')) {
                await i.deferUpdate();

                // إلغاء المؤقت الحالي
                if (activeTimers.has(timerId)) {
                    clearTimeout(activeTimers.get(timerId));
                    activeTimers.delete(timerId);
                }

                const answerLetter = i.customId.replace('answer_', '');

                const options = Object.keys(story.stages[currentStageId].answers);
                const selectedOption = options.find(opt => opt.startsWith(answerLetter + '.'));

                if (selectedOption) {
                    const answerData = story.stages[currentStageId].answers[selectedOption];
                    const newTotalPoints = totalPoints + answerData.points;

                    if (answerData.nextStage === 'end') {
                        await this.completeStory(interaction, story, newTotalPoints, randomTime);
                        collector.stop();
                        activeCollectors.delete(timerId);
                    } else if (answerData.nextStage && story.stages[answerData.nextStage]) {
                        const newRandomTime = this.generateRandomTime();
                        const { embed, components } = this.createStageEmbed(story, answerData.nextStage, interaction.user, newRandomTime, newTotalPoints);

                        await interaction.editReply({ 
                            embeds: [embed], 
                            components: components 
                        });

                        collector.stop();
                        activeCollectors.delete(timerId);
                        this.startCountdown(interaction, story, answerData.nextStage, newRandomTime, newTotalPoints);
                    } else {
                        await this.completeStory(interaction, story, newTotalPoints, randomTime);
                        collector.stop();
                        activeCollectors.delete(timerId);
                    }
                }
            }
        });

        collector.on('end', (collected, reason) => {
            // تنظيف المؤقت إذا انتهى ال collector لأي سبب
            if (activeTimers.has(timerId) && reason !== 'time') {
                clearTimeout(activeTimers.get(timerId));
                activeTimers.delete(timerId);
            }
            activeCollectors.delete(timerId);
        });
    },

    async completeStory(interaction, story, totalPoints, randomTime) {
        try {
            let endingKey = '';
            const storyTitle = story.title;

            if (storyTitle.includes('Astronomer')) {
                if (totalPoints >= 100) endingKey = '100';
                else if (totalPoints >= 76) endingKey = '76-99';
                else if (totalPoints >= 51) endingKey = '51-75';
                else if (totalPoints >= 26) endingKey = '26-50';
                else endingKey = '0-25';
            }
            else if (storyTitle.includes('Pyramids')) {
                if (totalPoints >= 120) endingKey = '120';
                else if (totalPoints >= 97) endingKey = '97-119';
                else if (totalPoints >= 85) endingKey = '85-96';
                else if (totalPoints >= 73) endingKey = '73-84';
                else if (totalPoints >= 61) endingKey = '61-72';
                else if (totalPoints >= 49) endingKey = '49-60';
                else if (totalPoints >= 37) endingKey = '37-48';
                else if (totalPoints >= 25) endingKey = '25-36';
                else if (totalPoints >= 13) endingKey = '13-24';
                else endingKey = '0-12';
            }
            else if (storyTitle.includes('Heist')) {
                if (totalPoints >= 140) endingKey = '140';
                else if (totalPoints >= 118) endingKey = '118-139';
                else if (totalPoints >= 109) endingKey = '109-117';
                else if (totalPoints >= 100) endingKey = '100-108';
                else if (totalPoints >= 91) endingKey = '91-99';
                else if (totalPoints >= 82) endingKey = '82-90';
                else if (totalPoints >= 73) endingKey = '73-81';
                else if (totalPoints >= 64) endingKey = '64-72';
                else if (totalPoints >= 55) endingKey = '55-63';
                else if (totalPoints >= 46) endingKey = '46-54';
                else if (totalPoints >= 37) endingKey = '37-45';
                else if (totalPoints >= 28) endingKey = '28-36';
                else if (totalPoints >= 19) endingKey = '19-27';
                else if (totalPoints >= 10) endingKey = '10-18';
                else endingKey = '0-9';
            }
            else if (storyTitle.includes('Haunted')) {
                if (totalPoints >= 160) endingKey = '160';
                else if (totalPoints >= 141) endingKey = '141-159';
                else if (totalPoints >= 133) endingKey = '133-140';
                else if (totalPoints >= 125) endingKey = '125-132';
                else if (totalPoints >= 117) endingKey = '117-124';
                else if (totalPoints >= 109) endingKey = '109-116';
                else if (totalPoints >= 101) endingKey = '101-108';
                else if (totalPoints >= 93) endingKey = '93-100';
                else if (totalPoints >= 85) endingKey = '85-92';
                else if (totalPoints >= 77) endingKey = '77-84';
                else if (totalPoints >= 69) endingKey = '69-76';
                else if (totalPoints >= 61) endingKey = '61-68';
                else if (totalPoints >= 53) endingKey = '53-60';
                else if (totalPoints >= 45) endingKey = '45-52';
                else if (totalPoints >= 37) endingKey = '37-44';
                else if (totalPoints >= 29) endingKey = '29-36';
                else if (totalPoints >= 21) endingKey = '21-28';
                else if (totalPoints >= 13) endingKey = '13-20';
                else if (totalPoints >= 6) endingKey = '6-12';
                else endingKey = '0-5';
            }
            else if (storyTitle.includes('Undead')) {
                if (totalPoints >= 180) endingKey = '180';
                else if (totalPoints >= 172) endingKey = '172-179';
                else if (totalPoints >= 164) endingKey = '164-171';
                else if (totalPoints >= 156) endingKey = '156-163';
                else if (totalPoints >= 148) endingKey = '148-155';
                else if (totalPoints >= 140) endingKey = '140-147';
                else if (totalPoints >= 132) endingKey = '132-139';
                else if (totalPoints >= 124) endingKey = '124-131';
                else if (totalPoints >= 116) endingKey = '116-123';
                else if (totalPoints >= 108) endingKey = '108-115';
                else if (totalPoints >= 100) endingKey = '100-107';
                else if (totalPoints >= 92) endingKey = '92-99';
                else if (totalPoints >= 85) endingKey = '85-91';
                else if (totalPoints >= 78) endingKey = '78-84';
                else if (totalPoints >= 71) endingKey = '71-77';
                else if (totalPoints >= 64) endingKey = '64-70';
                else if (totalPoints >= 57) endingKey = '57-63';
                else if (totalPoints >= 50) endingKey = '50-56';
                else if (totalPoints >= 43) endingKey = '43-49';
                else if (totalPoints >= 36) endingKey = '36-42';
                else if (totalPoints >= 29) endingKey = '29-35';
                else if (totalPoints >= 22) endingKey = '22-28';
                else if (totalPoints >= 15) endingKey = '15-21';
                else if (totalPoints >= 8) endingKey = '8-14';
                else endingKey = '0-7';
            }
            // Add other story ending calculations here...

            const ending = story.endings[endingKey];

            const saveResult = await dbManager.saveStoryProgress(
                interaction.user.id, 
                interaction.user.username, 
                story.title, 
                endingKey,
                totalPoints
            );

            if (!saveResult.success) {
                console.error('Failed to save story progress:', saveResult.error);
            }

            const successEmbed = new EmbedBuilder()
                .setColor(ending.color || story.color)
                .setTitle('🎉 MISSION ACCOMPLISHED!')
                .setImage(process.env.BLueLine)
                .setDescription(`**${ending.title}**\n\n${ending.description}\n\n` +
                              `**Total Points:** ${totalPoints}\n` +
                              `**Completed at:** ${randomTime}`)
                .setFooter({ 
                    text: `Player: ${interaction.user.username} • ${story.title}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            try {
                await interaction.deleteReply().catch(() => {});
            } catch (error) {}

            await interaction.channel.send({ 
                embeds: [successEmbed]
            });

        } catch (error) {
            console.error('Error completing story:', error);
            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ SYSTEM ERROR')
                        .setImage(process.env.RedLine)
                        .setDescription('An error occurred while saving your progress. Mission data may be incomplete.')
                        .setFooter({ 
                            text: `Player: ${interaction.user.username}`, 
                            iconURL: interaction.user.displayAvatarURL() 
                        })
                ]
            });
        }
    }
};