const inquirer = require('inquirer');

function askTask(_choices) {
    const questions = [{
        type: 'list',
        name: 'command',
        message: 'What do do?',
        choices: _choices,
    }];
    return inquirer.prompt(questions);
}

function askWithdraw(_choices) {
    const questions = [{
        type: 'list',
        name: 'index',
        message: 'Which deposit to spend?',
        choices: _choices,
    }];
    return inquirer.prompt(questions);
}

function askDepositCommand(_choices) {
    const questions = [{
        type: 'list',
        name: 'Command',
        message: 'Select what do to in deposits',
        choices: _choices,
        default: ["show"]
    }];
    return inquirer.prompt(questions);
}

function askExit() {
    const questions = [{
        type: 'list',
        name: 'command',
        message: "Go back or exit?",
        choices: ["Go back", "Exit"]
    }]
    return inquirer.prompt(questions);
}


export {askTask, askWithdraw, askDepositCommand, askExit}   