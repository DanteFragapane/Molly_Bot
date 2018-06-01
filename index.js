const Discord = require('discord.js');
const MySQL   = require('mysql');
const async   = require('async');
const path    = require('path');

const cmd = require(path.join(__dirname, 'commands.js'));

const config  = require(path.join(__dirname, 'lib/config.js'));
const molly   = new Discord.Client();
const pool    = MySQL.createPool({
  multipleStatements: true,
  connectionLimit: 10,
  host: config.host,
  user: config.user,
  password: config.pass,
  database: config.db,
  insecureAuth: true
});

let userArray       = [];
let timestampArray  = [];
let activityTime    = config.timeout;

let isBot = config.botAccount;


// I moved the login function to up here to its own function, so that I could just call it from wherever I need
// without having duplicate code for "molly.login(config.token);"
function login() {
  molly.login(config.token);
}

function shutdown() {
  console.log("Shutting down...");
  molly.destroy();
  process.exit();
}

molly.on('ready', () => {
    console.log('Molly loaded, trying to connect...');
    pool.getConnection((success, err) => {
      if (err) console.error(err)
      else {console.log("Successfully connected!")}
    })
});

molly.on('message', async (message) => {
  let msgAuth = message.author;
  let authID = message.author.id;
  
  // if (message.channel.type != "text") {
  //   return false;
  // }
  // if (message.channel.guild.id != guildID) {
  //   return false;
  // }

  if (!msgAuth.bot) {
    let dataXP =[
      parseInt(authID),
      message.author.username,
      parseInt(message.author.discriminator),
      message.author.bot
    ];

    pool.query(`SELECT * FROM xp WHERE discord_id = ${msgAuth.id}`, (err, rowsXP) => {
      if (err) console.error(err);
      let sql;
      if (rowsXP.length < 1) {
        userArray.push(authID);
        timestampArray.push(message.createdTimestamp);
        sql = `INSERT INTO xp (discord_id, username, discriminator, bot, xp) VALUES (${msgAuth.id}, '${msgAuth.username}', ${msgAuth.discriminator}, ${msgAuth.bot}, 1)`;
      } else {
        // If the user is in the DB, it doesn't mean it could be in the array, i.e. if the bot shut down at all. Do that check!
        if (!userArray.includes(authID)) { 
          userArray.push(authID);
          timestampArray.push(message.createdTimestamp);
        }
        // Activity log check. Make sure the message was sent after the interval, don't add XP for every message, only messages
        // after a set time period.
        if (message.createdTimestamp - timestampArray[userArray.indexOf(authID)] >= activityTime) {
          timestampArray[userArray.indexOf(authID)] = message.createdTimestamp;
          let xp = rowsXP[0].xp;
          sql = `UPDATE xp SET xp = ${xp + 1} WHERE discord_id = ${authID}`;
        }
      }
      pool.query(sql);
    });
  }    


  // if (message.author.id == config.user_id && message.content == "//") {
  // }

  // Commands for the whoever's user ID is in the config.json file, essentially, whoever runs the bot
  // let leader;
  let leades = [];
  if ((message.content.slice(0, config.prefix.length) === config.prefix)) {
    let params = message.content.split(' ');
    let command = params.shift().slice(config.prefix.length).toLowerCase();
    // console.log(command);
    // console.log(params);

    if (authID == config.user_id) {
      switch (command) {
        case "ping":
          message.channel.send("PONG!");
          break;

        case "shutdown":
          message.delete();
          shutdown();
          break;

        case "uptime":
          message.channel.send(molly.uptime / 1000 + " seconds");
          break;

        case "setact":
          let tempTime = parseInt(params[0]);
          if (tempTime >= 1000 && tempTime <= 60000) {
            console.log("activityTime is being changed from " + activityTime + " to " + tempTime);
            config.timeout = tempTime;
            activityTime = tempTime;
            message.channel.send(`activityTime has been set to ${activityTime} miliseconds.`);
          } else {
            message.reply("I need a number between 1000 and 60000, this number is in miliseconds.");
          }
          break;
        
        case "act":
          message.channel.send(`activityTime is set to ${activityTime} miliseconds.`);
          break;

        case "xp":
          if(!isBot) {
            if (params.length == 1 && params[0].match(/<@!?[0-9]+>/g)) {
              let namestrip = params[0].match(/\d/g).join("");
              let avatar = message.mentions.members.first().user.avatarURL;
              cmd.checkXP(pool, namestrip, message);
            } else {
              message.reply("I need only one ping for a user in order to check their XP, no more, no less!"); 
            }
          }
          break;
        default: 
          break;
      }
    }

    // Commands for non-owner
    if (isBot) {
    switch (command) {
      case "xp":
          if (params.length == 1 && params[0].match(/<@!?[0-9]+>/g)) {
            let namestrip = params[0].match(/\d/g).join("");
            let avatar = message.mentions.members.first().user.displayAvatarURL;
            cmd.checkXP(pool, namestrip, message);
          } else {
            message.reply("I need only one ping for a user in order to check their XP, no more, no less!"); 
          }
        break;
        
      case "leader":
        pool.query('SELECT `discord_id`, `username`, `xp` FROM `xp` ORDER BY `xp` DESC LIMIT 1', (err, leader) => {
          if (err) console.error(err);
          molly.fetchUser("208736120433934336").then(success =>{
            let avatarID = success.avatar;
            let userID = success.id;
            let avatar = `https://cdn.discordapp.com/avatars/${userID}/${avatarID}.png?size=2048`
            let embed = createSingleEmbed(leader[0].username, avatar,`Who has the most XP?`, leader[0].xp);
            if (leader.length = 0) {
              message.channel.send("It appears I have no XP for anyone right now!");
            } else {
              message.channel.send("Someone called?", { embed });
            }
          } ,fail => {console.error(fail)});
        });
        break;

      default:
        break;
      }
    }
  }

  // Array with some initial data
  let data = [ parseInt(message.channel.id) ];

  // Parsing other things
  switch (message.channel.type) {
    case 'text':
      data.push(message.guild.name);
      break;
    case 'dm':
      data.push(message.channel.recipient.username);
      break;
    case 'group':
      data.push('group');
      break;
    default:
      return console.error('Invalid channel type.');
  }

  // Appending all the leftover data to data array
  data = data.concat([
    message.channel.name,
    message.channel.type,
    parseInt(message.author.id),
    message.author.username,
    parseInt(message.author.discriminator),
    message.author.bot,
    parseInt(message.author.id)
  ]);

  // Querying database
  pool.query('INSERT IGNORE INTO `channels` (`channel_id`, `guild`, `name`, `type`) VALUES (?, ?, ?, ?);' +
    'INSERT IGNORE INTO `users` (`discord_id`, `username`, `discriminator`, `bot`) VALUES (?, ?, ?, ?);' +
    'SELECT id FROM `users` WHERE `discord_id`=? LIMIT 1;', data, (error, rows, fields) => {
    // Error handling for first function; return is here to stop execution
    if (error) return console.error(error);
    // Third query result, first row, `id` column name - refer to node-mysql docs.
    let id = rows[2][0].id;
    pool.query('INSERT INTO `messages` (`channel_id`, `message_id`, `author`, `text`, `created_at`) VALUES (?, ?, ?, ?, ?);', [
      parseInt(message.channel.id),
      message.id,
      id,
      message.content,
      message.createdAt
    ], (error) => { if (error) console.error(error); });
  });
});

molly.on('messageUpdate', (oldMess, newMess) => {
  // if (oldMess.channel.type != "text") {
  //   return false;
  // }
  // if (oldMess.channel.guild.id != guildID) {
  //   return false;
  // }

  pool.query('UPDATE `messages` SET `text` = ?, `edited_at` = ? WHERE `message_id` = ?;', [
    newMess.content,
    newMess.editedAt,
    oldMess.id
  ], (error) => {
    if (error) console.error(error);
  });
});

login();
