
function Logger(label) {
  // this.annChannel = null
  this.label = label
}

Logger.prototype._log = function(message, isError, tag) {
  let d       = new Date()
    , month   = d.getMonth() + 1
    , day     = d.getDate()
    , hours   = d.getHours()
    , minutes = d.getMinutes()
    , seconds = d.getSeconds()
    , tags    = []
    , logFunc = console.log
    , pre

  if (month < 10) { month = '0' + month }
  if (day < 10) { day = '0' + day }
  if (hours < 10) { hours = '0' + hours }
  if (minutes < 10) { minutes = '0' + minutes }
  if (seconds < 10) { seconds = '0' + seconds }

  pre = `${month}/${day} ${hours}:${minutes}:${seconds} ${this.label}: `
  if (isError) {
    tags.push('error')
    logFunc = console.error
  }
  if (tag) {
    tags.push(tag)
  }
  if (tags.length > 0) {
    pre = pre + '[' + tags.join('|') + '] '
  }
  logFunc(pre + message)
}

Logger.prototype.log = function(message, tag) {
  // handoff to the base log method
  this._log(message, false, tag)
}

Logger.prototype.error = function(message, tag) {
  // handoff to the base log method
  this._log(message, true, tag)
}


module.exports = Logger
