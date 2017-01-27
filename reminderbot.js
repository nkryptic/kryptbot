/*
TODO: 

To add to server with administrator permission:
https://discordapp.com/oauth2/authorize?client_id=APPLICATION_CLIENT_ID&permissions=8&scope=bot 
*/

const config = require('./config.json')
var Discord = require('discord.js');
var bot = new Discord.Client();
bot.on('ready', () => {
  const gngChan = bot.channels.find('name', 'gng-warroom')
  const gngRole = gngChan.guild.roles.find('name', 'GNG')
  // gngChan.sendMessage('**Reminder** collect your treasury loot before war ends! ' + gngRole)
  bot.destroy()
})
bot.login(config.botToken)
