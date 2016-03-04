#!/usr/bin/env node

var fs = require('fs'),
    http = require('http'),
    faye = require('faye'),
    getopt = require('node-getopt'),
    deferred = require('deferred')

var opt = getopt.create([
    ['l' , 'track-list=PATH' , 'path to track list file'],
    ['t' , 'track=PATH'      , 'path to new track file'],
    ['o' , 'stdout'          , 'write modified track list to stdout'],
    ['n' , 'notify=URL'      , 'publish notification for new track'],
    ['h' , 'help'            , 'display this help'],
    ['v' , 'version'         , 'show version']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

var trackListPath = opt.options['track-list'] || 'trackList.json'
var newTrackPath = opt.options['track'] || opt.argv[0] || '/dev/stdin'

fs.readFile (trackListPath, function (err, trackListData) {
    if (err) {
	console.log ("Warning: could not open '" + trackListPath + "': " + err)
    }
    var trackListJson = err ? {} : JSON.parse(trackListData)
    trackListJson.tracks = trackListJson.tracks || []
    
    var newTrackData = fs.readFileSync (newTrackPath)
    var newTrackJson = JSON.parse(newTrackData)

    // if it's a single definition, coerce to an array
    if (Object.prototype.toString.call(newTrackJson) != '[object Array]') {
	newTrackJson = [ newTrackJson ]
    }

    // validate the new track JSON structures
    newTrackJson.forEach (function (track) {
	if (!track.label) {
	    console.log ("Invalid track JSON: missing a label element")
	    process.exit (1)
	}
    })
    
    // insert/replace the tracks
    var addedTracks = [], replacedTracks = []
    newTrackJson.forEach (function (newTrack) {
	var newTracks = []
	trackListJson.tracks.forEach (function (oldTrack) {
	    if (oldTrack.label == newTrack.label) {
		newTracks.push (newTrack)
		replacedTracks.push (newTrack)
		newTrack = {}
	    } else {
		newTracks.push (oldTrack)
	    }
	})
	if (newTrack.label) {
	    newTracks.push (newTrack)
	    addedTracks.push (newTrack)
	}
	trackListJson.tracks = newTracks
    })

    // write the new track list
    var trackListOutputData = JSON.stringify (trackListJson, null, 2)
    if (opt.options.stdout) {
	process.stdout.write (trackListOutputData + "\n")
    } else {
	fs.writeFileSync (trackListPath, trackListOutputData)
    }

    // publish notifications
    var publishUrl = opt.options['notify']
    if (publishUrl) {
	var client = new faye.Client (publishUrl)
	deferred.map (addedTracks, function (track) {
	    return client.publish ("/tracks/new", track)
		.then (function() {
		    console.log ("Announced new track " + track.label)
		})
	}) (function() {
	    deferred.map (replacedTracks, function (track) {
		return client.publish ("/tracks/replace", track)
		    .then (function() {
			console.log ("Announced replacement track " + track.label)
		    })
	    }) (function() {
		process.exit()
	    })
	})

    } else {
	process.exit()
    }
    
})
