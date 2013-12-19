var port = process.env.PORT || 8080

var craigslist = require('craigslist')
var url = require('url')
var level = require('level')
var http = require('http').createServer(serve).listen(port)
var async = require('async')
var db = level('data.db', { valueEncoding: 'json' })
var baseURL = 'http://sfbay.craigslist.org'
var urls = [
  '/search/bia/sfc?catAbb=bia&query=shogun&zoomToPosting=&minAsk=&maxAsk=',
  '/search/bia/eby?catAbb=bia&query=shogun&zoomToPosting=&minAsk=&maxAsk='
]

var queue = async.queue(function(listing, cb) {
  var url = baseURL + listing.url
  craigslist.getListing(url, function(error, details) {
    listing.details = details
    db.put((+listing.details.publishedAt) + '-' + listing.postId, listing, function(err) {
      setTimeout(function() {
        cb(err)
      }, 5000 * Math.random())
    })
  })
}, 1)

queue.drain = function() {
  console.log('no more queued')
}

fetch()
setInterval(fetch, 30 * 60000)

function fetch() {
  urls.map(function(url) {
    craigslist.getList(baseURL + url, function(err, listings) {
      console.log('fetching', baseURL + url, new Date().toString())
      listings.map(queue.push.bind(queue))
    })
  })
}

function serve(req, res) {
  if (req.url.match('favicon')) return res.end()
  if (req.url.match('json')) return serveJSON(req, res)
  serveHTML(req, res)
}

function serveJSON(req, res) {
  var delim = ''
  res.write('{"rows": [')
  db.createValueStream({ reverse: true, valueEncoding: 'utf8' })
    .on('data', function(c) {
      res.write(delim + c)
      if (!delim) delim = ','
    })
    .on('end', function() {
      res.write(']}')
      res.end()
    })
}

function serveHTML(req, res) {
  var limit = -1
  var parsed = url.parse(req.url, true)
  if (parsed.query.limit) limit = +parsed.query.limit
  res.setHeader('content-type', 'text/html')
  db.createValueStream({ reverse: true, limit: limit })
    .on('data', function(c) {
      var img = c.details.coverImage
      res.write('<p>')
      if (img) res.write('<a href="' + c.details.url + '"><img src="' + img + '"></a>')
      var diff = Math.abs(new Date() - new Date(c.details.publishedAt))

      res.write('<br><a href="' + c.details.url + '">' + secondsToString(diff/1000) + '</a>')
      res.write('<br>' + c.details.text)
      res.write('</p>')
    })
    .on('end', function() {
      res.end()
    })
}

function secondsToString(seconds) {
  var numdays = Math.floor((seconds % 31536000) / 86400); 
  var numhours = Math.floor(((seconds % 31536000) % 86400) / 3600);
  var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
  var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
  return  numdays + " days " + numhours + " hours " + numminutes + " minutes " + ~~numseconds + " seconds";

}