// =======================
//   IMPORTS
// =======================
const { Client, GatewayIntentBits } = require("discord.js");
const { Pool } = require("pg");

// =======================
//   DATABASE (Railway)
// =======================
const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// =======================
//   DISCORD CLIENT
// =======================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// =======================
//   AUTO-CREATE USER
// =======================
async function ensureUser(userId) {
    await db.query(`INSERT INTO users (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
    await db.query(`INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
    await db.query(`INSERT INTO economy (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
}

// =======================
//   READY
// =======================
client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// =======================
//   WELCOME SYSTEM
// =======================
client.on("guildMemberAdd", (member) => {
    const channel = member.guild.systemChannel;
    if (!channel) return;

    channel.send({
        content: `🎉 Welcome **${member.user.username}**!`,
        files: ["https://share.creavite.co/6a1c6fdc4e92eedc84797869.gif"]
    });
});

// =======================
//   MESSAGE HANDLER
// =======================
client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    // 🔹 TEST COMMAND (NO DATABASE)
    if (msg.content === "!test") {
        return msg.reply("I hear you loud and clear.");
    }

    const userId = msg.author.id;
    await ensureUser(userId);
    console.log("User ensured, continuing..."); // DEBUG LINE

    // =======================
    //   AFK SYSTEM
    // =======================
    const afkCheck = await db.query("SELECT reason FROM afk_status WHERE user_id=$1", [userId]);
    if (afkCheck.rows.length > 0) {
        await db.query("DELETE FROM afk_status WHERE user_id=$1", [userId]);
        msg.reply("💤 You are no longer AFK.");
    }

    if (msg.mentions.users.size > 0) {
        for (const user of msg.mentions.users.values()) {
            const afk = await db.query("SELECT reason FROM afk_status WHERE user_id=$1", [user.id]);
            if (afk.rows.length > 0) {
                msg.channel.send(`📢 **${user.username}** is AFK: ${afk.rows[0].reason}`);
            }
        }
    }

    // =======================
    //   BASIC COMMANDS
    // =======================
    if (msg.content === "!ping") return msg.reply("pong");
    if (msg.content === "!coin") return msg.reply(`🪙 ${Math.random() < 0.5 ? "Heads" : "Tails"}`);
    if (msg.content === "!roll") return msg.reply(`🎲 ${Math.floor(Math.random() * 6) + 1}`);

    // =======================
    //   AFK COMMAND
    // =======================
    if (msg.content.startsWith("!afk")) {
        const reason = msg.content.split(" ").slice(1).join(" ") || "AFK";
        await db.query(`
            INSERT INTO afk_status (user_id, reason)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO UPDATE SET reason=$2
        `, [userId, reason]);

        return msg.reply(`💤 You are now AFK: **${reason}**`);
    }

    // =======================
    //   XP SYSTEM
    // =======================
    const stats = await db.query("SELECT * FROM user_stats WHERE user_id=$1", [userId]);
    let { xp, level, hp, max_hp, dead } = stats.rows[0];

    const gained = Math.floor(Math.random() * 11) + 5;
    xp += gained;

    if (xp >= level * 100) {
        level++;
        xp = 0;
        msg.channel.send(`🎉 **${msg.author.username}** leveled up to **${level}**!`);
    }

    await db.query("UPDATE user_stats SET xp=$1, level=$2 WHERE user_id=$3", [xp, level, userId]);

    if (msg.content === "!level") {
        return msg.reply(`⭐ Level: **${level}**\n📘 XP: **${xp}/${level * 100}**`);
    }

    // =======================
    //   HP SYSTEM
    // =======================
    if (msg.content === "!hp") {
        return msg.reply(`❤️ HP: **${hp}/${max_hp}**\n💀 Dead: **${dead ? "Yes" : "No"}**`);
    }

    if (msg.content === "!heal") {
        if (dead) return msg.reply("💀 You are dead. Use !revive");

        hp = Math.min(hp + 20, max_hp);
        await db.query("UPDATE user_stats SET hp=$1 WHERE user_id=$2", [hp, userId]);

        return msg.reply(`✨ You healed **20 HP**!`);
    }

    if (msg.content === "!revive") {
        if (!dead) return msg.reply("❌ You are not dead.");

        dead = false;
        hp = max_hp;

        await db.query("UPDATE user_stats SET dead=false, hp=$1 WHERE user_id=$2", [hp, userId]);

        return msg.reply(`✨ You have been revived with **${hp} HP**!`);
    }

    // =======================
    //   ECONOMY
    // =======================
    const eco = await db.query("SELECT coins FROM economy WHERE user_id=$1", [userId]);
    let coins = eco.rows[0].coins;

    if (msg.content === "!balance") {
        return msg.reply(`💰 You have **${coins} coins**.`);
    }

    if (msg.content.startsWith("!gamble")) {
        const amount = parseInt(msg.content.split(" ")[1]);
        if (!amount || amount < 1) return msg.reply("❌ Enter a valid amount.");
        if (amount > coins) return msg.reply("❌ Not enough coins.");

        const win = Math.random() < 0.5;

        if (win) coins += amount;
        else coins -= amount;

        await db.query("UPDATE economy SET coins=$1 WHERE user_id=$2", [coins, userId]);

        return msg.reply(win ? `🎉 You won **${amount} coins**!` : `💀 You lost **${amount} coins**.`);
    }

    // =======================
    //   ATTACK COMMAND
    // =======================
    if (msg.content.startsWith("!attack")) {
        const target = msg.mentions.users.first();
        if (!target) return msg.reply("❌ Mention someone to attack.");

        const attacks = [
            `⚔️ **${msg.author.username}** swings a rubber chicken at **${target.username}**!`,
            `🔥 **${msg.author.username}** drops a spicy meme on **${target.username}**!`,
            `💥 **${msg.author.username}** bonks **${target.username}** with a pixelated hammer!`
        ];

        const attack = attacks[Math.floor(Math.random() * attacks.length)];
        return msg.channel.send(attack);
    }

    // =======================
    //   CHAT MODE SYSTEM
    // =======================
    if (global.chatMode === undefined) global.chatMode = false;

    if (msg.content === "!start chat") {
        global.chatMode = true;
        return msg.reply("💬 Chat mode enabled! I will reply to everything you say.");
    }

    if (msg.content === "!end chat") {
        global.chatMode = false;
        return msg.reply("🔕 Chat mode disabled.");
    }

    if (global.chatMode) {
        if (msg.content.startsWith("!")) return;

        const replies = [
            "That's interesting!",
            "Tell me more.",
            "Why do you think that?",
            "I get what you're saying.",
            "Hmm… I never thought of it that way.",
            "You're making good points."
        ];

        const reply = replies[Math.floor(Math.random() * replies.length)];
        return msg.reply(reply);
    }
});

// =======================
//   LOGIN
// =======================
client.login(process.env.TOKEN);