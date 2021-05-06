// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');
const { MakeReservationDialog } = require('./componentDialogs/makeReservationDialogs');
const { CancelReservationDialog } = require('./componentDialogs/cancelReservationDialog');
const { LuisRecognizer, QnAMaker } = require('botbuilder-ai');

class Rambo extends ActivityHandler {
    constructor(conversationState, userState) {
        super();

        this.conversationState = conversationState;
        this.userState = userState;

        this.dialogState = conversationState.createProperty('dialogState');
        this.makeReservationDialog = new MakeReservationDialog(this.conversationState, this.userState);
        this.cancelReservationDialog = new CancelReservationDialog(this.conversationState, this.userState);

        this.previousIntent = this.conversationState.createProperty('previousIntent');
        this.conversationData = this.conversationState.createProperty('conservationData');

        const luisApplication = {
            applicationId: process.env.appId,
            endpointKey: process.env.subscriptionKey,
            azureRegion: process.env.region
        };

        const luisPredictionOptions = {
            includeAllIntents: true,
            apiVersion: 'v3',
            log: true,
            staging: false
        };

        const luisRecognizer = new LuisRecognizer(luisApplication, luisPredictionOptions, true);
        const qnaMaker = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId,
            endpointKey: process.env.QnAEndpointKey,
            host: process.env.QnAMakerEndpointHostKey
        });
        this.qnaMaker = qnaMaker;

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            const luisResult = await luisRecognizer.recognize(context);
            const intent = LuisRecognizer.topIntent(luisResult);

            const entities = luisResult.entities;
            await this.dispatchToIntentAsync(context, intent, entities);
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onDialog(async (context, next) => {
            // Save any state changes. The load happened during the execution of the Dialog.
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            await this.sendWelcomeMessage(context);
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;
        for (const idx in activity.membersAdded) {
            if (activity.membersAdded[idx].id !== activity.recipient.id) {
                const welcomeMessage = `Hi ${ activity.membersAdded[idx].name }. I am rambo bot. How can I help you?`;
                await turnContext.sendActivity(welcomeMessage);
                await this.sendSuggestedActions(turnContext);
            }
        }
    };

    async sendSuggestedActions(turnContext) {
        var reply = MessageFactory.suggestedActions(['Make Reservation', 'Cancel Reservation', 'Restaurant Address'], 'What would you like to do today?');
        await turnContext.sendActivity(reply);
    }

    async dispatchToIntentAsync(context, intent, entities) {
        var currentIntent = '';
        const previousIntent = await this.previousIntent.get(context, {});
        const conversationData = await this.conversationData.get(context, {});

        if (previousIntent.intentName && conversationData.endDialog === false) {
            currentIntent = previousIntent.intentName;
        } else if (previousIntent.intentName && conversationData.endDialog === true) {
            currentIntent = intent;
        } else if (intent === 'None' && !previousIntent.intentName) {
            const result = await this.qnaMaker.getAnswers(context);
            await context.sendActivity(`${ result[0].answer }`);
            await this.sendSuggestedActions(context);
        } else {
            currentIntent = intent;
            await this.previousIntent.set(context, { intentName: intent });
        }
        switch (currentIntent) {
        case 'Make_Reservation':
            await this.conversationData.set(context, { endDialog: false });
            console.log('entities: ', entities);
            await this.makeReservationDialog.run(context, this.dialogState, entities);
            conversationData.endDialog = await this.makeReservationDialog.isDialogComplete();
            if (conversationData.endDialog) {
                await this.previousIntent.set(context, { intentName: null });
                await this.sendSuggestedActions(context);
            }
            break;
        case 'Cancel_Reservation':
            await this.conversationData.set(context, { endDialog: false });
            await this.cancelReservationDialog.run(context, this.dialogState);
            conversationData.endDialog = await this.cancelReservationDialog.isDialogComplete();
            if (conversationData.endDialog) {
                await this.previousIntent.set(context, { intentName: null });
                await this.sendSuggestedActions(context);
            }
            break;
        default:
            console.log('did not match make reservation case');
        }
    }
}

module.exports.Rambo = Rambo;
