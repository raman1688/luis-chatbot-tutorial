const { WaterfallDialog, ComponentDialog } = require('botbuilder-dialogs');
const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt, DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');

const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
let endDialog = '';

class MakeReservationDialog extends ComponentDialog {
    constructor(conversationState, userState) {
        super('makeReservationDialog');
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT), this.validateNumberOfParticipants);
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.firstStep.bind(this), // Ask confirmation if user wants to make reservation?
            this.getName.bind(this), // Get name from user
            this.getNumberOfParticipants.bind(this), // Number of participants for reservation
            this.getDate.bind(this), // Date of reservation
            this.getTime.bind(this), // Time of reservation
            this.confirmStep.bind(this), // Show summary of values entered by user and ask confirmation to make reservation
            this.summaryStep.bind(this)
        ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async run(turnContext, accessor, entities) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id, entities);
        }
    }

    async firstStep(step) {
        console.log('stepinfo', step._info);
        if (step._info.options.noOfParticipants && step._info.options.noOfParticipants.length > 0) {
            step.values.noOfParticipants = step._info.options.noOfParticipants[0];
        }
        endDialog = false;
        return await step.prompt(CONFIRM_PROMPT, 'Would you like to make the reservation', ['yes', 'no']);
    }

    async getName(step) {
        if (step.result) {
            return await step.prompt(TEXT_PROMPT, 'Please enter your name.');
        } else {
            await step.context.sendActivity('You chose not to make reservation');
            endDialog = true;
            return await step.endDialog();
        }
    }

    async getNumberOfParticipants(step) {
        step.values.name = step.result;
        if (!step.values.noOfParticipants) {
            return await step.prompt(NUMBER_PROMPT, 'How many people you wish to make reservation for (0 - 50)?');
        }
        return await step.continueDialog();
    }

    async getDate(step) {
        if (!step.values.noOfParticipants) {
            step.values.noOfParticipants = step.result;
        }
        return await step.prompt(DATETIME_PROMPT, 'Please enter the date you want to make the reservation');
    }

    async getTime(step) {
        step.values.date = step.result;
        return await step.prompt(DATETIME_PROMPT, 'At what time?');
    }

    async confirmStep(step) {
        step.values.time = step.result;
        const message = `You have entered following values: \n 
            Name: ${ step.values.name } \n 
            Number of people: ${ step.values.noOfParticipants } \n 
            Date: ${ step.values.date } \n
            Time: ${ step.values.time }`;
        await step.context.sendActivity(message);

        return await step.prompt(CONFIRM_PROMPT, 'Do you want to proceed?', ['yes', 'no']);
    }

    async summaryStep(step) {
        if (step.result) {
            await step.context.sendActivity('Reservation Successfully made!');
            endDialog = true;
            return await step.endDialog();
        }
    }

    async validateNumberOfParticipants(promptContext) {
        return promptContext.recognized.succeeded && promptContext.recognized.value > 1 && promptContext.recognized.value < 50;
    }

    async isDialogComplete() {
        return endDialog;
    }
}

module.exports.MakeReservationDialog = MakeReservationDialog;
