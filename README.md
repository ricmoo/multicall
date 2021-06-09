Multicall
=========

A multicall contract enables a single eth_call to be used to
aggregate multiple constant contract method calls to a variety
of addresses.

The ethers Multicall contract is located at `multicall.eth`
and is verified on [Etherscan](https://etherscan.io/address/multicall.eth).


JavaScript API
--------------

```javascript
const multicaller = Multicaller(provider);

// The maximum amount of gas to allow each sub-call to consume
multicaller.gasLimtPerCall = 50000;

// The maximum result length to allow each call to return
multicaller.resultLimitPerCall = 1024;

multicaller.queue(address, fragment [ , values ]) => Promise<any>
multicaller.queueResult(address, fragment [ , values ]) => Promise<Result>
multicall.flush() => Promise<number>
```


Contract API
------------

```javascript
const ABI = [
  "function execute(uint gasLimit, uint maxResultSize, address[] addrs, bytes[] datas) view returns (uint blockNumber, uint[] statuses, bytes[] results)"
];

const contract = new Contract("multicall.eth", ABI, provider);
```

There is a single method, `execute` which will throttle the
amount of gas per external call and limit the resulting output
from each call to prevent malicious contracts from breaking the
aggregate call.

Each result includes a status (0 for failure, 1 for successs) along
with any result. A status of 0 may still return data, which will be
the result of the revert.


License
-------

MIT License.
