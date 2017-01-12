/*
!warmom add @mention CLASHID
!warmom remove @mention CLASHID
!warmom accounts
!warmom nag
!warmom naglist

TODO:
- rewrite this to listen for wmbot or ask wmbot stuff...
- have it set timers for war 2 hours and 4 hours before the end
  and automatically notify ppl then
- manual version will still be available though

unprompted =>
The war is now active.

.status =>
Boop, there are no active wars.
War starts 5 hours, 28 minutes
War ends 18 hours, 45 minutes
War ended 4 minutes, 46 seconds ago

*/
const splitMessage = require('discord.js').splitMessage
const Storage = require('node-storage')
const hash = require('string-hash')
const Logger = require('./logger.js')
const logger = new Logger('WarMom')

const base_cmd_regex = new RegExp(/^!warmom/, 'i')
const usage_cmd_regex = new RegExp(/^!warmom\s*$/, 'i')
const list_owners_cmd_regex = new RegExp(/^!warmom list owners$/, 'i')
const list_roster_cmd_regex = new RegExp(/^!warmom list roster$/, 'i')
const marching_orders_cmd_regex = new RegExp(/^!warmom notify march$/, 'i')
const add_cmd_regex = new RegExp(/^!warmom add (.+) to (.+)$/, 'i')
const remove_cmd_regex = new RegExp(/^!warmom remove (.+)$/, 'i')
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
const lineup_regex = new RegExp(/^\d+\. TH\d+ (.+) ([12]) attacks left$/)
const marching_regex = new RegExp(/^\d+\. TH\d+ ([^:]+): (.*)$/)
const roster_regex = new RegExp(/^TH(\d+) (.+) \$\d+(?: k\d+)?(?: q\d+)?(?: w\d+)?$/)
const usage = '*The WarMom commands:*' + '\n'
  + '**`!warmom add <clashID or warmomID> to <discord username>` **- ' + '\n'
  // + '**`!warmom remove USERNAME` **- ' + '\n'
  // + '**`!warmom add CLASHID` **- ' + '\n'
  + '**`!warmom list owners` **- ' + '\n'
  + '**`!warmom list roster` **- ' + '\n'
  + '**`!warmom notify march` **- '
const badChannel = 'WarMom can only be run from a war room channel'


function WarMom(config, client) {
  // this.annChannel = null
  this.client = client
  this.options = Object.assign({}, config.warmom)
  this.db = new Storage(this.options.db)
  this.accounts = {
      clash: new Map(this.db.get('accounts.clash') || [])
    , discord: new Map(this.db.get('accounts.discord') || [])
  }
  this.warrooms = {}
  this.timers = {}
  this.guild = null
  this.online = false

  if (this.options.enabled)  {
    this.client.on('message', this.onMessage.bind(this))
    this.client.on('ready', this.onReady.bind(this))
  }
}

WarMom.prototype._clearTimer = function(roomName) {
  if (this.timers[roomName]) {
    clearTimeout(this.timers[roomName])
  }
  this.timers[roomName] = null
}

WarMom.prototype._addTimer = function(roomName, func, interval) {
  this.timers[roomName] = setTimeout(func, interval)
}

WarMom.prototype._warmatchErrorHandler = function(channel, messgage) {
  return e => {
    channel.sendMessage(message + '\nThere was an error retrieving information from warmatch')
      .catch(logger.error)
  }
}

WarMom.prototype._sendMessage = function(channel, output) {
  let messages = splitMessage(output)
  if (messages instanceof Array) {
    for (let partial of messages) {
      channel.sendMessage(partial)
        .catch(logger.error)
    }
  }
  else {
    channel.sendMessage(messages)
      .catch(logger.error)
  }
}

WarMom.prototype._getMember = function(needle, searchByName) {
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

WarMom.prototype._addAccount = function(clashid, member) {
  for (let [k, v] of this.accounts.discord.entries()) {
    if (k != member.id && v.indexOf(clashid) > -1) {
      v.splice(v.indexOf(clashid), 1)
      this.accounts.discord.set(k, v)
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

WarMom.prototype.resolveClashID = function(clashid_or_hash, roomName) {
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

WarMom.prototype.parseStatus = function(message) {
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

WarMom.prototype.parseLineup = function(message) {
  // parse out the CoC account names and attacks
  let lineup = []

  for (let line of message.split(/\r?\n/)) {
    let match = lineup_regex.exec(line)
    if (match) {
      lineup.push({
          discordid: this.accounts.clash.get(match[1])
        , clashid: match[1]
        , remaining: match[2]
      })
    }
  }

  return lineup
}

WarMom.prototype.parseMarchingOrders = function(message) {
  // parse out the CoC account names and orders
  let orders = []

  for (let line of message.split(/\r?\n/)) {
    let match = marching_regex.exec(line)
    if (match) {
      orders.push({
          discordid: this.accounts.clash.get(match[1])
        , clashid: match[1]
        , orders: match[2]
      })
    }
  }

  return orders
}

WarMom.prototype.parseRoster = function(message) {
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

WarMom.prototype.getLineup = function(roomName) {
  const filter = m => m.author.bot && m.content.startsWith('Our lineup')
  // errors: ['time'] treats ending because of the time limit as an error
  let promise = this.warrooms[roomName].awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
    .then( function(collected) {
      let response = collected.first()
      const lineup = this.parseLineup(response.content)
      response.delete()
        .catch(logger.error)
      return lineup
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        logger.error('no responses: ' + collected.size)
        throw new Error('timeout waiting for lineup')
      } else {
        logger.error('error5: ' + collected)
        throw collected
      }
    });

  this.warrooms[roomName].sendMessage('.lineup')
    .then(m => {
      m.delete()
        .catch(logger.error)
    })
    .catch(logger.error)

  return promise
}

WarMom.prototype.getMarchingOrders = function(roomName) {
  const filter = m => m.author.bot && m.content.startsWith('Marching orders')
  // errors: ['time'] treats ending because of the time limit as an error
  let promise = this.warrooms[roomName].awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
    .then( function(collected) {
      let response = collected.first()
      const orders = this.parseMarchingOrders(response.content)
      response.delete()
        .catch(logger.error)
      return orders
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        logger.error('no responses: ' + collected.size)
        throw new Error('timeout waiting for marching orders')
     7} else {
        logger.error('error7: ' + collected)
        throw collected
      }
    });

  this.warrooms[roomName].sendMessage('.march')
    .then(m => {
      m.delete()
        .catch(logger.error)
    })
    .catch(logger.error)

  return promise
}

WarMom.prototype.getStatus = function(roomName) {
  // get the current war status from '.status'
  const filter = m => m.author.bot && m.author.username === 'wmbot' && status_regex.test(m.content)

  let promise = this.warrooms[roomName].awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
    .then( function(collected) {
      let response = collected.first()
      const status = this.parseStatus(response.content)
      response.delete()
        .catch(logger.error)
      return status
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        logger.error('no responses: ' + collected.size)
        throw new Error('timeout waiting for status')
      } else {
        logger.error('error2: ' + collected)
        throw collected
      }
    })

  this.warrooms[roomName].sendMessage('.status')
    .then(m => {
      m.delete()
        .catch(logger.error)
    })
    .catch(logger.error)

  return promise
}

WarMom.prototype.getRoster = function(roomName) {
  // get the current roster from '.list weight'
  const filter = m => m.author.bot && m.author.username === 'wmbot' && m.content.startsWith('List all by weight')

  let promise = this.warrooms[roomName].awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
    .then( function(collected) {
      let response = collected.first()
      const roster = this.parseRoster(response.content)
      response.delete()
        .catch(logger.error)
      return roster
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        logger.error('no responses: ' + collected.size)
        throw new Error('timeout waiting for roster')
      } else {
        logger.error('error2: ' + collected)
        throw collected
      }
    })

  this.warrooms[roomName].sendMessage('.list weight')
    .then(m => {
      m.delete()
        .catch(logger.error)
    })
    .catch(logger.error)

  return promise
}

WarMom.prototype.notifyLateAttackers = function(roomName, bothOnly, channel) {
  // check the lineup and see who has ${attacks} attacks remaining
  // send notifications that there is x time left to use them
  let unnotified = []
    , baseMsg = ''
    , owned = new Map([])
  
  channel = channel || this.warrooms[roomName]

  this.getStatus(roomName)
    .then(function(status) {
      if (status.status === 'ends') {
        if (status.hours > 0) {
          baseMsg = baseMsg + `${status.hours} hours `
        }
        if (status.minutes > 0) {
          baseMsg = baseMsg + `${status.minutes} minutes `
        }
        baseMsg = baseMsg + 'left in war'
        
        this.getLineup(roomName)
          .then(function(lineup) {
            for (let entry of lineup) {
              let member = this._getMember(entry.discordid)
                , partial = `${entry.clashid} - ${entry.remaining} attacks remaining`
              if (member) {
                let list = owned.get(member.id) || []
                if (list.length === 0) {
                  if (member.nickname) {
                    list.push('@' + member.nickname + ' ' + baseMsg)
                  }
                  else {
                    list.push('@' + member.user.username + ' ' + baseMsg)
                  }
                  // list.push(member + ' ' + baseMsg)
                }
                list.push(partial)
                owned.set(member.id, list)
              }
              else {
                unnotified.push(partial)
              }
            }
            for (let list of owned.values()) {
              this._sendMessage(channel, list.join('\n'))
            }
            if (unnotified.length > 0) {
              let output = '\n**The following could not be pinged about pending attacks, as they are unowned:**\n'
              output = output + unnotified.join('\n')
              this._sendMessage(channel, output)
            }
            // this._sendMessage(channel, output)
          }.bind(this))
          .catch(this._warmatchErrorHandler(channel, 'Notification for unused attacks failed'))
      }
    }.bind(this))
    .catch(this._warmatchErrorHandler(channel, 'Notification for unused attacks failed'))
}

WarMom.prototype.notifyMarchingOrders = function(roomName, channel) {
  // notify ppl in war that marching orders are up
  // reply with list of accounts not notified
  let unnotified = []
    , clan = this.options.warrooms[roomName].clan
    // , output = `${clan} marching orders` + '\n'
    , owned = new Map([])

  this.getStatus(roomName)
    .then(function(status) {
      if (status.status === 'starts' || status.status === 'ends') {
        this.getMarchingOrders(roomName)
          .then(function(orders) {
            for (let entry of orders) {
              let member = this._getMember(entry.discordid)
                , partial = `${entry.clashid}: ${entry.orders}`
              if (member) {
                let list = owned.get(member.id) || []
                if (list.length === 0) {
                  if (member.nickname) {
                    list.push('@' + member.nickname + ' marching orders:')
                  }
                  else {
                    list.push('@' + member.user.username + ' marching orders:')
                  }
                  // list.push(member + ' marching orders:')
                }
                list.push(partial)
                owned.set(member.id, list)
              }
              else {
                unnotified.push(partial)
              }
            }
            for (let list of owned.values()) {
              this._sendMessage(channel, list.join('\n'))
            }

            if (unnotified.length > 0) {
              let output = '**The following marching orders could not be pinged, as they are unowned:**\n'
              output = output + unnotified.join('\n')
              this._sendMessage(channel, output)
            }
            // this._sendMessage(channel, output)
          }.bind(this))
          .catch(this._warmatchErrorHandler(channel, 'Notification of marching orders failed'))
      }
      else {
        channel.sendMessage('There are no active wars.')
          .catch(logger.error)
      }
    }.bind(this))
    .catch(this._warmatchErrorHandler(channel, 'Notification of marching orders failed'))
}

WarMom.prototype.checkWar = function(roomName) {
  this._clearTimer(roomName)

  this.getStatus(roomName)
    .then( function(status) {
      // - if no war, then we simply wait for msg "the war is active" => no timer
      // - if War starts... we set timer to recheck after parsing amount of time
      // - if war ended... we simply wait for msg "the war is active" => no timer
      // - if war ends... then we setup timers (4 hours and then 2 hours before war end)
      if (status.status === 'starts') {
        // setup timer to check status when war starts
        let interval = status.totalMilliseconds + 1000
        logger.log(roomName + ': war not started yet. recheck in ' + interval/1000 + ' seconds')
        this._addTimer(roomName, function() {
          this.checkWar(roomName)
        }.bind(this), interval)
      }
      else if (status.status === 'ends') {
        // maybe move the values to ping at into the config file?
        // config.firstping = 4 * 60 * 60 * 1000
        // config.secondping = 2 * 60 * 60 * 1000

        // if time left is > 4 hours, setup timer to nag at 4 hours left
        if (status.hours >= 4) {
          let interval = status.totalMilliseconds - (4 * 60 * 60 * 1000)
          logger.log(roomName + ': setting up notification (first chance) in ' + interval/1000 + ' seconds')
          this._addTimer(roomName, function() {
            this.notifyLateAttackers(roomName, true)
          }.bind(this), interval)
        }
        // else if time left is > 2 hours, setup timer to nag at 2 hours left
        else if (status.hours >= 2) {
          let interval = status.totalMilliseconds - (2 * 60 * 60 * 1000)
          logger.log(roomName + ': setting up notification (last chance) in ' + interval/1000 + ' seconds')
          this._addTimer(roomName, function() {
            this.notifyLateAttackers(roomName, false)
          }.bind(this), interval)
        }
      }
    }.bind(this))
    .catch(e => {
      logger.error('could not get status from warmatch')
      // couldn't get status from warmatch, so retry later
      let interval = 30 * 60 * 1000  // 30 minutes
      this._addTimer(roomName, function() {
        this.checkWar(roomName)
      }.bind(this), interval)
    })
}

WarMom.prototype.listClanRoster = function(roomName, channel) {
  this.getRoster(roomName)
    .then(function(roster) {
      let clan = this.options.warrooms[roomName].clan
        , output = `${clan} roster` + '\n'
        , owned = []
        , unowned = []

      if (roster.length > 0) {
        for (let entry of roster) {
          let member = this._getMember(entry.discordid)
            , name
            , partial = ''
          if (member) {
            if (member.nickname) {
              name = member.nickname
            }
            else {
              name = member.user.username
            }
            // output = output + `${entry.clashid} is owned by ${name} [warmomID: ${entry.uid}]` + '\n'
            owned.push(`${entry.clashid} is owned by ${name}`)
          }
          else {
            unowned.push(`${entry.clashid} **is not owned** [warmomID: ${entry.uid}]`)
          }
        }
        if (owned.length > 0) {
          owned.sort()
          output = output + '\n**owned accounts**\n'
          output = output + owned.join('\n')
        }
        if (unowned.length > 0) {
          unowned.sort()
          output = output + '\n**unowned accounts**\n'
          output = output + unowned.join('\n')
        }
      }
      else {
        output = `Could not retrieve the roster for ${clan}!`
      }
      this._sendMessage(channel, output)
    }.bind(this))
    .catch(this._warmatchErrorHandler(channel, 'Could not get the clan roster'))
}

WarMom.prototype.listKnownOwners = function(channel) {
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

WarMom.prototype.addAccount = function(roomName, channel, message) {
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
            channel.sendMessage(`Added ${clashid} to discord account ${member.user.username}`)
          }
          else {
            channel.sendMessage(`Could not find a CoC account with name or warmomID matching ${clashid_or_hash}`)
          }
        }.bind(this))
        .catch(this._warmatchErrorHandler(channel, 'Could not verify the clash account'))
    }
    else {
      channel.sendMessage(`Could not find a discord member matching "${username}"`)
    }
  }
}

WarMom.prototype.removeOwner = function(channel, message) {
  
}

WarMom.prototype.onMessage = function(msg) {
  let roomName = msg.channel.name
  // return
  if (msg.content === 'The war is now active.' && msg.author.bot && Object.keys(this.warrooms).includes(roomName)) {
    if (this.options.warrooms[roomName].enabled) {
      this.checkWar(roomName)
    }
  }
  else if (base_cmd_regex.test(msg.content) && (msg.author.username === 'nkryptic' || msg.author.username === 'Stacey')) {
    // confirm message sent from a warroom?
    if ((! Object.keys(this.warrooms).includes(roomName)) && (! (/^!warmom test/i).test(msg.content))) {
      msg.channel.sendMessage(badChannel)
      return
    }
    if (usage_cmd_regex.test(msg.content)) {
      msg.channel.sendMessage(usage)
    }
    else if (add_cmd_regex.test(msg.content) && msg.mentions.users.size === 0) {
      this.addAccount(roomName, msg.channel, msg.content)
    }
    else if (remove_cmd_regex.test(msg.content) && msg.mentions.users.size === 0) {
      this.removeOwner(msg.channel, msg.content)
    }
    else if (list_owners_cmd_regex.test(msg.content)) {
      this.listKnownOwners(msg.channel)
    }
    else if (list_roster_cmd_regex.test(msg.content)) {
      this.listClanRoster(roomName, msg.channel)
    }
    else if (marching_orders_cmd_regex.test(msg.content)) {
      this.notifyMarchingOrders(roomName, msg.channel)
    }
    else if ((/^!warmom test/i).test(msg.content)) {
      const re1 = new RegExp(/^!warmom test (gng|fnf|hnh) (roster|march|attacks|war)$/, 'i')
          , match1 = re1.exec(msg.content)
          , re2 = new RegExp(/^!warmom test (gng|fnf|hnh) add/, 'i')
          , match2 = re2.exec(msg.content)
          , re3 = new RegExp(/^!warmom test owners/, 'i')
          , match3 = re3.exec(msg.content)
      if (match1) {
        let roomName = match1[1].toLowerCase() + '-warroom'
        let cmd = match1[2].toLowerCase()
        if (cmd === 'roster') {
          this.listClanRoster(roomName, msg.channel)
        }
        else if (cmd === 'march') {
          this.notifyMarchingOrders(roomName, msg.channel)
        }
        else if (cmd === 'war') {
          this.checkWar(roomName)
        }
        else {  // cmd === 'attacks'
          this.notifyLateAttackers(roomName, false, msg.channel)
        }
      }
      else if (match2) {
        let roomName = match2[1].toLowerCase() + '-warroom'
        let cmd = msg.content.replace(re2, '!warmom add')
        this.addAccount(roomName, msg.channel, cmd)
      }
      else if (match3) {
        this.listKnownOwners(msg.channel)
      }
      else {
        msg.channel.sendMessage('bad test command')
      }
    }
    else {
      msg.channel.sendMessage('I didn\'t understand that... \n\n' + usage)
    }
  }
}

WarMom.prototype.onReady = function() {
  if (!this.online) {
    logger.log('online!')
    this.online = true
    this.guild = this.client.guilds.find('name', this.options.guild)
    for (let roomName of Object.keys(this.options.warrooms)) {
      this.warrooms[roomName] = this.client.channels.find('name', roomName)
      this.timers[roomName] = null
      if (this.options.warrooms[roomName].enabled) {
        this.checkWar(roomName)
      }
    }
  }
}


module.exports = WarMom
