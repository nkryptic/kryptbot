// var msg1 = "Loot available is OKAY right now.  This will continue for the next 1 hour 7 minutes.  Loot will then improve to be DECENT for about 20 minutes but will slightly worsen to only be OKAY again in about 1 hour 27 minutes from now.  Loot won't be GOOD again until 4 hours 56 minutes from now."
// var msg2 = "Loot available is OKAY right now. This will continue for the next 59 minutes. Loot will then improve to be DECENT for about 20 minutes but will slightly worsen to only be OKAY again in about 1 hour 19 minutes from now. Loot won't be GOOD again until 4 hours 48 minutes from now."
// var re = new RegExp(/next (?:(\d+) hours? )?(\d+) minutes/)
// var match1 = rx.exec(msg1)
// var match2 = rx.exec(msg2)

// var hour1 = parseInt(match1[1] || 0)
//   , minute1 = parseInt(match1[2] || 0)

// var hour2 = parseInt(match2[1] || 0)
//   , minute2 = parseInt(match2[2] || 0)


// console.log(`msg1: ${hour1} ${minute1}`)
// console.log(`msg2: ${hour2} ${minute2}`)

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

const template = 'Grit N Grind vs ART CLASH' + '\n'
+ 'STATUS' + '\n'
+ '67 to 51 stars, score is +16' + '\n'
+ 'We have 95.72% and they have 74.24%' + '\n'
+ 'We have 47/50 attacks used and they have 34/50' + '\n'
+ 'We have 19 ☆☆☆ and they have 8 ☆☆☆' + '\n'
+ '1/6 cleared TH10 (1 attacks left)' + '\n'
+ '17/18 cleared TH9 (0 attacks left)' + '\n'
+ '1/1 cleared TH8 (0 attacks left)' + '\n'
+ 'War is active, data last updated 11 minutes, 6 seconds ago' + '\n'
+ 'Stats are based on user input, not real-time Supercell data' + '\n'
+ 'http://warmatch.us/clans/war/666'

let msg1 = template.replace('STATUS', 'War ends 1 hour, 42 minutes from now')
let msg2 = template.replace('STATUS', 'War starts 5 hours, 28 minutes from now')
let msg3 = template.replace('STATUS', 'War ended 4 minutes, 46 seconds ago')
let msg4 = 'Boop, there are no active wars.'

console.log('msg1')
console.log(status_regex.exec(msg1))
console.log('msg2')
console.log(status_regex.exec(msg2))
console.log('msg3')
console.log(status_regex.exec(msg3))
console.log('msg4')
console.log(status_regex.exec(msg4))
