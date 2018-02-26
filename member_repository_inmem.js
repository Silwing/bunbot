function MemberRepository() {
	this.members = [];
}

var sortByGiveCountThenGiveDate = function(member1, member2) {
	if(member1.giveCount != member2.giveCount) {
		return member1.giveCount - member2.giveCount;
	} else {
		return new Date(member1.giveDate).getTime() - new Date(member2.giveDate).getTime();
	}
}

MemberRepository.prototype.orderByGiveCountThenGiveDate = function() {
	this.members.sort(sortByGiveCountThenGiveDate);
	return this;
}

MemberRepository.prototype.list = async function() {
	return this.members.slice();
}

MemberRepository.prototype.removeById = async function(memberId) {
	var spliceIndex = -1;
	for(var i = 0; i < this.members.length; i++) {
		if(this.members[i].id == memberId) {
			spliceIndex = i;
		}
	}
	if(spliceIndex != -1) {
		this.members.splice(spliceIndex, 1);
	}
	return this;
}

MemberRepository.prototype.getLeastGiveCount = async function() {
	if(this.members.length == 0) return 0;
	
	this.orderByGiveCountThenGiveDate();
	return this.members[0].giveCount;
}

MemberRepository.prototype.add = async function(member) {
	this.members.push(member);
	return this;
}

MemberRepository.prototype.update = async function(member) {
	return this;
}

MemberRepository.prototype.getById = async function(memberId) {
	for(var i = 0; i < this.members.length; i++) {
		if(this.members[i].id == memberId) {
			return this.members[i];
		}
	}
}

MemberRepository.prototype.removeAll = async function() {
	this.members = [];
	return this;
}

module.exports.MemberRepository = MemberRepository;