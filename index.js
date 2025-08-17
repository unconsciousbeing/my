const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.MessageContent, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.GuildMembers
  ] 
});

// ===== CONFIG =====
const token = process.env.TOKEN; 
const OWNER_ID = process.env.OWNER_ID;
const DATA_FILE = 'data.json';
const COOLDOWN_MS = 5000;

// ===== Servers / Channels =====
const ALLOWED_SERVER_IDS = ['1389537262705836083', '1405070811110572062'];
const MAIN_SERVER_ID = '1389537262705836083';
const ALLOWED_CHANNEL_ID = '1405607142714638460';

// ===== Hidden Quests =====
const hiddenQuests = [
  "Drink 1 glass of water 💧",
  "Meditate 10 min 🧘",
  "Write 3 things you're grateful for ✍️",
  "Do 20 push-ups 💪",
  "Relax today 🛋️",
  "Send a motivational message 💌",
  "Celebrate someone else’s achievement 🎉",
  "Log your mood today 🙂",
  "Greet an admin 👋"
];

// ===== Workout Plans =====
const workoutPlans = {
  beginner: "Pushups: 30\nSquats: 20\nPlank: 2x30s\nCrunches: 30\nSkippings: 100",
  intermediate: "Pushups: 50\nSquats: 50\nPlank: 2x60s\nCrunches: 50\nSkippings: 300",
  advanced: "Pushups: 100\nSquats: 100\nPlank: 2x90s\nCrunches: 100\nSkippings: 500"
};

// ===== Load / Save Data =====
let data = {};
if (fs.existsSync(DATA_FILE)) {
  try { data = JSON.parse(fs.readFileSync(DATA_FILE)); }
  catch (err) { console.error('Error loading data.json:', err); data = {}; }
}
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// ===== Helper: Progress Bar =====
function getProgressBar(done, total) {
  if (total === 0) return '[No tasks] 0%';
  const percent = (done / total) * 100;
  const filled = Math.round((done / total) * 10);
  return `[${'■'.repeat(filled)}${'□'.repeat(10 - filled)}] ${percent.toFixed(0)}%`;
}

// ===== Bot Ready =====
client.once('ready', () => console.log(`Logged in as ${client.user.tag}!`));
const cooldowns = {};

// ===== Message Handler =====
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!ALLOWED_SERVER_IDS.includes(message.guild.id)) return;
  if (message.guild.id === MAIN_SERVER_ID && message.channel.id !== ALLOWED_CHANNEL_ID) return;

  const userId = message.author.id;

  if (!data[userId]) data[userId] = {
    entered: false,
    habits: [],
    goals: [],
    streak: 0,
    hiddenQuest: null,
    hiddenDone: false,
    workoutDone: false,
    currentWorkout: null,
    greeted: false,
    lastActive: Date.now(),
    graceDay: null,
    lastReset: null
  };
  const user = data[userId];

  const args = message.content.trim().split(/ +/g);
  const cmd = args[0].toLowerCase();

  // ===== !enter =====
  if (cmd === '!enter') {
    if (user.entered) return message.channel.send("[SYSTEM] ✅ You already started your journey!");
    await message.channel.send("[SYSTEM] Loading...");
    setTimeout(() => {
      user.entered = true;
      saveData();
      message.channel.send(`✨ Welcome ${message.author.username}! Type \`!help\` to see commands 💎`);
    }, 2000);
    return;
  }

  // ===== !help =====
  if (cmd === '!help') {
    const embed = new EmbedBuilder()
      .setTitle('📜 Commands & Info')
      .setColor('#00AAFF')
      .addFields(
        { name: '📝 Goals', value: '`!goal` / `!goals` - Show goals\n`!goal add <goal1,goal2>` - Add goals\n`!gdone 1 / all` - Mark done\n`!goal del1 / all` - Delete', inline: false },
        { name: '💡 Habits', value: '`!habit` - Show habits\n`!habit add <habit1,habit2>` - Add habits\n`!hdone 1 / all` - Mark done\n`!habit del1 / all` - Delete', inline: false },
        { name: '🎯 Quests', value: '`!quest` - Show hidden quest (locked until all habits done & ≥1 goal completed)\n`!quest done` - Complete quest', inline: false },
        { name: '💪 Workouts', value: '`!workout` - Show workouts\n`!workout custom <text>` - Custom workout\n`!workout done` - Mark workout done', inline: false },
        { name: '🕒 Grace Day', value: 'After 6 days streak, you can confirm without losing streak using `!grace 0`, or skip with `!grace 1`.', inline: false },
        { name: '⚠️ Inactivity', value: '3 days inactivity triggers a ping reminder.', inline: false },
        { name: '🛡️ Owner', value: '`!resetall` - Reset all data (Owner only)', inline: false }
      )
      .setFooter({ text: 'Complete habits & goals to gain streak. Use commands wisely! 💎' });
    return message.channel.send({ embeds: [embed] });
  }

  // ===== !goal / !goals =====
  if (cmd === '!goal' || cmd === '!goals') {
    if (args[1] === 'add') {
      const toAdd = args.slice(2).join(' ').split(',').map(s => s.trim()).filter(Boolean);
      if (!toAdd.length) return message.channel.send("[SYSTEM] Specify at least one goal.");
      user.goals.push(...toAdd.map(g => ({ text: g, done: false })));
      saveData();
      return message.channel.send(`[SYSTEM] ✅ Added goals: ${toAdd.join(', ')}`);
    }

    if (args[1]?.toLowerCase() === 'delall') { user.goals = []; saveData(); return message.channel.send("[SYSTEM] 🗑️ All goals deleted."); }
    if (args[1]?.toLowerCase().startsWith('del')) {
      const num = parseInt(args[1].slice(3));
      if (!num || num < 1 || num > user.goals.length) return message.channel.send("[SYSTEM] Invalid goal number.");
      const removed = user.goals.splice(num - 1, 1);
      saveData();
      return message.channel.send(`[SYSTEM] ❌ Removed goal: ${removed[0].text}`);
    }

    const doneCount = user.goals.filter(g => g.done).length;
    const total = user.goals.length;
    const goalEmbed = new EmbedBuilder()
      .setTitle(`${message.author.username}'s Goals`)
      .setColor('#00FFAA')
      .setDescription(user.goals.length === 0 ? 'No goals set yet.' : user.goals.map((g,i)=>`${i+1}. ${g.text} ${g.done?'✅':'❌'}`).join('\n'))
      .addFields({ name: 'Progress', value: getProgressBar(doneCount, total) });
    return message.channel.send({ embeds: [goalEmbed] });
  }

  // ===== !habit / !hdone =====
  if (cmd === '!habit') {
    if (args[1] === 'add') {
      const toAdd = args.slice(2).join(' ').split(',').map(s => s.trim()).filter(Boolean);
      if (!toAdd.length) return message.channel.send("[SYSTEM] Specify at least one habit.");
      user.habits.push(...toAdd.map(h => ({ text: h, done: false })));
      saveData();
      return message.channel.send(`[SYSTEM] ✅ Added habits: ${toAdd.join(', ')}`);
    }
    if (args[1]?.toLowerCase() === 'delall') { user.habits = []; saveData(); return message.channel.send("[SYSTEM] 🗑️ All habits deleted."); }
    if (args[1]?.toLowerCase().startsWith('del')) {
      const num = parseInt(args[1].slice(3));
      if (!num || num < 1 || num > user.habits.length) return message.channel.send("[SYSTEM] Invalid habit number.");
      const removed = user.habits.splice(num - 1, 1);
      saveData();
      return message.channel.send(`[SYSTEM] ❌ Removed habit: ${removed[0].text}`);
    }

    const doneCount = user.habits.filter(h => h.done).length;
    const total = user.habits.length;
    const habitEmbed = new EmbedBuilder()
      .setTitle(`${message.author.username}'s Habits`)
      .setColor('#FFAA00')
      .setDescription(user.habits.length === 0 ? 'No habits set yet.' : user.habits.map((h,i)=>`${i+1}. ${h.text} ${h.done?'✅':'❌'}`).join('\n'))
      .addFields({ name: 'Progress', value: getProgressBar(doneCount, total) });
    return message.channel.send({ embeds: [habitEmbed] });
  }

  // ===== !hdone =====
  if (cmd === '!hdone') {
    if (!args[1]) return message.channel.send("[SYSTEM] Specify habit number or 'all'.");
    if (args[1].toLowerCase() === 'all') {
      user.habits.forEach(h => h.done = true);
      saveData();
      return message.channel.send("[SYSTEM] ✅ All habits marked done!");
    }
    const num = parseInt(args[1]);
    if (!num || num < 1 || num > user.habits.length) return message.channel.send("[SYSTEM] Invalid habit number.");
    user.habits[num-1].done = true;
    saveData();
    return message.channel.send(`[SYSTEM] ✅ Habit marked done: ${user.habits[num-1].text}`);
  }

  // ===== !quest =====
  if (cmd === '!quest') {
    if (user.habits.every(h => h.done) && user.goals.some(g => g.done)) {
      if (!user.hiddenQuest) {
        user.hiddenQuest = hiddenQuests[Math.floor(Math.random() * hiddenQuests.length)];
        user.hiddenDone = false;
        saveData();
      }
      return message.channel.send(`🎯 Hidden Quest: ${user.hiddenQuest} ${user.hiddenDone ? '✅' : ''}`);
    } else return message.channel.send("🕵️ Hidden quest locked! Complete all habits and at least 1 goal first.");
  }

  if (cmd === '!quest' && args[1]?.toLowerCase() === 'done') {
    if (user.hiddenQuest && !user.hiddenDone) {
      user.hiddenDone = true;
      saveData();
      return message.channel.send(`✅ Quest completed! Great job, ${message.author.username}!`);
    } else return message.channel.send("No active quest or already completed!");
  }

  // ===== !workout =====
  if (cmd === '!workout') {
    if (!args[1]) {
      const workouts = Object.entries(workoutPlans)
        .map(([level, plan]) => `**${level}**:\n${plan}`)
        .join('\n\n');
      return message.channel.send(`💪 Workouts:\n${workouts}`);
    }
    if (args[1] === 'custom') {
      user.currentWorkout = args.slice(2).join(' ');
      user.workoutDone = false;
      saveData();
      return message.channel.send("[SYSTEM] ✅ Custom workout saved.");
    }
    if (args[1] === 'done') {
      user.workoutDone = true;
      saveData();
      return message.channel.send("[SYSTEM] ✅ Workout marked done!");
    }
  }

  // ===== !resetall (Owner) =====
  if (cmd === '!resetall' && message.author.id === OWNER_ID) {
    data = {};
    saveData();
    return message.channel.send("[SYSTEM] ⚠️ All data reset by owner.");
  }

  // ===== Inactivity / Grace Day / Streaks / Auto-reset =====
  const now = Date.now();
  const msPerDay = 2460601000;
  const daysInactive = Math.floor((now - user.lastActive) / msPerDay);

  // 3-day inactivity ping
  if (daysInactive >= 3 && !user.graceDay) {
    message.channel.send(`⏰ Hey <@${userId}>, you have been inactive for 3 days! Complete your habits to maintain your streak.`);
  }

  // 6-day streak grace day
  if (user.streak >= 6 && !user.graceDay) {
    user.graceDay = true;
    saveData();
    message.channel.send("🛡️ Grace Day activated! Confirm with `!grace 0` to keep streak, or `!grace 1` to skip.");
  }

  // Grace day commands
  if (cmd === '!grace') {
    if (!user.graceDay) return message.channel.send("[SYSTEM] You don't have a grace day right now.");
    if (args[1] === '0') {
      user.graceDay = null;
      saveData();
      return message.channel.send("[SYSTEM] ✅ Grace day confirmed, streak maintained.");
    }
    if (args[1] === '1') {
      user.streak = 0;
      user.graceDay = null;
      saveData();
      return message.channel.send("[SYSTEM] ⚠️ Grace day skipped, streak reset.");
    }
  }

  // Daily streak update and auto-reset after 2–3 hrs
  if (!user.lastReset) user.lastReset = now;
  const resetInterval = 2.5 * 60 * 60 * 1000; // 2.5 hours
  if (user.habits.every(h => h.done) && user.goals.every(g => g.done) && now - user.lastReset >= resetInterval) {
    user.habits.forEach(h => h.done = false);
    user.goals.forEach(g => g.done = false);
    user.hiddenQuest = null;
    user.hiddenDone = false;
    user.workoutDone = false;
    user.currentWorkout = null;
    user.streak += 1;
    user.lastReset = now;
    saveData();
    message.channel.send("[SYSTEM] 🔄 All habits & goals reset for a new cycle! Streak increased.");
  }

  // Reset streak if 1 day inactivity (excluding grace)
  if (daysInactive >= 1 && !user.graceDay) {
    user.streak = 0;
    saveData();
  }

  // Update last active
  user.lastActive = now;
  saveData();
});

// ===== Login =====
client.login(token).catch(err => console.error("Login failed:", err));