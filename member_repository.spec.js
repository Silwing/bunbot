const chai = require('chai');
const expect = chai.expect;

const memberRepo = require('./member_repository');

describe("MemberRepository", function() {

	var members = null;

	beforeEach(function(done) {
		members = new memberRepo.MemberRepository();
		members.removeAll().then(function() {
		setTimeout(function(){
	      done();
	    }, 500);
		}).catch(done);
	});

	it("should return empty list initially", async function() {
		var result = await members.list();
		expect(result).to.be.an('array');
		expect(result.length).to.equal(0);
	});

	it("should add the correct member with add", async function() {
		var member = {id: "1", giveCount: 0, giveDate: new Date(0).toISOString()};
		await members.add(member);

		var result = await members.list();
		expect(result.length).to.equal(1);
		expect(result[0]).to.deep.equal(member);
	});

	it("should remove the correct member with removeById", async function() {
		// Arrange
		var member1 = {id: "1", giveCount: 0, giveDate: new Date(0).toISOString()};
		var member2 = {id: "2", giveCount: 1, giveDate: new Date().toISOString()};
		await(await members.add(member1)).add(member2);

		// Act
		members.removeById(1);


		var result = await members.list();
		expect(result.length).to.equal(1);
		expect(result[0]).to.deep.equal(member2);
	});

	it("should find the correct member with getById", async function() {
		// Arrange
		var member1 = {id: "1", giveCount: 0, giveDate: new Date(0).toISOString()};
		var member2 = {id: "2", giveCount: 1, giveDate: new Date().toISOString()};
		await (await members.add(member1)).add(member2);

		// Act
		var found = await members.getById(1);

		expect(found).to.deep.equal(member1);
	});

	it("should sort correctly by givenCount and givenDate", async function() {
		// Arrange
		var member1 = {id: "1", giveCount: 0, giveDate: new Date(0).toISOString()};
		var member2 = {id: "2", giveCount: 1, giveDate: new Date("2018-01-26T00:00:00").toISOString()};
		var member3 = {id: "3", giveCount: 1, giveDate: new Date("2018-01-19T00:00:00").toISOString()};
		await (await (await members.add(member1)).add(member2)).add(member3);

		// Act
		var memberList = await members.orderByGiveCountThenGiveDate().list();

		expect(memberList.length).to.equal(3);
		expect(memberList[0]).to.deep.equal(member1);
		expect(memberList[1]).to.deep.equal(member3);
		expect(memberList[2]).to.deep.equal(member2);
	});

	it("should return the smallest give count from getLeastGiveCount", async function() {
		// Arrange
		var member1 = {id: "1", giveCount: 2, giveDate: new Date(0).toISOString()};
		var member2 = {id: "2", giveCount: 1, giveDate: new Date("2018-01-26T00:00:00").toISOString()};
		var member3 = {id: "3", giveCount: 1, giveDate: new Date("2018-01-19T00:00:00").toISOString()};
		await (await (await members.add(member1)).add(member2)).add(member3);

		expect(await members.getLeastGiveCount()).to.equal(1);
	});

	it("should return 0 for getLeastGiveCount with no members", async function() {
		expect(await members.getLeastGiveCount()).to.equal(0);
	});

	it("should update with new giveCount and giveDate", async function() {
		// Arrange
		var member = {id: "1", giveCount: 0, giveDate: new Date(0).toISOString()};
		await members.add(member);
		member.giveCount = 1;
		member.giveDate = new Date().toISOString();

		// Act
		await members.update(member);

		expect(await members.getById(member.id)).to.deep.equal(member);
	});

	describe("Multi-team functions", async function() {
		var anotherTeamsMembers = null;

		beforeEach(function(done) {
			anotherTeamsMembers = new memberRepo.MemberRepository("team2");
			anotherTeamsMembers.removeAll().then(function() {
			setTimeout(function(){
		      done();
		    }, 500);
			}).catch(done);
		});

		it("should return only members of the correct team", async function() {

			var member1 = {id: "1", giveCount: 2, giveDate: new Date(0).toISOString()};
			var member2 = {id: "2", giveCount: 1, giveDate: new Date("2018-01-26T00:00:00").toISOString()};
			var member3 = {id: "3", giveCount: 1, giveDate: new Date("2018-01-19T00:00:00").toISOString()};

			await (await members.add(member2)).add(member3);
			await anotherTeamsMembers.add(member1);

			// Act
			var memberList = await anotherTeamsMembers.list();

			expect(memberList.length).to.equal(1);
			expect(memberList[0]).to.deep.equal(member1);
		});
	});
});