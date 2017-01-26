/*
TODO: 
- [IN PROGRESS] refactor into separate modules and use class based style
- if reconnecting w/ forever was the cause of dupe timers, then refactor to address
- add command to ping people with attacks left to take in war
- add onboarding process (may require re-adding bot with proper perms/role)

To add to server with administrator permission:
https://discordapp.com/oauth2/authorize?client_id=APPLICATION_CLIENT_ID&permissions=8&scope=bot 
*/

const config   = require('./config.json')
const Discord  = require('discord.js');
const Forecast = require('./forecast.js')
const WarWatch = require('./warwatch.js')
const Playtime = require('./playtime.js')
const Logger   = require('./logger.js')

const logger = new Logger('kryptBot')
logger.log('starting initial setup')

var bot = new Discord.Client()
bot.on('ready', () => { logger.log('ready!') })
bot.on('reconnecting', () => { logger.error('reconnecting to discord') })

var forecast = new Forecast(config, bot)
var warwatch = new WarWatch(config, bot)
var playtime = new Playtime(config, bot)

bot.login(config.botToken)
