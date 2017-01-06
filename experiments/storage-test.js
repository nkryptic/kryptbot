var Storage = require('node-storage')

var store = new Storage('storage-test.db')

var users2 = new Map(store.get('users2') || [])

// var users2 = new Map()

console.log(users2)

users2.set('Interrupt', 'test1')
users2.set('nkryptic', 'test2')
users2.set('CruisrCharlie❄️', 'test3')

console.log(users2)

store.put('users2', Array.from(users2.entries()))

// var users = new Set(store.get('users') || [])

// console.log(users)

// users.add('Interrupt')
// users.add('nkryptic')
// users.add('CruisrCharlie❄️')

// store.put('users', Array.from(users))

