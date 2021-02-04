const hush = require("./hush-js.js");

const snarkjs = require("snarkjs");
const fs = require("fs");

const websnarkUtils = require("websnark/tools/stringifybigint");

async function createProof(oldLeaf, index, tree, receiver, show = false) {
    /**
     * What if we try to withdraw max - 5, and then let the fee be 5. The sum will be 0. Something need to be evaluated here.
     * Seems like we have to care of this inside the solidity. 
     */
    let maxVal = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    let maxVal128 = BigInt("340282366920938463463374607431768211455");
    console.log("Max value: ", maxVal);
    let withdrawAmount = hush.getRandom(4);
    //withdrawAmount = maxVal128; //oldLeaf.balance;// maxVal - BigInt(50);
    let fee = BigInt(5);// maxVal - BigInt(withdrawAmount) + BigInt(2);
    console.log("Old balance: ", oldLeaf.balance);
    console.log("Withdraw amount: ", withdrawAmount);   
    let totWithdraw = withdrawAmount + fee;
    let newBalance = oldLeaf.balance - totWithdraw;
    console.log("NewBalance: ", newBalance);
    console.log(totWithdraw);
    console.log(maxVal)
    
    if (totWithdraw > oldLeaf.balance){
        console.log("THIS SHOULD FAIL");
    }

    let newLeaf = hush.createLeaf(newBalance);

    let input = hush.createInput(oldLeaf, index, newLeaf, receiver, fee, tree);

    if (show) {
        console.log("Input: ", JSON.stringify(input, null, 4));
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "../withdraw.wasm", "../withdraw_final.zkey");

    if (show) {
        console.log("Proof: ", JSON.stringify(proof, null, 4));
        console.log("PublicSignals: ", JSON.stringify(publicSignals, null, 4));
    }

    return { proof, publicSignals, newLeaf };
}

async function run() {
    let addrString = "0xD81523Da11b9A55cB1b39f08bd59319E5143A910";
    let receiverAddr = BigInt(addrString);

    console.log("Receiver address: ", receiverAddr.toString());

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
    for (let index = 0; index < 1; index++) {
        let oldLeaf = leafs[index];

        let { proof, publicSignals, newLeaf } = await createProof(oldLeaf, index, tree, receiverAddr, true);

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