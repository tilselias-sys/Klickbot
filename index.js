// =======================================
// 🔥 Klick-Bot – ULTRA STABLE FULL VERSION
// =======================================

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot ist online!'));
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
} = require('discord.js');

const fs = require('fs');

const TOKEN = process.env.TOKEN;
const ROLE_NAME = 'klick';
const DATA_FILE = 'data.json';

// =======================================
// Discord Client
// =======================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// =======================================
// Datenspeicherung (Crash Safe)
// =======================================

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return {
            leaderboard: {},
            currentHolderId: null,
            roleStartTime: null,
            claimMessageId: null
        };
    }

    try {
        return JSON.parse(fs.readFileSync(DATA_FILE));
    } catch {
        return {
            leaderboard: {},
            currentHolderId: null,
            roleStartTime: null,
            claimMessageId: null
        };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =======================================
// Ready Event
// =======================================

client.once(Events.ClientReady, async () => {
    console.log(`Bot ist online als ${client.user.tag}`);

    const data = loadData();
    const guilds = await client.guilds.fetch();

    for (const [guildId] of guilds) {
        const guild = await client.guilds.fetch(guildId);
        await guild.members.fetch();

        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        if (!role) continue;

        const holder = role.members.first();
        if (holder) {
            data.currentHolderId = holder.id;
            if (!data.roleStartTime) data.roleStartTime = Date.now();
            console.log(`Aktueller Besitzer erkannt: ${holder.user.tag}`);
        }
    }

    saveData(data);
});

// =======================================
// Commands
// =======================================

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

    // Setup Button
    if (content === '!setupclick') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_role')
                .setLabel('Claim Klick-Rolle 🔥')
                .setStyle(ButtonStyle.Primary)
        );

        const botMessage = await message.channel.send({
            content: 'Klicke hier, um die Rolle "klick" zu claimen!',
            components: [row]
        });

        const data = loadData();
        data.claimMessageId = botMessage.id;
        saveData(data);
    }

    // Leaderboard
    if (content === '!leaderboard') {
        const data = loadData();

        if (data.currentHolderId && data.roleStartTime) {
            const duration = Date.now() - data.roleStartTime;
            if (!data.leaderboard[data.currentHolderId])
                data.leaderboard[data.currentHolderId] = 0;
            data.leaderboard[data.currentHolderId] += duration;
            data.roleStartTime = Date.now();
            saveData(data);
        }

        const sorted = Object.entries(data.leaderboard)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sorted.length === 0) return message.channel.send("Noch keine Daten vorhanden.");

        let text = "🏆 **Leaderboard – Rolle 'klick'** 🏆\n\n";

        for (let i = 0; i < sorted.length; i++) {
            const user = await client.users.fetch(sorted[i][0]);
            const totalSeconds = Math.floor(sorted[i][1] / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            text += `${i + 1}. ${user.tag} – ${minutes}m ${seconds}s\n`;
        }

        message.channel.send(text);
    }
});

// =======================================
// Button Interaction
// =======================================

let interactionLock = false;

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'claim_role') return;

    if (interactionLock) return; // Race-condition verhindern
    interactionLock = true;

    try {
        // Sofort ack, kein "Bot denkt..." Popup
        await interaction.deferUpdate().catch(() => {});

        const member = interaction.member;
        const guild = interaction.guild;
        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        if (!role) return;

        const data = loadData();
        const now = Date.now();

        // Alte Zeit speichern
        if (data.currentHolderId && data.roleStartTime) {
            const duration = now - data.roleStartTime;
            if (!data.leaderboard[data.currentHolderId])
                data.leaderboard[data.currentHolderId] = 0;
            data.leaderboard[data.currentHolderId] += duration;
        }

        // Alte Rolle entfernen
        for (const [, guildMember] of role.members) {
            await guildMember.roles.remove(role).catch(() => {});
        }

        // Neue Rolle vergeben
        await member.roles.add(role);

        data.currentHolderId = member.id;
        data.roleStartTime = now;

        saveData(data);

        // Button-Nachricht aktualisieren
        if (data.claimMessageId) {
            const channel = interaction.channel;
            const botMessage = await channel.messages.fetch(data.claimMessageId).catch(() => null);
            if (botMessage) {
                await botMessage.edit({
                    content: `Die Rolle "klick" gehört gerade: <@${member.id}>`,
                    components: botMessage.components
                }).catch(() => {});
            }
        }

    } catch (err) {
        if (err.code === 10062) {
            console.warn("Interaction ist abgelaufen, kann nicht geantwortet werden.");
        } else {
            console.error(err);
        }
    }

    interactionLock = false;
});

// =======================================
// Crash Schutz
// =======================================

client.on('error', console.error);
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// =======================================
// Login
// =======================================

client.login(TOKEN);
