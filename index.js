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
