
const KOVAN_ADDRESSES = {
    "weth": "0xd0a1e359811322d97991e03f863a0c30c2cf029c",
    "aweth": "0x87b1f4cf9BD63f7BBD3eE1aD04E8F52540349347",
    "dataprovider": "0x3c73A5E5785cAC854D468F727c606C07488a29D6",
    "lendingpool": "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe",
    "aavepool": "0x1631FFf000DF62c63A03E420c9627bc76eC562b7",
    "mimc": "0x1Aa58fAa010f6008B98ee1fB88459F2174d7369a",
}

function getWETH(network="kovan") {
    let wethAddresses = {
        "main": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "kovan": "0xd0a1e359811322d97991e03f863a0c30c2cf029c"
    }
    return wethAddresses[network];
}

function getDataProvider(network="kovan") {
    let addrs = {
        "main": "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d",
        "kovan": "0x3c73A5E5785cAC854D468F727c606C07488a29D6"
    }
    return addrs[network];
}

function getLendingPool(network="kovan") {
    let addrs = {
        "main": "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
        "kovan": "0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe"
    }
    return addrs[network];
}

function getAavePool(network="kovan") {
    let addrs = {
        "kovan": "0x208Aae127963261f4899B66aC6270B883F8865aC"
    };
    return addrs[network];
}

function getMiMC(network="kovan") {
    let mimcAddresses = {
        "kovan": "0x1Aa58fAa010f6008B98ee1fB88459F2174d7369a"
    };
    return mimcAddresses[network];
}

function getERC20Token(network="kovan") {
    let tokenAddresses = {
        "kovan": "0xc5fb5Ef0c806ecab8cA1aB216F9c18e1761dBb71"
    };
    return tokenAddresses[network];
}

function getERCZKPool(network="kovan") {
    let zkpoolAddresses = {
        "kovan": "0x70286799672113c949157C38c10624e7d2B9A8AE"
    };
    return zkpoolAddresses[network];
}
