const config = require('../config.json')
var Discord = require("discord.js");
var bot = new Discord.Client();

bot.on("message", msg => {
  if ((msg.content === '!yo' || msg.content === 'yo') && !msg.author.bot) {
    if (msg.mentions.users.exists('username', bot.user.username)) {
      msg.reply('Leave me out of it!')
    }
    else {
      msg.reply('What do you want?!?')
    }
  }
})

bot.on('ready', () => {
  console.log('I am ready!')
  var user = bot.users.find('username', 'nkryptic')
  console.log('nkryptic is a bot: @' + user.username + '#' + user.discriminator)
})

bot.login(config.botToken)

