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
var Discord = require('discord.js');
var Forecast = require('./forecast.js')
var WarMom = require('./warmom.js')
var Cleverbot = require('cleverbot-node')

var re1 = new RegExp(/!!+/, 'i')
var re2 = new RegExp(/\b(?:lol|rofl|lmao|roflmao)\b/, 'i')
var re3 = new RegExp(/<@[^>]+> ?/g)

var points = [
    "that's a lot of exclamation points!!!"
  , "you certainly made your [exclamation] point there"
  , "quite the punctuation fan, aren't you?"
]
var snarky = [
    "I like you. You remind me of me when I was young and stupid."
  , "I don’t know what your problem is, but I’ll bet it’s hard to pronounce."
  , "How about never? Is never good for you?"
  , "I see you’ve set aside this special time to humiliate yourself in public."
  , "I’m really easy to get along with once you people learn to worship me."
  , "Well, aren’t we a bloody ray of sunshine?"
  , "I’m out of my mind, but feel free to leave a message."
  , "I said, “No.” Which word don’t you understand?"
  , "I refuse to have a battle of wits with an unarmed person."
  , "It sounds like English, but I can’t understand a word you’re saying."
  , "If things get any worse, I’ll have to ask you to stop helping me."
  , "I can see your point, but I still think you’re full of crap."
  , "You are validating my inherent mistrust of co-workers."
  , "I have plenty of talent and vision. I just don’t give a damn."
  , "I’m already visualizing the duct tape over your mouth."
  , "I will always cherish the initial misconceptions I had about you."
  , "The fact that no one understands you doesn’t make you an artist."
  , "Any connection between your reality and mine is purely coincidental."
  , "What am I? Flypaper for freaks!?"
  , "I’m not being rude. You’re just insignificant."
  , "It’s a thankless job, but I’ve got a lot of Karma to burn off."
  , "Yes, I am an agent of Satan, but my duties are largely ceremonial."
  , "No, my powers can only be used for good."
  , "You sound reasonable. Did you take your meds today?"
  , "Who me? I just wander from room to room."
  , "Don’t worry. I forgot your name, too."
  , "You say I’m a bitch like it’s a bad thing."
  , "Thank you. We’re all refreshed and challenged by your unique point of view."
  , "Don’t bother me, I’m living happily ever after."
  , "This isn’t an office. It’s HELL with fluorescent lighting."
  , "Therapy is expensive. Popping bubble wrap is cheap. You choose."
  , "I’m not crazy. I’ve been in a very bad mood for the last 30 years."
  , "Sarcasm is just one more service I offer."
  , "Do they ever shut up on your planet?"
  , "Back off!! You’re standing in my aura."
  , "Well, this day was a total waste of make-up."
  , "I work 50 hours a week to be this poor."
  , "I’ll try being nicer if you’ll try being smarter."
  , "Ambivalent? Well, yes and no."
  , "Earth is full. Go home."
  , "Aw, did I step on your poor itty bitty ego?"
  , "You are depriving some village of their idiot."
  , "Whatever kind of look you were going for, you missed."
  , "Wait…I’m trying to imagine you with a personality."
  , "We’ve been friends for a very long time. How about we call it quits?"
  , "Ahhh. I see the SNAFU fairy has visited us again."
  , "Oh I get it … like humor … but different."
]

var main = {
    onMessage: msg => {
      let output
      if (msg.content.startsWith('!harass ') && msg.author.username === 'nkryptic') {
        let name = msg.content.replace('!harass ', '').toLowerCase()
        let pw = bot.guilds.find('name', 'Playmakers Wanted')
        let choice = getRandomInt(0, snarky.length)

        if (name) {
          let target = pw.members.find((member) => {
            if (member.user.username.toLowerCase() === name
                || (member.nickname && member.nickname.toLowerCase() === name)
            ) {
              return true
            }
            return false
          })
          if (target) {
            msg.channel.sendMessage(`${target}, ${snarky[choice]}`)
          }
          else {
            msg.channel.sendMessage(`Nobody matching '${name}' found`)
          }
        }
      }
      else if (msg.content.startsWith('!ask ') || msg.mentions.users.exists('username', 'nkrypticBot')) {
        let newmsg = msg.content.replace(re3, '').replace('!ask ', '')
        cleverbot.write(newmsg, function (response) {
          msg.channel.sendMessage(response.message)
        })
      }
      else if (msg.author.username === 'Stacey') {
        let nowDT = new Date()
        let choice
        // if ((nowDT.getDate() % 3) == 0) { // on days divisble by 3
          if (msg.mentions.users.exists('username', 'nkryptic') && nowDT.getHours() < 6) {
            msg.reply("you know, he *could* be sleeping")
          }
          else if (msg.mentions.users.exists('username', 'nkryptic')
            || re2.test(msg.content)
          ) {
            choice = getRandomInt(0, snarky.length)
            // msg.reply('leave poor nkryptic alone!')
            msg.channel.sendMessage(snarky[choice])
          }
          else if (re1.test(msg.content)) {
            choice = getRandomInt(0, points.length)
            msg.channel.sendMessage(points[choice])
          }
          else if (msg.content.startsWith('.list weight')) {
            msg.channel.sendMessage('just can\'t help yourself, can you?')
          }
        // }
      }
    }
  , onReady: () => {
      console.log('kryptBot is ready! ' + new Date())
      bot.user.setGame("with Stacey's mind")
    }
}

console.log('initial discord client setup starting: ' + new Date())
var bot = new Discord.Client();
bot.on('message', main.onMessage)
bot.on('ready', main.onReady)
bot.on('reconnecting', () => { console.log('reconnecting to discord: ' + new Date()) })

var cleverbot = new Cleverbot
Cleverbot.prepare(() => {})
var forecast = new Forecast(config, bot)
var warmom = new WarMom(config, bot)

bot.login(config.botToken)


function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

