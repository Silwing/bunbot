// Import express and request modules
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const { IncomingWebhook, WebClient } = require('@slack/client');
const schedule = require('node-schedule');
const bs = require('./bun_service');
const ts = require('./team_repository');
const cfenv = require('cfenv');
const _ = require('lodash');
const log4js = require('./config/log4js');

// Fetch client credentials from environment
const clientId = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;

// Setup logging
const logger = log4js.getLogger('index');

// Instantiate repository
const teams = new ts.TeamRepository();

// Instantiates Express and assigns our app variable to it
const app = express();
app.use(bodyParser.urlencoded({
    extended: true
}));
app.set('view engine', 'ejs');
const appEnv = cfenv.getAppEnv();

// Listen based on application environment from Cloud Foundry
app.listen(appEnv.port, appEnv.bind, function () {
    logger.info("BunBot app listening on port " + appEnv.port);
});

var sendDoneForTeam = function(team) {
    var currentBunee = team.bunservice.getCurrentBunee();
    if(currentBunee != null) {
        team.bunchannel.send("Hi <@" + currentBunee.id + ">, did you do you bun duty for today? Reply with /bunduty done to confirm.");
    }
};

var sendRequestForTeam = async function(team) {
    var nextBunee = await team.bunservice.getNextBunee();
    var nextDate = team.bunservice.getNextBunDate();
    team.bunchannel.send("Hi <@" + nextBunee.id + ">, you're up next for bun duty at " + nextDate.format("D. MMM YYYY") + ". Reply with /bunduty accept to confirm or /bunduty reject if you are unable to perform the duty this time.");
}

// Schedule jobs to request next bunee and mark current bunee done
var doneJob = async function(){
    logger.info("Triggered reminder for current bunee to mark duty done.");
    var teamList = await teams.list();
    _.forEach(teamList, sendDoneForTeam);
};
schedule.scheduleJob('0 10 * * 5', doneJob);

var requestJob = async function() {
    logger.info("Triggered request for next bunee.");
    var teamList = await teams.list();
    _.forEach(teamList, sendRequestForTeam);
};
schedule.scheduleJob('0 9 * * 4', requestJob);

function getIdFromText(text) {
    var matchResult = /.*<@(.*)\|.*>/.exec(text);
    return matchResult.length > 1 ? matchResult[1] : "";
}

function splitIntoWords(text) {
    var matchResult = text.match(/\S+/g);
    return matchResult ? matchResult : [];
}

// Default to showing the add button
app.get('/', function(req, res) {
    res.render('add_to_slack', { client_id: clientId });
});

// This route handles get request to a /oauth endpoint. We'll use this endpoint for handling the logic of the Slack oAuth process behind our app.
app.get('/oauth', async function(req, res) {
    // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
    if (req.query.error) {
        res.status(400);
        res.send("Authentication denied.");
    } else if (!req.query.code) {
        res.status(500);
        res.send({"Error": "Looks like we're not getting code."});
        logger.info("Got oauth request without the code query parameter, no authentication executed.");
    } else {
        // We'll do a GET call to Slack's `oauth.access` endpoint, passing our app's client ID, client secret, and the code we just got as query parameters.
        request({
            url: 'https://slack.com/api/oauth.access', //URL to hit
            qs: {code: req.query.code, client_id: clientId, client_secret: clientSecret}, //Query string data
            method: 'GET', //Specify the method

        }, async function (error, response, body) {
            if (error) {
                logger.error(error);
            } else {
                var auth = JSON.parse(body);
                if(auth.ok) {
                    delete auth.ok;
                    try {
                        await teams.add(auth);
                        res.send("Successfully added BunBot to your team.");
                    } catch(ex) {
                        res.send("Something went wrong.");
                    }
                } else {
                    logger.error("Something went wrong trying to authenticate.");
                    logger.debug(auth);
                    res.send("Something went wrong.");
                }
            }
        })
    }
});

// Act on different commands
app.post('/command', async function(req, res) {
    try {
        var words = splitIntoWords(req.body.text);
        var subCommand = words[0];
        var senderId = req.body.user_id;
        var teamId = req.body.team_id;
        var team = await teams.getById(teamId);
        logger.debug("Handling command " + subCommand + " for sender " + senderId + " with team " + teamId);
        switch(subCommand) {
        	case "list":
        		var list = await team.bunservice.list();
        		res.send(list);
        		break;

        	case "join":
        		await team.bunservice.join(senderId);
        		res.send("You successfully joined the bun duty list.");
        		break;

        	case "leave":
        		await team.bunservice.leave(senderId);
        		res.send("You successfully left the bun duty list.");
        		break;

        	case "triggerDone":
                if(await team.bunservice.members.isAdmin(senderId)) {
            		sendDoneForTeam(team);
                    res.send("");
                } else {
                    res.sendFile(__dirname + '/views/help.msg');
                }
        		break;

        	case "triggerRequest":
                if(await team.bunservice.members.isAdmin(senderId)) {
            		await sendRequestForTeam(team);
                    res.send("");
                } else {
                    res.sendFile(__dirname + '/views/help.msg');
                }
        		break;

        	case "done":
        		await team.bunservice.finishBunee();
        		res.send("The duty is done.");
            	break;

        	case "accept":
        		switch(await team.bunservice.acceptBunee(senderId)) {
        			case team.bunservice.SUCCESS:
        				res.send("You acceptance has been received.");
    	    			team.bunchannel.send("<!here> <@" + senderId + "> will bring the buns on " + team.bunservice.getNextBunDate().format("D. MMM YYYY") + ".");
    	    			break;
    	    		case team.bunservice.NO_BUNEE_FOUND:
    	    			res.send("It does not look like you are currently at the bun duty list. Use /bunduty join to join the list.");
    	    		case team.bunservice.NO_ONGOING_REQUEST:
    	    		default:
    	    			res.send("BunDuty is not currently looking for bunees.");
        		}
        		break;

        	case "reject":
        		switch(team.bunservice.rejectBunee()) {
        			case team.bunservice.SUCCESS:
    		    		res.send("I will pass on the responsibility to the next bunee. You will have another chance next time.");
    		    		sendRequestForTeam(team);
    		    		break;
    		    	default:
    		    		res.send("BunDuty is not currently looking for bunees.");
    		    }
        		break;

            case "addAdmin":
                if(await team.bunservice.members.isAdmin(senderId)) {
                    var memberIdToAdd = getIdFromText(words[1]);
                    if(team.bunservice.members.addAdmin(memberToAdd)) {
                        res.send("<@" + memberToAdd + "> added as admin");
                    } else {
                        res.send("<@" + memberToAdd + "> is not a bunee yet.");
                    }
                } else {
                    res.sendFile(__dirname + '/views/help.msg');
                }

            case "debug":
                logger.debug(await teams.debug());

        	default:
        		res.sendFile(__dirname + '/views/help.msg');
        }
    } catch(ex) {
        res.send("Something went wrong. Please try again.");
    }
});
