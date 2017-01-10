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
const lineup_regex = new RegExp(/^\d+\. TH\d+ (.*) ([12]) attacks left$/)
const roster_regex = new RegExp(/^TH(\d+) (.*) \$\d+(?: k\d+)?(?: q\d+)?(?: w\d+)?$/)
const usage = '*The WarMom commands:*' + '\n'
  + '**`!warmom add CLASHID to USERNAME ` **- ' + '\n'
  + '**`!warmom remove USERNAME         ` **- ' + '\n'
  // + '**`!warmom add @mention CLASHID      ` **- ' + '\n'
  // + '**`!warmom remove @mention [CLASHID] ` **- ' + '\n'
  + '**`!warmom list owners             ` **- ' + '\n'
  + '**`!warmom clan roster             ` **- ' + '\n'
  + '**`!warmom march                   ` **- '
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
    this.client.on("message", this.onMessage.bind(this))
    this.client.on('ready', this.onReady.bind(this))
  }
}

// WarMom.prototype.resolveClashID = function(clashid_or_hash, roomName, callback) {
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

WarMom.prototype.getMember = function(discordId) {
  let target = this.guild.members.find( member => member.user.id === discordId )
  // let target = this.guild.members.find((member) => {
  //   if (member.user.username.toLowerCase() === name
  //       || (member.nickname && member.nickname.toLowerCase() === name)
  //   ) {
  //     return true
  //   }
  //   return false
  // })
  return target
}

WarMom.prototype.parseStatus = function(message) {
  const match = status_regex.exec(message)
  const status = {
      status: match && match[1]
    , days: match && parseInt(match[2] || 0)
    , hours: match && parseInt(match[3] || 0)
    , minutes: match && parseInt(match[4] || 0)
    , seconds: match && parseInt(match[5] || 0)
    , warId: match && match[5]
  }
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

WarMom.prototype.outputRoster = function(roomName, roster) {
  // let output = intro + '\n'
  let clan = this.options.warrooms[roomName].clan
    , output = `${clan} roster` + '\n'

  if (roster.length > 0) {
    for (let entry of roster) {
      let member = this.getMember(entry.discordid)
        , name
      if (member) {
        if (member.nickname) {
          name = member.nickname
        }
        else {
          name = member.user.username
        }
        // output = output + `${entry.clashid} is owned by $name (UID: $entry.uid)` + '\n'
        output = output + `${entry.clashid} is owned by ${name}` + '\n'
      }
      else {
        output = output + `${entry.clashid} **is not owned** [warmomID: ${entry.uid}]` + '\n'
      }
    }
  }
  else {
    output = `Could not retrieve the roster for ${clan}!`
  }
  return output
}

WarMom.prototype.getLineup = function(roomName) {
  const filter = m => m.author.bot && m.content.startsWith('Our lineup')
  // errors: ['time'] treats ending because of the time limit as an error
  let promise = this.warrooms[roomName].awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
    .then( function(collected) {
      let response = collected.first()
      const lineup = this.parseLineup(response.content)
      response.delete()
        .catch(console.error)
      return lineup
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        console.error('no responses: ' + collected.size)
        throw new Error('timeout waiting for lineup')
      } else {
        console.error('error5: ' + collected)
        throw collected
      }
    });

  this.warrooms[roomName].sendMessage('.lineup')
    .then(m => {
      m.delete()
        .catch(console.error)
    })
    .catch(console.error)

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
        .catch(console.error)
      return status
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        console.error('no responses: ' + collected.size)
        throw new Error('timeout waiting for status')
      } else {
        console.error('error2: ' + collected)
        throw collected
      }
    })

  this.warrooms[roomName].sendMessage('.status')
    .then(m => {
      m.delete()
        .catch(console.error)
    })
    .catch(console.error)

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
        .catch(console.error)
      return roster
    }.bind(this))
    .catch(collected => {
      if (! (collected instanceof Error)) {
        console.error('no responses: ' + collected.size)
        throw new Error('timeout waiting for roster')
      } else {
        console.error('error2: ' + collected)
        throw collected
      }
    })

  this.warrooms[roomName].sendMessage('.list weight')
    .then(m => {
      m.delete()
        .catch(console.error)
    })
    .catch(console.error)

  return promise
}

WarMom.prototype.notifyLateAttackers = function(roomName, bothOnly) {
  // check the lineup and see who has ${attacks} attacks remaining
  // send notifications that there is x time left to use them
  let baseMessage = ''
    , unnotified = []
    , unnotifiedText = null
    // , channel = this.warrooms[roomName] 
    , channel = this.client.channels.find('name', 'bot-testing') 

  this.getStatus(roomName)
    .then(function(status) {
      if (status.status === 'ends') {
        if (status.hours > 0) {
          baseMessage = baseMessage + `${status.hours} hours `
        }
        if (status.minutes > 0) {
          baseMessage = baseMessage + `${status.minutes} minutes `
        }
        baseMessage = baseMessage + 'left in war and you have '
        
        this.getLineup(roomName)
          .then(function(lineup) {
            for (let entry of lineup) {
              if ((bothOnly && entry.remaining === 2) || entry.remaining > 0) {
                let member = this.getMember(entry.discordid)
                  , output = baseMessage
                if (member) {
                  output = `${entry.clashid} ` + output + `${entry.remaining} attacks remaining`
                  // output = output + member
                  channel.sendMessage(output)
                    .catch(console.error)
                }
                else {
                  unnotified.push(`${entry.clashid} - ${entry.remaining} attacks left`)
                }
              }
            }
            if (unnotified.length > 0) {
              unnotifiedText = '**The following could not be notified, as they are unowned:**\n' +
                unnotified.join('\n')
              channel.sendMessage(unnotifiedText)
                .catch(console.error)
            }
          }.bind(this))
      }
    }.bind(this))
}

WarMom.prototype.notifyLineupMarch = function(msg) {
  // notify ppl in war that marching orders are up
  // reply with list of accounts not notified
}

WarMom.prototype.checkWar = function(roomName) {
  this.clearTimer(roomName)

  this.getStatus(roomName)
    .then( function(status) {
      // - if no war, then we simply wait for msg "the war is active" => no timer
      // - if War starts... we set timer to recheck after parsing amount of time
      // - if war ended... we simply wait for msg "the war is active" => no timer
      // - if war ends... then we setup timers (4 hours and then 2 hours before war end)
      if (status.status === 'starts') {
        console.log('war not started yet, will recheck later: ' + roomName)
        // setup timer to check status when war starts
        let interval = (status.seconds + (60 * (status.minutes + (60 * status.hours)))) * 1000
        // this.addTimer(roomName, function() {
        //   this.checkWar(roomName)
        // }.bind(this), interval)
      }
      else if (status.status === 'ends') {
        // if time left is > 4 hours, setup timer to nag at 4 hours left
        if (status.hours >= 4) {
          console.log('setting up notification (first chance) for ' + roomName)
          // let interval = (status.seconds + (60 * (status.minutes + (60 * (status.hours - 4))))) * 1000
          // this.addTimer(roomName, function() {
          //   this.notifyLateAttackers(roomName, true)
          // }.bind(this), (interval))
        }
        // else if time left is > 2 hours, setup timer to nag at 2 hours left
        else if (status.hours >= 2) {
          console.log('setting up notification (last chance) for ' + roomName)
          let interval = (status.seconds + (60 * (status.minutes + (60 * (status.hours - 2))))) * 1000
          // this.addTimer(roomName, function() {
          //   this.notifyLateAttackers(roomName, false)
          // }.bind(this), interval)
        }
      }
    }.bind(this))
    .catch(e => {
      // couldn't get status from warmatch, so retry later
      // let interval = 15 * 60 * 1000  // 15 minutes
      // this.addTimer(roomName, function() {
      //   this.checkWar(roomName)
      // }.bind(this), interval)
    })
}

WarMom.prototype.listClanRoster = function(msg) {
  let roomName = 'gng-warroom'

  this.getRoster(roomName)
    .then(function(roster) {
      const output = this.outputRoster(roomName, roster)
      let messages = splitMessage(output)
      if (messages instanceof Array) {
        for (let partial of messages) {
          msg.channel.sendMessage(partial)
            .catch(console.error)
        }
      }
      else {
        msg.channel.sendMessage(messages)
          .catch(console.error)
      }
    }.bind(this))
}

WarMom.prototype.listKnownOwners = function(msg) {
  // compile list of owners (nickname or username) and the CoC accounts they own
}

WarMom.prototype.addAccount = function(msg) {
  const names_regex = new RegExp(/^!warmom add (.+) to (.+)$/)
  let username = null
    , clashid = null
    , clashid_or_hash = null
    , member = null
    , match = names_regex.exec(msg.content)

  if (match) {
    clashid_or_hash = match[1]
    username = match[2]
    member = this.guild.members.find( member => {
      if (member.user.username.toLowerCase() === username.toLowerCase()
          || (member.nickname && member.nickname.toLowerCase() === username.toLowerCase())
      ) {
        return true
      }
    })

    this.resolveClashID(clashid_or_hash, 'gng-warroom')
      .then(function(clashid) {
        if (member && clashid) {
          let owned = this.accounts.discord.get(member.id) || []
          if (owned.indexOf(clashid) === -1) {
            owned.push(clashid)
          }
          this.accounts.discord.set(member.id, owned)
          this.accounts.clash.set(clashid, member.id)

          this.db.put('accounts.discord', Array.from(this.accounts.discord.entries()))
          this.db.put('accounts.clash', Array.from(this.accounts.clash.entries()))

          msg.channel.sendMessage(`Added ${clashid} to discord account ${member.user.username}`)
        }
      }.bind(this))
  }
}

WarMom.prototype.removeOwner = function(msg) {
  const names_regex = new RegExp(/^!warmom remove (.+)$/)
}

WarMom.prototype.onMessage = function(msg) {
  let roomName = msg.channel.name
  // return
  if (msg.content === 'The war is now active.' && msg.author.bot && Object.keys(this.warrooms).includes(roomName)) {
    // this.checkWar(roomName)
  }
  else if (msg.content.startsWith('!warmom')) {
    // confirm message sent from a warroom?
    // if (! Object.keys(this.warrooms).includes(roomName)) {
    //   msg.channel.sendMessage(badChannel)
    //   return
    // }
    if (msg.content === '!warmom') {
      msg.channel.sendMessage(usage)
    }
    else if (msg.content.startsWith('!warmom add ') && msg.mentions.users.size === 0) {
      this.addAccount(msg)
    }
    else if (msg.content.startsWith('!warmom remove ') && msg.mentions.users.size === 0) {
      this.removeOwner(msg)
    }
    else if (msg.content.startsWith('!warmom list owners')) {
      this.listKnownOwners(msg)
    }
    else if (msg.content.startsWith('!warmom list clan')) {
      this.listClanRoster(msg)
    }
    else if (msg.content.startsWith('!warmom test')) {
      this.notifyLateAttackers('fnf-warroom', false)
    }
    else if (msg.content.startsWith('!warmom march')) {
      this.notifyLineupMarch(msg)
    }
    else {
      msg.channel.sendMessage('I didn\'t understand that... try typing `!warmom` for the available commands')
    }
  }
}

WarMom.prototype.onReady = function() {
  if (!this.online) {
    console.log('WarMom is online! ' + new Date())
    this.online = true
    this.guild = this.client.guilds.find('name', this.options.guild)
    for (let roomName of Object.keys(this.options.warrooms)) {
      this.warrooms[roomName] = this.client.channels.find('name', roomName)
      // if (this.options.warrooms[roomName].enabled) {
      //   this.checkWar(roomName)
      // }
    }
  }
}


module.exports = WarMom
