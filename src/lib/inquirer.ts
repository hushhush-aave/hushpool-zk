const inquirer = require('inquirer');

module.exports = {

    askName: () => {
        const questions = [
            {
                name: 'username',
                type: 'input',
                message: 'Enter your name',
                validate: function (value) {
                    if (value.length) {
                        return true;
                    } else {
                        return 'Please enter a username'
                    }
                }
            }
        ]
        return inquirer.prompt(questions);
    },

    askTask: (_choices) => {
        const questions = [{
            type: 'list',
            name: 'command',
            message: 'What do do?',
            choices: _choices,
        }];
        return inquirer.prompt(questions);
    },

    askWithdraw: (_choices) => {
        const questions = [{
            type: 'list',
            name: 'index',
            message: 'Which deposit to spend?',
            choices: _choices,
        }];
        return inquirer.prompt(questions);
    },

    askDepositCommand: (_choices) => {
        const questions = [{
            type: 'list',
            name: 'Command',
            message: 'Select what do to in deposits',
            choices: _choices,
            default: ["show"]
        }];
        return inquirer.prompt(questions);
    },

    askExit: () => {
        const questions = [{
            type: 'list',
            name: 'command',
            message: "Go back or exit?",
            choices: ["Go back", "Exit"]
        }]
        return inquirer.prompt(questions);
    }


}   