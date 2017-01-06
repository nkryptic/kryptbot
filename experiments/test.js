// var request = require('request')

// var forecast = {
//     url: 'http://clashofclansforecaster.com/STATS.json'
//   , duration: 60 * 1000 // 1 minute
//   , expires: undefined
//   , message: ''
//   , unavailable: 'Sorry, clashofclansforecaster.com is currently unavailable.' +
//       '\n\nTry going directly to http://clashofclansforecaster.com'
//   , getForecast: (successFunc, errorFunc) => {
//       request({
//         url: forecast.url
//       , json: true
//       }, function (error, response, body) {
//         if (!error && response.statusCode === 200 && body.forecastMessages.english) {
//           forecast.expires = new Date().getTime() + forecast.duration
//           forecast.message = body.forecastMessages.english
//           successFunc.apply()
//         }
//         else {
//           forecast.expires = undefined
//           forecast.message = ''
//           if (error) { console.log(error) }
//           errorFunc.apply()
//         }
//       })
//     }
// }

// forecast.getForecast(
//     () => {console.log(forecast.message)}
//   , () => {console.log(forecast.unavailable)}
// )

var str = "<@256862081767309315> what's up? <@!185112286308990991>"
var re3 = new RegExp(/<@[^>]+> ?/g)

console.log(str.replace(re3, ''))
