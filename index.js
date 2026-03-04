// ===========================
// 🔥 Klick-Bot – Restart-Safe Version
// ===========================

const express = require('express');
const app = express();
const PORT = 3000;

// Webserver für UptimeRobot
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

// ===========================
// 📂 Datenspeicherung
// ===========================

function loadData() {
    if (!fs.existsSync('data.json')) {
        return {
            leaderboard: {},
            currentHolderId: null,
            roleStartTime: null
        };
    }
    return JSON.parse(fs.readFileSync('data.json'));
}

function saveData(data) {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

// ===========================
// 🚀 Bot Start
// ===========================

client.once('clientReady', async () => {
    console.log(`Bot ist online als ${client.user.tag}`);

    let data = loadData();

    // Falls Bot neu gestartet wurde → Rolle im Server prüfen
    const guilds = await client.guilds.fetch();

    for (const [guildId] of guilds) {
        const guild = await client.guilds.fetch(guildId);
        await guild.members.fetch();

        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        if (!role) continue;

        const holder = role.members.first();

        if (holder) {
            data.currentHolderId = holder.id;

            // Wenn keine Startzeit existiert → jetzt setzen
            if (!data.roleStartTime) {
                data.roleStartTime = Date.now();
            }

            console.log(`Aktueller Rollenbesitzer erkannt: ${holder.user.tag}`);
        }
    }

    saveData(data);
});

// ===========================
// 📩 Commands
// ===========================

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    // Setup Button einmalig
    if (message.content.toLowerCase() === '!setupclick') {
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

        client.claimMessageId = botMessage.id;
    }

    // Leaderboard anzeigen
    if (message.content.toLowerCase() === '!leaderboard') {
        let data = loadData();

        // Aktuelle Zeit des Besitzers speichern
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

        if (sorted.length === 0)
            return message.channel.send("Noch keine Daten vorhanden.");

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

// ===========================
// 🔘 Button Interaktion
// ===========================

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'claim_role') return;

    const member = interaction.member;
    const guild = interaction.guild;
    const role = guild.roles.cache.find(r => r.name === ROLE_NAME);

    if (!role)
        return interaction.reply({
            content: 'Rolle nicht gefunden!',
            ephemeral: true
        });

    let data = loadData();
    const now = Date.now();

    // 🔥 Alte Zeit speichern
    if (data.currentHolderId && data.roleStartTime) {
        const duration = now - data.roleStartTime;

        if (!data.leaderboard[data.currentHolderId])
            data.leaderboard[data.currentHolderId] = 0;

        data.leaderboard[data.currentHolderId] += duration;
    }

    // Alte Rolle entfernen
    const previousHolder = guild.members.cache.get(data.currentHolderId);
    if (previousHolder && previousHolder.roles.cache.has(role.id)) {
        await previousHolder.roles.remove(role).catch(console.error);
    }

    // Neue Rolle vergeben
    await member.roles.add(role).catch(console.error);

    data.currentHolderId = member.id;
    data.roleStartTime = now;

    saveData(data);

    await interaction.reply({
        content: `Du hast die Rolle "${ROLE_NAME}" jetzt! 🔥`,
        ephemeral: true
    });

    // Button-Nachricht aktualisieren
    if (client.claimMessageId) {
        const channel = interaction.channel;
        const botMessage = await channel.messages
            .fetch(client.claimMessageId)
            .catch(() => null);

        if (botMessage) {
            botMessage.edit({
                content: `Die Rolle "klick" gehört gerade: <@${member.id}>`,
                components: botMessage.components
            });
        }
    }
});

// ===========================
// 🔐 Login
// ===========================

client.login(TOKEN);
