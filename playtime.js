const Cleverbot = require('cleverbot-node')
    , Logger = require('./logger.js')

const logger = new Logger('Playtime')

const bangbang_regex = new RegExp(/!!+/, 'i')
    , lol_regex = new RegExp(/\b(?:lol|rofl|lmao|roflmao)\b/, 'i')
    , mention_regex = new RegExp(/<@[^>]+> ?/g)

const points = [
    "that's a lot of exclamation points!!!"
  , "you certainly made your [exclamation] point there"
  , "quite the punctuation fan, aren't you?"
]

const snarky = [
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

function Playtime(config, client) {
  this.client = client
  this.options = Object.assign({}, config.playtime)
  this.cleverbot = new Cleverbot
  this.online = false
  if (this.options.enabled) {
    this.client.on("message", this.onMessage.bind(this))
    this.client.on('ready', this.onReady.bind(this))
  }
}

Playtime.prototype.onMessage = function(msg) {
  let output
  if (msg.content.startsWith('!harass ') && msg.author.username === 'nkryptic') {
    let name = msg.content.replace('!harass ', '').toLowerCase()
    let choice = getRandomInt(0, snarky.length)

    if (name) {
      let target = msg.channel.guild.members.find((member) => {
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
    let newmsg = msg.content.replace(mention_regex, '').replace('!ask ', '')
    this.cleverbot.write(newmsg, function (response) {
      msg.channel.sendMessage(response.message)
    })
  }
  else if (msg.author.username === 'Stacey') {
    let nowDT = new Date()
      , choice = null
    if (msg.mentions.users.exists('username', 'nkryptic') && nowDT.getHours() < 6) {
      msg.reply("you know, he *could* be sleeping")
    }
    else if (msg.mentions.users.exists('username', 'nkryptic')
      || lol_regex.test(msg.content)
    ) {
      choice = getRandomInt(0, snarky.length)
      // msg.reply('leave poor nkryptic alone!')
      msg.channel.sendMessage('Stacey, ' + snarky[choice])
    }
    else if (bangbang_regex.test(msg.content)) {
      choice = getRandomInt(0, points.length)
      msg.channel.sendMessage('Stacey, ' + points[choice])
    }
    else if (msg.content.startsWith('.list weight')) {
      msg.channel.sendMessage('Stacey, just can\'t help yourself, can you?')
    }
  }
}

Playtime.prototype.onReady = function() {
  if (!this.online) {
    logger.log('online!')
    this.online = true
    Cleverbot.prepare(() => {})
  }
  this.client.user.setGame("with Stacey's mind")
}


function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}


module.exports = Playtime
