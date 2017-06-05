# pusshkey

[![Greenkeeper badge](https://badges.greenkeeper.io/nexdrew/pusshkey.svg)](https://greenkeeper.io/)

Basic CLI (and Node module) to _push SSH keys_ to remote hosts. Add or remove a public key from several hosts in one shot.

Here's the scenario: You already have public key authentication to a set of remote hosts (on-premise VMs or AWS EC2 instances) and now you need to give _someone else_ access. Full-blown configuration management might be overkill - you just need to propagate someone else's key. Ok, you can either [write up a simple bash script](http://chriscase.cc/2012/09/appending-to-a-remote-file-via-ssh/) or... do it manually? Yuck. Then what do you do when someone leaves the company/project and you now need to _remove_ that person's key?

Enter **pusshkey**. A simple tool for a simple job. Install via npm, optionally configure a group of hosts in pusshkey.json, and `pusshkey add` or `pusshkey rm`.

## Install

```sh
$ npm install -g pusshkey
```

## Usage

Add key to one or more hosts. Will only add the key if it does not already exist. :thumbsup:

```sh
$ pusshkey [options] add <key> <host> [hosts...]
```

Remove key from one or more hosts.

```sh
$ pusshkey [options] rm <key> <host> [hosts...]
```

Note that a `<key>` is the public key to add or remove, either as a file reference or as the public key value itself. A `<host>` is either a hostname, IP, or alias. See Configuration below about using aliases to represent a set of hosts.

Also run `pusshkey -h` or `pusshkey` for help content and `pusshkey -V` to output the installed version.

### Options

`-u <user>`, `--user <user>`

The SSH user on the remote host(s). This will be used for authentication in order to access the remote hosts, and the key that you're pushing will go in the `authorized_keys` file that belongs to this user.

Default value is either **1)** the user specified in the `pusshkey.json` config file (see Configuration below) or **2)** the current user. Run `pusshkey -h` to see which user will be used as default.

`-i <identity>`, `--identity <identity>`

The identity file (private key) used for public key authentication against the remote host(s). This file represents your credentials (key and associated passphrase). This is the key you want to add to `ssh-agent` via `ssh-add <key>` before running `pusshkey` (see Notes below).

Default value is either **1)** the identity specified in the `pusshkey.json` config file (see Configuration below) or **2)** the default for the `ssh` program (typically `~/.ssh/id_rsa`). Run `pusshkey -h` to see which identity file will be used as default. A value of `''` equates to the default for the `ssh` program.

### Examples

```sh
# Add some_key to your-server
$ pusshkey add ~/.ssh/some_key.pub your-server

# Add some_key to multiple hosts
$ pusshkey add ~/.ssh/some_key.pub your-server-1 your-server-2 192.168.0.1 ec2-1-2-3-4.compute-1.amazonaws.com

# Add key_in_cwd.pub to your-server and authenticate using foo user and x_id_rsa private key
$ pusshkey add key_in_cwd.pub your-server -u foo -i ~/.ssh/x_id_rsa

# Remove old_key from your-server
$ pusshkey rm old_key.txt your-server
```

Also see Notes below about using `ssh-agent` (_before_ you run `pusshkey`) to make your life easier.

## Configuration

The big win here is the ability to predefine **host aliases**, which can represent one or more actual hostnames. You can also specify which user and identity that ssh should use (instead of using the `-u` and `-i` options every time).

Define a `pusshkey.json` file in the current working directory that contains the following (all entries are optional):

```json
{
  "hosts": {
    "dev-alias": [ "dev-server-1", "dev-server-2", "dev-server-N" ],
    "prd-alias": [ "prd-server-1", "prd-server-2", "prd-server-3", "prd-server-N" ],
    "all": [ "dev-alias", "prd-alias" ]
  },
  "user": "foo",
  "identity": "~/.ssh/foo_id_rsa"
}
```

Each `"hosts"` entry defines a host alias, and you can reference other aliases in the array. *Circular references are supported*, though I'm not sure why you would need them. It's also ok if you use the same host in multiple aliases - pusshkey will detect this and will only access each host **once per execution**.

The config above would let you run simple commands like:

```sh
$ pusshkey add new_key.pub dev-alias
$ pusshkey rm old_key.pub all
```

To propagate a key to several hosts in one execution for the `foo` user, using `foo_id_rsa` for authentication.

The configuration file MUST be in the current working directory, and it MUST be named `pusshkey.json`.

## Notes

- Currently requires the `ssh` program. If you're on Windwos, try installing msysgit first.
- To avoid password/passphrase prompts, make sure `ssh-agent` is running and you have added your private key via `ssh-add` before using `pusshkey`. Should be as simple as:

```sh
$ ssh-agent
$ ssh-add <key>
```

- To check if your key has been added to `ssh-agent`, run `ssh-add -l`.

## API

Coming soon.
