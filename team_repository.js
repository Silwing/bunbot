const cfenv = require('cfenv');
const Cloudant = require('cloudant');
const memberRepo = require('./member_repository');
const { IncomingWebhook, WebClient } = require('@slack/client');
const bs = require('./bun_service');
const appEnv = cfenv.getAppEnv();
const dbService = appEnv.getService("bunduty-cloudantNoSQLDB");
const url = dbService ? dbService.credentials.url : process.env.BUNDUTY_DB_URL;
const dbName = "bunteams";
var _ = require('lodash');
var Promise = require('bluebird');

function TeamRepository() {
	this.cloudant = Cloudant(url);
	this.db = this.cloudant.use(dbName);
	Promise.promisifyAll(this.db);
}

var isValidDoc = function(doc) {
	return doc._id && doc.access_token && doc.team_name && doc.incoming_webhook && doc.incoming_webhook.url;
}

var isValidTeam = function(team) {
	return team.access_token && team.team_id && team.team_name
		&& team.incoming_webhook && team.incoming_webhook.url;
}

var listDocs = async function(repo) {
	try {
		var result = await repo.db.viewAsync("teams", "by-id");
		return _.map(result.rows, (doc) => doc.value);
	} catch(ex) {
		console.log(ex);
		return [];
	}
}

var docById = async function(repo, teamId) {
	try {
		return await repo.db.getAsync(teamId.toString());
	} catch(ex) {
		throw ex;
	}
}

var convertDocToTeam = function(doc) { 
	if(isValidDoc(doc)) {
		return {
			"team_id": doc._id, 
			"access_token": doc.access_token, 
			"team_name": doc.team_name, 
			"bunservice": new bs.BunService(new memberRepo.MemberRepository(doc._id)),
			"bunchannel": new IncomingWebhook(doc.incoming_webhook.url)
		};
	}
};

var convertTeamToDoc = function(team) {
	if(isValidTeam(team)) {
		return {
			"_id": team.team_id, 
			"access_token": team.access_token, 
			"team_name": team.team_name, 
			"bot": team.bot,
			"incoming_webhook": team.incoming_webhook
		};
	}
}

TeamRepository.prototype.list = async function() {
	try {
		var teams = await listDocs(this);
		return _.map(teams, convertDocToTeam);
	} catch(ex) {
		console.log(ex);
	}
};

TeamRepository.prototype.removeAll = async function() {
	try {
		var docs = await listDocs(this);
		for(var i = 0; i < docs.length; i++) {
			docs[i]["_deleted"] = true;
		}
		var result = await this.db.bulkAsync({"docs": docs});
	} catch(ex) {
		console.log(ex);
	}
	return this;
}

TeamRepository.prototype.add = async function(team) {
	if(isValidTeam(team)) {
		try {
			var existing = await docById(this, team.team_id);
			if(!existing)
				await this.db.insertAsync(convertTeamToDoc(team));
			else {
				var updatedTeam = convertTeamToDoc(team);
				updatedTeam._rev = existing._rev;
				await this.db.insertAsync(updatedTeam);
				console.log("Team with ID " + team.team_id + " already exists. Updated existing team instead.");
			}
		} catch(ex) {
			console.log(ex);
		}
	} else {
		console.log("Could not add invalid team");
		console.log(team);
	}
	return this;
};

TeamRepository.prototype.getById = async function(teamId) {
	try {
		return convertDocToTeam(await docById(this, teamId));
	} catch(ex) {
		// Skip logging of deleted errors, since we don't care about those
		if(ex.reason == "deleted")
			return;

		console.log(ex);
	}
}


module.exports.TeamRepository = TeamRepository;