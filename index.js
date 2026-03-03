// ===========================
// Klick-Bot mit Button & Leaderboard
// ===========================

const express = require('express');
const app = express();
const PORT = 3000;

// Webserver für UptimeRobot (hält Render am Leben)
app.get('/', (req, res) => res.send('Bot ist online!'));
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

// ===========================
// Discord.js Setup
// ===========================
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
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

// ===========================
// Daten speichern / laden
// ===========================
function loadData() {
    if (!fs.existsSync('data.json')) return {};
    return JSON.parse(fs.readFileSync('data.json'));
}

function saveData(data) {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

// ===========================
// Bot Ready
// ===========================
client.once('clientReady', () => {
    console.log(`Bot ist online als ${client.user.tag}`);
});

// ===========================
// Setup Button-Message
// ===========================
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!setupclick') {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_role')
                    .setLabel('Claim Klick-Rolle 🔥')
                    .setStyle(ButtonStyle.Primary)
            );

        const botMessage = await message.channel.send({
            content: 'Klicke hier, um die Rolle "klick" zu claimen!',
            components: [row]
        });

        // Nachricht-ID merken, um sie später updaten zu können
        client.claimMessageId = botMessage.id;
    }

    // Leaderboard Command
    if (message.content.toLowerCase() === '!leaderboard') {
        const data = loadData();

        // Aktuelle Zeit für momentanen Besitzer zählen
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

// ===========================
// Button Interaktion
// ===========================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'claim_role') return;

    const member = interaction.member;
    const guild = interaction.guild;
    const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
    if (!role) return interaction.reply({ content: 'Rolle nicht gefunden!', ephemeral: true });

    const data = loadData();
    const now = Date.now();

    // Alte Rolle entfernen (nur eine Person darf die Rolle haben)
    const previousHolder = guild.members.cache.get(currentHolderId);
    if (previousHolder && previousHolder.roles.cache.has(role.id)) {
        await previousHolder.roles.remove(role).catch(console.error);
    }

    // Rolle neu vergeben
    await member.roles.add(role).catch(console.error);
    currentHolderId = member.id;
    roleStartTime = now;
    saveData(data);

    // Ephemeral Reply für den klickenden User (sichtbar nur für ihn)
    await interaction.reply({ content: `Du hast die Rolle "${ROLE_NAME}" jetzt! 🔥`, ephemeral: true });

    // Optional: Status der Button-Nachricht aktualisieren (wer die Rolle gerade hat)
    const channel = interaction.channel;
    if (client.claimMessageId) {
        const botMessage = await channel.messages.fetch(client.claimMessageId).catch(() => null);
        if (botMessage) {
            botMessage.edit({
                content: `Die Rolle "klick" gehört gerade: <@${member.id}>`,
                components: botMessage.components
            }).catch(console.error);
        }
    }
});

// ===========================
// Bot Login
// ===========================
client.login(TOKEN);
