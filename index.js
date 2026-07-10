require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { getKhmerTTS } = require('./tts');
const play = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

client.once('ready', (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  setupKeepAlive();
});

const VOICES = ['sreymom', 'piseth'];
const musicPlayers = new Map();
const ttsPlayers = new Map();
let persistentGuildId = null;
let persistentChannelId = null;
let persistentAdapterCreator = null;
let forceLeave = false;
let wasKicked = false;

function setupKeepAlive() {
  setInterval(() => {
    if (!persistentGuildId || forceLeave) return;
    const conn = getVoiceConnection(persistentGuildId);
    if (!conn || conn.state.status === VoiceConnectionStatus.Disconnected || conn.state.status === VoiceConnectionStatus.Destroyed) {
      console.log('Keep-alive reconnecting...');
      joinVoiceChannel({
        channelId: persistentChannelId,
        guildId: persistentGuildId,
        adapterCreator: persistentAdapterCreator,
        selfDeaf: false,
      });
    }
  }, 30000);
}

async function playTTS(connection, text) {
  const voice = VOICES[Math.floor(Math.random() * VOICES.length)];
  try {
    console.log(`Generating TTS: "${text.substring(0, 30)}..."`);
    const stream = await getKhmerTTS(text, voice);
    console.log('TTS audio received, playing...');

    const player = createAudioPlayer();
    const resource = createAudioResource(stream);
    connection.subscribe(player);
    player.play(resource);
    ttsPlayers.set(connection.joinConfig.guildId, player);

    return new Promise((resolve) => {
      player.on(AudioPlayerStatus.Playing, () => console.log('Audio is playing'));
      player.on(AudioPlayerStatus.Idle, () => { console.log('Audio finished'); ttsPlayers.delete(connection.joinConfig.guildId); resolve(); });
      player.on('error', (err) => {
        console.error('Player error:', err.message);
        ttsPlayers.delete(connection.joinConfig.guildId);
        resolve();
      });
    });
  } catch (err) {
    console.error('TTS error:', err.message);
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const args = content.split(/\s+/);

  if (args[0] === '/jol') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## You must be in a **voice channel**\n>>> Use this command while connected to a voice channel.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      return message.reply({ embeds: [errEmbed] });
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      persistentGuildId = message.guild.id;
      persistentChannelId = voiceChannel.id;
      persistentAdapterCreator = message.guild.voiceAdapterCreator;
      forceLeave = false;

      await playTTS(connection, `សួស្តីបង ${message.member.displayName}`);
      const joinEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('# 🔊 CONNECTED')
        .setDescription(`## Successfully joined **${voiceChannel.name}**\n>>> Say **/niyey** to make me speak!`)
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      message.reply({ embeds: [joinEmbed] });
    } catch (err) {
      console.error('Join error:', err.message);
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ❌ FAILED')
        .setDescription('## Unable to join the voice channel\n>>> Please check permissions and try again.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      message.reply({ embeds: [errEmbed] });
    }
  }

  if (args[0] === '/jenh') {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## Bot is not connected\n>>> Use **/jol** to make me join first.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      return message.reply({ embeds: [errEmbed] });
    }

    forceLeave = true;
    persistentGuildId = null;
    persistentChannelId = null;
    persistentAdapterCreator = null;
    connection.destroy();
    const leaveEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('# 👋 DISCONNECTED')
      .setDescription('## Successfully left the voice channel\n>>> See you next time!')
      .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
      .setImage('https://i.imgur.com/Yl2kAx0.png')
      .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
    message.reply({ embeds: [leaveEmbed] });
  }

  if (args[0] === '/cmd') {
    const cmdEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('# 📋 COMMANDS')
      .setDescription('## All available commands for **OLIVER BOT**')
      .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
      .setImage('https://i.imgur.com/Yl2kAx0.png')
      .addFields(
        { name: '**`/jol`**', value: '➜ Join your current voice channel', inline: false },
        { name: '**`/jenh`**', value: '➜ Leave the voice channel', inline: false },
        { name: '**`/niyey [text]`**', value: '➜ Make the bot speak your text', inline: false },
        { name: '**`/chopniyey`**', value: '➜ Cut the bot\'s current speech', inline: false },
        { name: '**`/jak [song]`**', value: '➜ Play a song from YouTube', inline: false },
        { name: '**`/bit`**', value: '➜ Stop the current song', inline: false },
        { name: '**`/cmd`**', value: '➜ Show this command list', inline: false },
        { name: '**🔗 Invite Bot**', value: '[Click here to invite OLIVER BOT](https://discord.com/oauth2/authorize?client_id=1524671957394784330&permissions=8&integration_type=0&scope=bot)', inline: false },
      )
      .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
    return message.reply({ embeds: [cmdEmbed] });
  }

  if (args[0] === '/chopniyey' || args[0] === '/chop') {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## Bot is not connected to voice.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      return message.reply({ embeds: [errEmbed] });
    }
    const ttsPlayer = ttsPlayers.get(message.guild.id);
    if (ttsPlayer) {
      ttsPlayer.stop();
      ttsPlayers.delete(message.guild.id);
    }
    const chopEmbed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('# ✂️ CHOPPED')
      .setDescription('## Audio cut successfully!')
      .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
      .setImage('https://i.imgur.com/Yl2kAx0.png')
      .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
    return message.reply({ embeds: [chopEmbed] });
  }

  if (args[0] === '/bit' || args[0] === '/stop') {
    const player = musicPlayers.get(message.guild.id);
    if (player) {
      player.stop();
      musicPlayers.delete(message.guild.id);
    }
    const stopEmbed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('# ⏹️ STOPPED')
      .setDescription('## Music stopped.')
      .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
      .setImage('https://i.imgur.com/Yl2kAx0.png')
      .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
    return message.reply({ embeds: [stopEmbed] });
  }

  if (args[0] === '/jak' || args[0] === '/plaeng') {
    if (!args[1]) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## Please provide a song name or URL\n>>> **Usage:** `/plaeng [song name or URL]`')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      return message.reply({ embeds: [errEmbed] });
    }
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## You must be in a voice channel!')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      return message.reply({ embeds: [errEmbed] });
    }
    const query = args.slice(1).join(' ');
    try {
      const connection = getVoiceConnection(message.guild.id) || joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
      });
      if (!getVoiceConnection(message.guild.id)) {
        persistentGuildId = message.guild.id;
        persistentChannelId = voiceChannel.id;
        persistentAdapterCreator = message.guild.voiceAdapterCreator;
        forceLeave = false;
      }
      const search = await play.search(query, { limit: 1 });
      if (!search.length) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('# ⛔ ERROR')
          .setDescription('## No results found!')
          .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
          .setImage('https://i.imgur.com/Yl2kAx0.png')
          .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
        return message.reply({ embeds: [errEmbed] });
      }
      const song = search[0];
      const stream = await play.stream(song.url);
      const resource = createAudioResource(stream.stream, { inputType: stream.type });
      const player = createAudioPlayer();
      connection.subscribe(player);
      player.play(resource);
      musicPlayers.set(message.guild.id, player);
      const playEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('# 🎵 NOW PLAYING')
        .setDescription(`## [${song.title}](${song.url})`)
        .setThumbnail(song.thumbnails[0]?.url || 'https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      message.reply({ embeds: [playEmbed] });
    } catch (err) {
      console.error('Play error:', err.message);
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ❌ ERROR')
        .setDescription('## Could not play that song.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      message.reply({ embeds: [errEmbed] });
    }
  }

  if ((args[0] === '/niyey' || args[0] === '/say') && args[1]) {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## Bot is not connected\n>>> Use **/jol** to make me join first.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      return message.reply({ embeds: [errEmbed] });
    }

    const musicPlayer = musicPlayers.get(message.guild.id);
    const wasPlaying = musicPlayer && musicPlayer.state.status === AudioPlayerStatus.Playing;
    if (wasPlaying) musicPlayer.pause();

    const text = message.content.replace(/^\/(?:niyey|say)\s+/i, '').trim();
    await playTTS(connection, text);
    const sayEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('# 🗣️ SPEAKING')
      .setDescription(`## ${text}`)
      .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
      .setImage('https://i.imgur.com/Yl2kAx0.png')
      .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
    message.reply({ embeds: [sayEmbed] });

    if (wasPlaying) musicPlayer.unpause();
  }


});

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member.id === client.user.id) {
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      persistentChannelId = newState.channelId;
      persistentAdapterCreator = newState.guild.voiceAdapterCreator;
      return;
    }
    if (!newState.channelId && !forceLeave && persistentChannelId) {
      wasKicked = true;
    }
    return;
  }

  if (!persistentChannelId) return;

  const joinedBotChannel = newState.channelId === persistentChannelId && oldState.channelId !== persistentChannelId;
  if (!joinedBotChannel) return;

  const connection = getVoiceConnection(newState.guild.id);
  if (!connection) return;

  const musicPlayer = musicPlayers.get(newState.guild.id);
  const wasPlaying = musicPlayer && musicPlayer.state.status === AudioPlayerStatus.Playing;
  if (wasPlaying) musicPlayer.pause();

  await playTTS(connection, `សួស្តីបង ${newState.member.displayName}`);

  if (wasPlaying) musicPlayer.unpause();
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});
