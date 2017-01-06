const config = require('../config.json')
var Discord = require("discord.js");
var bot = new Discord.Client();

bot.on("message", msg => {
  if (msg.content === '!bottest') {
    const filter = m => m.content.startsWith('test') && m.content.endsWith('ing')

    // errors: ['time'] treats ending because of the time limit as an error
    // msg.channel.awaitMessages(filter, { max: 4, time: 30000, errors: ['time'] })
    msg.channel.awaitMessages(filter, { maxMatches: 1, time: 10000, errors: ['time'] })
     .then(collected => console.log(`Received ${collected.size}.`))
     .catch(collected => console.log(`timeout: ${collected.size} received.`));
    // msg.channel.sendMessage('.lineup')
  }
  else if (msg.content.startsWith('!warmom add ') && msg.mentions.users.size === 1) {
    console.log(msg.content)
    const re1 = new RegExp(/<@[^>]+> ?/)
        , re2 = new RegExp(/^ *(.*) *$/)
    let text = msg.content.replace('!warmom add ', '')
    text = text.replace(re1, ' ')
    text = text.replace(re2, '$1')
    console.log(text)
    console.log(text === 'CruisrCharlie❄️')
  }
})

bot.on('ready', () => {
  console.log('I am ready!')
})

bot.login(config.botToken)

// var text = 'Our lineup' + '\n'
//          + '1. TH11 CyberBully done' + '\n'
//          + '2. TH10 Stacey 2 attacks left' + '\n'
//          + '3. TH10 zmann 78 done' + '\n'
//          + '4. TH10 Myth11 2 attacks left' + '\n'
//          + '5. TH10 Dreams done' + '\n'
//          + '6. TH10 Bullnutzz 1 attacks left' + '\n'
//          + '7. TH10 Blake4 2 attacks left' + '\n'
//          + '8. TH9 nkryptic done' + '\n'
//          + '9. TH9 oswald done' + '\n'
//          + '10. TH9 Jinx done' + '\n'
//          + '11. TH9 justin 2 attacks left' + '\n'
//          + '12. TH9 Moonwhale done' + '\n'
//          + '13. TH9 mango done' + '\n'
//          + '14. TH9 BigHoss done' + '\n'
//          + '15. TH9 BuRNiN_BoNeS done' + '\n'
//          + '16. TH9 BingoBango done' + '\n'
//          + '17. TH9 AnimalTape done' + '\n'
//          + '18. TH9 GodSilk 1 attacks left' + '\n'
//          + '19. TH9 nkryptic2 done' + '\n'
//          + '20. TH9 Sensei 1 attacks left' + '\n'
//          + '21. TH9 NᎪᎻ ᎷᎬᎪN 1 attacks left' + '\n'
//          + '22. TH8 Kyo done' + '\n'
//          + '23. TH8 garrett done' + '\n'
//          + '24. TH5 red woman done' + '\n'
//          + '25. TH3 Heart N Hustle 2 attacks left'

// const re = new RegExp(/^\d+\. TH\d+ (.*) ([12]) attacks left$/)
// var twoatks
// for (let line of text.split('\n')) {
//   let matches = re.exec(line)
//   if (matches) {
//     console.log(matches)
//   }
// }

