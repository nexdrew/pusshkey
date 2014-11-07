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
	// console.log('adding key to '+host);
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
	// console.log('removing key from '+host);
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

var supportedCommands = {
	add: {
		fx: addSSHPubKey
		,successMsg: "Successfully added key to host '%s'"
		,failureMsg: "Failed to add key to host '%s'"
	}
	,rm: {
		fx: removeSSHPubKey
		,successMsg: "Successfully removed key from host '%s'"
		,failureMsg: "Failed to remove key from host '%s'"
	}
};

var executeConfig = function(config) {
	//TODO: validate args!
	var cmdObj = supportedCommands[config.command];
	if(!cmdObj) {
		//throw new Error('Invalid command: '+config.command);
		var msg = 'Invalid command: '+config.command;
		if(config.callback) config.callback(false, msg, null);
		else console.log(msg);
		return false;
	}

	var pubkey = fs.existsSync(config.key) ? fs.readFileSync(config.key, { encoding: "utf8" }) : config.key;
	if(!pubkey || pubkey.length < 200 || pubkey.lastIndexOf('ssh-', 0) !== 0) {
		//throw new Error('Invalid public key: '+pubkey);
		var msg = 'Invalid public key: '+config.key;
		if(config.callback) config.callback(false, msg, null);
		else console.log(msg);
		return false;
	}
	else pubkey = pubkey.replace(/(?:\r\n|\r|\n)/g, '');

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
	var configHosts = typeof config.hosts === 'string' ? [config.hosts] : config.hosts;
	(configHosts || []).forEach(expand);

	if(hosts.length < 1) {
		var msg = 'No hosts defined';
		if(config.callback) config.callback(false, msg, null);
		else console.log(msg);
		return false;
	}

	var totalHosts = hosts.length;
	var details = { hostData: {}, errorHosts: [], successHosts: [] }, overallSuccess = true;
	hosts.forEach(function perHost(host) {
		// console.log('flattened host: '+host);
		var sshCallback = function(error, stdout, stderr) {
			details.hostData[host] = { error: error, stdout: stdout, stderr: stderr };
			if(error) {
				details.errorHosts.push(host);
				overallSuccess = false;
				if(!config.callback) {
					console.log(cmdObj.failureMsg, host);
					console.log(error);
				}
			} else {
				details.successHosts.push(host);
				if(!config.callback) console.log(cmdObj.successMsg, host);
			}
			//-- is this race condition?
			if((details.errorHosts.length + details.successHosts.length) === totalHosts && config.callback) {
				config.callback(overallSuccess, overallSuccess ? util.format('%d hosts successful', totalHosts) : util.format('%d/%d hosts with errors', details.errorHosts.length, totalHosts), details);
			}
		};
		cmdObj.fx(host, pubkey, sshCallback, config.user || defaultUser(), config.identity || defaultIdentity());
	});
	return true;
};

var execute = function(command, key, hosts, opts, cb) {
	var config = command && command.command && command.key && command.hosts ? command : (typeof opts !== 'function' ? (opts || {}) : (cb || {}));
	
	if(typeof opts === 'function') config.callback = opts;
	else if(typeof cb === 'function') config.callback = cb;

	config.key = key || config.key;
	config.hosts = hosts || config.hosts;

	if(typeof command === 'string') config.command = command;

	return executeConfig(config);
};

var add = function(key, hosts, opts, cb) {
	return execute('add', key, hosts, opts, cb);
};

var rm = function(key, hosts, opts, cb) {
	return execute('rm', key, hosts, opts, cb);
};

exports.JSON_FILE_NAME = JSON_FILE_NAME;
exports.json = json;
exports.defaultUser = defaultUser;
exports.defaultIdentity = defaultIdentity;
exports.execute = execute;
exports.add = add;
exports.rm = rm;
