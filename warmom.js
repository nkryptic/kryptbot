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

const Storage = require('node-storage')

// const status_regex = new RegExp(/there are no active wars|War (starts|ends|ended) (?:(\d+) hours?,?)? ?(?:(\d+) minutes?,?)? ?(?:(\d+) seconds?,?)?[^]*warmatch\.us\/clans\/war\/(\d+)/, 'm')
const status_regex = new RegExp(
    'there are no active wars'
  + '|'
  + 'War (starts|ends|ended) '
  + '(?:(\\d+) hours?,?)? ?'
  + '(?:(\\d+) minutes?,?)? ?'
  + '(?:(\\d+) seconds?,?)?'
  + '[^]*warmatch\\.us\\/clans\\/war\\/(\\d+)'
  , 'm')
// const war_regex = new RegExp(/warmatch.us\/clans\/war\/(\d+)/, 'm')
const re = new RegExp(/^\d+\. TH\d+ (.*) ([12]) attacks left$/)
const roster_regex = new RegExp(/^TH(\d+) (.*) \$\d+(?: k\d+)?(?: q\d+)?(?: w\d+)?$/)
const usage = '*The WarMom commands:*' + '\n'
  + '**`!warmom add @mention CLASHID    ` **- ' + '\n'
  + '**`!warmom remove @mention CLASHID ` **- ' + '\n'
  + '**`!warmom list owners             ` **- ' + '\n'
  + '**`!warmom clan roster             ` **- '

var gngWarTimers = gngWarTimers || []
var hnhWarTimers = hnhWarTimers || []
var fnfWarTimers = fnfWarTimers || []

function clearTimer(roomName) {
  if ((!roomName || roomName === 'gng') && gngWarTimers.length > 0) {
    for (let tID of gngWarTimers) {
      clearTimeout(tID);
    }
    gngWarTimers = []
  }
  if ((!roomName || roomName === 'hnh') && hnhWarTimers.length > 0) {
    for (let tID of hnhWarTimers) {
      clearTimeout(tID);
    }
    hnhWarTimers = []
  }
  if ((!roomName || roomName === 'fnf') && fnfWarTimers.length > 0) {
    for (let tID of fnfWarTimers) {
      clearTimeout(tID);
    }
    fnfWarTimers = []
  }
}

function addTimer(roomName, func, interval) {
  if (roomName === 'gng') {
    for (let tID of gngWarTimers) {
      clearTimeout(tID);
    }
    gngWarTimers[gngWarTimers.length] = setTimeout(func, interval)
  }
  if (roomName === 'hnh') {
    for (let tID of hnhWarTimers) {
      clearTimeout(tID);
    }
    hnhWarTimers[hnhWarTimers.length] = setTimeout(func, interval)
  }
  if (roomName === 'fnf') {
    for (let tID of fnfWarTimers) {
      clearTimeout(tID);
    }
    fnfWarTimers[fnfWarTimers.length] = setTimeout(func, interval)
  }
}


function WarMom(config, client) {
  // this.annChannel = null
  this.client = client
  this.db = new Storage(config.warmomDb)
  this.accounts = {
      clash: new Map(this.db.get('accounts.clash') || [])
    , discord: new Map(this.db.get('accounts.discord') || [])
  }
  this.warrooms = {}
  this.guild = null

  this.client.on("message", this.onMessage.bind(this))
  this.client.on('ready', this.onReady.bind(this))
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

WarMom.prototype.processStatus = function(roomName, msg) {
  // - if no war, then we simply wait for msg "the war is active" => no timer
  // - if War starts... we set timer to recheck after parsing amount of time
  // - if war ended... we simply wait for msg "the war is active" => no timer
  // - if war ends... then we setup timers (4 hours and then 2 hours before war end)
  const match = status_regex.exec(msg.content)
  if (match) {
    const status = match[1]
        , hours = parseInt(match[2] || 0)
        , minutes = parseInt(match[3] || 0)
        , seconds = parseInt(match[4] || 0)
        , warId = match[5]
    if (status === 'starts') {
      // setup timer to check status when war starts
      let interval = (seconds + (60 * (minutes + (60 * hours)))) * 1000
      addTimer(roomName, function() {
        this.setupWarTimer(roomName)
      }.bind(this), interval)
    }
    else if (status === 'ends') {
      // if time left is > 4 hours, setup timer to nag at 4 hours left
      // else if time left is > 2 hours, setup timer to nag at 2 hours left
    }
  }
}

WarMom.prototype.processRoster = function(roomName, msg) {
  // parse out the CoC account names
  // match CoC account names with owner (nickname or username), if known
  // send message: list CoC roster with owner for each entry
  let roster = []
    // , output = intro + '\n'
    , output = ''
    // , channel = msg.channel
    , message = msg.content

  for (let line of message.split(/\r?\n/)) {
    // console.log('line: =>' + line + '<=')
    let match = roster_regex.exec(line)
    if (match) {
      roster.push({
          discordid: this.accounts.clash.get(match[2])
        , clashid: match[2]
        , townhall: match[1]
      })
      console.log('member found: ' + match[2])
    }
  }
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
        output = output + `${entry.clashid} is owned by $name` + '\n'
      }
      else {
        output = output + `${entry.clashid} is not owned (UID: $entry.uid)` + '\n'
      }
    }
  }
  else {
    output = 'Could not find a roster!'
  }
  return output
}

WarMom.prototype.setupWarTimer = function(roomName) {
  clearTimer(roomName)

  // send .setup in each war channel and listen for result
  const filter = m => m.author.bot && m.author.username === 'wmbot' && status_regex.test(m.content)
  this.warrooms[roomName].awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
    .then( function(collected) {
      this.processStatus(roomName, collected.first())
      collected.first().delete()
    }.bind(this))
    .catch(collected => {
      //
    })
  this.warrooms[roomName].sendMessage('.status').then(m => m.delete())
}

WarMom.prototype.onMessage = function(msg) {
  return

  if (msg.content.startsWith('!warmom')) {
    // confirm message sent from a warroom?
    if (msg.content === '!warmom') {
      msg.channel.sendMessage(usage)
    }
    else if (msg.content.startsWith('!warmom add-raw ') && msg.mentions.users.size === 0) {
    }
    else if (msg.content.startsWith('!warmom add ') && msg.mentions.users.size === 1) {
    }
    else if (msg.content.startsWith('!warmom remove ') && msg.mentions.users.size === 1) {
    }
    else if (msg.content.startsWith('!warmom list owners')) {
      // compile list of owners (nickname or username) and the CoC accounts they own
    }
    else if (msg.content.startsWith('!warmom list clan')) {
      // get the current roster from '.list weight'
      const filter = m => m.author.bot && m.author.username === 'wmbot' && m.content.startsWith('List all by weight')
      msg.channel.awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
        .then( function(collected) {
          const output = this.processRoster(roomName, collected.first())
          collected.first().delete()
          msg.channel.sendMessage(output)
        }.bind(this))
        .catch(collected => {
          //
        })
      msg.channel.sendMessage('.list status').then(m => m.delete())
    }
    else {
      msg.channel.sendMessage('I didn\'t understand that... try typing `!warmom` for the available commands')
    }
  }
}

WarMom.prototype.onReady = function() {
  console.log('WarMom is ready! ' + new Date())
  this.warrooms.gng = this.client.channels.find('name', 'gng-warroom')
  this.warrooms.hnh = this.client.channels.find('name', 'hnh-warroom')
  this.warrooms.fnf = this.client.channels.find('name', 'fnf-warroom')
  this.guild = this.warrooms.gng.guild
  // this.setupWarTimer('gng')
  // this.setupWarTimer('hnh')
  // this.setupWarTimer('fnf')
}


module.exports = WarMom
