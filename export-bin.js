
const fs = require("fs");
const { resolve } = require("path");

const { ethers } = require("ethers");

const initcode = fs.readFileSync(resolve(__dirname, "contracts/artifacts/Multicall_sol_Multicall.bin")).toString();
const abi = fs.readFileSync(resolve(__dirname, "contracts/artifacts/Multicall_sol_Multicall.abi")).toString();

const iface = new ethers.utils.Interface(abi);
const output = {
    initcode: ("0x" + initcode),
    abi: iface.format("full")
};

fs.writeFileSync(resolve(__dirname, "contract.json"), JSON.stringify(output, null, 2));
