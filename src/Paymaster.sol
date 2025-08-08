// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "./EntryPoint/BasePaymaster.sol";


contract Paymaster is BasePaymaster {
    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    /**
     * Validate a user operation.
     * @param userOp     - The user operation.
     * @param userOpHash - The hash of the user operation.
     * @param maxCost    - The maximum cost of the user operation.
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        bytes memory context = "";
        return (context, 0);
    }

    receive() external payable {}
}