function createSingleEmbed(title, avatar, string, xp) {
    if (avatar == null) {avatar = molly.user.displayAvatarURL}
    const embed = {
      "title": `${title}`,
      "color": 12648703,
      "thumbnail": {
        "url": `${avatar}`,
      },
      "fields": [
        {
          "name": `${string}`,
          "value": `${xp}`,
        }
      ]
    };
    return embed;
  }



exports.checkXP = function(pool, ping, message){
    let embed;
    pool.query('SELECT `xp` FROM xp WHERE `discord_id` = ?;', ping, (error, xp) => {
      let username = message.mentions.members.first().user.username;
      let avatar = message.mentions.members.first().user.displayAvatarURL;
      let xpQ;
      if (xp.length == 0) {
        xpQ = 0;
      } else {
        xpQ = xp[0].xp;
      }
      embed = createSingleEmbed(username, avatar,`How much XP do I have written down for you?`, xpQ);
      message.channel.send("Someone called?", { embed });
    });
  }