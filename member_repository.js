const cfenv = require('cfenv');
const Cloudant = require('cloudant');
const appEnv = cfenv.getAppEnv();
const dbService = appEnv.getService("bunduty-cloudantNoSQLDB");
const url = dbService ? dbService.credentials.url : process.env.BUNDUTY_DB_URL;
const defaultTeam = "bunduty";
var Promise = require('bluebird');
const log4js = require('./config/log4js');
const logger = log4js.getLogger('member');

function MemberRepository(team_id) {
	logger.debug("Creating member repository object for " + team_id);
	this.team_id = team_id || defaultTeam;
	this.cloudant = Cloudant(url);
	this.db = this.cloudant.use("bunduty");
	Promise.promisifyAll(this.db);
}

var convertByGivingViewDocToDoc = function(viewDoc) {
	return {"_id": viewDoc.value._id, "giveCount": viewDoc.value.giveCount, "giveDate": viewDoc.value.giveDate, "_rev": viewDoc.value._rev};
}

var convertDocToMember = function(doc) {
	return {"id": doc._id, "giveCount": doc.giveCount, "giveDate": doc.giveDate};
}

var map = function(inputArr, mapFunc) {
	var resultArr = [];
	for(var i = 0; i < inputArr.length; i++) {
		resultArr[i] = mapFunc(inputArr[i]);
	}
	return resultArr;
}

var listDocs = async function(repo) {
	try {
		var result = await repo.db.viewAsync("bunees", "by-giving", {startkey: [repo.team_id], endkey: [repo.team_id, {}]});
		return map(result.rows, convertByGivingViewDocToDoc);
	} catch(ex) {
		logger.error(ex);
		return [];
	}
}

MemberRepository.prototype.orderByGiveCountThenGiveDate = function() {
	
	return this;
}

MemberRepository.prototype.list = async function() {
	return map(await listDocs(this), convertDocToMember);
}

MemberRepository.prototype.removeById = async function(memberId) {
	try {
		var doc = await this.db.getAsync(memberId);
		await this.db.destroyAsync(doc._id, doc._rev);
	} catch(ex) {
		logger.error(ex);
	}
	return this;
}

MemberRepository.prototype.removeAll = async function() {
	try {
		var docs = await listDocs(this);
		for(var i = 0; i < docs.length; i++) {
			docs[i]["_deleted"] = true;
		}
		var result = await this.db.bulkAsync({"docs": docs});
	} catch(ex) {
		logger.error(ex);
	}
	return this;
}

MemberRepository.prototype.getLeastGiveCount = async function() {
	try {
		var leastDocs = await this.db.viewAsync("bunees", "least-give", {group: true, reduce: true});
		return (leastDocs.rows.length > 0) ? leastDocs.rows[0].value : 0;
	} catch(ex) {
		logger.error(ex);
	}
}

MemberRepository.prototype.add = async function(member) {
	try {
		await this.db.insertAsync({"_id": member.id.toString(), "giveCount": member.giveCount, "giveDate": member.giveDate, team_id: this.team_id});
	} catch(ex) {
		logger.error(ex);
	}
	return this;
}

MemberRepository.prototype.update = async function(member) {
	try {
		var toUpdate = await this.db.getAsync(member.id.toString());
		toUpdate.giveCount = member.giveCount;
		toUpdate.giveDate = member.giveDate;
		await this.db.insertAsync(toUpdate);
	} catch(ex) {
		logger.error(ex);
	}
	return this;
}

MemberRepository.prototype.getById = async function(memberId) {
	try {
		return convertDocToMember(await this.db.getAsync(memberId));
	} catch(ex) {
		logger.error(ex);
	}
}

MemberRepository.prototype.isAdmin = async function(memberId) {
	try {
		var member = await this.db.getAsync(memberId);
		logger.debug(member);
		return member.isAdmin === true;
	} catch(ex) {
		logger.error(ex);
	}
}

MemberRepository.prototype.addAdmin = async function(memberId) {
	try {
		var member = await this.db.getAsync(memberId);
		member.isAdmin = true;
		await this.db.insertAsync(member);
	} catch(ex) {
		logger.error(ex);
		if(ex.statusCode == 404) {
			return false;
		}
		throw new Error("Could not add admin");
	}
	return true;
}

module.exports.MemberRepository = MemberRepository;
