
const forecastURL = 'http://clashofclansforecaster.com/STATS.json'
    , Request = require('request')
    , Storage = require('node-storage')
    , Logger = require('./logger.js')

const logger = new Logger('Forecast')

const statuses = [
    'EXCELLENT'
  , 'GREAT'
  , 'GOOD'
  // , 'DECENT'
  // , 'OKAY'
  // , 'TERRIBLE'
]
const pollInterval = 60 * 60 * 1000  // 60 minutes
const re = new RegExp(/next (?:(\d+) hours?)? ?(?:(\d+) minutes?)?/)
const pollIntro = '**current loot forecast** *from clashofclansforecaster.com*'
const unavailable = 'Sorry, clashofclansforecaster.com is currently unavailable.' +
    '\n\nTry going directly to http://clashofclansforecaster.com'

function Forecast(config, client) {
  this.channel = null
  this.options = Object.assign({}, config.forecast)
  this.client = client
  this.forecast = {
      message: ''
    , word: ''
    , short: ''
    , hours: 0
    , minutes: 0
  }
  this.db = new Storage(this.options.db)
  this.subs = {
      excellent: new Set(this.db.get('subscribers.excellent') || [])
    , great: new Set(this.db.get('subscribers.great') || [])
    , good: new Set(this.db.get('subscribers.good') || [])
  }
  this.nextpoll = this.db.get('nextpoll') || 0
  this.online = false

  if (this.options.enabled) {
    this.client.on("message", this.onMessage.bind(this))
    this.client.on('ready', this.onReady.bind(this))
  }
}

// Forecast.DEFAULTS = {

// }

Forecast.prototype.getForecast = function() {
  logger.log('polling forecast')

  Request({
    url: forecastURL
  , json: true
  }, function (error, response, body) {
    let interval = pollInterval
    if (!error && response.statusCode === 200 && body.forecastMessages.english) {
      interval = this.processForecast(body.forecastMessages.english, body.forecastWordNow)
    }
    logger.log('next forecast poll in ' + (interval/1000) + ' seconds')
    setTimeout(this.getForecast.bind(this), interval)
    this.nextpoll = new Date().getTime() + interval
    this.db.put('nextpoll', this.nextpoll)
  }.bind(this))
}

Forecast.prototype.processForecast = function(sourceMessage, word) {

  let interval = pollInterval
    , subscribers = []
    , user
    , message = sourceMessage
    , short
    , hours = 0
    , minutes = 0
    , matches

  matches = re.exec(message)
  if (matches) {
    hours = parseInt(matches[1] || 0)
    minutes = parseInt(matches[2] || 0)
  }
  
  for (let status of statuses) {
    message = message.replace(status, `**${status}**`)
  }
  
  this.channel.fetchMessages()
    .then( messages => {
      messages.filter( m => !m.pinned ).deleteAll()
    })
    .then( 
      function() {
        this.channel.sendMessage(pollIntro + '\n' + message)
      }.bind(this)
    )

  if (word === 'EXCELLENT') {
    subscribers = subscribers.concat(Array.from(this.subs.excellent))
    subscribers = subscribers.concat(Array.from(this.subs.great))
    subscribers = subscribers.concat(Array.from(this.subs.good))
  }
  else if (word === 'GREAT') {
    subscribers = subscribers.concat(Array.from(this.subs.great))
    subscribers = subscribers.concat(Array.from(this.subs.good))
  }
  else if (word === 'GOOD') {
    subscribers = subscribers.concat(Array.from(this.subs.good))
  }
  if (subscribers) {
    if (hours > 0 || minutes > 0) {
      short = `Loot will be ${word} for the next`
      if (hours == 1) {
        short = `${short} 1 hour`
      }
      else if (hours > 1) {
        short = `${short} ${hours} hours`
      }

      if (minutes == 1) {
        short = `${short} 1 minute`
      }
      else if (minutes > 1) {
        short = `${short} ${minutes} minutes`
      }
    }
    else {
      short = `Loot is ${word} right now`
    }
    for (let username of subscribers) {
      user = this.client.users.find('username', username)
      if (user) {
        user.sendMessage(short)
      }
    }
  }

  if (hours > 0 || minutes > 0) {
    interval = (((hours * 60) + minutes + 1) * 60) * 1000 
  }
  return interval
}

Forecast.prototype.subscribe = function(username, category) {
  this.subs.good.delete(username)
  this.subs.great.delete(username)
  this.subs.excellent.delete(username)
  if (category && this.subs[category]) {
    this.subs[category].add(username)
  }
  this.db.put('subscribers.good', Array.from(this.subs.good))
  this.db.put('subscribers.great', Array.from(this.subs.great))
  this.db.put('subscribers.excellent', Array.from(this.subs.excellent))
}

Forecast.prototype.unsubscribe = function(username) {
  this.subscribe(username, null)
}

Forecast.prototype.onMessage = function(msg) {
  let output
  if (msg.content === '!forecast') {
    output = 'You can see the latest forecast in ' + this.channel + '\n'
      + '*You might also be interested in subscription:*' + '\n'
      + '**`!forecast subscribe        ` **- get pinged when loot is EXCELLENT' + '\n'
      + '**`!forecast subscribe great  ` **- get pinged when loot is GREAT or EXCELLENT' + '\n'
      + '**`!forecast subscribe good   ` **- get pinged when loot is GOOD, GREAT or EXCELLENT' + '\n'
      + '**`!forecast unsubscribe      ` **- stop all loot pings' + '\n' + '\n'

    output = output + '**NOTE:** '

    if (this.subs.excellent.has(msg.author.username)) {
      output = output + 'you are subscribed and will be pinged if loot is EXCELLENT'
    }
    else if (this.subs.great.has(msg.author.username)) {
      output = output + 'you are subscribed and will be pinged if loot is GREAT or EXCELLENT'
    }
    else if (this.subs.good.has(msg.author.username)) {
      output = output + 'you are subscribed and will be pinged if loot is GOOD, GREAT or EXCELLENT'
    }
    else {
      output = output + 'you are not subscribed'
    }
    msg.channel.sendMessage(output)
  }
  else if (msg.content === '!forecast subscribe' || msg.content === '!forecast subscribe excellent') {
    this.subscribe(msg.author.username, 'excellent')
    output = 'you are subscribed and will be pinged if loot is EXCELLENT'
    msg.reply(output)
  }
  else if (msg.content === '!forecast subscribe great') {
    this.subscribe(msg.author.username, 'great')
    output = 'you are subscribed and will be pinged if loot is GREAT or EXCELLENT'
    msg.reply(output)
  }
  else if (msg.content === '!forecast subscribe good') {
    this.subscribe(msg.author.username, 'good')
    output = 'you are subscribed and will be pinged if loot is GOOD, GREAT or EXCELLENT'
    msg.reply(output)
  }
  else if (msg.content === '!forecast unsubscribe') {
    this.unsubscribe(msg.author.username)
    msg.reply('you are not subscribed')
  }
  else if (msg.content.startsWith('!forecast')) {
    msg.channel.sendMessage('I didn\'t understand that... try typing `!forecast` for the available commands')
  }
}

Forecast.prototype.onReady = function() {
  let nowDT = new Date().getTime()
    , interval = 1000
  if (!this.online) {
    logger.log('online!')
    this.online = true
    this.channel = this.client.channels.find('name', this.options.channel)
    if (this.nextpoll && nowDT < this.nextpoll) {
      interval = this.nextpoll - nowDT
    }
    logger.log('starting forecast poll in ' + (interval/1000) + ' seconds')
    setTimeout(this.getForecast.bind(this), interval)
  }
}


module.exports = Forecast
