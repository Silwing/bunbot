const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const moment = require('moment');

const bs = require('./bun_service');
const mem = require('./member_repository');

describe("BunService", function() {

	var bunService = null,
		members = null;

	beforeEach(function() {
		members = new mem.MemberRepository();
		bunService = new bs.BunService(members);
	});

	describe("DB functions", function() {

		beforeEach(function(done) {
			members.removeAll().then(function() {
			setTimeout(function(){
		      done();
		    }, 500);
			}).catch(done);
		});

		describe("list", function() {

			it("should print an empty list initially", async function() {
				expect(await bunService.list()).to.equal("");
			});

			it("should print a member after joining", async function() {
				// Arrange
				await bunService.join("1234");

				expect(await bunService.list()).to.equal("<@1234> (1. Jan 1970)");
			});

			it("should not print a member after leaving", async function() {
				// Arrange
				await bunService.join("1234");
				await bunService.join("1337");
				await bunService.leave("1234");

				expect(await bunService.list()).to.equal("<@1337> (1. Jan 1970)");
			});

			it("should print two members separated by line break", async function() {
				// Arrange two members different giveCount to ensure stable ordering
				var member1 = {id: "1234", giveCount: 0, giveDate: new Date(0).toISOString()};
				var member2 = {id: "1337", giveCount: 1, giveDate: new Date("2018-01-26T00:00:00").toISOString()};
				await (await members.add(member1)).add(member2);

				expect(await bunService.list()).to.equal("<@1234> (1. Jan 1970)\n<@1337> (26. Jan 2018)");
			});
		});

		describe("getNextBunee", function() {

			it("should return the bunee with the least give count", async function() {
				// Arrange
				var member1 = {id: "1", giveCount: 0, giveDate: new Date(0).toISOString()};
				var member2 = {id: "2", giveCount: 1, giveDate: new Date().toISOString()};
				await (await members.add(member1)).add(member2);

				expect(await bunService.getNextBunee()).to.deep.equal(member1);
			});

			it("should return the bunee with the oldest give date if give count is equal", async function() {
				// Arrange
				var member1 = {id: "1", giveCount: 1, giveDate: new Date("2018-01-26T00:00:00").toISOString()};
				var member2 = {id: "2", giveCount: 1, giveDate: new Date("2018-01-19T00:00:00").toISOString()};
				await (await members.add(member1)).add(member2);

				expect(await bunService.getNextBunee()).to.deep.equal(member2);
			})
		});

		describe("acceptBunee", function() {

			it("should return error if called without first starting a request", async function() {
				// Arrange
				await bunService.join("1234");

				expect(await bunService.acceptBunee("1234")).to.equal(bunService.NO_ONGOING_REQUEST);
			});

			it("should return success for existing member", async function() {
				// Arrange
				await bunService.join("1234");
				await bunService.getNextBunee();

				expect(await bunService.acceptBunee("1234")).to.equal(bunService.SUCCESS);
			});

			it("should return error if called without joining first", async function() {
				// Arrange
				await bunService.getNextBunee();

				expect(await bunService.acceptBunee(1234)).to.equal(bunService.NO_BUNEE_FOUND);
			});
		});

		describe("finishBunee", function() {

			it("should update giveCount and giveDate for bunee", async function() {
				// Arrange
				var clock = sinon.useFakeTimers(new Date(2018, 0, 19));
				await bunService.join("1234");
				await bunService.getNextBunee();
				await bunService.acceptBunee("1234");
				var bunee = await bunService.getCurrentBunee();

				// Act
				await bunService.finishBunee();

				var updatedBunee = await members.getById(bunee.id);

				expect(updatedBunee.giveCount).to.equal(1);
				expect(moment(updatedBunee.giveDate).format("YYYY-MM-DD")).to.equal(moment(new Date(2018, 0, 19)).format("YYYY-MM-DD"));

				clock.restore();
			});
		});

	});

	describe("getNextBunDate", function() {

		it("should return Friday in same week when called on Monday", function() {
			var clock = sinon.useFakeTimers(new Date(2018, 0, 22).getTime());

			expect(bunService.getNextBunDate().format("YYYY-MM-DD")).to.equal(moment(new Date(2018, 0, 26)).format("YYYY-MM-DD"));

			clock.restore();
		});

		it("should return Friday in same week when called on Thursday", function() {
			var clock = sinon.useFakeTimers(new Date(2018, 0, 25).getTime());

			expect(bunService.getNextBunDate().format("YYYY-MM-DD")).to.equal(moment(new Date(2018, 0, 26)).format("YYYY-MM-DD"));

			clock.restore();
		});

		it("should return Friday in next week when called on Sunday", function() {
			var clock = sinon.useFakeTimers(new Date(2018, 0, 21).getTime());

			expect(bunService.getNextBunDate().format("YYYY-MM-DD")).to.equal(moment(new Date(2018, 0, 26)).format("YYYY-MM-DD"));

			clock.restore();
		});

		it("should return Friday in next week when called on Saturday", function() {
			var clock = sinon.useFakeTimers(new Date(2018, 0, 20).getTime());

			expect(bunService.getNextBunDate().format("YYYY-MM-DD")).to.equal(moment(new Date(2018, 0, 26)).format("YYYY-MM-DD"));

			clock.restore();
		});

		it("should return Friday in next week when called on Friday", function() {
			var clock = sinon.useFakeTimers(new Date(2018, 0, 19).getTime());

			expect(bunService.getNextBunDate().format("YYYY-MM-DD")).to.equal(moment(new Date(2018, 0, 26)).format("YYYY-MM-DD"));

			clock.restore();
		});
	});
});