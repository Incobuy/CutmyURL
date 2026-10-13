require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { nanoid } = require('nanoid');

const bot = new Telegraf(process.env.BOT_TOKEN);

const db = new sqlite3.Database('./shortener.db', (err) => {
    if (err) {
        console.error('Database opening error: ' + err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        free_links_used INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        short_code TEXT UNIQUE,
        long_url TEXT,
        clicks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    
    db.run(`INSERT OR IGNORE INTO users (user_id, free_links_used) VALUES (?, 0)`, [userId], (err) => {
        if (err) console.error(err);
    });

    const welcomeMessage = 
        `Welcome to CutmyURL Bot!\n\n` +
        `Manage and shorten your links professionally.\n` +
        `• Free tier: 5 short links.\n` +
        `• Premium links: $0.20 via Telegram Stars after free tier.`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Shorten Link', 'shorten_link')],
        [Markup.button.callback('My Statistics', 'my_stats')]
    ]);

    return ctx.reply(welcomeMessage, keyboard);
});

bot.action('shorten_link', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Please send me the long URL you want to shorten:');
});

bot.action('my_stats', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id.toString();

    db.all(`SELECT short_code, long_url, clicks FROM links WHERE user_id = ?`, [userId], (err, rows) => {
        if (err) {
            return ctx.reply('Error fetching your statistics.');
        }
        if (rows.length === 0) {
            return ctx.reply('You have not created any short links yet.');
        }

        let response = 'Your Short Links & Analytics:\n\n';
        rows.forEach((row, index) => {
            response += `${index + 1}. Code: ${row.short_code}\n   URL: ${row.long_url}\n   Clicks: ${row.clicks}\n\n`;
        });

        ctx.reply(response);
    });
});

bot.launch().then(() => {
    console.log('Bot is up and running...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
