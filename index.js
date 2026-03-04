// =======================================
// 🔥 Klick-Bot – ULTRA STABLE & BUTTON READY
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
    Events,
    PermissionsBitField
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
// Datenspeicherung
// =======================================

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        return { leaderboard: {}, currentHolderId: null, roleStartTime: null, claimMessageId: null };
    }
    try {
        const raw = fs.readFileSync(DATA_FILE);
        return JSON.parse(raw);
    } catch {
        return { leaderboard: {}, currentHolderId: null, roleStartTime: null, claimMessageId: null };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// =======================================
// Bot Ready
// =======================================

client.once(Events.ClientReady, async () => {
    console.log(`🚀 Bot eingeloggt als ${client.user.tag}`);
    
    const data = loadData();
    // Beim Start prüfen wir kurz, wer die Rolle hat, um synchron zu bleiben
    for (const guild of client.guilds.cache.values()) {
        try {
            await guild.members.fetch(); // Alle Member laden für Sicherheit
            const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
            if (role) {
                const holder = role.members.first();
                if (holder) {
                    data.currentHolderId = holder.id;
                    if (!data.roleStartTime) data.roleStartTime = Date.now();
                }
            }
        } catch (e) {
            console.error("Fehler beim Initialisieren der Guild:", guild.name);
        }
    }
    saveData(data);
});

// =======================================
// Commands
// =======================================

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const content = message.content.toLowerCase();

    // Setup Button (Nur für Admins)
    if (content === '!setupclick') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("Du brauchst Admin-Rechte dafür!");
        }

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
        const now = Date.now();

        // Aktuelle Zeit für den derzeitigen Besitzer temporär dazurechnen
        let displayBoard = { ...data.leaderboard };
        if (data.currentHolderId && data.roleStartTime) {
            const currentDuration = now - data.roleStartTime;
            displayBoard[data.currentHolderId] = (displayBoard[data.currentHolderId] || 0) + currentDuration;
        }

        const sorted = Object.entries(displayBoard)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sorted.length === 0) return message.channel.send("Noch keine Daten vorhanden.");

        let text = "🏆 **Leaderboard – Rolle 'klick'** 🏆\n\n";
        for (let i = 0; i < sorted.length; i++) {
            const userId = sorted[i][0];
            const ms = sorted[i][1];
            
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const timeStr = `${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s`;
            text += `**${i + 1}.** <@${userId}> – ${timeStr}\n`;
        }

        message.channel.send({ content: text, allowedMentions: { users: [] } }); // Verhindert Pings im Leaderboard
    }
});

// =======================================
// Button Interaction (DER REPARATUR-FIX)
// =======================================

let interactionLock = false;

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'claim_role') return;

    if (interactionLock) {
        return interaction.reply({ content: "⏳ System arbeitet noch, bitte kurz warten!", ephemeral: true }).catch(() => {});
    }

    interactionLock = true;

    try {
        const { guild, member, channel } = interaction;
        const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
        
        if (!role) {
            interactionLock = false;
            return interaction.reply({ content: "❌ Fehler: Rolle nicht gefunden!", ephemeral: true });
        }

        // 1. Schon Besitzer?
        const data = loadData();
        if (data.currentHolderId === member.id) {
            interactionLock = false;
            return interaction.reply({ content: "✨ Du hast die Rolle bereits!", ephemeral: true });
        }

        // 2. Interaktion bestätigen
        await interaction.deferUpdate().catch(() => {});

        const now = Date.now();

        // 3. Rollen-Tausch Logik
        if (data.currentHolderId) {
            // Zeit für den alten Besitzer in das Leaderboard schreiben
            const duration = now - data.roleStartTime;
            data.leaderboard[data.currentHolderId] = (data.leaderboard[data.currentHolderId] || 0) + duration;

            // Rolle beim alten Besitzer entfernen
            try {
                const prevMember = await guild.members.fetch(data.currentHolderId).catch(() => null);
                if (prevMember && prevMember.roles.cache.has(role.id)) {
                    await prevMember.roles.remove(role);
                }
            } catch (e) { console.log("Konnte Rolle vom alten User nicht entfernen."); }
        }

        // 4. Rolle dem neuen Besitzer geben
        await member.roles.add(role);

        // 5. Daten speichern
        data.currentHolderId = member.id;
        data.roleStartTime = now;
        saveData(data);

        // 6. NACHRICHT EDITIEREN (Der kritische Teil)
        try {
            // Wir versuchen die Nachricht, an der der Button hängt, direkt zu bearbeiten
            await interaction.editReply({
                content: `Die Rolle **${ROLE_NAME}** gehört gerade: <@${member.id}>`,
                components: interaction.message.components // Behält den Button bei!
            });
        } catch (editError) {
            // Fallback: Wenn Editieren nicht geht, sende neue Nachricht und lösche alte (optional)
            await channel.send(`🔥 **Wechsel!** Die Rolle gehört nun <@${member.id}>!`);
        }

    } catch (err) {
        console.error("Fehler im Prozess:", err);
    } finally {
        interactionLock = false;
    }
});

// =======================================
// Schutz & Login
// =======================================

client.on('error', console.error);
process.on('unhandledRejection', console.error);

client.login(TOKEN);
