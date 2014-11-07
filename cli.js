#!/usr/bin/env node
'use strict';

var commander = require('commander');
var pkg = require('./package.json');
var pusshkey = require('./');

commander.version(pkg.version);

var cmds = ['add', 'rm'];
var cmdArgs = ['<key>', '<host>', '[hosts...]'];

var cmdsFull = cmds.map(function(c, i, a) { return c+' '+cmdArgs.join(' '); });
cmdsFull.push('hosts');

var brkLength = cmdsFull.reduce(function(p, c, i, a) { return a[i].length > p ? a[i].length : p }, 0);
var brk = '\n'+new Array(brkLength+3).join(' ');

var sharedDesc =
	brk+cmdArgs[0]+' should be the path to the public key file or the key value itself'
	+brk+cmdArgs[1]+' should be an IP, hostname, or "hosts" key from '+pusshkey.JSON_FILE_NAME
	+brk+cmdArgs[2]+' allows you to define additional <host> values';

var config = {};

var handleCommand = function(command, key, host, hosts) {
	config.execute = true;
	config.command = command;
	config.key = key;
	config.hosts = (hosts || [host]);
	if(hosts) config.hosts.unshift(host);
	config.user = commander.user;
	config.identity = commander.identity;
	config.parallel = !!commander.parallel;
	config.force = !!commander.force;
	// console.log('commander:', commander);
};

commander
	.command(cmdsFull[0])
	.description(
		'Add key to remote host'
		+brk+'Will only add the key if it does not already exist'
		// +' (see --force option)'
		+sharedDesc
		+'\n')
	.action(function add(key, host, hosts) {
		handleCommand(cmds[0], key, host, hosts);
	});

commander
	.command(cmdsFull[1])
	.description(
		'Remove key from remote host'
		+brk+'Will attempt to remove the key if it\'s found'
		+sharedDesc
		+'\n')
	.action(function rm(key, host, hosts) {
		handleCommand(cmds[1], key, host, hosts);
	});

commander
	.command(cmdsFull[2])
	.description('Output "hosts" object from '+pusshkey.JSON_FILE_NAME)
	.action(function hosts() {
		config.execute = false;
		config.command = cmdsFull[2];
		console.log((pusshkey.json && pusshkey.json.hosts) || 'No hosts configured. Try adding a '+pusshkey.JSON_FILE_NAME+' file with a "hosts" object.');
	});

commander.option('-u, --user <user>', 'specify the username to authenticate ssh with - default is '+pusshkey.defaultUser());
commander.option('-i, --identity <identity_file>', 'specify the identity file (private key) for public key authentication - default is \''+pusshkey.defaultIdentity()+'\'')
// commander.option('-p, --parallel', 'flag to execute commands against remote hosts concurrently');
// commander.option('-f, --force', 'flag to forcefully perform the command, whether the key already exists or not');

// parse args and execute command action
commander.parse(process.argv);

if(!config.command) commander.help();

if(config.execute) {
	var successfullyQueued = pusshkey.execute(config);
	if(!successfullyQueued) process.exit(1);
}
