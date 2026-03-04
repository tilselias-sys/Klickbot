// 1. IMPORTS
const express = require('express');
const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    PermissionsBitField
} = require('discord.js');

// 2. EXPRESS SETUP (für das Hosting)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot ist online!'));
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

// 3. KONSTANTEN & CLIENT DEFINITION (Das hier MUSS vor client.on stehen!)
const TOKEN = process.env.TOKEN;
const ROLE_NAME = 'klick';
const DATA_FILE = 'data.json';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 4. HILFSFUNKTIONEN
function loadData() {
    if (!fs.existsSync(DATA_FILE)) return { leaderboard: {}, currentHolderId: null, roleStartTime: null, claimMessageId: null };
    try { return JSON.parse(fs.readFileSync(DATA_FILE)); } catch { return { leaderboard: {}, currentHolderId: null, roleStartTime: null, claimMessageId: null }; }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 5. EVENTS
client.once(Events.ClientReady, () => {
    console.log(`✅ Eingeloggt als ${client.user.tag}`);
});

// Hier kommt deine Button-Logik (InteractionCreate)
let interactionLock = false;
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'claim_role') return;
    if (interactionLock) return interaction.reply({ content: "Warte kurz...", ephemeral: true });

    interactionLock = true;
    try {
        const { guild, member } = interaction;
        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        if (!role) {
            interactionLock = false;
            return interaction.reply({ content: "Rolle nicht gefunden!", ephemeral: true });
        }

        await interaction.deferUpdate().catch(() => {});
        const data = loadData();
        const now = Date.now();

        if (data.currentHolderId === member.id) {
            interactionLock = false;
            return;
        }

        // Alten Besitzer entfernen
        if (data.currentHolderId) {
            const duration = now - data.roleStartTime;
            data.leaderboard[data.currentHolderId] = (data.leaderboard[data.currentHolderId] || 0) + duration;
            const prevMember = await guild.members.fetch(data.currentHolderId).catch(() => null);
            if (prevMember) await prevMember.roles.remove(role).catch(() => {});
        }

        // Neuen Besitzer setzen
        await member.roles.add(role);
        data.currentHolderId = member.id;
        data.roleStartTime = now;
        saveData(data);

        await interaction.editReply({
            content: `Die Rolle **${ROLE_NAME}** gehört gerade: <@${member.id}>`,
            components: interaction.message.components
        });
    } catch (e) {
        console.error(e);
    } finally {
        interactionLock = false;
    }
});

// Setup & Leaderboard Commands
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    const content = message.content.toLowerCase();

    if (content === '!setupclick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('claim_role').setLabel('Claim Klick-Rolle 🔥').setStyle(ButtonStyle.Primary)
        );
        await message.channel.send({ content: 'Klicke hier für die Rolle!', components: [row] });
    }

    if (content === '!leaderboard') {
        const data = loadData();
        const sorted = Object.entries(data.leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 10);
        let text = "🏆 **Leaderboard** 🏆\n";
        sorted.forEach(([id
