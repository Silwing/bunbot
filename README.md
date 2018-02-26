# BunBot

A Slack bot to manage a list of people taking turns in doing something.

Currently aimed at Friday breakfasts but could be easily adapted for something else.

Configured to be deployed on IBM Cloud using the CloudantNoSQLDb service.

Needs environment variables SLACK_CLIENT_ID and SLACK_CLIENT_SECRET to be set to the respective values for the app.

Works with OAuth to install in any Slack workspace and supports multiple teams simultanously.

TODO: create setup script for databases and views to bootstrap the application.