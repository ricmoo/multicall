"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Multicaller = void 0;
const ethers_1 = require("ethers");
const logger = new ethers_1.ethers.utils.Logger("multicall/0.0.1");
;
class Multicaller {
    constructor(provider) {
        this.provider = provider;
        this.gasLimitPerCall = 60000;
        this.resultLimitPerCall = 1024;
        this._pendingRequests = [];
    }
    queue(address, fragment, values) {
        return this._queue(address, fragment, (values || []), true);
    }
    queueResult(address, fragment, values) {
        return this._queue(address, fragment, (values || []), false);
    }
    _queue(address, method, values, dereference) {
        if (values == null) {
            values = [];
        }
        const fragment = ethers_1.ethers.utils.FunctionFragment.from(method);
        const iface = new ethers_1.ethers.utils.Interface([fragment]);
        return new Promise((resolve, reject) => {
            this._pendingRequests.push({
                address,
                data: iface.encodeFunctionData(fragment, values),
                commit: (error, success, result) => {
                    if (error) {
                        reject(error);
                    }
                    else if (success) {
                        let output = iface.decodeFunctionResult(fragment, result);
                        if (dereference && fragment.outputs && fragment.outputs.length === 1) {
                            output = output[0];
                        }
                        resolve(output);
                    }
                    else {
                        const error = logger.makeError("call failed", ethers_1.ethers.utils.Logger.errors.CALL_EXCEPTION, {
                            something: "123"
                        });
                        reject(error);
                    }
                }
            });
        });
    }
    flush() {
        return __awaiter(this, void 0, void 0, function* () {
            const gasLimit = this.gasLimitPerCall;
            const resultLimit = this.resultLimitPerCall;
            const pendingRequests = this._pendingRequests;
            this._pendingRequests = [];
            const multicall = new ethers_1.ethers.Contract("multicall.eth", [
                "function execute(uint, uint, address[], bytes[]) view returns (uint blockNumber, uint[] statuses, bytes[] results)"
            ], this.provider);
            const { blockNumber, statuses, results } = (yield multicall.execute(gasLimit, resultLimit, pendingRequests.map((r) => r.address), pendingRequests.map((r) => r.data)));
            statuses.forEach((status, index) => {
                pendingRequests[index].commit(null, !status.isZero(), results[index]);
            });
            return blockNumber.toNumber();
        });
    }
}
exports.Multicaller = Multicaller;
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        const tester = new Multicaller(ethers_1.ethers.getDefaultProvider());
        const dai = yield tester.provider.resolveName("dai.tokens.ethers.eth");
        const ricmoo = yield tester.provider.resolveName("ricmoo.firefly.eth");
        const result = {
            decimals: tester.queue(dai, "decimals() view returns (uint8)"),
            name: tester.queue(dai, "name() view returns (string)"),
            balance: tester.queue(dai, "balanceOf(address) view returns (uint256)", [ricmoo]),
        };
        console.log(result);
        const blockNumber = yield tester.flush();
        console.log(result);
        console.log("BlockNumber", blockNumber);
        console.log(result);
    });
})();
//# sourceMappingURL=index.js.map