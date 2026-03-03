const express = require('express');
const app = express();
const PORT = 3000;

// einfacher Webserver für UptimeRobot
app.get('/', (req, res) => res.send('Bot ist online!'));
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ] 
});

const TOKEN = process.env.TOKEN;
const ROLE_NAME = 'klick';

let roleStartTime = null;
let currentHolderId = null;

// Daten laden / speichern
function loadData() {
    if (!fs.existsSync('data.json')) return {};
    return JSON.parse(fs.readFileSync('data.json'));
}

function saveData(data) {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

client.on('clientReady', () => {
    console.log(`Bot ist online als ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const member = message.member;
    const guild = message.guild;
    const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
    if (!role) return;

    let data = loadData();

    // 1️⃣ Claim Command
    if (message.content.toLowerCase() === '!claim') {
        const now = Date.now();

        // Zeit vom aktuellen Besitzer speichern
        if (currentHolderId && roleStartTime) {
            const duration = now - roleStartTime;
            if (!data[currentHolderId]) data[currentHolderId] = 0;
            data[currentHolderId] += duration;
        }

        // Rolle von allen entfernen
        guild.members.cache.forEach(async m => {
            if (m.roles.cache.has(role.id)) {
                await m.roles.remove(role).catch(console.error);
            }
        });

        // Rolle dem neuen Besitzer geben
        await member.roles.add(role).catch(console.error);

        currentHolderId = member.id;
        roleStartTime = now;

        saveData(data);

        message.channel.send(`${member.user.tag} hat die Rolle "${ROLE_NAME}" jetzt! 🔥`);
    }

    // 2️⃣ Leaderboard Command
    if (message.content.toLowerCase() === '!leaderboard') {
        // Aktuelle Zeit für aktuellen Besitzer zählen
        if (currentHolderId && roleStartTime) {
            const now = Date.now();
            const duration = now - roleStartTime;
            if (!data[currentHolderId]) data[currentHolderId] = 0;
            data[currentHolderId] += duration;
            roleStartTime = now;
            saveData(data);
        }

        const sorted = Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sorted.length === 0) return message.channel.send("Noch keine Daten vorhanden.");

        let leaderboardText = "🏆 **Leaderboard – Rolle 'klick'** 🏆\n\n";

        for (let i = 0; i < sorted.length; i++) {
            const user = await client.users.fetch(sorted[i][0]);
            const totalSeconds = Math.floor(sorted[i][1] / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            leaderboardText += `${i + 1}. ${user.tag} – ${minutes}m ${seconds}s\n`;
        }

        message.channel.send(leaderboardText);
    }
});

client.login(TOKEN);