/*
TODO:
- auto-cleanup old accounts?

- how to handle friedly/arranged wars?
    need jv to add that info to status output
    don't send marching orders for them?
*/
const splitMessage = require('discord.js').splitMessage
const Storage = require('node-storage')
const hash = require('string-hash')
const Logger = require('./logger.js')

const appName = 'WarWatch'
const logger = new Logger(appName)

const acctHashLabel = appName + 'ID'
const base_cmd_text = '!warwatch'
const base_cmd_regex = new RegExp(/^/.source + base_cmd_text + /\b/.source, 'i')
const usage_cmd_regex = new RegExp(base_cmd_regex.source + / *$/.source, 'i')
const list_owners_cmd_regex = new RegExp(base_cmd_regex.source + / +owners *$/.source, 'i')
const list_roster_cmd_regex = new RegExp(base_cmd_regex.source + / +roster *$/.source, 'i')
const marching_orders_cmd_regex = new RegExp(base_cmd_regex.source + / +notify +march *$/.source, 'i')
const status_cmd_regex = new RegExp(base_cmd_regex.source + / +status *$/.source, 'i')
const add_cmd_regex = new RegExp(base_cmd_regex.source + / +add +(.+) +to +(.+) *$/.source, 'i')
const remove_cmd_regex = new RegExp(base_cmd_regex.source + / +remove +(.+) *$/.source, 'i')
const cleanup_cmd_regex = new RegExp(base_cmd_regex.source + / +cleanup *$/.source, 'i')
const identify_cmd_regex = new RegExp(base_cmd_regex.source + / +identify +(.+) *$/.source, 'i')
const release_cmd_regex = new RegExp(base_cmd_regex.source + / +release +(.+) *$/.source, 'i')
const status_regex = new RegExp(
    'there are no active wars'
  + '|'
  + 'War (starts|ends|ended) '
  + '(?:(\\d+) days?,?)? ?'
  + '(?:(\\d+) hours?,?)? ?'
  + '(?:(\\d+) minutes?,?)? ?'
  + '(?:(\\d+) seconds?,?)?'
  + '[^]*warmatch\\.us\\/clans\\/war\\/(\\d+)'
  , 'm')
// const war_regex = new RegExp(/warmatch.us\/clans\/war\/(\d+)/, 'm')
const lineup_regex = new RegExp(/^(\d+)\. TH\d+ (.+) (?:([12]) attacks left|done)$/)
const marching_regex = new RegExp(/^(\d+)\. TH\d+ (.+): (.*)$/)
const roster_regex = new RegExp(/^TH(\d+) (.+) \$\d+(?: k\d+)?(?: q\d+)?(?: w\d+)?$/)
const basicUsage = '*The ' + appName + ' commands:*' + '\n'
  + '**`' + base_cmd_text + ' status` ** - show clan reminder status' + '\n'
  + '**`' + base_cmd_text + ' owners` ** - list Discord users with registered CoC accounts (in any clan)' + '\n'
  + '**`' + base_cmd_text + ' roster` ** - list clan accounts with their registered owner (or ' + acctHashLabel + ')' + '\n'
  + '**`' + base_cmd_text + ' identify <clashID or ' + acctHashLabel + '>` ** - register a clan account to yourself'
const authUsage = basicUsage + '\n\nAdmin-only commands:\n'
  + '**`' + base_cmd_text + ' add <clashID or ' + acctHashLabel + '> to <Discord username>` ** - register a clan account for a Discord user' + '\n'
  + '**`' + base_cmd_text + ' remove <clashID or ' + acctHashLabel + '>` ** - unregister a clan account' + '\n'
  + '**`' + base_cmd_text + ' cleanup` ** - remove Discord users and registered accounts that have left the server' + '\n'
  + '**`' + base_cmd_text + ' notify march` ** - ping marching orders to owners of clan accounts in war'
const badChannel = appName + ' can only be run from a war room channel'
const warmatchErrorMsg = 'There was an error retrieving information from warmatch'
const msDay = 24 * 60 * 60 * 1000
    , msHour = 60 * 60 * 1000
    , msMinute = 60 * 1000
const rosterPartitions = {
  5: {
    firstHalf: {min: 1, max: 2},
    secondHalf: {min: 3, max: 5},
    firstQuarter: {min: 1, max: 1},
    secondQuarter: {min: 2, max: 2},
    thirdQuarter: {min: 3, max: 3},
    fourthQuarter: {min: 4, max: 5}
  },
  10: {
    firstHalf: {min: 1, max: 5},
    secondHalf: {min: 6, max: 10},
    firstQuarter: {min: 1, max: 2},
    secondQuarter: {min: 3, max: 5},
    thirdQuarter: {min: 6, max: 7},
    fourthQuarter: {min: 8, max: 10}
  },
  15: {
    firstHalf: {min: 1, max: 7},
    secondHalf: {min: 8, max: 15},
    firstQuarter: {min: 1, max: 3},
    secondQuarter: {min: 4, max: 7},
    thirdQuarter: {min: 8, max: 10},
    fourthQuarter: {min: 11, max: 15}
  },
  20: {
    firstHalf: {min: 1, max: 10},
    secondHalf: {min: 11, max: 20},
    firstQuarter: {min: 1, max: 5},
    secondQuarter: {min: 6, max: 10},
    thirdQuarter: {min: 11, max: 15},
    fourthQuarter: {min: 16, max: 20}
  },
  25: {
    firstHalf: {min: 1, max: 12},
    secondHalf: {min: 13, max: 25},
    firstQuarter: {min: 1, max: 6},
    secondQuarter: {min: 7, max: 12},
    thirdQuarter: {min: 13, max: 18},
    fourthQuarter: {min: 19, max: 25}
  },
  30: {
    firstHalf: {min: 1, max: 15},
    secondHalf: {min: 16, max: 30},
    firstQuarter: {min: 1, max: 7},
    secondQuarter: {min: 8, max: 15},
    thirdQuarter: {min: 16, max: 22},
    fourthQuarter: {min: 23, max: 30}
  },
  40: {
    firstHalf: {min: 1, max: 20},
    secondHalf: {min: 21, max: 40},
    firstQuarter: {min: 1, max: 10},
    secondQuarter: {min: 11, max: 20},
    thirdQuarter: {min: 21, max: 30},
    fourthQuarter: {min: 31, max: 40}
  },
  50: {
    firstHalf: {min: 1, max: 25},
    secondHalf: {min: 26, max: 50},
    firstQuarter: {min: 1, max: 12},
    secondQuarter: {min: 13, max: 25},
    thirdQuarter: {min: 26, max: 37},
    fourthQuarter: {min: 38, max: 50}
  }
}
const VALID_RANGE_KEYS = new Set([
    'firstHalf'
  , 'secondHalf'
  , 'firstQuarter'
  , 'secondQuarter'
  , 'thirdQuarter'
  , 'fourthQuarter'
])
const HUMANIZED_RANGES = new Map([
    ['firstHalf', 'top 50%']
  , ['secondHalf', 'bottom 50%']
  , ['firstQuarter', 'top 25%']
  , ['secondQuarter', 'upper-middle 25%']
  , ['thirdQuarter', 'lower-middle 25%']
  , ['fourthQuarter', 'bottom 25%']
])
const retryInfo = {
    checkWarNoWarInterval: 12 * msHour
  , checkWarErrorInterval: 30 * msMinute
  , reminderErrorInterval: 2 * msMinute
  , reminderErrorMaxTries: 5
}


function WarWatch(config, client) {
  // this.annChannel = null
  this.client = client
  // this.options = Object.assign({}, config.warwatch)
  this.options = JSON.parse(JSON.stringify(config.warwatch))
  this.db = new Storage(this.options.db)
  this.accounts = {
      clash: new Map(this.db.get('accounts.clash') || [])
    , discord: new Map(this.db.get('accounts.discord') || [])
  }
  this.warrooms = {}
  this.timers = {}
  this.reminders = {}
  this.guild = null
  this.online = false

  this._validateAutoSettings()
  if (this.options.enabled)  {
    this.client.on('message', this.onMessage.bind(this))
    this.client.on('ready', this.onReady.bind(this))
  }
}

WarWatch.prototype._humanizeRange = function(range) {
  const output = HUMANIZED_RANGES.get(range) || 'unknown %'
  return output
}

WarWatch.prototype._timeToMS = function(time) {
  const total = (msHour * (time.hours || 0)) + (msMinute * (time.minutes || 0))
  return total
}

WarWatch.prototype._formatMS = function(total) {
  const hours = Math.floor(total / msHour)
      , minutes = Math.floor((total % msHour) / msMinute)
  return this._formatTime(minutes, hours)
}

WarWatch.prototype._formatTime = function(minutes, hours) {
  let message
    , part
    , parts = []

  if (hours && hours > 0) {
    part = `${hours} hour`
    if (hours > 1) {
      part = part + 's'
    }
    parts.push(part)
  }
  if (minutes && minutes > 0) {
    part = `${minutes} minute`
    if (minutes > 1) {
      part = part + 's'
    }
    parts.push(part)
  }
  if (parts.length === 0) {
    message = '0 minutes'
  }
  else {
    message = parts.join(', ')
  }
  return message
}

WarWatch.prototype._formatMemberMsg = function(member, text, testing) {
  let output

  if (testing) {
    if (member.nickname) {
      output = '@' + member.nickname
    }
    else {
      output = '@' + member.user.username
    }
  }
  else {
    output = '' + member
  }
  output = output + ' ' + text
  return output
}

WarWatch.prototype._sendMessage = function(channel, output) {
  let messages = splitMessage(output)
  if (messages instanceof Array) {
    for (let partial of messages) {
      channel.sendMessage(partial)
        .catch(e => {})
    }
  }
  else {
    channel.sendMessage(messages)
      .catch(e => {})
  }
}

WarWatch.prototype._getMember = function(needle, searchByName) {
  let target = null

  if (needle) {
    if (searchByName) {
      target = this.guild.members.find((member) => {
        if (member.user.username.toLowerCase() === needle.toLowerCase()
            || (member.nickname && member.nickname.toLowerCase() === needle.toLowerCase())
        ) {
          return true
        }
        return false
      })
    }
    else {
      target = this.guild.members.find( member => member.user.id === needle )
    }
  }
  return target
}

WarWatch.prototype._addAccount = function(clashid, member) {
  for (let [k, v] of this.accounts.discord.entries()) {
    if (k != member.id && v.indexOf(clashid) > -1) {
      v.splice(v.indexOf(clashid), 1)
      if (v.length > 0) {
        this.accounts.discord.set(k, v)
      }
      else {
        this.accounts.discord.delete(k)
      }
    }
  }
  let owned = this.accounts.discord.get(member.id) || []
  if (owned.indexOf(clashid) === -1) {
    owned.push(clashid)
  }
  this.accounts.discord.set(member.id, owned)
  this.accounts.clash.set(clashid, member.id)

  this.db.put('accounts.discord', Array.from(this.accounts.discord.entries()))
  this.db.put('accounts.clash', Array.from(this.accounts.clash.entries()))
}

WarWatch.prototype._removeAccount = function(clashid) {
  for (let [k, v] of this.accounts.discord.entries()) {
    if (v.indexOf(clashid) > -1) {
      v.splice(v.indexOf(clashid), 1)
      if (v.length > 0) {
        this.accounts.discord.set(k, v)
      }
      else {
        this.accounts.discord.delete(k)
      }
    }
  }
  
  this.accounts.clash.delete(clashid)

  this.db.put('accounts.discord', Array.from(this.accounts.discord.entries()))
  this.db.put('accounts.clash', Array.from(this.accounts.clash.entries()))
}

WarWatch.prototype._lookupClashID = function(clashid_or_hash) {
  let clashid

  for (let k of this.accounts.clash.keys()) {
    let uid = hash(k).toString()
    if (k === clashid_or_hash || uid === clashid_or_hash) {
      clashid = k
    }
  }
  return clashid
}

WarWatch.prototype._addReminder = function(roomName, idx, sourceReminder) {
  let reminder = JSON.parse(JSON.stringify(sourceReminder))

  if (! (reminder.include && reminder.include instanceof Object)) {
    reminder.include = {}
  }

  if (! (reminder.filter && reminder.filter instanceof Object)) {
    reminder.filter = {}
  }

  if (!reminder.label) {
    reminder.label = `Reminder #${idx}`
  }

  if (! (reminder.time && reminder.time instanceof Object && (reminder.time.hours || reminder.time.minutes))) {
    logger.error(`skipping ${roomName} reminder #${idx} - invalid or missing time attribute`)
    return
  }
  else if (! (reminder.include.orders || reminder.include.attacksLeft || reminder.include.timeLeft || reminder.message)) {
    logger.error(`skipping ${roomName} reminder #${idx} - no message or include directive`)
    return
  }
  else if (reminder.filter.range && !VALID_RANGE_KEYS.has(reminder.filter.range)) {
    logger.error(`skipping ${roomName} reminder #${idx} - bad range filter specified: ${reminder.filter.range}`)
    return
  }

  this.reminders[roomName].push(reminder)
}

WarWatch.prototype._clearTimer = function(roomName) {
  for (let t of this.timers[roomName]) {
    clearTimeout(t)
  }
  this.timers[roomName] = []
}

WarWatch.prototype._addTimer = function(roomName, func, interval) {
  // save the timeout ID, so we can cancel
  this.timers[roomName].push(setTimeout(func, interval))
}

WarWatch.prototype._validateAutoSettings = function() {
  const defaultTime = {hours: 1, minutes: 0}
  let override = false
  for (let roomName of Object.keys(this.options.warrooms)) {
    if (this.options.warrooms[roomName].autoMarchTime) {
      if (this.options.warrooms[roomName].autoMarchTime instanceof Object) {
        if (! (this.options.warrooms[roomName].autoMarchTime.hours || this.options.warrooms[roomName].autoMarchTime.minutes)) {
          override = true
        }
      }
      else {
        override = true
      }
    }
    else {
      override = true
    }

    if (override) {
      this.options.warrooms[roomName].autoMarchTime = Object.assign({}, defaultTime)
    }
  }
}

WarWatch.prototype.resolveClashID = function(clashid_or_hash, roomName) {
  return this.getRoster(roomName)
    .then(function(roster) {
      let clashid = null
      for (let entry of roster) {
        if (entry.clashid === clashid_or_hash || entry.uid === clashid_or_hash) {
          clashid = entry.clashid
        }
      }
      return clashid
    }.bind(this))
}

WarWatch.prototype.parseStatus = function(message) {
  const match = status_regex.exec(message)
  const status = {
      status: match && match[1]
    , days: match && parseInt(match[2] || 0)
    , hours: match && parseInt(match[3] || 0)
    , minutes: match && parseInt(match[4] || 0)
    , seconds: match && parseInt(match[5] || 0)
    , totalMilliseconds: 0
    , warId: match && match[5]
  }
  status.totalMilliseconds = (status.seconds + (60 * (status.minutes + (60 * status.hours)))) * 1000
  return status
}

WarWatch.prototype.parseLineup = function(message) {
  // parse out the CoC account names and attacks
  let lineup = new Map()

  for (let line of message.split(/\r?\n/)) {
    let match = lineup_regex.exec(line)
    if (match) {
      let position = parseInt(match[1])
      lineup.set(position, {
          position: position
        , discordid: this.accounts.clash.get(match[2])
        , clashid: match[2]
        , remaining: parseInt(match[3] || 0)
      })
    }
  }

  return lineup
}

WarWatch.prototype.parseMarchingOrders = function(message) {
  // parse out the CoC account names and orders
  let orders = new Map()

  for (let line of message.split(/\r?\n/)) {
    let match = marching_regex.exec(line)
    if (match) {
      let position = parseInt(match[1])
      orders.set(position, {
          position: position
        , discordid: this.accounts.clash.get(match[2])
        , clashid: match[2]
        , orders: match[3]
      })
    }
  }

  return orders
}

WarWatch.prototype.parseRoster = function(message) {
  // parse out the CoC account names
  let roster = []

  for (let line of message.split(/\r?\n/)) {
    let match = roster_regex.exec(line)
    if (match) {
      roster.push({
          discordid: this.accounts.clash.get(match[2])
        , clashid: match[2]
        , townhall: match[1]
        , uid: hash(match[2]).toString()
      })
    }
  }

  return roster
}

WarWatch.prototype._getWMInfo = function(roomName, cmd, filter, funcName) {
  // errors: ['time'] treats ending because of the time limit as an error
  let promise = this.warrooms[roomName].awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
    .then( function(collected) {
      let response = collected.first()
      response.delete()
        .catch(e => {})
      const result = this[funcName](response.content)
      return result
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        throw new Error('timeout waiting for warmatch info (' + cmd + ')')
      } else {
        throw collected
      }
    });

  this.warrooms[roomName].sendMessage(cmd)
    .then(m => {
      m.delete()
        .catch(e => {})
    })
    .catch(e => {})

  return promise
}

WarWatch.prototype.getLineup = function(roomName) {
  const filter = m => m.author.bot && m.content.startsWith('Our lineup')
  return this._getWMInfo(roomName, '.lineup', filter, 'parseLineup')
}

WarWatch.prototype.getMarchingOrders = function(roomName) {
  const filter = m => m.author.bot && m.content.startsWith('Marching orders')
  return this._getWMInfo(roomName, '.march', filter, 'parseMarchingOrders')
}

WarWatch.prototype.getStatus = function(roomName) {
  // get the current war status from '.status'
  const filter = m => m.author.bot && m.author.username === 'wmbot' && status_regex.test(m.content)
  return this._getWMInfo(roomName, '.status', filter, 'parseStatus')
}

WarWatch.prototype.getRoster = function(roomName) {
  // get the current roster from '.list weight'
  const filter = m => m.author.bot && m.author.username === 'wmbot' && m.content.startsWith('List all by weight')
  return this._getWMInfo(roomName, '.list weight', filter, 'parseRoster')
}

WarWatch.prototype._mergeLineupOrders = function(lineup, orders) {
  if (! orders) {
    return lineup
  }
  let results = new Map()
  for (let [idx, entry] of lineup) {
    let order = orders.get(idx) || {}
      , result = {}
    Object.assign(result, order, entry)
    results.set(idx, result)
  }
  return results
}

WarWatch.prototype._handleReminder = function(roomName, reminder, status, entries, channel, testing) {
  let unnotified = []
    , owned = new Map([])
    // , baseMsg
    , minAttacks = 1
    , range = {}
    , clan = this.options.warrooms[roomName].clan
    , warTimeMsg = `${clan} war...`

  if (reminder.filter.range) {
    if (Object.keys(rosterPartitions).includes(entries.size.toString())) {
      range = rosterPartitions[entries.size][reminder.filter.range]
    }
  }
  if (reminder.filter.has2attacks) {
    minAttacks = 2
  }

  if (reminder.include.timeLeft) {
    warTimeMsg = `${clan} war ${status.status} in ` + this._formatTime(status.minutes, status.hours)
  }

  for (let [idx, entry] of entries) {
    skip = false
    if ((!entry.remaining) || entry.remaining < minAttacks) {
      skip = true
    }
    if ((range.min && entry.position < range.min) || (range.max && entry.position > range.max)) {
      skip = true
    }
    if (status.status == 'starts' && reminder.include.orders && !entry.orders) {
      skip = true
    }

    /*
        @discordacct - TIME LEFT IN WAR...
        1. CLASHID: some message...`
          marching orders: orders go here...`
          attacks remaining: 1 or 2`
    */
    if (!skip) {
      let member = this._getMember(entry.discordid)
      if (member) {
        let data = owned.get(member.id) || {messages: []}
        let acctTxt = `**${entry.position}. ${entry.clashid}**`
        if (!data.member) {
          data.member = member
        }
        if (reminder.message) {
          data.messages.push(`${acctTxt}: *${reminder.message}*`)
        }
        else {
          data.messages.push(acctTxt)
        }
        if (reminder.include.orders && entry.orders) {
          data.messages.push('\t- marching orders: ' + entry.orders)
        }
        if (reminder.include.attacksLeft) {
          data.messages.push('\t- attacks remaining: ' + entry.remaining)
        }
        owned.set(member.id, data)
      }
      else {
        unnotified.push(entry.clashid)
      }
    }
  }

  channel.sendMessage('Starting notifications for reminder *' + reminder.label + '*')
    .catch(e => {})

  for (let data of owned.values()) {
    let messages = [warTimeMsg]
      , output

    messages = messages.concat(data.messages)
    output = this._formatMemberMsg(data.member, messages.join('\n'), testing)
    this._sendMessage(channel, output)
  }
  if (unnotified.length > 0) {
    let output = '\n**The following could not be notified, as they are unowned:**\n'
    output = output + unnotified.join('\n')
    this._sendMessage(channel, output)
  }
}

WarWatch.prototype.doReminder = function(roomName, reminderIdx, channel, testing, retries) {
  var $scope = {}
  let reminder
  if (reminderIdx instanceof Object) {
    reminder = reminderIdx
  }
  else {
    reminder = this.reminders[roomName][reminderIdx]
  }
  
  channel = channel || this.warrooms[roomName]

  if (reminder) {
    this.getStatus(roomName)
      .then(function(status) {
        $scope.status = status
        if (status.status === 'ends' || (status.status == 'starts' && reminder.include.orders)) {
          return this.getLineup(roomName)
        }
        else {
          logger.error(`Reminder ${reminder.label} called at wrong time for ${roomName}`)
          throw new Error('ReminderAtWrongTime')
        }
      }.bind(this))
      .then(function(lineup) {
        $scope.lineup = lineup
        if (reminder.include.orders) {
          return this.getMarchingOrders(roomName)
        }
        else {
          return new Promise(resolve => {resolve()})
        }
      }.bind(this))
      .then(function(orders){
        let entries = this._mergeLineupOrders($scope.lineup, orders)
        this._handleReminder(roomName, reminder, $scope.status, entries, channel, testing)
      }.bind(this))
      .catch(e => {
        if (e.message != 'ReminderAtWrongTime') {
          let retry_count = retries || 0
          logger.error('Reminder failure... warmatch retrieval error: ' + e.message)
          if ((! testing) && (retry_count < retryInfo.reminderErrorMaxTries)) {
            logger.error('retrying reminder...')
            // couldn't get status from warmatch, so retry later
            this._addTimer(roomName, function() {
              this.doReminder(roomName, reminderIdx, undefined, false, retry_count + 1)
            }.bind(this), retryInfo.reminderErrorInterval)
          }
          else {
            channel.sendMessage(`Failed to send reminder *${reminder.label}* ` + warmatchErrorMsg)
              .catch(e => {})
          }
        }
      })
  }
  else {
    logger.error(`Reminder #${reminderIdx} does not exists for ${roomName}`)
    if (testing) {
      channel.sendMessage(`Reminder #${reminderIdx} does not exists for ${roomName}`)
        .catch(e => {})
    }
  }
}

WarWatch.prototype.notifyMarchingOrders = function(roomName, range, channel, testing) {
  let reminder = {
      label: "Ping with initial marching orders"
    , filter: {}
    , include: {
        orders: true
      , timeLeft: true
      }
  }
  if (range) {
    reminder.filter.range = range
    reminder.label = 'Ping ' + this._humanizeRange(range) + ' with initial marching orders'
  }
  this.doReminder(roomName, reminder, channel, testing)
}

WarWatch.prototype.checkWar = function(roomName, justActivated, channel) {
  if (! (this.options.warrooms[roomName].autoRemind || this.options.warrooms[roomName].autoMarch)) {
    return
  }

  this._clearTimer(roomName)

  this.getStatus(roomName)
    .then( function(status) {
      // - if no war or war ended... we wait for msg "the war is active" (but setup timer to recheck too)
      // - if war starts... we set timer to recheck after parsing amount of time
      // - if war ends... then we setup timers for reminders
      if (status.status === 'starts') {
        // setup timer to check status when war starts
        let interval = status.totalMilliseconds + msMinute
        logger.log(roomName + ': upcoming war not started yet. rechecking to set up reminders in ' + this._formatTime(status.minutes, status.hours))
        this._addTimer(roomName, function() {
          this.checkWar(roomName)
        }.bind(this), interval)

        // only do this for random war?  how?
        if (this.options.warrooms[roomName].autoMarch) {
          interval = status.totalMilliseconds - this._timeToMS(this.options.warrooms[roomName].autoMarchTime)
          if (interval > 0 || justActivated) {
            interval = (interval > 0) ? interval : 2000
            logger.log(roomName + ': auto notification of marching orders in ' + this._formatMS(interval))
            if (channel && justActivated) {
              channel.sendMessage('Marching orders will be sent to roster in ' + this._formatMS(interval))
                .catch(e => {})
            }
            this._addTimer(roomName, function() {
              this.notifyMarchingOrders(roomName, this.options.warrooms[roomName].autoMarchTime.range)
            }.bind(this), interval)
          }
        }
      }
      else if (status.status === 'ends' && this.options.warrooms[roomName].autoRemind) {
        for (let [idx, reminder] of this.reminders[roomName].entries()) {
          let interval = status.totalMilliseconds - this._timeToMS(reminder.time)
          if (interval > 0) {
            logger.log(roomName + ': setting up reminder "' + reminder.label + '" to trigger in ' + this._formatMS(interval))
            this._addTimer(roomName, function() {
              this.doReminder(roomName, idx)
            }.bind(this), interval)
          }
        }
      }
      else {
        logger.log(roomName + ': war is over or new one not activated yet. will wait for activation via warbot')
        this._addTimer(roomName, function() {
          this.checkWar(roomName)
        }.bind(this), retryInfo.checkWarNoWarInterval)

      }
    }.bind(this))
    .catch(e => {
      logger.error('could not get status from warmatch')
      // couldn't get status from warmatch, so retry later
      this._addTimer(roomName, function() {
        this.checkWar(roomName, justActivated)
      }.bind(this), retryInfo.checkWarErrorInterval)
    })
}

WarWatch.prototype.listClanRoster = function(roomName, channel) {
  this.getRoster(roomName)
    .then(function(roster) {
      let clan = this.options.warrooms[roomName].clan
        , clanRole = this.options.warrooms[roomName].clanRole
        , output = `${clan} roster`
        , owned = []
        , unowned = []
        , missingRoleExists = false

      if (roster.length > 0) {
        for (let entry of roster) {
          let member = this._getMember(entry.discordid)
            , memberText
            , partial = ''
          if (member) {
            if (member.nickname) {
              memberText = member.nickname
            }
            else {
              memberText = member.user.username
            }
            if (! member.roles.exists('name', clanRole)) {
              memberText = memberText + ' :warning:'
              missingRoleExists = true
            }
            owned.push(`${entry.clashid} [${acctHashLabel}: ${entry.uid}] - owned by ${memberText}`)
          }
          else {
            unowned.push(`${entry.clashid} [${acctHashLabel}: ${entry.uid}]`)
          }
        }
        if (owned.length > 0) {
          owned.sort()
          output = output + '\n\n**owned accounts**\n'
          output = output + owned.join('\n')
          if (missingRoleExists) {
            output = output + '\nUsers with a :warning: icon are missing the clan role (' + clanRole + ')'
          }
        }
        if (unowned.length > 0) {
          unowned.sort()
          output = output + '\n\n**unowned accounts**\n'
          output = output + unowned.join('\n')
        }
      }
      else {
        output = `Could not retrieve the roster for ${clan}!`
      }
      this._sendMessage(channel, output)
    }.bind(this))
    .catch( e => {
      channel.sendMessage('Could not get the clan roster. ' + warmatchErrorMsg)
        .catch(e => {})
    })
}

WarWatch.prototype.listKnownOwners = function(channel) {
  // compile list of owners (nickname or username) and the CoC accounts they own
  let output = '**Known Owners:**\n'
    , owners = []
  for (let [k, v] of this.accounts.discord.entries()) {
    let member = this._getMember(k)
      , partial = ''
    if (member && v.length > 0) {
      if (member.nickname) {
        partial = member.nickname
      }
      else {
        partial = member.user.username
      }
      partial = partial + ': ' + v.join(', ')
      owners.push(partial)
    }
  }
  owners.sort()
  output = output + owners.join('\n')
  this._sendMessage(channel, output)
}

WarWatch.prototype.addAccount = function(roomName, channel, message) {
  let username = null
    , clashid = null
    , clashid_or_hash = null
    , member = null
    , match = add_cmd_regex.exec(message)

  if (match) {
    clashid_or_hash = match[1]
    username = match[2]
    member = this._getMember(username, true)

    if (member) {
      this.resolveClashID(clashid_or_hash, roomName)
        .then(function(clashid) {
          if (clashid) {
            this._addAccount(clashid, member)
            channel.sendMessage(`Registered CoC account ${clashid} to discord account ${member.user.username}`)
              .catch(e => {})
          }
          else {
            channel.sendMessage(
                `**Oops...** A CoC account with name or ${acctHashLabel} matching ${clashid_or_hash} was not found on the roster` + '\n'
                + 'find the correct ' + acctHashLabel + ' or name by running the `' + base_cmd_text + ' roster` command'
              )
              .catch(e => {})
          }
        }.bind(this))
        .catch( e => {
          channel.sendMessage('Could not verify the clash account. ' + warmatchErrorMsg)
            .catch(e => {})
        })
    }
    else {
      channel.sendMessage(`Could not find a discord member matching "${username}"`)
        .catch(e => {})
    }
  }
}

WarWatch.prototype.removeAccount = function(channel, message) {
  let clashid = null
    , clashid_or_hash = null
    , match = remove_cmd_regex.exec(message)

  if (match) {
    clashid_or_hash = match[1]
    clashid = this._lookupClashID(clashid_or_hash)

    if (clashid) {
      this._removeAccount(clashid)
      channel.sendMessage(`Unregistered CoC account ${clashid}`)
        .catch(e => {})
    }
    else {
      channel.sendMessage(
          `**Oops...** A CoC account with name or ${acctHashLabel} matching ${clashid_or_hash} was not registered` + '\n'
          + 'find the correct ' + acctHashLabel + ' or name by running the `' + base_cmd_text + ' roster` command'
        )
        .catch(e => {})
    }
  }
}

WarWatch.prototype.cleanupOwners = function(channel) {
  let clashids = []
    , counter = 0
  for (let [k, v] of this.accounts.discord.entries()) {
    let member = this._getMember(k)
    if (!member) {
      for (let clashid of v) {
        this.accounts.clash.delete(clashid)
      }
      this.accounts.discord.delete(k)
      counter++
    }
  }

  this.db.put('accounts.discord', Array.from(this.accounts.discord.entries()))
  this.db.put('accounts.clash', Array.from(this.accounts.clash.entries()))

  channel.sendMessage(`Removed ${counter} discord accounts`)
    .catch(e => {})
}

WarWatch.prototype.identifyAccount = function(roomName, channel, message, member) {
  let clashid = null
    , clashid_or_hash = null
    , match = identify_cmd_regex.exec(message)

  if (match) {
    clashid_or_hash = match[1]

    this.resolveClashID(clashid_or_hash, roomName)
      .then(function(clashid) {
        if (clashid) {
          let existing = this.accounts.clash.get(clashid)
          if (existing && existing !== member.id) {
            channel.sendMessage(`${clashid} is currently claimed and will need to be released first`)
              .catch(e => {})
          } else {
            this._addAccount(clashid, member)
            channel.sendMessage(`Registered CoC account ${clashid} to discord account ${member.user.username}`)
              .catch(e => {})
          }
        }
        else {
          channel.sendMessage(
              `**Oops...** A CoC account with name or ${acctHashLabel} matching ${clashid_or_hash} was not found on the roster` + '\n'
              + 'find the correct ' + acctHashLabel + ' or name by running the `' + base_cmd_text + ' roster` command'
            )
            .catch(e => {})
        }
      }.bind(this))
      .catch( e => {
        channel.sendMessage('Could not verify the clash account. ' + warmatchErrorMsg)
          .catch(e => {})
      })
  }
}

WarWatch.prototype.releaseAccount = function(roomName, channel, message, member) {
  let clashid = null
    , clashid_or_hash = null
    , match = release_cmd_regex.exec(message)

  if (match) {
    clashid_or_hash = match[1]
    clashid = this._lookupClashID(clashid_or_hash)

    if (clashid) {
      let existing = this.accounts.clash.get(clashid)
      if (existing && existing === member.id) {
        this._removeAccount(clashid)
        channel.sendMessage(`Unregistered CoC account ${clashid}`)
          .catch(e => {})
      }
      else {
        channel.sendMessage(`Cannot unregistered CoC account ${clashid}... you are not the owner`)
          .catch(e => {})
      }
    }
    else {
      channel.sendMessage(
          `**Oops...** A CoC account with name or ${acctHashLabel} matching ${clashid_or_hash} was not registered` + '\n'
          + 'find the correct ' + acctHashLabel + ' or name by running the `' + base_cmd_text + ' roster` command')
        .catch(e => {})
    }
  }
}

WarWatch.prototype.reportStatus = function(roomName, channel) {
  // are reminders enabled for warroom?
  // are we currently in war
  // what reminders will be setup
  // what reminders are currently pending
  let clan = this.options.warrooms[roomName].clan
    , autoRemindStatus = 'disabled'
    , autoMarchStatus = 'disabled'
    , autoMarchTime = this._formatTime(this.options.warrooms[roomName].autoMarchTime.minutes, this.options.warrooms[roomName].autoMarchTime.hours)
    , output

  if (this.options.warrooms[roomName].autoRemind) {
    autoRemindStatus = 'enabled'
  }
  if (this.options.warrooms[roomName].autoMarch) {
    autoMarchStatus = 'enabled'
  }
  output = `${clan} warwatch status`
  output = output + '\n\n' + `auto notification of marching orders: **${autoMarchStatus}**`
  output = output + '\n' + `- marching orders would be sent ${autoMarchTime} before war starts`
  if (this.options.warrooms[roomName].autoMarchTime.range) {
    output = output + ' to the ' + this._humanizeRange(this.options.warrooms[roomName].autoMarchTime.range) + ' of the roster'
  }
  output = output + '\n\n' + `war attack reminders: **${autoRemindStatus}**`
  if (this.reminders[roomName].length) {
    output = output + '\nregistered reminders:'
    for (let reminder of this.reminders[roomName]) {
      output = output
        + '\nreminder *' + reminder.label + '*'
        + '\n-- sent ' + this._formatTime(reminder.time.minutes, reminder.time.hours)
        + ' before war ends'
    }
  }
  else {
    output = output + '\nno registered reminders!'
  }
  
  channel.sendMessage(output)
    .catch(e => {})
}

WarWatch.prototype.onMessage = function(msg) {
  const roomName = msg.channel.name
      , authzRoleName = this.options.authzRole
      , isWarRoom = Object.keys(this.warrooms).includes(roomName)
      , isActivationMessage = m => m.content === 'The war is now active.' && m.author.bot
      // , isAdminUser = m => m.author.username === 'nkryptic' || m.author.username === 'Stacey'
      , isAdminUser = m => authzRoleName && m.member.roles.exists('name', authzRoleName)
      , isTestMessage = m => (new RegExp(base_cmd_regex.source + / +test/.source, 'i')).test(m.content) && m.author.username === 'nkryptic'
      , unauthorized = false

  if (isActivationMessage(msg) && isWarRoom) {
    this.checkWar(roomName, true, msg.channel)
  }
  else if (base_cmd_regex.test(msg.content)) {
    if (! (isWarRoom || isTestMessage(msg))) {
      msg.channel.sendMessage(badChannel)
        .catch(e => {})
    }
    else if (usage_cmd_regex.test(msg.content)) {
      if (isAdminUser(msg)) {
        msg.channel.sendMessage(authUsage)
          .catch(e => {})
      }
      else {
        msg.channel.sendMessage(basicUsage)
          .catch(e => {})
      }
    }
    else if (status_cmd_regex.test(msg.content)) {
      this.reportStatus(roomName, msg.channel)
    }
    else if (list_owners_cmd_regex.test(msg.content)) {
      this.listKnownOwners(msg.channel)
    }
    else if (list_roster_cmd_regex.test(msg.content)) {
      this.listClanRoster(roomName, msg.channel)
    }
    else if (identify_cmd_regex.test(msg.content)) {
      this.identifyAccount(roomName, msg.channel, msg.content, msg.member)
    }
    else if (release_cmd_regex.test(msg.content)) {
      // this.releaseAccount(roomName, msg.channel, msg.content, msg.member)
    }
    else if (add_cmd_regex.test(msg.content)) {
      if (isAdminUser(msg)) {
        this.addAccount(roomName, msg.channel, msg.content)
      }
      else {
        unauthorized = true
      }
    }
    else if (remove_cmd_regex.test(msg.content)) {
      if (isAdminUser(msg)) {
        this.removeAccount(msg.channel, msg.content)
      }
      else {
        unauthorized = true
      }
    }
    else if (cleanup_cmd_regex.test(msg.content)) {
      if (isAdminUser(msg)) {
        this.cleanupOwners(msg.channel)
      }
      else {
        unauthorized = true
      }
    }
    else if (marching_orders_cmd_regex.test(msg.content)) {
      if (isAdminUser(msg)) {
        this.notifyMarchingOrders(roomName, undefined, msg.channel)
      }
      else {
        unauthorized = true
      }
    }
    else if (isTestMessage(msg)) {
      const list_owners_cmd_regex = new RegExp(base_cmd_regex.source + / +owners *$/.source, 'i')
      const re1 = new RegExp(base_cmd_regex.source + / +test (gng|fnf|hnh) (roster|march|war|status|cleanup)$/.source, 'i')
          , match1 = re1.exec(msg.content)
          , re2 = new RegExp(base_cmd_regex.source + / +test (gng|fnf|hnh) (add|remove)/.source, 'i')
          , match2 = re2.exec(msg.content)
          , re3 = new RegExp(base_cmd_regex.source + / +test (gng|fnf|hnh) reminder (\d+)$/.source, 'i')
          , match3 = re3.exec(msg.content)
          , re4 = new RegExp(base_cmd_regex.source + / +test owners/.source, 'i')
          , re5 = new RegExp(base_cmd_regex.source + / +test usage/.source, 'i')
          , re6 = new RegExp(base_cmd_regex.source + / +test admin usage/.source, 'i')
      if (match1) {
        let roomName = match1[1].toLowerCase() + '-warroom'
        let cmd = match1[2].toLowerCase()
        if (cmd === 'roster') {
          this.listClanRoster(roomName, msg.channel)
        }
        else if (cmd === 'march') {
          this.notifyMarchingOrders(roomName, undefined, msg.channel, true)
        }
        else if (cmd === 'war') {
          this.checkWar(roomName)
        }
        else if (cmd === 'cleanup') {
          this.cleanupOwners(msg.channel)
        }
        else {  // cmd === 'status'
          this.reportStatus(roomName, msg.channel)
        }
      }
      else if (match2) {
        let room = match2[1].toLowerCase() + '-warroom'
        let action = match2[2]
        let cmd = msg.content.replace(re2, base_cmd_text + ' ' + action)
        if (action === 'add') {
          this.addAccount(room, msg.channel, cmd)
        }
        else {  // action === 'remove'
          this.removeAccount(msg.channel, cmd)
        }
      }
      else if (match3) {
        let room = match3[1].toLowerCase() + '-warroom'
        let idx = parseInt(match3[2])
        this.doReminder(room, idx, msg.channel, true)
      }
      else if (re4.test(msg.content)) {
        this.listKnownOwners(msg.channel)
      }
      else if (re5.test(msg.content)) {
        msg.channel.sendMessage(basicUsage)
          .catch(e => {})
      }
      else if (re6.test(msg.content)) {
        msg.channel.sendMessage(authUsage)
          .catch(e => {})
      }
      else {
        msg.channel.sendMessage('bad test command')
          .catch(e => {})
      }
    }
    else {
      if (isAdminUser(msg)) {
        msg.channel.sendMessage('I didn\'t understand that... \n\n' + authUsage)
          .catch(e => {})
      }
      else {
        msg.channel.sendMessage('I didn\'t understand that... \n\n' + basicUsage)
          .catch(e => {})
      }
    }
    if (unauthorized) {
      msg.channel.sendMessage('Unauthorized... you must have the ' + authzRoleName + ' role')
        .catch(e => {})
    }
  }
}

WarWatch.prototype.onReady = function() {
  if (!this.online) {
    logger.log('online!')
    this.online = true
    this.guild = this.client.guilds.find('name', this.options.guild)

    for (let roomName of Object.keys(this.options.warrooms)) {
      this.warrooms[roomName] = this.client.channels.find('name', roomName)
      this.timers[roomName] = []
      this.reminders[roomName] = []
      if (this.options.warrooms[roomName].reminders instanceof Array) {
        for (let [idx, reminder] of this.options.warrooms[roomName].reminders.entries()) {
          this._addReminder(roomName, idx, reminder)
        }
      }
      this.checkWar(roomName)
    }
  }
}


module.exports = WarWatch
