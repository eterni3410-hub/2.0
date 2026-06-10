/* ===============================
   PokeChaos — Full RPG Discord Bot
   CLEANED + FIXED + IMPROVED
   =============================== */

// ===============================
// IMPORTS
// ===============================

const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField,
    EmbedBuilder
} = require("discord.js");

const fetch = require("node-fetch");
const ms = require("ms");
const fs = require("fs");
const path = require("path");

// ===============================
// SIMPLE JSON DATABASE (chaosdata.json)
// ===============================

const DB_PATH = path.join(__dirname, "chaosdata.json");

if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ coins: {} }, null, 2));
}

function readDB() {
    try {
        const raw = fs.readFileSync(DB_PATH, "utf8");
        return JSON.parse(raw);
    } catch {
        return { coins: {} };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let dbData = readDB();

// ===============================
// USER DATA STRUCTURES
// ===============================

let userInventory = {};
let userAFK = {};
let userReminders = [];
let activeGiveaways = {};
let userPokemon = {};

// ===============================
// UNIVERSAL EMBED STYLE
// ===============================

function chaosEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle(title)
        .setDescription(description);
}

// ===============================
// UNIFIED ECONOMY SYSTEM
// ===============================

function getCoins(userId) {
    return dbData.coins[userId] || 0;
}

function addCoins(userId, amount) {
    const current = getCoins(userId);
    dbData.coins[userId] = current + amount;
    writeDB(dbData);
}

function removeCoins(userId, amount) {
    const current = getCoins(userId);
    dbData.coins[userId] = Math.max(0, current - amount);
    writeDB(dbData);
}

// ===============================
// KEYS (USE ENV VARIABLES)
// ===============================

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;

// ===============================
// DISCORD CLIENT
// ===============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

client.once("ready", () => {
    console.log(`Bot is fully online as ${client.user.tag}`);
});

// ===============================
// GLOBALS
// ===============================

const PREFIX = ">";
const commands = {};

const aiChatEnabled = {};

const economy = {};
const dailyCooldown = {};

const unoGames = {};
const hangmanGames = {};
const hangmanWords = ["apple", "banana", "dragon", "pokemon", "discord", "chaos"];

const casinoCooldown = new Map();
const blackjackGames = new Map();
const JACKPOT_KEY = "casino_jackpot";
const bossSpawns = {};

let messageCount = 0;
const spawnThreshold = 15;

const channelSpawns = {};

// ===============================
// COMMAND HANDLER (START)
// ===============================

client.on("messageCreate", async (msg) => {
    if (!msg.guild) return;
    if (msg.author.bot) return;
    if (!msg.content.startsWith(PREFIX)) return;

    const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // ===============================
    // UNIVERSAL COMMAND EXECUTOR
    // ===============================
    if (commands[cmd]) {
        try {
            return commands[cmd](msg, args);
        } catch (err) {
            console.error(err);
            return msg.reply("❌ Error running command.");
        }
    }
    // -----------------------------
    // PING
    // -----------------------------
    if (cmd === "ping") {
        return msg.reply("Pong!");
    }

    // ===============================
    // HELP COMMAND
    // ===============================
    if (cmd === "help") {
        const CYAN = 0x0f859d;

        const page1 = new EmbedBuilder()
            .setColor(CYAN)
            .setTitle("🎮 Game Commands")
            .setDescription(
                "**>uno** — Start a UNO match\n" +
                "**>unoplay** — Play a card\n" +
                "**>unotake** — Draw a card\n" +
                "**>hangman** — Start Hangman\n" +
                "**>hangmanend** — End Hangman\n" +
                "**>guess** — Number guessing game\n"
            );

        const page2 = new EmbedBuilder()
            .setColor(CYAN)
            .setTitle("🎰 Gambling & Casino")
            .setDescription(
                "**>coinflip** — Flip a coin\n" +
                "**>slots** — Spin the slot machine\n" +
                "**>blackjack** — Start blackjack\n" +
                "**>hit** — Hit in blackjack\n" +
                "**>stand** — Stand in blackjack\n" +
                "**>daily** — Claim daily reward\n" +
                "**>balance** — Check your coins\n" +
                "**>give** — Give coins to another user\n" +
                "**>leaderboard** — Top richest players\n"
            );

        const page3 = new EmbedBuilder()
            .setColor(CYAN)
            .setTitle("🐉 Pokémon Commands")
            .setDescription(
                "**>pokemon** — View your Pokémon\n" +
                "**>pokedex** — View Pokédex\n" +
                "**>spawn** — Spawn a Pokémon\n" +
                "**>catch** — Catch a Pokémon\n" +
                "**>catchwild** — Catch wild Pokémon\n" +
                "**>team** — View your team\n" +
                "**>release** — Release a Pokémon\n" +
                "**>trade** — Trade with someone\n" +
                "**>fight** — Battle another player\n" +
                "**>boss** — Spawn a boss\n" +
                "**>fightboss** — Fight the boss\n" +
                "**>gigantamax** — Gigantamax a Pokémon\n" +
                "**>mega** — Mega evolve\n" +
                "**>shop** — Pokémon shop\n" +
                "**>buy** — Buy items\n" +
                "**>use** — Use an item\n"
            );

        const page4 = new EmbedBuilder()
            .setColor(CYAN)
            .setTitle("🧭 Utility Commands")
            .setDescription(
                "**>ping** — Bot latency\n" +
                "**>uptime** — Bot uptime\n" +
                "**>afk** — Set AFK status\n" +
                "**>reminder** — Set a reminder\n" +
                "**>profile** — View your profile\n" +
                "**>inventory** — View your items\n"
            );

        const page5 = new EmbedBuilder()
            .setColor(CYAN)
            .setTitle("🔒 Owner‑Only Commands")
            .setDescription(
                "**>ownerspawn** — Spawn a Pokémon\n" +
                "**>ownercoins** — Give coins\n" +
                "**>ownerreset** — Reset a user\n" +
                "**>ownerwipe** — Wipe all data\n"
            );

        const pages = [page1, page2, page3, page4, page5];
        let currentPage = 0;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("prev").setLabel("◀️").setStyle(1),
            new ButtonBuilder().setCustomId("next").setLabel("▶️").setStyle(1)
        );

        const sent = await msg.reply({
            embeds: [pages[currentPage]],
            components: [row]
        });

        const collector = sent.createMessageComponentCollector({ time: 60000 });

        collector.on("collect", async (i) => {
            if (i.user.id !== msg.author.id)
                return i.reply({ content: "This menu isn't for you.", ephemeral: true });

            if (i.customId === "prev") {
                currentPage = currentPage === 0 ? pages.length - 1 : currentPage - 1;
            } else {
                currentPage = currentPage === pages.length - 1 ? 0 : currentPage + 1;
            }

            await i.update({
                embeds: [pages[currentPage]],
                components: [row]
            });
        });

        collector.on("end", () => {
            sent.edit({ components: [] }).catch(() => {});
        });

        return;
    }

       // ===============================
    // PREMIUM ANIMATED SLOTS
    // ===============================
    if (cmd === "slots") {
        (async () => {

            const bet = parseInt(args[0]);
            if (!bet || bet <= 0) return msg.reply("Enter a valid bet amount.");

            const bal = getCoins(msg.author.id);
            if (bal < bet) return msg.reply("You don't have enough coins.");

            const symbols = ["💎", "⭐", "🍀", "🔥", "7️⃣", "💰"];

            const spin = () => [
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)],
                symbols[Math.floor(Math.random() * symbols.length)]
            ];

            const frame1 = ["⬜", "⬜", "⬜"];
            const frame2 = ["🔄", "⬜", "⬜"];
            const frame3 = ["🔄", "🔄", "⬜"];
            const frame4 = ["🔄", "🔄", "🔄"];

            const final = spin();

            const msgSlot = await msg.channel.send(
                `🎰 **SLOTS**\n[ ${frame1[0]} | ${frame1[1]} | ${frame1[2]} ]`
            );

            setTimeout(() => {
                msgSlot.edit(`🎰 **SLOTS**\n[ ${frame2[0]} | ${frame2[1]} | ${frame2[2]} ]`);
            }, 500);

            setTimeout(() => {
                msgSlot.edit(`🎰 **SLOTS**\n[ ${frame3[0]} | ${frame3[1]} | ${frame3[2]} ]`);
            }, 900);

            setTimeout(() => {
                msgSlot.edit(`🎰 **SLOTS**\n[ ${frame4[0]} | ${frame4[1]} | ${frame4[2]} ]`);
            }, 1300);

            setTimeout(() => {
                const [a, b, c] = final;

                let resultText = "";
                let winAmount = 0;

                if (a === b && b === c) {
                    winAmount = bet * 5;
                    addCoins(msg.author.id, winAmount);
                    resultText = `🎉 **JACKPOT!** Triple ${a}!\nYou won **${winAmount}** coins!`;
                } else if (a === b || b === c || a === c) {
                    winAmount = bet * 2;
                    addCoins(msg.author.id, winAmount);
                    resultText = `✨ Nice! You matched two symbols!\nYou won **${winAmount}** coins!`;
                } else {
                    removeCoins(msg.author.id, bet);
                    resultText = `💀 You lost **${bet}** coins.`;
                }

                msgSlot.edit(
                    `🎰 **SLOTS**\n[ ${a} | ${b} | ${c} ]\n\n${resultText}`
                );
            }, 2000);

        })();
    }

// ===============================
// BOSS GENERATOR
// ===============================

function generateBoss() {
    const bosses = [
        { name: "Mega Charizard X", hp: 600, sprite: "https://img.pokemondb.net/artwork/large/charizard-mega-x.jpg" },
        { name: "Rayquaza", hp: 750, sprite: "https://img.pokemondb.net/artwork/large/rayquaza.jpg" },
        { name: "Giratina (Origin)", hp: 800, sprite: "https://img.pokemondb.net/artwork/large/giratina-origin.jpg" },
        { name: "Zacian (Crowned)", hp: 850, sprite: "https://img.pokemondb.net/artwork/large/zacian-crowned.jpg" }
    ];

    return bosses[Math.floor(Math.random() * bosses.length)];
}

// ===============================
// >boss — Spawn or Show Boss
// ===============================

commands.boss = async (message) => {
    const channelId = message.channel.id;

    if (!bossSpawns[channelId]) {
        const newBoss = generateBoss();
        bossSpawns[channelId] = {
            name: newBoss.name,
            hp: newBoss.hp,
            maxHp: newBoss.hp,
            sprite: newBoss.sprite
        };
    }

    const boss = bossSpawns[channelId];

    const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`⚠️ Boss Appeared: ${boss.name}`)
        .setDescription(
            `❤️ **HP:** ${boss.hp}/${boss.maxHp}\n` +
            `⚔️ Use \`>fightboss\` to attack!`
        )
        .setImage(boss.sprite);

    return message.reply({ embeds: [embed] });
};

// ===============================
// >fightboss — Attack the Boss
// ===============================

commands.fightboss = async (message) => {
    const channelId = message.channel.id;
    const boss = bossSpawns[channelId];

    if (!boss) {
        return message.reply("❌ No boss is currently active! Use `>boss` to spawn one.");
    }

    // Player damage (random 40–120)
    const dmg = Math.floor(Math.random() * 80) + 40;
    boss.hp = Math.max(0, boss.hp - dmg);

    let text = `⚔️ **You attack ${boss.name}!**\n`;
    text += `💥 Damage dealt: **${dmg}**\n`;
    text += `❤️ Boss HP: **${boss.hp}/${boss.maxHp}**\n\n`;

    // Boss defeated
    if (boss.hp <= 0) {
        const reward = Math.floor(Math.random() * 400) + 200;

        // ⭐ FIXED — use real QuickDB economy
        await addCoins(message.author.id, reward);

        text += `🎉 **You defeated the boss!**\n`;
        text += `💰 Reward: **${reward} coins**\n`;

        delete bossSpawns[channelId];
    }

    return message.reply(text);
};

// ===============================
// HELPER FUNCTIONS
// ===============================

// ⭐ ALL OLD ECONOMY CODE REMOVED — it was breaking bossSpawns

function formatHangmanWord(word, guessed) {
    return [...word].map(c => guessed.includes(c) ? c : "-").join("");
}

const unoDeck = [
    "R1","R2","R3","R4","R5","R6","R7","R8","R9",
    "G1","G2","G3","G4","G5","G6","G7","G8","G9",
    "B1","B2","B3","B4","B5","B6","B7","B8","B9",
    "Y1","Y2","Y3","Y4","Y5","Y6","Y7","Y8","Y9"
];

function drawUnoCard() {
    return unoDeck[Math.floor(Math.random() * unoDeck.length)];
}

function drawCard() {
    const cards = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
    return cards[Math.floor(Math.random() * cards.length)];
}

function calculateHand(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        if (card === "A") {
            aces++;
            total += 11;
        } else if (["J","Q","K"].includes(card)) {
            total += 10;
        } else {
            total += parseInt(card);
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
}

// ===============================
// MODERATION COMMANDS
// ===============================

commands.kick = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot kick members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to kick.")] });

    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
        await target.kick(reason);
        message.reply({ embeds: [chaosEmbed("🦵 User Kicked", `${target.user.tag} was kicked.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not kick this user.")] });
    }
};

commands.ban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot ban members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to ban.")] });

    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
        await target.ban({ reason });
        message.reply({ embeds: [chaosEmbed("🔨 User Banned", `${target.user.tag} was banned.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not ban this user.")] });
    }
};

commands.unban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot unban members.")] });

    const userId = args[0];
    if (!userId) return message.reply({ embeds: [chaosEmbed("🆔 Missing ID", "Provide a user ID to unban.")] });

    try {
        await message.guild.members.unban(userId);
        message.reply({ embeds: [chaosEmbed("🔓 User Unbanned", `Unbanned ID: ${userId}`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not unban this user.")] });
    }
};

commands.mute = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot mute members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to mute.")] });

    const duration = args[1] || "10m";

    try {
        await target.timeout(ms(duration));
        message.reply({ embeds: [chaosEmbed("🔇 User Muted", `${target.user.tag} muted for ${duration}.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not mute this user.")] });
    }
};

commands.unmute = async (message) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot unmute members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to unmute.")] });

    try {
        await target.timeout(null);
        message.reply({ embeds: [chaosEmbed("🔊 User Unmuted", `${target.user.tag} is now unmuted.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not unmute this user.")] });
    }
};

commands.clear = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot clear messages.")] });

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100)
        return message.reply({ embeds: [chaosEmbed("🔢 Invalid Number", "Choose between 1 and 100.")] });

    try {
        await message.channel.bulkDelete(amount, true);
        message.reply({ embeds: [chaosEmbed("🧹 Messages Deleted", `${amount} messages removed.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not delete messages.")] });
    }
};
// ===============================
// OWNER SPAWN SYSTEM
// ===============================

// Simple data file for saving spawned Pokémon
const DATA_PATH = path.join(__dirname, "pokedata.json");

function loadData() {
    try {
        const raw = fs.readFileSync(DATA_PATH, "utf8");
        return JSON.parse(raw);
    } catch {
        return { userPokemon: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

let persistentData = loadData();
if (!persistentData.userPokemon) persistentData.userPokemon = {};
const savedUserPokemon = persistentData.userPokemon;

// ===============================
// OWNERSPAWN COMMAND
// ===============================

commands.ownerspawn = async (message, args) => {
    // Only bot owner can use this
    const ownerId = "YOUR_OWNER_ID_HERE";
    if (message.author.id !== ownerId) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Access", "Only the bot owner can spawn special Pokémon.")]
        });
    }

    const targetUser = message.mentions.users.first() || message.author;
    const pokemonName = (args[0] || "").toLowerCase();

    if (!pokemonName) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing Name", "You must specify a Pokémon name to spawn.")]
        });
    }

    // Initialize user storage
    if (!savedUserPokemon[targetUser.id]) {
        savedUserPokemon[targetUser.id] = [];
    }

    // Add Pokémon to user
    savedUserPokemon[targetUser.id].push(pokemonName);
    saveData(persistentData);

    const spawnEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("✨ OWNER SPAWN")
        .setDescription(
            `👑 **Owner Spawned:** \`${pokemonName}\`\n` +
            `🎟 **Given To:** ${targetUser}\n\n` +
            `📦 This Pokémon has been **saved** to their collection.`
        )
        .setFooter({ text: "PokeChaos • Special Spawn" })
    return message.reply({ embeds: [spawnEmbed] });
};


// ===============================
// SYNC OWNERSPAWN WITH RUNTIME userPokemon
// ===============================

function syncSavedToRuntime() {
    Object.keys(savedUserPokemon).forEach((id) => {
        if (!userPokemon[id]) userPokemon[id] = [];
        savedUserPokemon[id].forEach((p) => {
            if (!userPokemon[id].includes(p)) {
                userPokemon[id].push(p);
            }
        });
    });
}

// Call once on startup after userPokemon is defined
syncSavedToRuntime();

// ===============================
// CATCH (FIXED)
// ===============================

commands.catch = async (message) => {
    if (!global.activeSpawn) {
        return message.reply({ embeds: [chaosEmbed("❌ No Pokémon", "There is nothing to catch.")] });
    }

    if (global.activeSpawn.channel !== message.channel.id) {
        return message.reply({ embeds: [chaosEmbed("❌ Wrong Channel", "The Pokémon is not here.")] });
    }

    const caught = global.activeSpawn.name;
    delete global.activeSpawn;

    return message.reply({ embeds: [chaosEmbed("🎉 Pokémon Caught!", `You caught **${caught}**!`)] });
};

// ===============================
// UNO GAME
// ===============================

commands.uno = async (message, args) => {
    const sub = args[0];
    const guildId = message.guild.id;

    if (!sub) {
        return message.reply({
            embeds: [
                chaosEmbed("🟥 UNO Commands",
                "`>uno start`\n`>uno join`\n`>uno hand`\n`>uno draw`\n`>uno play <card>`\n`>uno end`")
            ]
        });
    }

    if (sub === "start") {
        if (unoGames[guildId])
            return message.reply({ embeds: [chaosEmbed("🟥 Already Running", "An UNO game is already active.")] });

        unoGames[guildId] = {
            players: {},
            order: [],
            topCard: drawUnoCard(),
            started: true
        };

        return message.reply({
            embeds: [
                chaosEmbed("🟥 UNO Started!", `Top card: \`${unoGames[guildId].topCard}\``)
            ]
        });
    }

    if (sub === "join") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        if (game.players[message.author.id])
            return message.reply({ embeds: [chaosEmbed("🟥 Already Joined", "You are already in the game.")] });

        game.players[message.author.id] = [
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard()
        ];

        game.order.push(message.author.id);

        return message.reply({ embeds: [chaosEmbed("🟥 Joined UNO", `${message.author.username} joined the game.`)] });
    }

    if (sub === "hand") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        const hand = game.players[message.author.id];
        if (!hand) return message.reply({ embeds: [chaosEmbed("🟥 Not Playing", "You are not in the game.")] });

        try {
            await message.author.send(`🟥 **Your Uno hand:** ${hand.join(", ")}`);
            message.reply({ embeds: [chaosEmbed("📩 Sent", "Your hand was sent in DMs.")] });
        } catch {
            message.reply({ embeds: [chaosEmbed("⚠️ DM Blocked", "Enable DMs to receive your hand.")] });
        }
    }

    if (sub === "draw") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        const hand = game.players[message.author.id];
        if (!hand) return message.reply({ embeds: [chaosEmbed("🟥 Not Playing", "You are not in the game.")] });

        const card = drawUnoCard();
        hand.push(card);

        return message.reply({ embeds: [chaosEmbed("🟥 Card Drawn", `${message.author.username} drew a card.`)] });
    }

    if (sub === "play") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        const hand = game.players[message.author.id];
        if (!hand) return message.reply({ embeds: [chaosEmbed("🟥 Not Playing", "You are not in the game.")] });

        const card = args[1];
        if (!card) return message.reply({ embeds: [chaosEmbed("🟥 Missing Card", "Example: `>uno play R5`")] });

        if (!hand.includes(card))
            return message.reply({ embeds: [chaosEmbed("🟥 Invalid Card", "You don't have that card.")] });

        const top = game.topCard;
        if (card[0] !== top[0] && card[1] !== top[1])
            return message.reply({ embeds: [chaosEmbed("🟥 No Match", "Card does not match color or number.")] });

        game.topCard = card;
                game.players[message.author.id] = hand.filter(c => c !== card);

        return message.reply({
            embeds: [
                chaosEmbed(
                    "🟥 Card Played",
                    `${message.author.username} played \`${card}\`.\nNew top card: \`${card}\``
                )
            ]
        });
    }

    if (sub === "end") {
        if (!unoGames[guildId])
            return message.reply({
                embeds: [chaosEmbed("🟥 No Game", "There is no UNO game running.")]
            });

        delete unoGames[guildId];

        return message.reply({
            embeds: [chaosEmbed("🟥 UNO Ended", "The UNO game has been closed.")]
        });
    }
};

// ===============================
// HANGMAN GAME
// ===============================
commands.hangman = async (message, args) => {
    const guildId = message.guild.id;

    if (hangmanGames[guildId]) {
        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎮 Hangman Already Running",
                    "A game is already active! Use `>guess <letter>` to play."
                )
            ]
        });
    }

    const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
    hangmanGames[guildId] = {
        word,
        guessed: [],
        wrong: 0
    };

    const display = formatHangmanWord(word, []);

    return message.reply({
        embeds: [
            chaosEmbed(
                "🎮 Hangman Started!",
                `Word: \`${display}\`\nWrong guesses: **0/6**`
            )
        ]
    });
};

commands.guess = async (message, args) => {
    const guildId = message.guild.id;
    const game = hangmanGames[guildId];

    if (!game) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ No Game", "Start a game with `>hangman`.")]
        });
    }

    const letter = args[0]?.toLowerCase();
    if (!letter || letter.length !== 1 || !/[a-z]/.test(letter)) {
        return message.reply({
            embeds: [
                chaosEmbed("⚠️ Invalid Guess", "Guess a single letter. Example: `>guess a`")
            ]
        });
    }

    if (game.guessed.includes(letter)) {
        return message.reply({
            embeds: [
                chaosEmbed("🔁 Already Guessed", `You've already guessed **${letter}**.`)
            ]
        });
    }

    game.guessed.push(letter);

    if (!game.word.includes(letter)) {
        game.wrong++;

        if (game.wrong >= 6) {
            delete hangmanGames[guildId];
            return message.reply({
                embeds: [
                    chaosEmbed(
                        "💀 Hangman Lost",
                        `The word was **${game.word}**.\nBetter luck next time!`
                    )
                ]
            });
        }
    }

    const display = formatHangmanWord(game.word, game.guessed);

    if (!display.includes("-")) {
        delete hangmanGames[guildId];
        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎉 Hangman Won!",
                    `You guessed the word: **${game.word}**!`
                )
            ]
        });
    }

    return message.reply({
        embeds: [
            chaosEmbed(
                "🎮 Hangman",
                `Word: \`${display}\`\nWrong guesses: **${game.wrong}/6**`
            )
        ]
    });
};

commands.hangmanend = async (message) => {
    const guildId = message.guild.id;

    if (!hangmanGames[guildId]) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ No Game", "There is no Hangman game running.")
            ]
        });
    }

    delete hangmanGames[guildId];

    return message.reply({
        embeds: [
            chaosEmbed("🛑 Hangman Ended", "The Hangman game has been stopped.")
        ]
    });
};
// ===============================
// UNIFIED ECONOMY SYSTEM (QuickDB v9)
// ===============================

async function getCoins(userId) {
    const coins = await db.get(`coins_${userId}`);
    return coins ?? 0; // start at 0, not 100
}

async function addCoins(userId, amount) {
    const current = await getCoins(userId);
    await db.set(`coins_${userId}`, current + amount);
}

async function removeCoins(userId, amount) {
    const current = await getCoins(userId);
    const newAmount = Math.max(0, current - amount);
    await db.set(`coins_${userId}`, newAmount);
}


// ===============================
// PREMIUM ANIMATED CASINO SYSTEM
// ===============================

// Assumes:
// - getCoins(userId)
// - addCoins(userId, amount)
// - removeCoins(userId, amount)
// - commands object exists


// Helper: cooldown check (5s)
function canUseCasino(userId) {
    const now = Date.now();
    const last = casinoCooldown.get(userId) || 0;
    if (now - last < 5000) return false;
    casinoCooldown.set(userId, now);
    return true;
}

// Helper: get jackpot
async function getJackpot() {
    const val = await db.get(JACKPOT_KEY);
    return val || 0;
}

// Helper: add to jackpot
async function addToJackpot(amount) {
    const current = await getJackpot();
    await db.set(JACKPOT_KEY, current + amount);
}

// Helper: reset jackpot
async function resetJackpot() {
    await db.set(JACKPOT_KEY, 0);
}

// ===============================
// SLOTS (Animated 3x3, jackpots, near-miss)
// ===============================

const slotSymbols = [
    { emoji: "🍒", weight: 30, payout: 2 },
    { emoji: "🍋", weight: 25, payout: 3 },
    { emoji: "🍇", weight: 20, payout: 4 },
    { emoji: "⭐", weight: 15, payout: 6 },
    { emoji: "💎", weight: 8, payout: 10 },
    { emoji: "👑", weight: 2, payout: 50 } // jackpot symbol
];

function rollSymbol() {
    const total = slotSymbols.reduce((a, s) => a + s.weight, 0);
    let r = Math.random() * total;
    for (const s of slotSymbols) {
        if (r < s.weight) return s;
        r -= s.weight;
    }
    return slotSymbols[0];
}

function formatReels(reels) {
    return (
        `${reels[0][0].emoji} | ${reels[0][1].emoji} | ${reels[0][2].emoji}\n` +
        `${reels[1][0].emoji} | ${reels[1][1].emoji} | ${reels[1][2].emoji}\n` +
        `${reels[2][0].emoji} | ${reels[2][1].emoji} | ${reels[2][2].emoji}`
    );
}

function calculateSlotsWin(reels, bet) {
    let multiplier = 0;
    let jackpotHit = false;

    // Check middle row for main win
    const mid = reels[1];
    if (mid[0].emoji === mid[1].emoji && mid[1].emoji === mid[2].emoji) {
        multiplier = mid[0].payout;
        if (mid[0].emoji === "👑") jackpotHit = true;
    }

    // Small bonus for diagonals
    const diag1 = [reels[0][0], reels[1][1], reels[2][2]];
    const diag2 = [reels[0][2], reels[1][1], reels[2][0]];
    if (diag1.every(s => s.emoji === diag1[0].emoji)) multiplier += Math.floor(diag1[0].payout / 2);
    if (diag2.every(s => s.emoji === diag2[0].emoji)) multiplier += Math.floor(diag2[0].payout / 2);

    const win = bet * multiplier;
    return { win, multiplier, jackpotHit };
}

commands.slots = async (message, args) => {
    const userId = message.author.id;

    if (!canUseCasino(userId)) {
        return message.reply("⏳ Slow down! Wait a few seconds before spinning again.");
    }

    const bet = parseInt(args[0]) || 10;
    if (bet <= 0) return message.reply("🎰 Bet must be a positive number.");
    if (bet > 100000) return message.reply("🎰 Max bet is 100,000 coins.");

    const coins = await getCoins(userId);
    if (coins < bet) return message.reply("💸 You don't have enough coins for that bet.");

    await removeCoins(userId, bet);
    await addToJackpot(Math.floor(bet * 0.1)); // 10% to jackpot

    // Animated reels
    const spinningMsg = await message.reply("🎰 Spinning the reels...\n[ 🎞️ | 🎞️ | 🎞️ ]\n[ 🎞️ | 🎞️ | 🎞️ ]\n[ 🎞️ | 🎞️ | 🎞️ ]");

    const reels = [
        [rollSymbol(), rollSymbol(), rollSymbol()],
        [rollSymbol(), rollSymbol(), rollSymbol()],
        [rollSymbol(), rollSymbol(), rollSymbol()]
    ];

    const { win, multiplier, jackpotHit } = calculateSlotsWin(reels, bet);
    const jackpot = await getJackpot();

    let resultText = `🎰 **Premium Slots** — Bet: ${bet} coins\n\n`;
    resultText += formatReels(reels) + "\n\n";

    if (win > 0) {
        await addCoins(userId, win);
        resultText += `✨ You won **${win} coins** (x${multiplier})!\n`;
    } else {
        resultText += "💀 No win this time...\n";
    }

    if (jackpotHit) {
        await addCoins(userId, jackpot);
        await resetJackpot();
        resultText += `👑 **JACKPOT!** You also won the jackpot of **${jackpot} coins!**\n`;
    } else {
        // Near-miss tease
        resultText += `💰 Current jackpot: **${jackpot} coins**\n`;
    }

    await spinningMsg.edit(resultText);
};

// ===============================
// COINFLIP (streaks, all-in mode)
// ===============================

const streakKey = id => `cf_streak_${id}`;

async function getStreak(id) {
    return (await db.get(streakKey(id))) || 0;
}

async function setStreak(id, val) {
    await db.set(streakKey(id), val);
}

commands.coinflip = async (message, args) => {
    const userId = message.author.id;

    if (!canUseCasino(userId)) {
        return message.reply("⏳ Slow down! Wait a few seconds before flipping again.");
    }

    let betArg = args[0]?.toLowerCase();
    const choice = (args[1]?.toLowerCase() === "tails") ? "tails" : "heads";

    const coins = await getCoins(userId);
    let bet = 0;

    if (betArg === "all" || betArg === "all-in") {
        bet = coins;
    } else {
        bet = parseInt(betArg) || 10;
    }

    if (bet <= 0) return message.reply("🪙 Bet must be a positive number.");
    if (bet > coins) return message.reply("💸 You don't have enough coins for that bet.");
    if (bet > 200000) return message.reply("🪙 Max coinflip bet is 200,000 coins.");

    await removeCoins(userId, bet);

    const streak = await getStreak(userId);
    const bonusMultiplier = 1 + Math.min(streak * 0.1, 1.0); // up to x2

    const flip = Math.random() < 0.5 ? "heads" : "tails";

    let text = `🪙 **Coinflip** — Bet: ${bet} coins\nYou chose **${choice.toUpperCase()}**...\n\n`;
    text += `🌀 The coin spins...\n`;

    await message.channel.send("🌀 ...");

    text += `🪙 It lands on **${flip.toUpperCase()}**!\n\n`;

    if (flip === choice) {
        const win = Math.floor(bet * 2 * bonusMultiplier);
        await addCoins(userId, win);
        await setStreak(userId, streak + 1);
        text += `✅ You **WIN**! You receive **${win} coins** (streak x${bonusMultiplier.toFixed(1)}).\n`;
        text += `🔥 Win streak: **${streak + 1}**\n`;
    } else {
        await setStreak(userId, 0);
        text += `❌ You **LOSE**. Better luck next time.\n`;
        text += `💤 Win streak reset.\n`;
    }

    await message.reply(text);
};

// ===============================
// BLACKJACK (multi-round, animated)
// ===============================

function drawCard() {
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    const suits = ["♠", "♥", "♦", "♣"];
    const rank = ranks[Math.floor(Math.random() * ranks.length)];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    return { rank, suit };
}

function cardValue(card) {
    if (["J", "Q", "K"].includes(card.rank)) return 10;
    if (card.rank === "A") return 11;
    return parseInt(card.rank);
}

function handValue(hand) {
    let total = hand.reduce((sum, c) => sum + cardValue(c), 0);
    let aces = hand.filter(c => c.rank === "A").length;
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function formatHand(hand) {
    return hand.map(c => `${c.rank}${c.suit}`).join(" ");
}

commands.blackjack = async (message, args) => {
    const userId = message.author.id;

    if (!canUseCasino(userId)) {
        return message.reply("⏳ Slow down! Wait a few seconds before playing again.");
    }

    const bet = parseInt(args[0]) || 50;
    if (bet <= 0) return message.reply("🃏 Bet must be a positive number.");
    if (bet > 200000) return message.reply("🃏 Max blackjack bet is 200,000 coins.");

    const coins = await getCoins(userId);
    if (coins < bet) return message.reply("💸 You don't have enough coins for that bet.");

    await removeCoins(userId, bet);

    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];

    const game = {
        bet,
        playerHand,
        dealerHand,
        finished: false
    };

    blackjackGames.set(userId, game);

    let text = `🃏 **Blackjack** — Bet: ${bet} coins\n\n`;
    text += `🧍 Your hand: ${formatHand(playerHand)} (Total: ${handValue(playerHand)})\n`;
    text += `🏦 Dealer shows: ${formatHand([dealerHand[0]])}\n\n`;
    text += `Type **>hit** to draw a card or **>stand** to hold.`;

    await message.reply(text);
};

commands.hit = async (message) => {
    const userId = message.author.id;
    const game = blackjackGames.get(userId);

    if (!game || game.finished) {
        return message.reply("🃏 You have no active blackjack game. Use >blackjack <bet> to start.");
    }

    game.playerHand.push(drawCard());

    const playerTotal = handValue(game.playerHand);

    let text = `🃏 **Blackjack — HIT**\n\n`;
    text += `🧍 Your hand: ${formatHand(game.playerHand)} (Total: ${playerTotal})\n`;
    text += `🏦 Dealer shows: ${formatHand([game.dealerHand[0]])}\n\n`;

    if (playerTotal > 21) {
        game.finished = true;
        text += `💀 You **BUST**! You lose your bet of ${game.bet} coins.\n`;
        blackjackGames.delete(userId);
    } else {
        text += `Type **>hit** to draw again or **>stand** to hold.`;
    }

    await message.reply(text);
};

commands.stand = async (message) => {
    const userId = message.author.id;
    const game = blackjackGames.get(userId);

    if (!game || game.finished) {
        return message.reply("🃏 You have no active blackjack game. Use >blackjack <bet> to start.");
    }

    let dealerTotal = handValue(game.dealerHand);
    while (dealerTotal < 17) {
        game.dealerHand.push(drawCard());
        dealerTotal = handValue(game.dealerHand);
    }

    const playerTotal = handValue(game.playerHand);

    let text = `🃏 **Blackjack — STAND**\n\n`;
    text += `🧍 Your hand: ${formatHand(game.playerHand)} (Total: ${playerTotal})\n`;
    text += `🏦 Dealer hand: ${formatHand(game.dealerHand)} (Total: ${dealerTotal})\n\n`;

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
        const win = game.bet * 2;
        await addCoins(userId, win);
        text += `✅ You **WIN**! You receive **${win} coins**.\n`;
    } else if (dealerTotal === playerTotal) {
        await addCoins(userId, game.bet);
        text += `➖ **PUSH**. Your bet of ${game.bet} coins is returned.\n`;
    } else {
        text += `❌ You **LOSE**. Better luck next time.\n`;
    }

    game.finished = true;
    blackjackGames.delete(userId);

    await message.reply(text);
};

// ===============================
// POKÉMON SYSTEM (FULL POKÉDEX VIA POKÉAPI)
// ===============================

const pokemonDataCache = {};
const pokemonStatsCache = {};
let allPokemonNames = [];

// Load ALL Pokémon names from PokéAPI for random spawns
async function loadAllPokemon() {
    try {
        const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=20000");
        const data = await res.json();
        allPokemonNames = data.results.map(p => p.name);
        console.log(`Loaded ${allPokemonNames.length} Pokémon from PokéAPI.`);
    } catch (err) {
        console.error("Failed to load full Pokémon list:", err);
    }
}

// Call this once when the bot starts (add near client.ready or after client creation)
loadAllPokemon();

// Fetch full Pokémon data from PokéAPI
async function getPokemonData(name) {
    name = name.toLowerCase();

    if (pokemonDataCache[name]) return pokemonDataCache[name];

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
        if (!res.ok) return null;

        const data = await res.json();

        const types = data.types.map(t => t.type.name);
        const abilities = data.abilities.map(a => a.ability.name);
        const moves = data.moves.map(m => m.move.name);
        const sprite = data.sprites.other?.["official-artwork"]?.front_default || data.sprites.front_default;

        const stats = {
            hp: data.stats[0].base_stat,
            atk: data.stats[1].base_stat,
            def: data.stats[2].base_stat,
            spAtk: data.stats[3].base_stat,
            spDef: data.stats[4].base_stat,
            speed: data.stats[5].base_stat
        };

        const result = { name, types, abilities, moves, sprite, stats };
        pokemonDataCache[name] = result;
        pokemonStatsCache[name] = stats;

        return result;
    } catch (err) {
        console.error("PokéAPI Error:", err);
        return null;
    }
}

// Get stats (from cache or PokéAPI)
async function getStats(name) {
    name = name.toLowerCase();

    if (pokemonStatsCache[name]) return pokemonStatsCache[name];

    const data = await getPokemonData(name);
    if (!data) return null;

    return data.stats;
}

// Random Pokémon generator using FULL Pokédex
function getRandomPokemon() {
    if (allPokemonNames.length === 0) return "pikachu"; // fallback if load failed
    return allPokemonNames[Math.floor(Math.random() * allPokemonNames.length)];
}

// Auto-spawn Pokémon in channel (with sprite, types)
async function spawnRandomPokemonChannel(channel) {
    const pokemon = getRandomPokemon();
    const data = await getPokemonData(pokemon);

    if (!data) {
        return channel.send({
            embeds: [chaosEmbed("⚠️ Error", `Could not load data for **${pokemon}**.`)]
        });
    }

    global.activeSpawn = {
        name: data.name.toLowerCase(),
        channel: channel.id
    };

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "✨ A Wild Pokémon Appeared!",
        `A wild **${data.name}** has spawned!\nTypes: ${typeText}\nUse \`>catch\` to try catching it!`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    await channel.send({ embeds: [embed] });
}

// Manual spawn command (random, with sprite)
commands.spawn = async (message) => {
    const pokemon = getRandomPokemon();
    const data = await getPokemonData(pokemon);

    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Could not load data for **${pokemon}**.`)]
        });
    }

    global.activeSpawn = {
        name: data.name.toLowerCase(),
        channel: message.channel.id
    };

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "✨ Pokémon Spawned!",
        `A wild **${data.name}** has appeared!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// OWNERSPAWN (UPDATED WITH POKÉAPI SPRITES/TYPES)
commands.ownerspawn = async (message, args) => {
    if (message.author.id !== OWNER_ID) {
        return message.reply({ embeds: [chaosEmbed("🚫 Restricted", "Only the bot owner can use this.")] });
    }

    const pokemonName = args[0];
    if (!pokemonName) {
        return message.reply({ embeds: [chaosEmbed("⚠️ Missing Pokémon", "Example: `>ownerspawn pikachu`")] });
    }

    const data = await getPokemonData(pokemonName);
    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `Could not find **${pokemonName}** in PokéAPI.`)]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "✨ Owner Spawned Pokémon!",
        `A wild **${data.name}** has appeared!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    try {
        global.activeSpawn = {
            name: data.name.toLowerCase(),
            channel: message.channel.id
        };

        await message.channel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        return message.reply({ embeds: [chaosEmbed("⚠️ Error", "Failed to spawn Pokémon.")] });
    }
};

// Pokédex lookup (with types, abilities, moves, sprite)
commands.pokedex = async (message, args) => {
    const name = args[0]?.toLowerCase();
    if (!name) {
        return message.reply({
            embeds: [chaosEmbed("📘 Pokédex", "Usage: `>pokedex <pokemon>`")]
        });
    }

    const data = await getPokemonData(name);
    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `**${name}** is not in the Pokédex.`)]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");
    const abilityText = data.abilities.slice(0, 3).map(a => `\`${a}\``).join(", ");
    const moveText = data.moves.slice(0, 5).map(m => `\`${m}\``).join(", ");

    const embed = chaosEmbed(
        `📘 Pokédex — ${data.name}`,
        `**Types:** ${typeText}\n**Abilities:** ${abilityText}\n**Sample Moves:** ${moveText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// Catch wild Pokémon (random, stored by name)
commands.catchwild = async (message) => {
    const pokemon = getRandomPokemon();
    const data = await getPokemonData(pokemon);

    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Could not load data for **${pokemon}**.`)]
        });
    }

    if (!userPokemon[message.author.id]) {
        userPokemon[message.author.id] = [];
    }

    userPokemon[message.author.id].push(data.name.toLowerCase());

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "🎉 Pokémon Caught!",
        `You caught a wild **${data.name}**!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// Show user's Pokémon team (names, with PokéAPI lookup per slot)
commands.team = async (message) => {
    const team = userPokemon[message.author.id];

    if (!team || team.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("⚔️ Your Team", "You have no Pokémon yet.")]
        });
    }

    const lines = [];
    for (let i = 0; i < team.length; i++) {
        const name = team[i];
        const data = await getPokemonData(name);
        if (!data) {
            lines.push(`**${i + 1}.** ${name}`);
            continue;
        }
        const typeText = data.types.join("/");
        lines.push(`**${i + 1}.** ${data.name} (${typeText})`);
    }

    return message.reply({
        embeds: [
            chaosEmbed("⚔️ Your Pokémon Team", lines.join("\n"))
        ]
    });
};

// Release a Pokémon
commands.release = async (message, args) => {
    const index = parseInt(args[0]) - 1;

    if (!userPokemon[message.author.id] || !userPokemon[message.author.id][index]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Invalid Slot", "Choose a valid Pokémon number.")]
        });
    }

    const released = userPokemon[message.author.id][index];
    userPokemon[message.author.id].splice(index, 1);

    return message.reply({
        embeds: [
            chaosEmbed("🕊️ Pokémon Released", `You released **${released}** back into the wild.`)
        ]
    });
};

// Trade Pokémon between users
commands.trade = async (message, args) => {
    const target = message.mentions.users.first();
    const index = parseInt(args[1]) - 1;

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("👥 Trade Error", "Usage: `>trade @user <slot>`")]
        });
    }

    if (!userPokemon[message.author.id] || !userPokemon[message.author.id][index]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Invalid Slot", "Choose a valid Pokémon number.")]
        });
    }

    const pokemon = userPokemon[message.author.id][index];

    if (!userPokemon[target.id]) {
        userPokemon[target.id] = [];
    }

    userPokemon[target.id].push(pokemon);
    userPokemon[message.author.id].splice(index, 1);

    return message.reply({
        embeds: [
            chaosEmbed("🔄 Trade Complete", `You traded **${pokemon}** to **${target.username}**.`)
        ]
    });
};

// ===============================
// CATCH (OWNERSPAWN / AUTO-SPAWN)
// ===============================

commands.catch = async (message) => {
    if (!global.activeSpawn) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Pokémon", "There is nothing to catch.")]
        });
    }

    if (global.activeSpawn.channel !== message.channel.id) {
        return message.reply({
            embeds: [chaosEmbed("❌ Wrong Channel", "The Pokémon is not here.")]
        });
    }

    const caughtName = global.activeSpawn.name;
    delete global.activeSpawn;

    if (!userPokemon[message.author.id]) {
        userPokemon[message.author.id] = [];
    }

    userPokemon[message.author.id].push(caughtName);

    const data = await getPokemonData(caughtName);
    const displayName = data?.name || caughtName;
    const typeText = data ? data.types.map(t => `\`${t}\``).join(", ") : "Unknown";

    const embed = chaosEmbed(
        "🎉 Pokémon Caught!",
        `You caught **${displayName}**!\nTypes: ${typeText}`
    );

    if (data?.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// ===============================
// BATTLE SYSTEM (USING POKÉAPI STATS)
// ===============================

commands.fight = async (message) => {
    const wild = getRandomPokemon();
    const wildStats = await getStats(wild);

    if (!wildStats) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Could not load stats for **${wild}**.`)]
        });
    }

    const userTeam = userPokemon[message.author.id];
    if (!userTeam || userTeam.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Pokémon", "You need at least one Pokémon to fight.")]
        });
    }

    const chosen = userTeam[0].toLowerCase();
    const chosenStats = await getStats(chosen);

    if (!chosenStats) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Stats missing for **${chosen}**.`)]
        });
    }

    // ⚔️ Battle Start Banner
    const startEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("⚔️ BATTLE     START")
        .setImage("https://copilot.microsoft.com/th/id/BCO.801afeaa-0d13-40ac-8df0-6639561f1e6c.png");

    await message.reply({ embeds: [startEmbed] });

    // ⚔️ Battle Result
const userPower = chosenStats.atk + Math.floor(Math.random() * 20);
const wildPower = wildStats.atk + Math.floor(Math.random() * 20);

const result = userPower >= wildPower
    ? `🎉 **You won!**\nYour **${chosen}** defeated the wild **${wild}**!`
    : `💀 **You lost...**\nThe wild **${wild}** overpowered your **${chosen}**.`;

// 🏆 Victory Banner
if (userPower >= wildPower) {
    const victoryEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🏆 VICTORY!")
        .setImage("https://copilot.microsoft.com/th/id/BCO.484f1cc6-ab7c-4161-81e9-89921d2b6a50.png");

    await message.channel.send({ embeds: [victoryEmbed] });
}

// 💀 Defeat Banner
else {
    const defeatEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💀 DEFEAT...")
        .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513175785513553992/ChatGPT_Image_Jun_7_2026_09_40_11_AM.png?ex=6a26c644&is=6a2574c4&hm=b18df6d27e63c62e05c0ca4e3c6e367e47da5bdf3e84855e3b63f4c25790fc72");

    await message.channel.send({ embeds: [defeatEmbed] });
}

return message.channel.send({
    embeds: [chaosEmbed("⚔️ Battle Result", result)]
});
};

commands.fightboss = async (message) => {

    if (!global.activeBoss) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Boss", "There is no active boss right now.")]
        });
    }

    if (global.activeBoss.channel !== message.channel.id) {
        return message.reply({
            embeds: [chaosEmbed("❌ Wrong Channel", "Fight the boss in the correct channel.")]
        });
    }

    const boss = global.activeBoss;
    const userTeam = userPokemon[message.author.id];

    if (!userTeam || userTeam.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Pokémon", "You need a Pokémon to fight the boss.")]
        });
    }

    const chosen = userTeam[0].toLowerCase();
    const stats = await getStats(chosen);

    if (!stats) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Stats missing for **${chosen}**.`)]
        });
    }

    const damage = stats.atk + Math.floor(Math.random() * 20);
    boss.hp -= damage;

    // 🏆 Victory Banner when boss dies
    if (boss.hp <= 0) {
        const defeated = boss.name;
        delete global.activeBoss;

        const victoryEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🏆 VICTORY!")
            .setImage("https://copilot.microsoft.com/th/id/BCO.484f1cc6-ab7c-4161-81e9-89921d2b6a50.png");

        await message.channel.send({ embeds: [victoryEmbed] });

        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎉 Boss Defeated!",
                    `Your **${chosen}** dealt **${damage}** damage and defeated **${defeated.toUpperCase()}**!`
                )
            ]
        });
    }

    return message.reply({
        embeds: [
            chaosEmbed(
                "⚔️ Boss Fight",
                `Your **${chosen}** dealt **${damage}** damage!\nBoss HP remaining: **${boss.hp}**`
            )
        ]
    });
};
// ===============================
// PLAYER DUEL SYSTEM (Pokétwo Style)
// ===============================

commands.fight = async (message, args) => {
    const target = message.mentions.users.first();

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚔️ Duel", "Tag a player to duel.\nUsage: `>fight @player`")]
        });
    }

    if (target.id === message.author.id) {
        return message.reply({
            embeds: [chaosEmbed("❌ Invalid Duel", "You cannot duel yourself.")]
        });
    }

    const yourTeam = userPokemon[message.author.id];
    const theirTeam = userPokemon[target.id];

    if (!yourTeam || yourTeam.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Pokémon", "You need at least one Pokémon to duel.")]
        });
    }

    if (!theirTeam || theirTeam.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("❌ Opponent Has No Pokémon", `${target.username} has no Pokémon to duel with.`)]
        });
    }

    const yourMon = yourTeam[0].toLowerCase();
    const theirMon = theirTeam[0].toLowerCase();

    const yourStats = await getStats(yourMon);
    const theirStats = await getStats(theirMon);

    if (!yourStats || !theirStats) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", "Could not load Pokémon stats.")]
        });
    }

    // ⚔️ Duel Start Banner
    const startEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("⚔️ DUEL     START")
        .setImage("https://copilot.microsoft.com/th/id/BCO.801afeaa-0d13-40ac-8df0-6639561f1e6c.png");

    await message.reply({ embeds: [startEmbed] });

    // Power calculation (Pokétwo style randomness)
    const yourPower = yourStats.atk + Math.floor(Math.random() * 20);
    const theirPower = theirStats.atk + Math.floor(Math.random() * 20);

    let resultText = "";
    let winner = null;

    if (yourPower >= theirPower) {
        winner = message.author;
        resultText =
            `🎉 **${message.author.username} wins the duel!**\n` +
            `Their **${yourMon}** defeated **${theirMon}** used by **${target.username}**.`;
    } else {
        winner = target;
        resultText =
            `💀 **${target.username} wins the duel!**\n` +
            `Their **${theirMon}** overpowered **${yourMon}** used by **${message.author.username}**.`;
    }

    // 🏆 Victory banner
    if (winner.id === message.author.id) {
        const victoryEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🏆 VICTORY!")
            .setImage("https://copilot.microsoft.com/th/id/BCO.484f1cc6-ab7c-4161-81e9-89921d2b6a50.png");

        await message.channel.send({ embeds: [victoryEmbed] });
    } else {
        // 💀 Defeat banner
        const defeatEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("💀 DEFEAT...")
            .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513175785513553992/ChatGPT_Image_Jun_7_2026_09_40_11_AM.png?ex=6a26c644&is=6a2574c4&hm=b18df6d27e63c62e05c0ca4e3c6e367e47da5bdf3e84855e3b63f4c25790fc72");

        await message.channel.send({ embeds: [defeatEmbed] });
    }

    return message.channel.send({
        embeds: [chaosEmbed("⚔️ Duel Result", resultText)]
    });
};

// ===============================
// MEGA EVOLUTION & GIGANTAMAX
// ===============================

// Mega stones & G-Max items (expand later)
const megaStones = {
    charizard: "charizard-mega-x",
    mewtwo: "mewtwo-mega-x",
    lucario: "lucario-mega",
    gengar: "gengar-mega"
};

const gigantamaxForms = {
    pikachu: "pikachu-gmax",
    charizard: "charizard-gmax",
    gengar: "gengar-gmax",
    snorlax: "snorlax-gmax"
};

// MEGA EVOLUTION
commands.mega = async (message, args) => {
    const pokemonName = args[0]?.toLowerCase();
    if (!pokemonName) {
        return message.reply({
            embeds: [
                chaosEmbed("✨ Mega Evolution", "Usage: `>mega <pokemon>`")
            ]
        });
    }

    if (!megaStones[pokemonName]) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ Cannot Mega Evolve", `**${pokemonName}** has no Mega Evolution.`)
            ]
        });
    }

    const megaForm = megaStones[pokemonName];
    const data = await getPokemonData(megaForm);

    if (!data) {
        return message.reply({
            embeds: [
                chaosEmbed("⚠️ Error", `Could not load Mega Evolution data for **${pokemonName}**.`)
            ]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "🔥 Mega Evolution!",
        `Your **${pokemonName}** Mega Evolved into **${data.name}**!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// GIGANTAMAX
commands.gigantamax = async (message, args) => {
    const pokemonName = args[0]?.toLowerCase();
    if (!pokemonName) {
        return message.reply({
            embeds: [
                chaosEmbed("🌩️ Gigantamax", "Usage: `>gigantamax <pokemon>`")
            ]
        });
    }

    if (!gigantamaxForms[pokemonName]) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ Cannot Gigantamax", `**${pokemonName}** has no Gigantamax form.`)
            ]
        });
    }

    const gmaxForm = gigantamaxForms[pokemonName];
    const data = await getPokemonData(gmaxForm);

    if (!data) {
        return message.reply({
            embeds: [
                chaosEmbed("⚠️ Error", `Could not load Gigantamax data for **${pokemonName}**.`)
            ]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "🌩️ Gigantamax Transformation!",
        `Your **${pokemonName}** transformed into **${data.name}**!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// ===============================
// SHOP (5-page embed layout)
// ===============================

const shopPages = [
    {
        title: "Pokéballs",
        description:
            "🔸 **Pokéball** — 50 coins\n" +
            "🔹 **Great Ball** — 150 coins\n" +
            "🔶 **Ultra Ball** — 300 coins\n" +
            "💎 **Master Ball** — 1000 coins"
    },
    {
        title: "Battle Items",
        description:
            "🛡️ **Potion** — 100 coins (heal 30 HP)\n" +
            "💊 **Super Potion** — 200 coins (heal 60 HP)\n" +
            "💉 **Hyper Potion** — 400 coins (heal 120 HP)\n" +
            "☀️ **Revive** — 500 coins (revive fainted Pokémon)\n" +
            "✨ **Max Revive** — 800 coins (full revive)"
    },
    {
        title: "Mega Stones",
        description:
            "⚜️ **Charizardite X** — 1000 coins\n" +
            "⚜️ **Charizardite Y** — 1000 coins\n" +
            "⚜️ **Mewtwonite X** — 1200 coins\n" +
            "⚜️ **Mewtwonite Y** — 1200 coins\n" +
            "⚜️ **Gengarite** — 900 coins\n" +
            "⚜️ **Lucarionite** — 900 coins\n" +
            "⚜️ **Blastoiseinite** — 1000 coins\n" +
            "⚜️ **Venusaurite** — 1000 coins\n" +
            "⚜️ **Blazikenite** — 1200 coins\n" +
            "⚜️ **Sceptilite** — 1000 coins\n" +
            "⚜️ **Swampertite** — 1000 coins\n" +
            "⚜️ **Gardevoirite** — 900 coins\n" +
            "⚜️ **Tyranitarite** — 1200 coins\n" +
            "⚜️ **Salamencite** — 1200 coins"
    },
    {
        title: "Gigantamax Items",
        description:
            "✨ **Dynamax Band** — 1500 coins\n" +
            "✨ **G-Max Candy** — 700 coins\n" +
            "🍲 **Max Soup** — 900 coins"
    },
    {
        title: "TMs",
        description:
            "📀 **TM01** — 300 coins\n" +
            "📀 **TM02** — 300 coins\n" +
            "📀 **TM03** — 300 coins\n" +
            "📀 **TM Random** — 500 coins"
    }
];

// ===============================
// PAGINATED SHOP COMMAND
// ===============================

commands.shop = async (message, args) => {
    let page = 1;

    if (args[0] && !isNaN(args[0])) {
        page = parseInt(args[0]);
    }

    if (args[0]?.toLowerCase() === "next") {
        page = (message.lastShopPage || 1) + 1;
    }

    if (args[0]?.toLowerCase() === "prev") {
        page = (message.lastShopPage || 1) - 1;
    }

    if (page < 1) page = 1;
    if (page > shopPages.length) page = shopPages.length;

    message.lastShopPage = page;

    const data = shopPages[page - 1];

    const embed = new EmbedBuilder()
        .setTitle(`🛒 PokéShop — Page ${page}/${shopPages.length} (${data.title})`)
        .setDescription(data.description)
        .setColor(0xff99cc)
        .setFooter({ text: "Use >shop next, >shop prev, or >shop <page>" });

    await message.reply({ embeds: [embed] });
};

// ===============================
// BUY COMMAND (QuickDB v9 permanent saving)
// ===============================

commands.buy = async (message, args) => {
    const player = await ensurePlayer(message.author.id);

    const item = args[0]?.toLowerCase();
    const amount = parseInt(args[1]) || 1;

    if (!item) return message.reply("🛒 Specify an item to buy. Example: >buy pokeball 3");

    const prices = {
        pokeball: 50,
        greatball: 150,
        ultraball: 300,
        masterball: 1000,

        potion: 100,
        superpotion: 200,
        hyperpotion: 400,
        revive: 500,
        maxrevive: 800,

        charizarditex: 1000,
        charizarditey: 1000,
        mewtwonitex: 1200,
        mewtwonitey: 1200,
        gengarite: 900,
        lucarionite: 900,
        blastoisinite: 1000,
        venusaurite: 1000,
        blazikenite: 1200,
        sceptilite: 1000,
        swampertite: 1000,
        gardevoirite: 900,
        tyranitarite: 1200,
        salamencite: 1200,

        dynamaxband: 1500,
        gmaxcandy: 700,
        maxsoup: 900,

        tm01: 300,
        tm02: 300,
        tm03: 300,
        tmrandom: 500
    };

    if (!prices[item]) return message.reply("🛒 That item does not exist. Use >shop.");

    const cost = prices[item] * amount;
    const coins = await getCoins(message.author.id);

    if (coins < cost) return message.reply("💸 You don't have enough coins.");

    await removeCoins(message.author.id, cost);

    player.items[item] = (player.items[item] || 0) + amount;

    await db.set(`player_${message.author.id}`, player);

    await message.reply(`🛒 You bought ${amount} ${item}(s) for ${cost} coins.`);
};

// ===============================
// RELEASE SYSTEM
// ===============================

commands.release = async (message, args) => {
    const index = parseInt(args[0]);
    const list = userPokemon[message.author.id];

    if (!list || list.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("📦 Empty Box", "You have no Pokémon to release.")]
        });
    }

    if (isNaN(index) || index < 1 || index > list.length) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Invalid Number", "Choose a valid Pokémon index.")]
        });
    }

    const removed = list.splice(index - 1, 1)[0];

    const releaseEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🕊️ Pokémon Released")
        .setDescription(`You released **${removed}** into the wild.`)
        .setFooter({ text: "PokeChaos • Release System" });

    return message.reply({ embeds: [releaseEmbed] });
};

// ===============================
// TRADE SYSTEM
// ===============================

commands.trade = async (message, args) => {
    const target = message.mentions.users.first();
    const giveIndex = parseInt(args[1]);
    const takeIndex = parseInt(args[2]);

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to trade with.")]
        });
    }

    const yourList = userPokemon[message.author.id] || [];
    const theirList = userPokemon[target.id] || [];

    if (!yourList[giveIndex - 1] || !theirList[takeIndex - 1]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Invalid Trade", "One of the Pokémon does not exist.")]
        });
    }

    const yours = yourList[giveIndex - 1];
    const theirs = theirList[takeIndex - 1];

    yourList[giveIndex - 1] = theirs;
    theirList[takeIndex - 1] = yours;

    const tradeEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔄 Trade Complete")
        .setDescription(
            `🤝 **${message.author.username}** traded **${yours}**\n` +
            `↔️ **${target.username}** traded **${theirs}**`
        )
        .setFooter({ text: "PokeChaos • Trading System" });

    return message.reply({ embeds: [tradeEmbed] });
};

// ===============================
// LEVEL SYSTEM (AUTO-LEVEL ON FIGHT)
// ===============================
function addXP(userId, amount) {
    if (!userXP[userId]) userXP[userId] = 0;
    userXP[userId] += amount;

    if (userXP[userId] >= 100) {
        userXP[userId] -= 100;
        userLevel[userId] = (userLevel[userId] || 1) + 1;
        return true;
    }
    return false;
}

commands.level = async (message) => {
    const lvl = userLevel[message.author.id] || 1;
    const xp = userXP[message.author.id] || 0;

    const lvlEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("📈 Your Level")
        .setDescription(`**Level:** ${lvl}\n**XP:** ${xp}/100`)
        .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513172787752075304/154efff0-fb3a-4262-9f50-833bd4a04bcb.png?ex=6a26c379&is=6a2571f9&hm=ff7acb9408067549290bcb175c58328c220b98ab44117e29d2b75824b5f2f52a") // placeholder
        .setFooter({ text: "PokeChaos • Level System" });

    return message.reply({ embeds: [lvlEmbed] });
};
// ===============================
// INVENTORY + ITEM SYSTEM
// ===============================

if (!userInventory) userInventory = {};

function getInventory(id) {
    if (!userInventory[id]) userInventory[id] = {};
    return userInventory[id];
}

function addItem(id, item, amount = 1) {
    const inv = getInventory(id);
    if (!inv[item]) inv[item] = 0;
    inv[item] += amount;
}

function removeItem(id, item, amount = 1) {
    const inv = getInventory(id);
    if (!inv[item] || inv[item] < amount) return false;
    inv[item] -= amount;
    if (inv[item] <= 0) delete inv[item];
    return true;
}

// ===============================
// INVENTORY COMMAND
// ===============================

commands.inventory = async (message) => {
    const inv = getInventory(message.author.id);
    const keys = Object.keys(inv);

    if (keys.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("🎒 Empty Inventory", "You have no items yet.")]
        });
    }

    const invEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🎒 Your Inventory")
        .setDescription(
            keys.map(k => `**${k}:** ${inv[k]}`).join("\n")
        )
        .setFooter({ text: "PokeChaos • Inventory System" });

    return message.reply({ embeds: [invEmbed] });
};

// ===============================
// USE ITEM COMMAND
// ===============================

commands.use = async (message, args) => {
    const item = (args[0] || "").toLowerCase();
    if (!item) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing Item", "You must specify an item to use.")]
        });
    }

    const inv = getInventory(message.author.id);

    if (!inv[item]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `You don't have any **${item}**.`)]
        });
    }

    // Example effects
    let effectText = "";

    if (item === "potion") {
        effectText = "Your Pokémon feel refreshed!";
    } else if (item === "rare_candy") {
        const leveled = addXP(message.author.id, 100);
        effectText = leveled
            ? "🎉 Your level increased!"
            : "You gained XP!";
    } else {
        effectText = "This item has no effect yet.";
    }

    removeItem(message.author.id, item, 1);

    const useEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🧪 Item Used")
        .setDescription(
            `You used **${item}**.\n\n${effectText}`
        )
        .setFooter({ text: "PokeChaos • Item System" });

    return message.reply({ embeds: [useEmbed] });
};
// ===============================
// DAILY REWARD SYSTEM (FIXED)
// ===============================

commands.daily = async (message) => {
    const id = message.author.id;
    const now = Date.now();

    // 24 hours = 86400000 ms
    if (dailyCooldown[id] && now - dailyCooldown[id] < 86400000) {
        const remaining = 86400000 - (now - dailyCooldown[id]);
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);

        return message.reply({
            embeds: [
                chaosEmbed(
                    "⏳ Not Yet",
                    `You already claimed your daily reward.\nCome back in **${hours}h ${minutes}m**.`
                )
            ]
        });
    }

    // Reward
    const coins = Math.floor(Math.random() * 200) + 100;

    // ⭐ FIXED — USE REAL ECONOMY SYSTEM
    await addCoins(id, coins);

    dailyCooldown[id] = now;

    const dailyEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🎁 Daily Reward")
        .setDescription(
            `You received **${coins} coins**!\n` +
            `Come back tomorrow for more rewards.`
        )
        .setFooter({ text: "PokeChaos • Daily System" });

    return message.reply({ embeds: [dailyEmbed] });
};

// ===============================
// COIN BALANCE SYSTEM (FIXED)
// ===============================

commands.balance = async (message) => {
    const id = message.author.id;
    const coins = await getCoins(id);

    const balEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💰 Your Balance")
        .setDescription(`You currently have **${coins} coins**.`)
        .setFooter({ text: "PokeChaos • Economy System" });

    return message.reply({ embeds: [balEmbed] });
};

// ===============================
// GIVE COINS (OWNER ONLY)
// ===============================

commands.givecoins = async (message, args) => {
    const ownerId = "YOUR_OWNER_ID_HERE";
    if (message.author.id !== ownerId) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Access", "Only the owner can give coins.")]
        });
    }

    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target || isNaN(amount) || amount <= 0) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Invalid Usage", "Use: `>givecoins @user amount`")]
        });
    }

    userCoins[target.id] = (userCoins[target.id] || 0) + amount;

    const giveEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💸 Coins Granted")
        .setDescription(
            `👑 **Owner Granted:** ${amount} coins\n` +
            `🎟 **To:** ${target}`
        )
        .setFooter({ text: "PokeChaos • Economy Control" });

    return message.reply({ embeds: [giveEmbed] });
};
// ===============================
// AFK SYSTEM
// ===============================

if (!userAFK) userAFK = {};

commands.afk = async (message, args) => {
    const reason = args.join(" ") || "AFK";

    userAFK[message.author.id] = reason;

    const afkEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💤 AFK Enabled")
        .setDescription(
            `You are now marked as **AFK**.\n` +
            `📌 **Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • AFK System" });

    return message.reply({ embeds: [afkEmbed] });
};

// ===============================
// REMOVE AFK ON MESSAGE
// ===============================

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    if (userAFK[msg.author.id]) {
        delete userAFK[msg.author.id];

        const backEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🔔 Welcome Back")
            .setDescription("You are no longer AFK.")
            .setFooter({ text: "PokeChaos • AFK System" });

        return msg.reply({ embeds: [backEmbed] });
    }

    // Notify if tagging AFK user
    if (msg.mentions.users.size > 0) {
        msg.mentions.users.forEach((u) => {
            if (userAFK[u.id]) {
                msg.reply({
                    embeds: [
                        chaosEmbed(
                            "💤 User AFK",
                            `${u.username} is AFK.\n📌 **Reason:** ${userAFK[u.id]}`
                        )
                    ]
                });
            }
        });
    }
});

// ===============================
// REMINDER SYSTEM
// ===============================

if (!userReminders) userReminders = [];

commands.remind = async (message, args) => {
    const time = parseInt(args[0]);
    const text = args.slice(1).join(" ");

    if (!time || !text) {
        return message.reply({
            embeds: [
                chaosEmbed(
                    "⏰ Invalid Usage",
                    "Use: `>remind <seconds> <message>`"
                )
            ]
        });
    }

    const remindEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("⏰ Reminder Set")
        .setDescription(
            `I will remind you in **${time} seconds**.\n` +
            `📌 **Message:** ${text}`
        )
        .setFooter({ text: "PokeChaos • Reminder System" });

    message.reply({ embeds: [remindEmbed] });

    setTimeout(() => {
        const doneEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🔔 Reminder")
            .setDescription(text)
            .setFooter({ text: "PokeChaos • Reminder System" });

        message.author.send({ embeds: [doneEmbed] }).catch(() => {});
    }, time * 1000);
};

// ===============================
// WELCOME SYSTEM
// ===============================

client.on("guildMemberAdd", async (member) => {
    const channel = member.guild.systemChannel;
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🌟 Welcome!")
        .setDescription(
            `Welcome to **${member.guild.name}**, ${member}!\n` +
            `Enjoy your stay!`
        )
        .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513171346421715079/standard_1.gif?ex=6a26c222&is=6a2570a2&hm=a693772ecd22fe94ffb29c22ad2ed99115abee36ec72672109e379643002f1fd")
        .setFooter({ text: "PokeChaos • Welcome System" });

    channel.send({ embeds: [welcomeEmbed] });
});
// ===============================
// GIVEAWAY SYSTEM
// ===============================

if (!activeGiveaways) activeGiveaways = {};

commands.giveaway = async (message, args) => {
    const duration = parseInt(args[0]);
    const prize = args.slice(1).join(" ");

    if (!duration || !prize) {
        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎉 Giveaway Setup",
                    "Use: `>giveaway <seconds> <prize>`"
                )
            ]
        });
    }

    const id = Date.now().toString();
    activeGiveaways[id] = {
        host: message.author.id,
        prize,
        entrants: [],
        channel: message.channel.id
    };

    const gEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🎉 GIVEAWAY STARTED")
        .setDescription(
            `🎁 **Prize:** ${prize}\n` +
            `⏳ **Duration:** ${duration} seconds\n` +
            `👑 **Host:** ${message.author}`
        )
        .setImage("https://cdn.discordapp.com/attachments/1479684491927748678/1512242134886125760/lv_0_20260604191428.jpg?ex=6a26ac7d&is=6a255afd&hm=e7259d513605b0a690cd4fe14baeb569d3425e6b2260a9aff8f206926210ca22")
        .setFooter({ text: "React with 🎉 to enter!" });

    const msg = await message.reply({ embeds: [gEmbed] });
    await msg.react("🎉");

    // Collect reactions
    const filter = (reaction, user) =>
        reaction.emoji.name === "🎉" && !user.bot;

    const collector = msg.createReactionCollector({ filter, time: duration * 1000 });

    collector.on("collect", (reaction, user) => {
        if (!activeGiveaways[id].entrants.includes(user.id)) {
            activeGiveaways[id].entrants.push(user.id);
        }
    });

    collector.on("end", async () => {
        const g = activeGiveaways[id];
        if (!g) return;

        const entrants = g.entrants;
        delete activeGiveaways[id];

        if (entrants.length === 0) {
            return message.channel.send({
                embeds: [
                    chaosEmbed(
                        "😔 No Entries",
                        "Nobody entered the giveaway."
                    )
                ]
            });
        }

        const winner = entrants[Math.floor(Math.random() * entrants.length)];

        const winEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🎉 GIVEAWAY WINNER")
            .setDescription(
                `🏆 **Winner:** <@${winner}>\n` +
                `🎁 **Prize:** ${prize}\n` +
                `👑 **Hosted By:** <@${g.host}>`
            )
            .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513177264412430406/ChatGPT_Image_Jun_7_2026_09_46_02_AM.png?ex=6a26c7a5&is=6a257625&hm=7edb3fa8062d9ddf6d0343dc75e55a930490b13ba5d890be0ad64618577a60f5")
            .setFooter({ text: "Congratulations!" });

        return message.channel.send({ embeds: [winEmbed] });
    });
};
   
// ===============================
// MODERATION SYSTEM
// ===============================

commands.kick = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot kick members.")]
        });
    }

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason provided.";

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to kick.")]
        });
    }

    await target.kick(reason).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("👢 Member Kicked")
        .setDescription(
            `**User:** ${target.user.tag}\n` +
            `**Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.ban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot ban members.")]
        });
    }

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason provided.";

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to ban.")]
        });
    }

    await target.ban({ reason }).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔨 Member Banned")
        .setDescription(
            `**User:** ${target.user.tag}\n` +
            `**Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.unban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot unban members.")]
        });
    }

    const userId = args[0];
    if (!userId) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing ID", "Provide a user ID to unban.")]
        });
    }

    await message.guild.members.unban(userId).catch(() => {});

    const unbanEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔓 Member Unbanned")
        .setDescription(`User with ID **${userId}** has been unbanned.`)
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [unbanEmbed] });
};

commands.mute = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot mute members.")]
        });
    }

    const target = message.mentions.members.first();
    const duration = parseInt(args[1]) || 10; // minutes
    const reason = args.slice(2).join(" ") || "No reason provided.";

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to mute.")]
        });
    }

    await target.timeout(duration * 60 * 1000, reason).catch(() => {});

    const muteEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔇 Member Muted")
        .setDescription(
            `**User:** ${target.user.tag}\n` +
            `**Duration:** ${duration} minutes\n` +
            `**Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [muteEmbed] });
};

commands.unmute = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot unmute members.")]
        });
    }

    const target = message.mentions.members.first();

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to unmute.")]
        });
    }

    await target.timeout(null).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔊 Member Unmuted")
        .setDescription(`**User:** ${target.user.tag} has been unmuted.`)
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.clear = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot clear messages.")]
        });
    }

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Invalid Number", "Choose a number between 1 and 100.")]
        });
    }

    await message.channel.bulkDelete(amount, true).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🧹 Messages Cleared")
        .setDescription(`Deleted **${amount}** messages.`)
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

// ===============================
// UTILITY COMMANDS
// ===============================

commands.ping = async (message) => {
    const ping = Date.now() - message.createdTimestamp;

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🏓 Pong!")
        .setDescription(`Latency: **${ping}ms**`)
        .setFooter({ text: "PokeChaos • Utility" });

    return message.reply({ embeds: [embed] });
};

commands.uptime = async (message) => {
    const totalSeconds = Math.floor(process.uptime());
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("⏱️ Bot Uptime")
        .setDescription(`**${hours}h ${minutes}m ${seconds}s**`);

    return message.reply({ embeds: [embed] });
}; // <-- closes uptime ONLY

}); // <-- closes messageCreate (correct)

// ===============================
// COMMAND HANDLER (END)
// ===============================

// ===============================
// BOT READY MESSAGE
// ===============================

client.on("ready", () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});
// ===============================
// DATA SAVE + LOAD SYSTEM
// ===============================

const SAVE_PATH = path.join(__dirname, "chaosdata.json");

function loadAllData() {
    try {
        const raw = fs.readFileSync(SAVE_PATH, "utf8");
        const parsed = JSON.parse(raw);

        userPokemon = parsed.userPokemon || {};
        userCoins = parsed.userCoins || {};
        userInventory = parsed.userInventory || {};
        userXP = parsed.userXP || {};
        userLevel = parsed.userLevel || {};
        ownerspawnData = parsed.ownerspawnData || {};

    } catch {
        userPokemon = {};
        userCoins = {};
        userInventory = {};
        userXP = {};
        userLevel = {};
        ownerspawnData = {};
    }
}

function saveAllData() {
    const data = {
        userPokemon,
        userCoins,
        userInventory,
        userXP,
        userLevel,
        ownerspawnData
    };

    fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2), "utf8");
}

// Auto‑save every 30 seconds
setInterval(() => {
    saveAllData();
}, 30000);

// Load on startup
loadAllData();

// ===============================
// EXPORT COMMANDS
// ===============================

module.exports = { commands };

// ===============================
// BOT ONLINE + LOGIN
// ===============================

client.once("ready", () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

// ===============================
// LOGIN
// ===============================
client.login(TOKEN);
