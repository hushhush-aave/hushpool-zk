const mimcjs = require("./mimcsponge.js");
const random = require('random-bigint');
const snarkjs = require("snarkjs");

exports.getZeroValue = () => {
    // uint256(keccak256(abi.encodePacked("HushHush"))) % SNARK_SCALAR_FIELD;
    let current_zero_value = BigInt('10040938200627430310828075205244513358216211203724055178857443267945086138226');
    return current_zero_value;
}

exports.getRandom = (nBytes = 31) => {
    return random(nBytes * 8);
}

exports.createLeaf = (balance) => {
    return {
        secret: exports.getRandom(),
        nonce: exports.getRandom(),
        balance: balance,
    };
}

exports.stringifyLeaf = (leaf) => {
    return {
        secret: leaf.secret.toString(),
        nonce: leaf.nonce.toString(),
        balance: leaf.balance.toString(),
    };
}

exports.destringifyLeaf = (leaf) => {
    return {
        secret: BigInt(leaf.secret.toString()),
        nonce: BigInt(leaf.nonce.toString()),
        balance: BigInt(leaf.balance.toString()),
    };
}


exports.getInnerCommitmentFromLeaf = (leaf) => {
    return exports.getInnerCommitment(leaf.secret, leaf.nonce);
}

exports.getInnerCommitment = (secret, nonce) => {
    return mimcjs.multiHash([secret, nonce], 0, 1);
}

exports.getCommitmentFromLeaf = (leaf) => {
    return exports.getCommitment(leaf.balance, leaf.secret, leaf.nonce);
}

exports.getCommitment = (balance, secret, nonce) => {
    const innerCommit = exports.getInnerCommitment(secret, nonce);// mimcjs.multiHash([secret, nonce], 0, 1);
    return mimcjs.multiHash([balance, innerCommit], 0, 1);
}

exports.getNullifier = (secret, index) => {
    return mimcjs.multiHash([secret, index], 0, 1);
}

exports.buildTree = (depth, commitments) => {
    let layers = [];

    for (let i = 0; i < depth + 1; i++) {
        layers.push([]);
    }

    commitments.forEach(commit => {
        layers[0].push(commit);
    });

    for (let i = commitments.length; i < Math.pow(2, depth); i++){
        layers[0].push(exports.getZeroValue());
    }

    for (let i = 0; i < depth; i++) {
        let currLength = layers[i].length;
        for (let j = 0; j < currLength; j += 2) {
            let left = layers[i][j];
            let right = layers[i][j + 1];
            let hash = mimcjs.multiHash([left, right], 0, 1);
            layers[i + 1].push(hash);
        }
    }

    let tree = {
        layers: layers,
        root: layers[depth][0],
        depth: depth
    }

    return tree;
}

exports.getProof = (oldLeaf, index, tree, withdrawAmount, fee, receiver, wasm = "./zk-proofs/hush-withdraw/withdraw.wasm", pkey = "./zk-proofs/hush-withdraw/withdraw_final.zkey") => {
    return new Promise(async function(resolve, reject){
        let { input, newLeaf } = exports.createInput(oldLeaf, index, withdrawAmount, receiver, fee, tree);

        // const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "./zk-proofs/hush-withdraw/withdraw.wasm", "./zk-proofs/hush-withdraw/withdraw_final.zkey");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, pkey);
        
        let solidityProof = exports.getSolidityProofArray(proof);
        let soliditySignals = exports.getSoliditySignalsArray(publicSignals);
    
        resolve({ proof, publicSignals, solidityProof, soliditySignals, newLeaf });    
    });
}


exports.getSolidityProofArray = (proof) => {
    let proofList = [
        proof["pi_a"][0], proof["pi_a"][1],
        proof["pi_b"][0][1], proof["pi_b"][0][0],
        proof["pi_b"][1][1], proof["pi_b"][1][0],
        proof["pi_c"][0], proof["pi_c"][1]
    ];
    return proofList;
}

exports.getSoliditySignalsArray = (publicSignals) => {
    let nullifier = publicSignals[0];
    let newLeafCommit = publicSignals[1];
    let withdrawAmount = publicSignals[2];
    let root = publicSignals[3];
    let _receiver = publicSignals[4];
    let fee = publicSignals[5];

    let publicList = [withdrawAmount, fee, root, nullifier, newLeafCommit];
    return publicList;
}

exports.createInput = (oldLeaf, index, withdrawAmount, receiverAddr, fee, tree) => {

    let path = [];
    let pathIndices = [];

    let currVal = exports.getCommitment(oldLeaf.balance, oldLeaf.secret, oldLeaf.nonce);
    let currIndex =  parseInt(index.toString()); //TODO: THis is not the best xD

    let layers = tree.layers;

    for (let i = 0; i < tree.depth; i++) {
        if (currIndex % 2 == 0) { // Im left
            let left = currVal;
            let right = layers[i][currIndex + 1]
            path.push(right);
            currVal = mimcjs.multiHash([left, right], 0, 1);
            pathIndices.push(0);
        } else {
            let left = layers[i][currIndex - 1]
            let right = currVal;
            path.push(left);
            currVal = mimcjs.multiHash([left, right], 0, 1);
            pathIndices.push(1);
        }
        currIndex >>= 1;
    }

    if (tree.root != currVal) {
        console.log("Root not matching");
        console.log(tree);
    }

    let newBalance = oldLeaf.balance - (withdrawAmount + fee);
    let newLeaf = exports.createLeaf(newBalance);

    let input = {
        "withdrawAmount": withdrawAmount.toString(),
        "root": tree.root.toString(),
        "oldSecret": oldLeaf.secret.toString(),
        "oldNonce": oldLeaf.nonce.toString(),
        "oldBalance": oldLeaf.balance.toString(),
        "index": index.toString(),
        "pathElements": path.map(element => element.toString()),
        "secret": newLeaf.secret.toString(),
        "nonce": newLeaf.nonce.toString(),
        "fee": fee.toString(),
        "receiver": receiverAddr.toString()
    }

    return {input, newLeaf};

}




