const mimcjs = require("./mimcsponge.js");
const random = require('random-bigint');

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

exports.getInnerCommitment = (secret, nonce) => {
    return mimcjs.multiHash([secret, nonce], 0, 1);
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


exports.createInput = (oldLeaf, index, newLeaf, tree) => {
    let withdrawAmount = oldLeaf.balance - newLeaf.balance;
    if (withdrawAmount < 0) {
        throw "ERROR, cannot withdraw negative amount";
    }

    let path = [];
    let pathIndices = [];

    let currVal = exports.getCommitment(oldLeaf.balance, oldLeaf.secret, oldLeaf.nonce);
    let currIndex = index;

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
        throw "Root not matching";
    }


    let input = {
        "withdrawAmount": withdrawAmount.toString(),
        "root": tree.root.toString(),
        "oldSecret": oldLeaf.secret.toString(),
        "oldNonce": oldLeaf.nonce.toString(),
        "oldBalance": oldLeaf.balance.toString(),
        "index": index,
        "pathElements": path.map(element => element.toString()),
        "secret": newLeaf.secret.toString(),
        "nonce": newLeaf.nonce.toString()
    }

    return input;

}




