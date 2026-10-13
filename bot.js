require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { nanoid } = require('nanoid');
const express = require('express');

// Initialize Express to satisfy Render Web Service port binding requirement
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('CutmyURL Bot is running live!');
});

app.listen(PORT, () => {
    console.log(`Web server is listening on port ${PORT}`);
});

// Initialize Telegram Bot
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

bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const text = ctx.message.text;

    if (text.startsWith('http://') || text.startsWith('https://')) {
        const shortCode = nanoid(6);

        db.run(`INSERT INTO links (user_id, short_code, long_url) VALUES (?, ?, ?)`, [userId, shortCode, text], (err) => {
            if (err) {
                return ctx.reply('Error saving your short link. Please try again.');
            }
            
            const shortUrl = `https://t.me/${ctx.botInfo.username}?start=${shortCode}`;
            ctx.reply(`Success! Your short link is:\n${shortUrl}\n\nOriginal URL: ${text}`);
        });
    } else {
        ctx.reply('Please send a valid URL starting with http:// or https://, or use the menu buttons.');
    }
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
    console.log('Telegram Bot is up and running...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
