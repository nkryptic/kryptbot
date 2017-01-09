/*
TODO: 
- [IN PROGRESS] refactor into separate modules and use class based style
- if reconnecting w/ forever was the cause of dupe timers, then refactor to address
- add command to ping people with attacks left to take in war
- add onboarding process (may require re-adding bot with proper perms/role)

To add to server with administrator permission:
https://discordapp.com/oauth2/authorize?client_id=APPLICATION_CLIENT_ID&permissions=8&scope=bot 
*/

const config = require('./config.json')
const Discord = require('discord.js');
const Forecast = require('./forecast.js')
const WarMom = require('./warmom.js')
const Playtime = require('./playtime.js')

console.log('initial discord client setup starting: ' + new Date())

var bot = new Discord.Client()
bot.on('ready', () => { console.log('kryptBot is ready! ' + new Date()) })
bot.on('reconnecting', () => { console.log('reconnecting to discord: ' + new Date()) })

var forecast = new Forecast(config, bot)
var warmom   = new WarMom(config, bot)
var playtime = new Playtime(config, bot)

bot.login(config.botToken)
