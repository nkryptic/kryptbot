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

const re = new RegExp(/^\d+\. TH\d+ (.*) ([12]) attacks left$/)
const usage = '*The WarMom commands:*' + '\n'
  + '**`!warmom add @mention CLASHID    ` **- ' + '\n'
  + '**`!warmom remove @mention CLASHID ` **- ' + '\n'
  + '**`!warmom accounts                ` **- ' + '\n'
  + '**`!warmom nag                     ` **- '
  + '**`!warmom naglist                 ` **- '


function WarMom(client) {
  // this.annChannel = null
  this.client = client
  this.db = new Storage('warmom.db')
  this.accounts = {
      clash: new Map(this.db.get('accounts.clash') || [])
    , discord: new Map(this.db.get('accounts.discord') || [])
  }
  // this.subs = {
  //     excellent: new Set(this.db.get('subscribers.excellent') || [])
  //   , great: new Set(this.db.get('subscribers.great') || [])
  //   , good: new Set(this.db.get('subscribers.good') || [])
  // }
  this.warrooms = {}
  this.guild = null

  this.client.on("message", this.onMessage.bind(this))
  this.client.on('ready', this.onReady.bind(this))
}

// WarMom.DEFAULTS = {

// }

// WarMom.prototype.lookupUser = function(clashid) {
  
// }

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

WarMom.prototype.processLineup = function(msg, intro) {
  let nags = []
    , output = intro + '\n'
    , channel = msg.channel
    , message = msg.content

  msg.delete()

  for (let line of message.split(/\r?\n/)) {
    console.log('line: =>' + line + '<=')
    let match = re.exec(line)
    if (match) {

      nags.push({
          discordid: this.accounts.clash.get(match[1])
        , clashid: match[1]
        , remaining: match[2]
      })
      console.log('nag found: ' + match[1])
    }
  }
  if (nags.length > 0) {
    for (let entry of nags) {
      console.log('nag attempt: ' + entry.clashid)
      let member = this.getMember(entry.discordid)
      if (member) {
        if (member.nickname) {
          output = output + member.nickname
        }
        else {
          output = output + member.user.username
        }
        output = output + ` (${entry.clashid}) - ${entry.remaining} attacks left` + '\n'
      }
      else {
        output = output + `UNKNOWN (${entry.clashid}) - ${entry.remaining} attacks left` + '\n'
      }
    }
  }
  else {
    output = 'No one with attacks remaining to nag!'
  }
  msg.channel.sendMessage(output)
}

WarMom.prototype.subscribe = function(username, category) {
  // this.subs.good.delete(username)
  // this.subs.great.delete(username)
  // this.subs.excellent.delete(username)
  // if (category && this.subs[category]) {
  //   this.subs[category].add(username)
  // }
  // this.db.put('subscribers.good', Array.from(this.subs.good))
  // this.db.put('subscribers.great', Array.from(this.subs.great))
  // this.db.put('subscribers.excellent', Array.from(this.subs.excellent))
}

WarMom.prototype.unsubscribe = function(username) {
  // this.subscribe(username, null)
}

WarMom.prototype.onMessage = function(msg) {
  return
  let output

  if (! msg.content.startsWith('!warmom')) {
    return
  }
  // confirm message sent from a warroom

  if (msg.content === '!warmom') {
    msg.channel.sendMessage(usage)
  }
  else if (msg.content.startsWith('!warmom add-raw ') && msg.mentions.users.size === 0) {
    const re1 = new RegExp(/<@[^>]+> ?/)
        , re2 = new RegExp(/^ *(.*) *$/)
        , addRaw = new RegExp(/^!warmom add-raw (.+) owning (.+)$/)
    let username = null
      , clashid = null
      , member = null
      , match = addRaw.exec(msg.content)

    if (match) {
      username = match[1]
      clashid = match[2]
      member = this.guild.members.find( member => {
        if (member.user.username.toLowerCase() === username.toLowerCase()
            || (member.nickname && member.nickname.toLowerCase() === username.toLowerCase())
        ) {
          return true
        }
      })

      if (member) {
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
    }
  }
  else if (msg.content.startsWith('!warmom add ') && msg.mentions.users.size === 1) {
    const re1 = new RegExp(/<@[^>]+> ?/)
        , re2 = new RegExp(/^ *(.*) *$/)
    let user = msg.mentions.users.first()
      , clashid = msg.content.replace('!warmom add ', '')
    clashid = clashid.replace(re1, ' ')
    clashid = clashid.replace(re2, '$1')
    if (clashid) {
      let owned = this.accounts.discord.get(user.id) || []
      if (owned.indexOf(clashid) === -1) {
        owned.push(clashid)
      }
      this.accounts.discord.set(user.id, owned)
      this.accounts.clash.set(clashid, user.id)

      this.db.put('accounts.discord', Array.from(this.accounts.discord.entries()))
      this.db.put('accounts.clash', Array.from(this.accounts.clash.entries()))

      msg.channel.sendMessage(`Added ${clashid} to discord account ${user.username}`)
    }
  }
  else if (msg.content.startsWith('!warmom nag')) {
    const filter = m => m.author.bot && m.content.startsWith('Our lineup')
    let intro = msg.content.replace('!warmom nag', '').replace(/^ */, '')
    // errors: ['time'] treats ending because of the time limit as an error
    msg.channel.awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
      .then(
        function(collected) {
          this.processLineup(collected.first(), intro)
        }.bind(this)
      )
      .catch(collected => {
        msg.channel.sendMessage('Could not retrieve war lineup')
        msg.delete()
      });
    msg.channel.sendMessage('.lineup').then(m => m.delete())
  }
  else {
    msg.channel.sendMessage('I didn\'t understand that... try typing `!warmom` for the available commands')
  }
}

WarMom.prototype.onReady = function() {
  console.log('WarMom is ready! ' + new Date())
  this.warrooms.gng = this.client.channels.find('name', 'gng-warroom')
  this.warrooms.hnh = this.client.channels.find('name', 'hnh-warroom')
  this.warrooms.fnf = this.client.channels.find('name', 'fnf-warroom')
  this.guild = this.warrooms.gng.guild
}


module.exports = WarMom
