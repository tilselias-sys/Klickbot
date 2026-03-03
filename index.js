const express = require('express');
const app = express();
const PORT = 3000;

// Einfacher Webserver für UptimeRobot
app.get('/', (req, res) => res.send('Bot ist online!'));
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

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

// Daten laden / speichern
function loadData() {
    if (!fs.existsSync('data.json')) return {};
    return JSON.parse(fs.readFileSync('data.json'));
}

function saveData(data) {
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

client.once('clientReady', () => {
    console.log(`Bot ist online als ${client.user.tag}`);
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    // Button-Message initial senden
    if (message.content.toLowerCase() === '!setupclick') {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_role')
                    .setLabel('Claim Klick-Rolle 🔥')
                    .setStyle(ButtonStyle.Primary)
            );
        await message.channel.send({ content: 'Klicke hier, um die Rolle "klick" zu claimen:', components: [row] });
    }

    // Leaderboard per Command
    if (message.content.toLowerCase() === '!leaderboard') {
        const data = loadData();
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

// Interaktionen (Button-Klicks) abfangen
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'claim_role') return;

    const member = interaction.member;
    const guild = interaction.guild;
    const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
    if (!role) return interaction.reply({ content: 'Rolle nicht gefunden!', ephemeral: true });

    const data = loadData();
    const now = Date.now();

    // ❌ Alte Rolle entfernen – nur eine Person darf sie haben
    const previousHolder = guild.members.cache.get(currentHolderId);
    if (previousHolder && previousHolder.roles.cache.has(role.id)) {
        await previousHolder.roles.remove(role).catch(console.error);
    }

    // Rolle neu vergeben
    await member.roles.add(role).catch(console.error);
    currentHolderId = member.id;
    roleStartTime = now;
    saveData(data);

    await interaction.reply({ content: `${member.user.tag} hat die Rolle "${ROLE_NAME}" jetzt! 🔥`, ephemeral: false });
});

client.login(TOKEN);
