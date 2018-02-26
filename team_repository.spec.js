const chai = require('chai');
const expect = chai.expect;

const teamRepo = require('./team_repository');

describe("TeamRepository", function() {

	var teams = null;

	beforeEach(function(done) {
		teams = new teamRepo.TeamRepository();
		teams.removeAll().then(function() {
		setTimeout(function(){
	      done();
	    }, 500);
		}).catch(done);
	});

	it("should return an empty list initially", async function() {
		var result = await teams.list();

		expect(result).to.be.an("array");
		expect(result.length).to.equal(0);
	});

	it("should add a team correctly", async function() {
		var team = {team_id: "t1234", access_token: "xoxp-testtoken", team_name: "BunTeam", "bot": { "bot_access_token": "xoxb-testtoken"}};
		await teams.add(team);

		var list = await teams.list();
		expect(list.length).to.equal(1);
		expect(list[0]).to.deep.include(team);
	});

	it("should return correct team by id", async function() {
		var team1 = {team_id: "t1234", access_token: "xoxp-testtoken", team_name: "BunTeam", "bot": { "bot_access_token": "xoxb-testtoken"}};
		var team2 = {team_id: "t1337", access_token: "xoxp-testt0ken", team_name: "RollTeam", "bot": { "bot_access_token": "xoxb-testt0ken"}};
		await (await teams.add(team1)).add(team2);

		var team = await teams.getById("t1337");
		expect(team).to.deep.include(team2);
	});

	it("should contain a bun service with the correct member repository", async function() {
		var team1 = {team_id: "t1234", access_token: "xoxp-testtoken", team_name: "BunTeam", "bot": { "bot_access_token": "xoxb-testtoken"}};
		await teams.add(team1);

		var team = await teams.getById("t1234");
		expect(team.bunservice.members.team_id).to.equal(team1.team_id);
	});

});