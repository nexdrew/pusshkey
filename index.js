'use strict';

var fs = require('fs');
var child_process = require('child_process');
var ssh = 'ssh';

//==================================================================================
//-- this logic stolen from https://github.com/mozilla/awsbox/blob/master/lib/ssh.js
var addSSHPubKey = function(host, pubkey, cb, user, identity) {
	// Add the key if it is not already in the file
	var escapedPubkey = pubkey.replace(/(["'`\$\!\*\?\\\(\)\[\]\{\}])/g, '\\$1');
	var destination = user+'@'+host;
	var rcmd = 'grep "' + escapedPubkey + '" .ssh/authorized_keys || echo "' + escapedPubkey + '" >> .ssh/authorized_keys';
	var args = ['-o', 'StrictHostKeyChecking no', destination, rcmd];
	if(identity) args.unshift('-i', identity);
	console.log('adding key to '+host);
	child_process.execFile(ssh, args, cb);
};

var removeSSHPubKey = function(host, pubkey, cb, user, identity) {
	// Remove the key from the file
	// Escape characters that could break sed regex
	// (nb NOT the + sign)
	var escapedPubkey = pubkey.replace(/(["'`\$\!\*\?\\\/\(\)\[\]\{\}])/g, '\\$1');
	var destination = user+'@'+host;
	var rcmd = 'sed -i "/' + escapedPubkey + '/d" .ssh/authorized_keys';
	var args = ['-o', 'StrictHostKeyChecking no', destination, rcmd];
	if(identity) args.unshift('-i', identity);
	console.log('removing key from '+host);
	child_process.execFile(ssh, args, cb);
};
//==================================================================================

// var tryRequire = function(path, defaultReturn) {
// 	try { return require(path); } catch(e) { return defaultReturn; }
// };

var JSON_FILE_NAME = 'pusshkey.json';
// var json = tryRequire('./'+JSON_FILE_NAME, {});
var json = require('optional')('./'+JSON_FILE_NAME);

var defaultUser = function() {
	return (json && json.user) || (process.env['USER'] || 'ec2-user');
};

var defaultIdentity = function() {
	return (json && json.identity) || '';
};

var executeConfig = function(config) {
	//TODO: validate args!
	var fx = config.command === 'rm' ? removeSSHPubKey : addSSHPubKey;
	var pubkey = (fs.existsSync(config.key) ? fs.readFileSync(config.key, { encoding: "utf8" }) : config.key).replace(/(?:\r\n|\r|\n)/g, '');
	var cb = function(error, stdout, stderr) {
		//TODO: make this better!
		if(error) console.log("ERROR!\n"+error);
		else console.log("success!");
	};

	//-- expand hosts for any aliases
	var hosts = [], hostIndex = '', aliasIndex = '', i;
	var expand = function(host) {
		i = '<'+host+'>';
		if(json && json.hosts && json.hosts[host]) {
			if(aliasIndex.indexOf(i) == -1) {
				// console.log(host+' is alias, expanding');
				aliasIndex += i;
				json.hosts[host].forEach(expand);
			}
			// else console.log(host+' is alias, already expanded');
		} else {
			if(hostIndex.indexOf(i) == -1) {
				// console.log('adding '+host);
				hostIndex += i;
				hosts.push(host);
			}
			// else console.log(host+' already added');
		}
	};
	(config.hosts || []).forEach(expand);

	hosts.forEach(function perHost(host) {
		// console.log('flattened host: '+host);
		fx(host, pubkey, cb, config.user || defaultUser(), config.identity || defaultIdentity());
	});
};

var execute = function(command, key, hosts, opts) {
	if(command && command.command && command.key && command.hosts) executeConfig(command);
	else {
		var config = opts || {};
		config.command = command || config.command;
		config.key = key || config.key;
		config.hosts = hosts || config.hosts;
		executeConfig(config);
	}
};

var add = function(key, hosts, opts) {
	//TODO: check first arg
	execute('add', key, hosts, opts);
};

var rm = function(key, hosts, opts) {
	//TODO: check first arg
	execute('rm', key, hosts, opts);
};

exports.JSON_FILE_NAME = JSON_FILE_NAME;
exports.json = json;
exports.defaultUser = defaultUser;
exports.defaultIdentity = defaultIdentity;
exports.execute = execute;
exports.add = add;
exports.rm = rm;
