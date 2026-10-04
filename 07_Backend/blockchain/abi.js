'use strict';

// Human-readable ABI (ethers v6) for the parts of ColdChainRegistry the backend uses.
// Kept here so the backend does not depend on Hardhat build artifacts. If you change
// the contract's function signatures, update this file too.
module.exports = [
  'function anchorRecord(bytes32 recordId, bytes32 batchKey, uint8 recordType, bytes32 dataHash)',
  'function getRecord(bytes32 recordId) view returns (bool exists, bytes32 dataHash, bytes32 batchKey, uint8 recordType, address submitter, uint64 timestamp)',
  'function verifyRecord(bytes32 recordId, bytes32 dataHash) view returns (bool exists, bool matches)',
  'event RecordAnchored(bytes32 indexed recordId, bytes32 indexed batchKey, uint8 indexed recordType, bytes32 dataHash, address submitter, uint64 timestamp)'
];
