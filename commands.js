/**
 * This is the file where the bot commands are located
 *
 * @license MIT license
 */

var http = require('http');
var sys = require('sys');

//Google doesn't like http
var https = require('https');
var csv = require('csv-parse');

exports.commands = {
	/**
	 * Help commands
	 *
	 * These commands are here to provide information about the bot.
	 */

	about: function(arg, by, room, con) {
		if (this.hasRank(by, '#~') || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		text += '**OM Room Bot** by: Quinella and TalkTakesTime, with custom OM commands by unfixable';
		this.say(con, room, text);
	},
	help: 'guide',
	guide: function(arg, by, room, con) {
		if (this.hasRank(by, '#~') || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		if (config.botguide) {
			text += 'A guide on how to use this bot can be found here: ' + config.botguide;
		} else {
			text += 'There is no guide for this bot. PM the owner with any questions.';
		}
		this.say(con, room, text);
	},

	/**
	 * Dev commands
	 *
	 * These commands are here for highly ranked users (or the creator) to use
	 * to perform arbitrary actions that can't be done through any other commands
	 * or to help with upkeep of the bot.
	 */

	reload: function(arg, by, room, con) {
		if (!this.hasRank(by, '#~')) return false;
		try {
			this.uncacheTree('./commands.js');
			Commands = require('./commands.js').commands;
			this.say(con, room, 'Commands reloaded.');
		} catch (e) {
			error('failed to reload: ' + sys.inspect(e));
		}
	},
	custom: function(arg, by, room, con) {
		if (!this.hasRank(by, '~')) return false;
		// Custom commands can be executed in an arbitrary room using the syntax
		// ".custom [room] command", e.g., to do !data pikachu in the room lobby,
		// the command would be ".custom [lobby] !data pikachu". However, using
		// "[" and "]" in the custom command to be executed can mess this up, so
		// be careful with them.
		if (arg.indexOf('[') === 0 && arg.indexOf(']') > -1) {
			var tarRoom = arg.slice(1, arg.indexOf(']'));
			arg = arg.substr(arg.indexOf(']') + 1).trim();
		}
		this.say(con, tarRoom || room, arg);
	},
	js: function(arg, by, room, con) {
		if (config.excepts.indexOf(toId(by)) === -1) return false;
		try {
			var result = eval(arg.trim());
			this.say(con, room, JSON.stringify(result));
		} catch (e) {
			this.say(con, room, e.name + ": " + e.message);
		}
	},

	/**
	 * Room Owner commands
	 *
	 * These commands allow room owners to personalise settings for moderation and command use.
	 */

	settings: 'set',
	set: function(arg, by, room, con) {
		if (!this.hasRank(by, '%@&#~') || room.charAt(0) === ',') return false;

		var settable = {
			say: 1,
			joke: 1,
			choose: 1,
			usagestats: 1,
			buzz: 1,
			helix: 1,
			survivor: 1,
			games: 1,
			wifi: 1,
			monotype: 1,
			autoban: 1,
			happy: 1,
			guia: 1,
			studio: 1,
			'switch': 1,
			banword: 1
		};
		var modOpts = {
			flooding: 1,
			caps: 1,
			stretching: 1,
			bannedwords: 1
		};

		var opts = arg.split(',');
		var cmd = toId(opts[0]);
		if (cmd === 'mod' || cmd === 'm' || cmd === 'modding') {
			if (!opts[1] || !toId(opts[1]) || !(toId(opts[1]) in modOpts)) return this.say(con, room, 'Incorrect command: correct syntax is ' + config.commandcharacter + 'set mod, [' +
				Object.keys(modOpts).join('/') + '](, [on/off])');

			if (!this.settings['modding']) this.settings['modding'] = {};
			if (!this.settings['modding'][room]) this.settings['modding'][room] = {};
			if (opts[2] && toId(opts[2])) {
				if (!this.hasRank(by, '#~')) return false;
				if (!(toId(opts[2]) in {on: 1, off: 1}))  return this.say(con, room, 'Incorrect command: correct syntax is ' + config.commandcharacter + 'set mod, [' +
					Object.keys(modOpts).join('/') + '](, [on/off])');
				if (toId(opts[2]) === 'off') {
					this.settings['modding'][room][toId(opts[1])] = 0;
				} else {
					delete this.settings['modding'][room][toId(opts[1])];
				}
				this.writeSettings();
				this.say(con, room, 'Moderation for ' + toId(opts[1]) + ' in this room is now ' + toId(opts[2]).toUpperCase() + '.');
				return;
			} else {
				this.say(con, room, 'Moderation for ' + toId(opts[1]) + ' in this room is currently ' +
					(this.settings['modding'][room][toId(opts[1])] === 0 ? 'OFF' : 'ON') + '.');
				return;
			}
		} else {
			if (!Commands[cmd]) return this.say(con, room, config.commandcharacter + '' + opts[0] + ' is not a valid command.');
			var failsafe = 0;
			while (!(cmd in settable)) {
				if (typeof Commands[cmd] === 'string') {
					cmd = Commands[cmd];
				} else if (typeof Commands[cmd] === 'function') {
					if (cmd in settable) {
						break;
					} else {
						this.say(con, room, 'The settings for ' + config.commandcharacter + '' + opts[0] + ' cannot be changed.');
						return;
					}
				} else {
					this.say(con, room, 'Something went wrong. PM TalkTakesTime here or on Smogon with the command you tried.');
					return;
				}
				failsafe++;
				if (failsafe > 5) {
					this.say(con, room, 'The command "' + config.commandcharacter + '' + opts[0] + '" could not be found.');
					return;
				}
			}

			var settingsLevels = {
				off: false,
				disable: false,
				'+': '+',
				'%': '%',
				'@': '@',
				'&': '&',
				'#': '#',
				'~': '~',
				on: true,
				enable: true
			};
			if (!opts[1] || !opts[1].trim()) {
				var msg = '';
				if (!this.settings[cmd] || (!this.settings[cmd][room] && this.settings[cmd][room] !== false)) {
					msg = '.' + cmd + ' is available for users of rank ' + ((cmd === 'autoban' || cmd === 'banword') ? '#' : config.defaultrank) + ' and above.';
				} else if (this.settings[cmd][room] in settingsLevels) {
					msg = '.' + cmd + ' is available for users of rank ' + this.settings[cmd][room] + ' and above.';
				} else if (this.settings[cmd][room] === true) {
					msg = '.' + cmd + ' is available for all users in this room.';
				} else if (this.settings[cmd][room] === false) {
					msg = '' + config.commandcharacter+''+ cmd + ' is not available for use in this room.';
				}
				this.say(con, room, msg);
				return;
			} else {
				if (!this.hasRank(by, '#~')) return false;
				var newRank = opts[1].trim();
				if (!(newRank in settingsLevels)) return this.say(con, room, 'Unknown option: "' + newRank + '". Valid settings are: off/disable, +, %, @, &, #, ~, on/enable.');
				if (!this.settings[cmd]) this.settings[cmd] = {};
				this.settings[cmd][room] = settingsLevels[newRank];
				this.writeSettings();
				this.say(con, room, 'The command ' + config.commandcharacter + '' + cmd + ' is now ' +
					(settingsLevels[newRank] === newRank ? ' available for users of rank ' + newRank + ' and above.' :
					(this.settings[cmd][room] ? 'available for all users in this room.' : 'unavailable for use in this room.')))
			}
		}
	},
	blacklist: 'autoban',
	ban: 'autoban',
	ab: 'autoban',
	autoban: function(arg, by, room, con) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@&#~')) return this.say(con, room, config.nick + ' requires rank of @ or higher to (un)blacklist.');

		arg = arg.split(',');
		var added = [];
		var illegalNick = [];
		var alreadyAdded = [];
		if (!arg.length || (arg.length === 1 && !arg[0].trim().length)) return this.say(con, room, 'You must specify at least one user to blacklist.');
		for (var i = 0; i < arg.length; i++) {
			var tarUser = toId(arg[i]);
			if (tarUser.length < 1 || tarUser.length > 18) {
				illegalNick.push(tarUser);
				continue;
			}
			if (!this.blacklistUser(tarUser, room)) {
				alreadyAdded.push(tarUser);
				continue;
			}
			this.say(con, room, '/roomban ' + tarUser + ', Blacklisted user');
			this.say(con,room, '/modnote ' + tarUser + ' was added to the blacklist by ' + by + '.');
			added.push(tarUser);
		}

		var text = '';
		if (added.length) {
			text += 'User(s) "' + added.join('", "') + '" added to blacklist successfully. ';
			this.writeSettings();
		}
		if (alreadyAdded.length) text += 'User(s) "' + alreadyAdded.join('", "') + '" already present in blacklist. ';
		if (illegalNick.length) text += 'All ' + (text.length ? 'other ' : '') + 'users had illegal nicks and were not blacklisted.';
		this.say(con, room, text);
	},
	unblacklist: 'unautoban',
	unban: 'unautoban',
	unab: 'unautoban',
	unautoban: function(arg, by, room, con) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;
		if (!this.hasRank(this.ranks[room] || ' ', '@&#~')) return this.say(con, room, config.nick + ' requires rank of @ or higher to (un)blacklist.');

		arg = arg.split(',');
		var removed = [];
		var notRemoved = [];
		if (!arg.length || (arg.length === 1 && !arg[0].trim().length)) return this.say(con, room, 'You must specify at least one user to unblacklist.');
		for (var i = 0; i < arg.length; i++) {
			var tarUser = toId(arg[i]);
			if (tarUser.length < 1 || tarUser.length > 18) {
				notRemoved.push(tarUser);
				continue;
			}
			if (!this.unblacklistUser(tarUser, room)) {
				notRemoved.push(tarUser);
				continue;
			}
			this.say(con, room, '/roomunban ' + tarUser);
			removed.push(tarUser);
		}

		var text = '';
		if (removed.length) {
			text += 'User(s) "' + removed.join('", "') + '" removed from blacklist successfully. ';
			this.writeSettings();
		}
		if (notRemoved.length) text += (text.length ? 'No other ' : 'No ') + 'specified users were present in the blacklist.';
		this.say(con, room, text);
	},
	viewbans: 'viewblacklist',
	vab: 'viewblacklist',
	viewautobans: 'viewblacklist',
	viewblacklist: function(arg, by, room, con) {
		if (!this.canUse('autoban', room, by) || room.charAt(0) === ',') return false;

		var text = '';
		if (!this.settings.blacklist || !this.settings.blacklist[room]) {
			text = 'No users are blacklisted in this room.';
		} else {
			if (arg.length) {
				var nick = toId(arg);
				if (nick.length < 1 || nick.length > 18) {
					text = 'Invalid nickname: "' + nick + '".';
				} else {
					text = 'User "' + nick + '" is currently ' + (nick in this.settings.blacklist[room] ? '' : 'not ') + 'blacklisted in ' + room + '.';
				}
			} else {
				var nickList = Object.keys(this.settings.blacklist[room]);
				if (!nickList.length) return this.say(con, room, '/pm ' + by + ', No users are blacklisted in this room.');
				this.uploadToHastebin(con, room, by, 'The following users are banned in ' + room + ':\n\n' + nickList.join('\n'))
				return;
			}
		}
		this.say(con, room, '/pm ' + by + ', ' + text);
	},
	banphrase: 'banword',
	banword: function(arg, by, room, con) {
		if (!this.canUse('banword', room, by)) return false;
		if (!this.settings.bannedphrases) this.settings.bannedphrases = {};
		arg = arg.trim().toLowerCase();
		if (!arg) return false;
		var tarRoom = room;

		if (room.charAt(0) === ',') {
			if (!this.hasRank(by, '~')) return false;
			tarRoom = 'global';
		}

		if (!this.settings.bannedphrases[tarRoom]) this.settings.bannedphrases[tarRoom] = {};
		if (arg in this.settings.bannedphrases[tarRoom]) return this.say(con, room, "Phrase \"" + arg + "\" is already banned.");
		this.settings.bannedphrases[tarRoom][arg] = 1;
		this.writeSettings();
		this.say(con, room, "Phrase \"" + arg + "\" is now banned.");
	},
	unbanphrase: 'unbanword',
	unbanword: function(arg, by, room, con) {
		if (!this.canUse('banword', room, by)) return false;
		arg = arg.trim().toLowerCase();
		if (!arg) return false;
		var tarRoom = room;

		if (room.charAt(0) === ',') {
			if (!this.hasRank(by, '~')) return false;
			tarRoom = 'global';
		}

		if (!this.settings.bannedphrases || !this.settings.bannedphrases[tarRoom] || !(arg in this.settings.bannedphrases[tarRoom])) 
			return this.say(con, room, "Phrase \"" + arg + "\" is not currently banned.");
		delete this.settings.bannedphrases[tarRoom][arg];
		if (!Object.size(this.settings.bannedphrases[tarRoom])) delete this.settings.bannedphrases[tarRoom];
		if (!Object.size(this.settings.bannedphrases)) delete this.settings.bannedphrases;
		this.writeSettings();
		this.say(con, room, "Phrase \"" + arg + "\" is no longer banned.");
	},
	viewbannedphrases: 'viewbannedwords',
	vbw: 'viewbannedwords',
	viewbannedwords: function(arg, by, room, con) {
		if (!this.canUse('banword', room, by)) return false;
		arg = arg.trim().toLowerCase();
		var tarRoom = room;

		if (room.charAt(0) === ',') {
			if (!this.hasRank(by, '~')) return false;
			tarRoom = 'global';
		}

		var text = "";
		if (!this.settings.bannedphrases || !this.settings.bannedphrases[tarRoom]) {
			text = "No phrases are banned in this room.";
		} else {
			if (arg.length) {
				text = "The phrase \"" + arg + "\" is currently " + (arg in this.settings.bannedphrases[tarRoom] ? "" : "not ") + "banned " +
					(room.charAt(0) === ',' ? "globally" : "in " + room) + ".";
			} else {
				var banList = Object.keys(this.settings.bannedphrases[tarRoom]);
				if (!banList.length) return this.say(con, room, "No phrases are banned in this room.");
				this.uploadToHastebin(con, room, by, "The following phrases are banned " + (room.charAt(0) === ',' ? "globally" : "in " + room) + ":\n\n" + banList.join('\n'))
				return;
			}
		}
		this.say(con, room, text);
	},

	/**
	 * General commands
	 *
	 * Add custom commands here.
	 */

	tell: 'say',
	say: function(arg, by, room, con) {
		if (!this.canUse('say', room, by)) return false;
		this.say(con, room, stripCommands(arg) + ' (' + by + ' said this)');
	},
	joke: function(arg, by, room, con) {
		if (!this.canUse('joke', room, by) || room.charAt(0) === ',') return false;
		var self = this;

		var reqOpt = {
			hostname: 'api.icndb.com',
			path: '/jokes/random',
			method: 'GET'
		};
		var req = http.request(reqOpt, function(res) {
			res.on('data', function(chunk) {
				try {
					var data = JSON.parse(chunk);
					self.say(con, room, data.value.joke.replace(/&quot;/g, "\""));
				} catch (e) {
					self.say(con, room, 'Sorry, couldn\'t fetch a random joke... :(');
				}
			});
		});
		req.end();
	},
	choose: function(arg, by, room, con) {
		if (arg.indexOf(',') === -1) {
			var choices = arg.split(' ');
		} else {
			var choices = arg.split(',');
		}
		choices = choices.filter(function(i) {return (toId(i) !== '')});
		if (choices.length < 2) return this.say(con, room, (room.charAt(0) === ',' ? '': '/pm ' + by + ', ') + '.choose: You must give at least 2 valid choices.');

		var choice = choices[Math.floor(Math.random()*choices.length)];
		this.say(con, room, ((this.canUse('choose', room, by) || room.charAt(0) === ',') ? '':'/pm ' + by + ', ') + stripCommands(choice));
	},
	usage: 'usagestats',
	usagestats: function(arg, by, room, con) {
		if (this.canUse('usagestats', room, by) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}
		text += 'http://www.smogon.com/stats/2015-01/';
		this.say(con, room, text);
	},
	seen: function(arg, by, room, con) { // this command is still a bit buggy
		var text = (room.charAt(0) === ',' ? '' : '/pm ' + by + ', ');
		arg = toId(arg);
		if (!arg || arg.length > 18) return this.say(con, room, text + 'Invalid username.');
		if (arg === toId(by)) {
			text += 'Have you looked in the mirror lately?';
		} else if (arg === toId(config.nick)) {
			text += 'You might be either blind or illiterate. Might want to get that checked out.';
		} else if (!this.chatData[arg] || !this.chatData[arg].seenAt) {
			text += 'The user ' + arg + ' has never been seen.';
		} else {
			text += arg + ' was last seen ' + this.getTimeAgo(this.chatData[arg].seenAt) + ' ago' + (
				this.chatData[arg].lastSeen ? ', ' + this.chatData[arg].lastSeen : '.');
		}
		this.say(con, room, text);
	},
	helix: function(arg, by, room, con) {
		if (this.canUse('helix', room, by) || room.charAt(0) === ',') {
			var text = '';
		} else {
			var text = '/pm ' + by + ', ';
		}

		var rand = ~~(20 * Math.random()) + 1;

		switch (rand) {
	 		case 1: text += "Signs point to yes."; break;
	  		case 2: text += "Yes."; break;
			case 3: text += "Reply hazy, try again."; break;
			case 4: text += "Without a doubt."; break;
			case 5: text += "My sources say no."; break;
			case 6: text += "As I see it, yes."; break;
			case 7: text += "You may rely on it."; break;
			case 8: text += "Concentrate and ask again."; break;
			case 9: text += "Outlook not so good."; break;
			case 10: text += "It is decidedly so."; break;
			case 11: text += "Better not tell you now."; break;
			case 12: text += "Very doubtful."; break;
			case 13: text += "Yes - definitely."; break;
			case 14: text += "It is certain."; break;
			case 15: text += "Cannot predict now."; break;
			case 16: text += "Most likely."; break;
			case 17: text += "Ask again later."; break;
			case 18: text += "My reply is no."; break;
			case 19: text += "Outlook good."; break;
			case 20: text += "Don't count on it."; break;
		}
		this.say(con, room, text);
	},

	/**
	 * Room specific commands
	 *
	 * These commands are used in specific rooms on the Smogon server.
	 */
	espaol: 'esp',
	ayuda: 'esp',
	esp: function(arg, by, room, con) {
		// links to relevant sites for the Wi-Fi room 
		if ((room !== 'espaol' && room.charAt(0) !== ',') || config.serverid !== 'showdown') return false;
		var text = '';
		if (room.charAt(0) === ',' || !this.canUse('guia', room, by)) {
			text += '/pm ' + by + ', ';
		}
		var messages = {
			reglas: 'Recuerda seguir las reglas de nuestra sala en todo momento: http://ps-salaespanol.weebly.com/reglas.html',
			faq: 'Preguntas frecuentes sobre el funcionamiento del chat: http://ps-salaespanol.weebly.com/faq.html',
			faqs: 'Preguntas frecuentes sobre el funcionamiento del chat: http://ps-salaespanol.weebly.com/faq.html',
			foro: '¡Visita nuestro foro para participar en multitud de actividades! http://ps-salaespanol.proboards.com/',
			guia: 'Desde este índice (http://ps-salaespanol.proboards.com/thread/575/ndice-de-gu) podrás acceder a toda la información importante de la sala. By: Lost Seso',
			liga: '¿Tienes alguna duda sobre la Liga? ¡Revisa el **índice de la Liga** aquí!: (http://goo.gl/CxH2gi) By: xJoelituh'
		};
		text += (toId(arg) ? (messages[toId(arg)] || '¡Bienvenidos a la comunidad de habla hispana! Si eres nuevo o tienes dudas revisa nuestro índice de guías: http://ps-salaespanol.proboards.com/thread/575/ndice-de-gu') : '¡Bienvenidos a la comunidad de habla hispana! Si eres nuevo o tienes dudas revisa nuestro índice de guías: http://ps-salaespanol.proboards.com/thread/575/ndice-de-gu');
		this.say(con, room, text);
	},
	studio: function(arg, by, room, con) {
		if ((room !== 'thestudio' && room.charAt(0) !== ',') || config.serverid !== 'showdown') return false;
		var text = '';
		if (room.charAt(0) === ',' || !this.canUse('studio', room, by)) {
			text += '/pm ' + by + ', ';
		}
		var messages = {
			plug: '/announce The Studio\'s plug.dj can be found here: https://plug.dj/the-studio/'
		};
		this.say(con, room, text + (messages[toId(arg)] || ('Welcome to The Studio, a music sharing room on PS!. If you have any questions, feel free to PM a room staff member. Available commands for .studio: ' + Object.keys(messages).join(', '))));
	},
	'switch': function(arg, by, room, con) {
		if (room !== 'gamecorner' || config.serverid !== 'showdown' || !this.canUse('switch', room, by)) return false;
		this.say(con, room, 'Taking over the world. Starting with Game Corner. Room deregistered.');
		this.say(con, room, '/k ' + (toId(arg) || by) + ', O3O YOU HAVE TOUCHED THE SWITCH');
	},
	wifi: function(arg, by, room, con) {
		// links to relevant sites for the Wi-Fi room 
		if ((room !== 'wifi' && room.charAt(0) !== ',') || config.serverid !== 'showdown') return false;
		var text = '';
		if (room.charAt(0) === ',' || !this.canUse('wifi', room, by)) {
			text += '/pm ' + by + ', ';
		}
		var messages = {
			intro: 'Here is an introduction to Wi-Fi: http://tinyurl.com/welcome2wifi',
			rules: 'The rules for the Wi-Fi room can be found here: http://pstradingroom.weebly.com/rules.html',
			faq: 'Wi-Fi room FAQs: http://pstradingroom.weebly.com/faqs.html',
			faqs: 'Wi-Fi room FAQs: http://pstradingroom.weebly.com/faqs.html',
			scammers: 'List of known scammers: http://tinyurl.com/psscammers',
			cloners: 'List of approved cloners: http://goo.gl/WO8Mf4',
			tips: 'Scamming prevention tips: http://pstradingroom.weebly.com/scamming-prevention-tips.html',
			breeders: 'List of breeders: http://tinyurl.com/WiFIBReedingBrigade',
			signup: 'Breeders Sign Up: http://tinyurl.com/GetBreeding',
			bans: 'Ban appeals: http://tinyurl.com/WifiBanAppeals',
			banappeals: 'Ban appeals: http://tinyurl.com/WifiBanAppeals',
			lists: 'Major and minor list compilation: http://tinyurl.com/WifiSheets',
			trainers: 'List of EV trainers: http://tinyurl.com/WifiEVtrainingCrew',
			youtube: 'Wi-Fi room\'s official YouTube channel: http://tinyurl.com/wifiyoutube',
			league: 'Wi-Fi Room Pokemon League: http://tinyurl.com/wifiroomleague'
		};
		if (!this.wifiRoom) { 
			this.wifiRoom = {
				docRevs : ['', ''],
				scammers : {},
				cloners : []
			};
		}
		var args = arg.trim().split(',');
		var that = this;
		switch (toId(args[0])) {
		case 'checkfc': 
			if (!config.googleapikey) {
				this.say(con, room, text + 'A Google API key has not been provided and is required for this command to work.');
				return;
			}
			if (args.length < 2) {
				this.say(con, room, text + 'Usage: .wifi checkfc, <fc>');
				return;
			}
			that.getDocMeta('0AvygZBLXTtZZdFFfZ3hhVUplZm5MSGljTTJLQmJScEE', function (err, meta) {
				if (err) {
					console.log(err);
					that.say(con, room, text + 'An error occured while processing your command. Please report this!');
					return;
				}
				if (that.wifiRoom.docRevs[1] == meta.version) {
					var value = that.wifiRoom.scammers[args[1].replace(/\D/g, '')];
					if (value) {
						text += "The FC " + args[1] + " **BELONGS TO A KNOWN SCAMMER**. Known names: " + value.substring(0, 61) + (value.length > 61 ? '...' : '.');
					} else {
						text += "This FC does **NOT** belong to a known scammer.";
					}
					that.say(con, room, text);
					return;
				}
				that.say(con, room, text + 'Scammers List changed. Updating...');
				that.wifiRoom.docRevs[1] = meta.version;
				that.getDocCsv(meta, function (data) {
					csv(data, function (err, data) {
						if (err) {
							console.log(err);
							that.say(con, room, text + 'An error occured while processing your command. Please report this!');
							return;
						}
						data.forEach(function (ent) {
							var str = ent[1].replace(/\D/g, '');
							if (str && str.length >= 12) {
								for (var i = 0; i < str.length / 12; i++) {
									that.wifiRoom.scammers[str.substr(12 * i, 12 * i + 12)] = ent[0];
								}
							}
						});
						var value = that.wifiRoom.scammers[args[1].replace(/\D/g, '')];
						if (value) {
							text += "The FC " + args[1] + " **BELONGS TO A KNOWN SCAMMER**. Known names: " + value.substring(0, 61) + (value.length > 61 ? '...' : '.');
						} else {
							text += "This FC does **NOT** belong to a known scammer.";
						}
						that.say(con, room, text);
					});
				});
			});
			break;
		/*
		case 'ocloners':
		case 'onlinecloners': 
			//Let's pretend this doesn't exist yet
			this.say(con, room, text + 'Unknown option. General links can be found here: http://pstradingroom.weebly.com/links.html');
			break;
			if (!config.googleapikey) {
				this.say(con, room, text + 'A Google API key has not been provided and is required for this command to work.');
				return;
			}
			that.getDocMeta('0Avz7HpTxAsjIdFFSQ3BhVGpCbHVVdTJ2VVlDVVV6TWc', function (err, meta) {
				if (err) {
					console.log(err);
					that.say(con, room, text + 'An error occured while processing your command. Please report this!');
					return;
				}
				text = '/pm ' + by + ', ';
				if (that.wifiRoom.docRevs[0] == meta.version) {
					var found = [];
					for (var i in that.wifiRoom.cloners) {
						if (that.chatData[toId(that.wifiRoom.cloners[i][0])]) {
							found.push('Name: ' + that.wifiRoom.cloners[i][0] + ' | FC: ' + that.wifiRoom.cloners[i][1] + ' | IGN: ' + that.wifiRoom.cloners[i][2]);
						}
					}
					if (!found.length) {
						that.say(con, room, text + 'No cloners were found online.');
						return;
					}
					var foundstr = found.join(' ');
					if(foundstr.length > 266) {
						that.uploadToHastebin(con, room, by, "The following cloners are online :\n\n" + found.join('\n'));
						return;
					}
					that.say(con, room, by, "The following cloners are online :\n\n" + foundstr);
					return;
				}
				that.say(con, room, text + 'Cloners List changed. Updating...');
				that.wifiRoom.docRevs[0] = meta.version;
				that.getDocCsv(meta, function (data) {
					csv(data, function (err, data) {
						if (err) {
							console.log(err);
							this.say(con, room, text + 'An error occured while processing your command. Please report this!');
							return;
						}
						data.forEach(function (ent) {
							var str = ent[1].replace(/\D/g, '');
							if (str && str.length >= 12) {
								that.wifiRoom.cloners.push([ent[0], ent[1], ent[2]]);
							}
						});
						var found = [];
						for (var i in that.wifiRoom.cloners) {
							if (that.chatData[toId(that.wifiRoom.cloners[i][0])]) {
								found.push('Name: ' + that.wifiRoom.cloners[i][0] + ' | FC: ' + that.wifiRoom.cloners[i][1] + ' | IGN: ' + that.wifiRoom.cloners[i][2]);
							}
						}
						if (!found.length) {
							that.say(con, room, text + 'No cloners were found online.');
							return;
						}
						var foundstr = found.join(' ');
						if (foundstr.length > 266) {
							that.uploadToHastebin(con, room, by, "The following cloners are online :\n\n" + found.join('\n'));
							return;
						}
						that.say(con, room, by, "The following cloners are online :\n\n" + foundstr);
					});
				});
			});
			break;
		*/
		
		default: 
			this.say(con, room, text + (toId(args[0]) ? (messages[toId(args[0])] || 'Unknown option. General links can be found here: http://pstradingroom.weebly.com/links.html') : 'Links can be found here: http://pstradingroom.weebly.com/links.html'));
		}
	},
	mono: 'monotype',
	monotype: function(arg, by, room, con) {
		// links and info for the monotype room
		if ((room !== 'monotype' && room.charAt(0) !== ',') || config.serverid !== 'showdown') return false;
		var text = '';
		if (room.charAt(0) === ',' || !this.canUse('monotype', room, by)) {
			text += '/pm ' + by + ', ';
		}
		var messages = {
			forums: 'The monotype room\'s forums can be found here: http://psmonotypeforum.createaforum.com/index.php',
			plug: 'The monotype room\'s plug can be found here: http://plug.dj/monotype-3-am-club/',
			rules: 'The monotype room\'s rules can be found here: http://psmonotype.wix.com/psmono#!rules/cnnz',
			site: 'The monotype room\'s site can be found here: http://www.psmonotype.wix.com/psmono',
			league: 'Information on the Monotype League can be found here: http://themonotypeleague.weebly.com/'
		};
		text += (toId(arg) ? (messages[toId(arg)] || 'Unknown option. General information can be found here: http://www.psmonotype.wix.com/psmono') : 'Welcome to the monotype room! Please visit our site to find more information. The site can be found here: http://www.psmonotype.wix.com/psmono');
		this.say(con, room, text);
	},
	survivor: function(arg, by, room, con) {
		// contains links and info for survivor in the Survivor room
		if ((room !== 'survivor' && room.charAt(0) !== ',') || config.serverid !== 'showdown') return false;
		var text = '';
		if (room.charAt(0) === ',' || !this.canUse('survivor', room, by)) {
			text += '/pm ' + by + ', ';
		}
		var gameTypes = {
			hg: "http://survivor-ps.weebly.com/hunger-games.html",
			hungergames: "http://survivor-ps.weebly.com/hunger-games.html",
			classic: "http://survivor-ps.weebly.com/classic.html"
		};
		if (arg) {
			if (!gameTypes[toId(arg)]) return this.say(con, room, "Invalid game type. The game types can be found here: http://survivor-ps.weebly.com/themes.html");
			text += "The rules for this game type can be found here: " + gameTypes[toId(arg)];
		} else {
			text += "The list of game types can be found here: http://survivor-ps.weebly.com/themes.html";
		}
		this.say(con, room, text);
	},
	games: function(arg, by, room, con) {
		// lists the games for the games room
		if ((room !== 'gamecorner' && room.charAt(0) !== ',') || config.serverid !== 'showdown') return false;
		var text = '';
		if (room.charAt(0) === ',' || !this.canUse('games', room, by)) {
			text += '/pm ' + by + ', ';
		}
		this.say(con, room, text + 'Game List: 1. Would You Rather, 2. NickGames, 3. Scattegories, 4. Commonyms, 5. Questionnaires, 6. Funarios, 7. Anagrams, 8. Spot the Reference, 9. Pokemath, 10. Liar\'s Dice');
		this.say(con, room, text + '11. Pun Game, 12. Dice Cup, 13. Who\'s That Pokemon?, 14. Pokemon V Pokemon (BST GAME), 15. Letter Getter, 16. Missing Link, 17. Parameters! More information can be found here: http://psgamecorner.weebly.com/games.html');
	},
	happy: function(arg, by, room, con) {
		// info for The Happy Place
		if ((room !== 'thehappyplace' && room.charAt(0) !== ',') || config.serverid !== 'showdown') return false;
		var text = "";
		if (room.charAt(0) === ',' || !this.canUse('happy', room, by)) text += "/pm " + by + ", ";
		arg = toId(arg);
		if (arg === 'askstaff' || arg === 'ask' || arg === 'askannie') {
			text += "http://thepshappyplace.weebly.com/ask-the-staff.html";
		} else {
			text += "The Happy Place, at its core, is a friendly environment for anyone just looking for a place to hang out and relax. We also specialize in taking time to give advice on life problems for users. Need a place to feel at home and unwind? Look no further!";
		}
		this.say(con, room, text);
	},


	/**
	 * Jeopardy commands
	 *
	 * The following commands are used for Jeopardy in the Academics room
	 * on the Smogon server.
	 */


	b: 'buzz',
	buzz: function(arg, by, room, con) {
		if (this.buzzed || !this.canUse('buzz', room, by) || room.charAt(0) === ',') return false;
		this.say(con, room, '**' + by.substr(1) + ' has buzzed in!**');
		this.buzzed = by;
		this.buzzer = setTimeout(function(con, room, buzzMessage) {
			this.say(con, room, buzzMessage);
			this.buzzed = '';
		}.bind(this), 7 * 1000, con, room, by + ', your time to answer is up!');
	},
	reset: function(arg, by, room, con) {
		if (!this.buzzed || !this.hasRank(by, '%@&#~') || room.charAt(0) === ',') return false;
		clearTimeout(this.buzzer);
		this.buzzed = '';
		this.say(con, room, 'The buzzer has been reset.');
	},
};
