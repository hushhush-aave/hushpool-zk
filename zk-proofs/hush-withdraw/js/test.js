const hush = require("./hush-js.js");

const snarkjs = require("snarkjs");
const fs = require("fs");

async function createProof(oldLeaf, index, tree, show = false) {
    let withdrawAmount = hush.getRandom(4);
    let newBalance = withdrawAmount > oldLeaf.balance ? oldLeaf.balance : oldLeaf.balance - withdrawAmount;

    let newLeaf = hush.createLeaf(newBalance);

    let input = hush.createInput(oldLeaf, index, newLeaf, tree);

    if (show) {
        console.log(JSON.stringify(input, null, 4));
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "../withdraw.wasm", "../withdraw_final.zkey");

    if (show) {
        console.log(JSON.stringify(proof, null, 4));
        console.log(JSON.stringify(publicSignals, null, 4));
    }

    return { proof, publicSignals, newLeaf };
}

async function run() {
    let depth = 3;
    let leafs = [];

    for (let i = 0; i < Math.pow(2, 2); i++) {
        leafs.push(hush.createLeaf(hush.getRandom(8)));
    }
    leafs.push(leafs[0]);

    let commits = leafs.map(leaf => hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
    let tree = hush.buildTree(depth, commits);
    let nullifiers = {};

    const vKey = JSON.parse(fs.readFileSync("../verification_key.json"));

    // Time to make the proofs. The last is same commitment as first, to show that same commitments can have different.
    for (let index = 0; index < 5; index++) {
        let oldLeaf = leafs[index];

        let { proof, publicSignals, newLeaf } = await createProof(oldLeaf, index, tree, false);
        let nullifier = publicSignals[0];
        let newCommitment = publicSignals[1];
        let withdrawAmount = publicSignals[2];

        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        if (nullifiers[nullifier] != undefined) {
            console.log("Nullifier reuse: ", nullifier, index);
            continue;
        } else {
            if (isValid) {
                console.log("Accept proof. Spend (", oldLeaf.balance.toString(), "), withdraw ", withdrawAmount.toString(), "create (", newLeaf.balance.toString(), "):", newCommitment);
                nullifiers[nullifier] = true;
            } else {
                console.log("Reject proof for ", index);
                continue;
            }
        }
    }
};

run().then(() => {
    process.exit(0);
});