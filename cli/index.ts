const chalk = require('chalk');
const clear = require('clear');
const figlet = require('figlet');

//const queries = require('./lib/inquirer');

import {askTask, askExit} from './lib/inquirer';

import {KOVAN_ADDRESSES} from './../utils/addresses';

import {deposit_clear, deposit_show, deposit_show_old, deposit_create, initWithdraw } from './lib/deposit';

const ConfigStore = require('configstore');
const conf = new ConfigStore('hushhush');


//deposit_clear();

start();

async function start() {

    while (true) {
        clear();
        console.log(
            chalk.yellow(
                figlet.textSync("Hush Hush", { horizontalLayout: 'full' })
            )
        );
        console.log(chalk.bold("Kovan pool at: "), chalk.yellow(KOVAN_ADDRESSES["aavepool"]));

        let tasks = ["Deposit", "Show deposits", "Show old deposits", "Withdraw", "Exit"];

        let res = await askTask(tasks);
        let action = res["command"];

        let handleResponse = await handleAction(action);

        console.log();
        let exRes = await askExit();
        if (exRes["command"] == "Exit") {
            process.exit(0);
        }
    }
}

async function handleAction(_action) {
    if (_action == "Deposit") {
        return await deposit_create();
    } else if (_action == "Show deposits") {
        return await deposit_show();
    } else if (_action == "Show old deposits") {
        return await deposit_show_old();
    } else if (_action == "Withdraw") {
        return await initWithdraw();
    } else {
        process.exit(0);
    }
}