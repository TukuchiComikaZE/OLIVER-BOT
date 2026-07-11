require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { getKhmerTTS } = require('./tts');
const ytdl = require('@distube/ytdl-core');
const { spotify } = require('spotify-url-info');
const play = require('play-dl');
const { spawn } = require('child_process');
const { StreamType } = require('@discordjs/voice');

function ytdlpStream(url) {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestaudio',
      '-o', '-',
      '--no-playlist',
      '--no-warnings',
      '--extractor-args', 'youtube:player_client=web_creator',
      url
    ]);
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-f', 'opus',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ]);
    let stderr = '';
    let resolved = false;
    ytdlp.stderr.on('data', (d) => { stderr += d.toString(); });
    ytdlp.on('error', (err) => { if (!resolved) reject(err); });
    ytdlp.on('close', (code) => {
      if (!resolved && code !== 0) reject(new Error(stderr || 'yt-dlp failed with code ' + code));
    });
    ytdlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.on('error', (err) => { if (!resolved) reject(err); });
    ffmpeg.stdout.on('readable', () => {
      resolved = true;
      resolve({ stream: ffmpeg.stdout, type: StreamType.OggOpus });
    });
  });
}

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
const currentSongTitle = new Map();
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
        { name: '**`/jak [song]`**', value: '➜ Play a song from YouTube/Spotify', inline: false },
        { name: '**`/bit`**', value: '➜ Stop the current song', inline: false },
        { name: '**`/lyric`**', value: '➜ Show lyrics of current song', inline: false },
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

  if (args[0] === '/lyric') {
    const title = currentSongTitle.get(message.guild.id);
    if (!title) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## No song is currently playing.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      return message.reply({ embeds: [errEmbed] });
    }
    const songTitle = title;
    const parts = songTitle.split(' - ');
    const artist = parts.length > 1 ? parts[1].trim() : '';
    const songName = parts[0].trim();
    try {
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(songName)}`);
      const data = await res.json();
      if (!data.lyrics) throw new Error('No lyrics');
      const lyricEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('# 📜 LYRICS')
        .setDescription(`## ${songTitle}\n\`\`\`${data.lyrics.substring(0, 4000)}\`\`\``)
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      message.reply({ embeds: [lyricEmbed] });
    } catch {
      const errEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('# ⛔ ERROR')
        .setDescription('## Could not find lyrics for this song.')
        .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
        .setImage('https://i.imgur.com/Yl2kAx0.png')
        .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
      message.reply({ embeds: [errEmbed] });
    }
  }

  if (args[0] === '/bit') {
    const player = musicPlayers.get(message.guild.id);
    if (player) {
      player.stop();
      musicPlayers.delete(message.guild.id);
      currentSongTitle.delete(message.guild.id);
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

  if (args[0] === '/jak') {
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

      let songUrl, songTitle, songThumb;
      const isSpotify = query.includes('open.spotify.com');

      if (isSpotify) {
        const data = await spotify.data(query);
        const search = await play.search(`${data.name} ${data.artists?.[0]?.name || ''}`, { limit: 1 });
        if (!search.length) {
          const errEmbed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('# ⛔ ERROR')
            .setDescription('## Could not find that song on YouTube.')
            .setThumbnail('https://i.imgur.com/Yl2kAx0.png')
            .setImage('https://i.imgur.com/Yl2kAx0.png')
            .setFooter({ text: 'OLIVER BOT • DEV BY CHI D', iconURL: 'https://i.imgur.com/WInF5AF.png' });
          return message.reply({ embeds: [errEmbed] });
        }
        songUrl = search[0].url;
        songTitle = `${data.name} - ${data.artists?.[0]?.name || ''}`;
        songThumb = data.coverArt?.sources?.[0]?.url || search[0].thumbnails?.[0]?.url;
      } else {
        const isDirectLink = query.match(/https?:\/\/(www\.)?(youtube\.com|youtu\.be)/);
        if (isDirectLink) {
          const info = await play.video_info(query);
          songUrl = query;
          songTitle = info.video_details.title;
          songThumb = info.video_details.thumbnails[0]?.url;
        } else {
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
          songUrl = search[0].url;
          songTitle = search[0].title;
          songThumb = search[0].thumbnails[0]?.url;
        }
      }

      const audioStream = await ytdlpStream(songUrl);
      const resource = createAudioResource(audioStream.stream, { inputType: audioStream.type });
      const player = createAudioPlayer();
      connection.subscribe(player);
      player.play(resource);
      musicPlayers.set(message.guild.id, player);
      currentSongTitle.set(message.guild.id, songTitle);
      const playEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('# 🎵 NOW PLAYING')
        .setDescription(`## [${songTitle}](${songUrl})`)
        .setThumbnail(songThumb || 'https://i.imgur.com/Yl2kAx0.png')
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

    if (wasPlaying) {
      connection.subscribe(musicPlayer);
      musicPlayer.unpause();
    }
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

  if (wasPlaying) {
    connection.subscribe(musicPlayer);
    musicPlayer.unpause();
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});
