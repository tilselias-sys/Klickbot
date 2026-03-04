// =======================================
// 🔥 Klick-Bot – FULLY REPAIRED & STABLE
// =======================================

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

// 2. EXPRESS SETUP (Wichtig für Hosting-Dienste wie Render/Replit)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot ist online!'));
app.listen(PORT, () => console.log(`Webserver läuft auf Port ${PORT}`));

// 3. KONSTANTEN & CLIENT
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

// 4. DATEN-VERWALTUNG
function loadData() {
    if (!fs.existsSync(DATA_FILE)) return { leaderboard: {}, currentHolderId: null, roleStartTime: null };
    try { 
        return JSON.parse(fs.readFileSync(DATA_FILE)); 
    } catch (e) { 
        return { leaderboard: {}, currentHolderId: null, roleStartTime: null }; 
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// 5. BOT READY EVENT
client.once(Events.ClientReady, () => {
    console.log(`✅ Eingeloggt als ${client.user.tag}`);
});

// 6. BUTTON LOGIK (InteractionCreate) - REPARIERTE VERSION
let interactionLock = false;

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'claim_role') return;

    if (interactionLock) {
        return interaction.reply({ content: "Warte einen Moment...", ephemeral: true }).catch(() => {});
    }

    interactionLock = true;

    try {
        const { guild, member } = interaction;
        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        
        if (!role) {
            interactionLock = false;
            return interaction.reply({ content: "Rolle nicht gefunden!", ephemeral: true });
        }

        const data = loadData();
        
        // SICHERHEITS-CHECK: Falls das Leaderboard-Objekt fehlt, erstelle es neu
        if (!data.leaderboard) data.leaderboard = {};

        const now = Date.now();

        if (data.currentHolderId === member.id) {
            interactionLock = false;
            return interaction.reply({ content: "Du hast die Rolle schon!", ephemeral: true });
        }

        await interaction.deferUpdate().catch(() => {});

        // Alten Besitzer entfernen & Zeit speichern
        if (data.currentHolderId) {
            const duration = now - (data.roleStartTime || now);
            
            // Sicherstellen, dass für die ID ein Eintrag existiert (verhindert den "undefined" Fehler)
            if (!data.leaderboard[data.currentHolderId]) {
                data.leaderboard[data.currentHolderId] = 0;
            }
            
            data.leaderboard[data.currentHolderId] += duration;
            
            const prevMember = await guild.members.fetch(data.currentHolderId).catch(() => null);
            if (prevMember) {
                await prevMember.roles.remove(role).catch(() => {});
            }
        }

        // Neuen Besitzer setzen
        await member.roles.add(role).catch(e => console.error("Konnte Rolle nicht geben:", e));
        
        data.currentHolderId = member.id;
        data.roleStartTime = now;
        
        // Sicherstellen, dass der neue User im Board existiert
        if (!data.leaderboard[member.id]) {
            data.leaderboard[member.id] = 0;
        }

        saveData(data);

        await interaction.editReply({
            content: `Die Rolle **${ROLE_NAME}** gehört gerade: <@${member.id}>`,
            components: interaction.message.components
        }).catch(() => {});

    } catch (err) {
        console.error("Fehler bei Button:", err);
    } finally {
        interactionLock = false;
    }
});

// 7. BEFEHLE (Leaderboard & Setup)
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const content = message.content.toLowerCase();

    if (content === '!setupclick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_role')
                .setLabel('Claim Klick-Rolle 🔥')
                .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({
            content: 'Klicke hier, um die Rolle zu claimen!',
            components: [row]
        });
    }

    if (content === '!leaderboard') {
        const data = loadData();
        const entries = Object.entries(data.leaderboard);
        
        if (entries.length === 0) return message.channel.send("Noch keine Daten.");

        const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 10);
        let text = "🏆 **Leaderboard** 🏆\n\n";
        
        sorted.forEach(([id, ms], i) => {
            const totalSec = Math.floor(ms / 1000);
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            text += `**${i + 1}.** <@${id}> – ${m}m ${s}s\n`;
        });

        message.channel.send({ content: text, allowedMentions: { users: [] } });
    }
});

// 8. BOT LOGIN
client.login(TOKEN);
