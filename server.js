const express = require('express');
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { goals } = require('mineflayer-pathfinder');
const autoEat = require('mineflayer-auto-eat').plugin;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// active bots store karne ke liye array
let activeBots = [];

// HTML Web Dashboard
app.get('/', (req, res) => {
    let botRows = activeBots.map((bot, index) => {
        let timeLeft = Math.max(0, Math.ceil((bot.expiresAt - Date.now()) / 1000 / 60));
        return `
            <tr>
                <td>${bot.username}</td>
                <td>${bot.host}:${bot.port}</td>
                <td><b style="color: #0d6efd;">${bot.tier.toUpperCase()}</b></td>
                <td>${timeLeft} mins</td>
                <td><span style="color: green;">Online</span></td>
            </tr>
        `;
    }).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Minecraft AFK Bot Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; background: #1e1e2e; color: #fff; padding: 20px; }
            .container { max-width: 700px; margin: auto; background: #2b2b3b; padding: 25px; border-radius: 10px; }
            h2 { text-align: center; color: #4caf50; }
            label { font-weight: bold; margin-top: 10px; display: block; }
            input, select, button { width: 100%; padding: 10px; margin-top: 5px; margin-bottom: 15px; border-radius: 5px; border: none; }
            input, select { background: #3b3b4b; color: #fff; }
            button { background: #4caf50; color: #fff; font-weight: bold; cursor: pointer; font-size: 16px; }
            button:hover { background: #45a049; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #444; }
            th { background: #3b3b4b; }
            #msg { color: #ffeb3b; text-align: center; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Minecraft AFK Bot Manager</h2>
            <form id="botForm" action="/start-bot" method="POST">
                <label>Server IP:</label>
                <input type="text" name="host" placeholder="e.g. myserver.aternos.me" required>
                
                <label>Server Port:</label>
                <input type="number" name="port" value="25565" required>
                
                <label>Bot Username:</label>
                <input type="text" name="username" placeholder="e.g. AFK_Bot_1" required>

                <label>Bot Tier:</label>
                <select name="tier">
                    <option value="basic">Basic (Anti-AFK Jump & Movement)</option>
                    <option value="standard">Standard (Basic + Auto Eat & Farming)</option>
                    <option value="advanced">Advanced (Standard + Pathfinding & Defense)</option>
                </select>

                <label>Duration (in Hours):</label>
                <input type="number" name="durationHours" value="1" min="0.1" step="0.1" required>

                <button type="submit" id="submitBtn">Start Bot</button>
            </form>
            <div id="msg"></div>

            <h3>Active Running Bots</h3>
            <table>
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Server IP</th>
                        <th>Tier</th>
                        <th>Time Left</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${botRows.length > 0 ? botRows : '<tr><td colspan="5" style="text-align:center;">No bots running.</td></tr>'}
                </tbody>
            </table>
        </div>

        <script>
            // 5 second reset mechanism after submitting
            const form = document.getElementById('botForm');
            form.addEventListener('submit', () => {
                const btn = document.getElementById('submitBtn');
                const msg = document.getElementById('msg');
                btn.disabled = true;
                msg.innerText = "Connecting bot... Form will reset in 5 seconds to add next bot!";
                setTimeout(() => {
                    form.reset();
                    btn.disabled = false;
                    msg.innerText = "";
                    window.location.reload();
                }, 5000);
            });
        </script>
    </body>
    </html>
    `);
});

// Bot Starter API endpoint
app.post('/start-bot', (req, res) => {
    const { host, port, username, tier, durationHours } = req.body;
    const durationMs = parseFloat(durationHours) * 60 * 60 * 1000;
    const expiresAt = Date.now() + durationMs;

    try {
        const bot = mineflayer.createBot({
            host: host,
            port: parseInt(port),
            username: username
        });

        // Load Plugins
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(autoEat);

        let botData = {
            id: Date.now(),
            username,
            host,
            port,
            tier,
            expiresAt,
            instance: bot
        };

        activeBots.push(botData);

        bot.on('spawn', () => {
            console.log(`[+] Bot ${username} connected to ${host}:${port}`);

            // Tier 1: Basic Anti-AFK
            setInterval(() => {
                if (!bot.entity) return;
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 500);
                bot.look(Math.random() * Math.PI * 2, 0);
            }, 15000);

            // Tier 2: Standard (Auto-Eat + Basic Action)
            if (tier === 'standard' || tier === 'advanced') {
                bot.autoEat.enable();
                setInterval(() => {
                    bot.swingArm('right');
                }, 8000);
            }

            // Tier 3: Advanced (Pathfinding logic ready)
            if (tier === 'advanced') {
                const defaultMove = new Movements(bot);
                bot.pathfinder.setMovements(defaultMove);
            }
        });

        // Auto-Deletion / Expiration Timer setup
        setTimeout(() => {
            console.log(`[-] Duration ended for bot ${username}. Disconnecting...`);
            bot.quit();
            activeBots = activeBots.filter(b => b.id !== botData.id);
        }, durationMs);

        bot.on('error', (err) => console.log(`Bot Error (${username}):`, err.message));
        bot.on('end', () => {
            activeBots = activeBots.filter(b => b.id !== botData.id);
            console.log(`Bot ${username} disconnected.`);
        });

        res.redirect('/');
    } catch (e) {
        console.error(e);
        res.status(500).send("Error starting bot");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dashboard Server running on port ${PORT}`);
});