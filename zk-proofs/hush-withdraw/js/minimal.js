const hush = require("./hush-js.js");

let depth = 3;
let leafs = [];

let tree1 = hush.buildTree(depth, leafs);
console.log(tree1);

let aLeaf = hush.createLeaf(BigInt(1000000000000000000000));
let bLeaf = hush.createLeaf(BigInt(1000000000000000000000));

leafs.push(aLeaf);

let thisInner = hush.getInnerCommitment(aLeaf.secret, aLeaf.nonce);
console.log("Inner A: ", thisInner);

thisInner = hush.getInnerCommitment(bLeaf.secret, bLeaf.nonce);
console.log("Inner B: ", thisInner);


for (let i = 0; i < Math.pow(2, depth); i++) {
    //    leafs.push(hush.createLeaf(hush.getRandom(8)));
}

let commits = leafs.map(leaf => hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
let tree = hush.buildTree(depth, commits);

console.log(tree);

leafs.push(bLeaf);

let commits2 = leafs.map(leaf => hush.getCommitment(leaf.balance, leaf.secret, leaf.nonce));
let tree2 = hush.buildTree(depth, commits2);

console.log(tree2);










// Now create the input for the proof
let index = 0;
let oldLeaf = leafs[index];

let newBalance = hush.getRandom(4);
if (newBalance > oldLeaf.balance) {
    newBalance = oldLeaf.balance;
}

let newLeaf = hush.createLeaf(newBalance);

let input = hush.createInput(oldLeaf, index, newLeaf, tree);

let pretty = JSON.stringify(input, null, 4);

console.log("input:");
console.log(pretty);


// We need to make an implementation of the incremental merkle tree as well, 
// such that we can actually generate the merkle paths


