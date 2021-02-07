const hush = require("./hush-js.js");

const snarkjs = require("snarkjs");
const fs = require("fs");

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

        let maxVal = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        let maxVal128 = BigInt("340282366920938463463374607431768211455");    

        let _fee = BigInt(5);
        let _withdrawAmount = BigInt(25500);// maxVal128;// BigInt(2500);

        let _wasm = "./../withdraw.wasm";
        let _pkey = "./../withdraw_final.zkey";
        let { proof, publicSignals, newLeaf } = await hush.getProof(oldLeaf, index, tree, _withdrawAmount, _fee, receiverAddr, wasm=_wasm, pkey = _pkey);

        let nullifier = publicSignals[0];
        let newCommitment = publicSignals[1];
        let withdrawAmount = publicSignals[2];

        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

        if (nullifiers[nullifier] != undefined) {
            console.log("Nullifier reuse: ", nullifier, index);
            continue;
        } else {
            if (isValid) {
                console.log("Accept proof. Spend (", oldLeaf.balance.toString(), "), withdraw ", (_withdrawAmount + _fee).toString(), "create (", newLeaf.balance.toString(), "):", newCommitment);
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