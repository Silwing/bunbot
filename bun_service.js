const memberRepo = require('./member_repository');
const moment = require('moment');

function BunService(members) {
	this.members = members || new memberRepo.MemberRepository();
	this.currentBunee = null;
	this.hasOngoingRequest = false;
	this.requestCount = 0;
}

BunService.prototype.SUCCESS = 1;
BunService.prototype.NO_ONGOING_REQUEST = -1;
BunService.prototype.NO_BUNEE_FOUND = -2;

BunService.prototype.list = async function() {
	var res = [];
	var memberList = await this.members.orderByGiveCountThenGiveDate().list();
	for(var i = 0; i < memberList.length; i++) {
		res.push("<@" + memberList[i].id + "> (" + moment(memberList[i].giveDate).format("D. MMM YYYY") + ")");
	}
	return res.join("\n");
}

BunService.prototype.join = async function(userId) {
	await this.members.add({id: userId, giveCount: await this.members.getLeastGiveCount(), giveDate: new Date(0).toISOString()});
}

BunService.prototype.leave = async function(userId) {
	await this.members.removeById(userId);
}

BunService.prototype.finishBunee = async function() {
	this.currentBunee.giveCount++;
	this.currentBunee.giveDate = new Date().toISOString();
	await this.members.update(this.currentBunee);
	this.currentBunee = null;
}

BunService.prototype.acceptBunee = async function(userId) {
	if(this.hasOngoingRequest) {
		var bunee;
		if(bunee = await this.members.getById(userId)) {
			this.currentBunee = bunee;
			this.hasOngoingRequest = false;
			this.requestCount = 0;
			return this.SUCCESS;
		} else {
			return this.NO_BUNEE_FOUND;
		}
	}
	return this.NO_ONGOING_REQUEST;
}

BunService.prototype.rejectBunee = function() {
	if(this.hasOngoingRequest) {
		return this.SUCCESS;
	} else {
		return this.NO_ONGOING_REQUEST;
	}
}

BunService.prototype.getCurrentBunee = function() {
	return this.currentBunee;
}

BunService.prototype.getNextBunee = async function() {
	this.hasOngoingRequest = true;
	return (await this.members.orderByGiveCountThenGiveDate().list())[this.requestCount++];
}

BunService.prototype.getNextBunDate = function() {
	var today = moment();
	return today.day(today.day() >= 5 ? 12 : 5);
}

module.exports.BunService = BunService;