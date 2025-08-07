// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";


contract Account is BaseAccount {
    address public owner;
    address public _entryPoint;
    uint256 public counter;
    bool public useAuth;
    using MessageHashUtils for bytes32;

    event StateModified (
        address indexed addr,
        uint256 state
    );

    constructor(address _owner, address _entryPointAddr, bool _useAuth) {
        owner = _owner;
        useAuth = _useAuth;
        _entryPoint = _entryPointAddr;
    }

    function getCounter() external view returns (uint256) {
        return counter;
    }

    /// implement your authentication logic here
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash) internal override virtual returns (uint256 validationData) {

        if (useAuth) {
            // 1. Recover signer address from signature and userOpHash
            bytes32 ethSignedMessageHash = userOpHash.toEthSignedMessageHash();
            address signer = ECDSA.recover(ethSignedMessageHash, userOp.signature);

            // 2. Validate signer is the owner
            //require(signer == owner, "Invalid signer");

            // 3. Validate nonce (simplified example)
            //require(userOp.nonce == getNonce(), "Invalid nonce");
        }

        // Return validation data (e.g., VALIDATION_SUCCESS)
        return 0; // Or a specific value indicating success
    }

    function modifyState() external {
        counter = counter+1;
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }
}