client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!setupclick') {
        // Nachricht einmalig erstellen
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

        // Die ID merken, falls du später die Nachricht updaten willst
        client.claimMessageId = botMessage.id;
    }
});

// Interaktion: Rolle übertragen
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'claim_role') return;

    const member = interaction.member;
    const guild = interaction.guild;
    const role = guild.roles.cache.find(r => r.name === ROLE_NAME);
    if (!role) return interaction.reply({ content: 'Rolle nicht gefunden!', ephemeral: true });

    const data = loadData();
    const now = Date.now();

    // Alte Rolle entfernen
    const previousHolder = guild.members.cache.get(currentHolderId);
    if (previousHolder && previousHolder.roles.cache.has(role.id)) {
        await previousHolder.roles.remove(role).catch(console.error);
    }

    // Rolle neu vergeben
    await member.roles.add(role).catch(console.error);
    currentHolderId = member.id;
    roleStartTime = now;
    saveData(data);

    // Ephemeral Reply für den User (sichtbar nur für ihn)
    await interaction.reply({ content: `Du hast die Rolle "${ROLE_NAME}" jetzt! 🔥`, ephemeral: true });

    // Optional: Status der Button-Nachricht aktualisieren
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
