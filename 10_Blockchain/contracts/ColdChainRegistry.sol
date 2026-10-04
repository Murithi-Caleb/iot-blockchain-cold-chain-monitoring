// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ColdChainRegistry
/// @notice Append-only registry of integrity fingerprints (SHA-256 hashes) for
///         cold-chain and traceability records.
/// @dev Only hashes and identifiers are stored on-chain. The records themselves
///      (batch details, high-frequency temperature/humidity readings) stay in the
///      off-chain database. Anyone can later recompute a record's hash from the
///      database and compare it with the value anchored here to detect tampering.
///
///      Record IDs and batch keys are opaque 32-byte values derived off-chain, so
///      no business data (batch IDs, locations, produce types) is exposed.
contract ColdChainRegistry {
    // Record types (kept as uint8 so new kinds can be added without a new contract
    // as long as they stay within MAX_RECORD_TYPE):
    //   0 = batch registration
    //   1 = environmental readings digest
    //   2 = cold-chain event (reserved for the alerts/excursions phase)
    //   3 = produce movement event (reserved for the movement phase)
    uint8 public constant MAX_RECORD_TYPE = 3;

    struct Record {
        bytes32 dataHash;
        bytes32 batchKey;
        uint8 recordType;
        address submitter;
        uint64 timestamp; // block timestamp; 0 means "no such record"
    }

    address public owner;
    mapping(address => bool) public isWriter;
    mapping(bytes32 => Record) private records;

    event RecordAnchored(
        bytes32 indexed recordId,
        bytes32 indexed batchKey,
        uint8 indexed recordType,
        bytes32 dataHash,
        address submitter,
        uint64 timestamp
    );
    event WriterSet(address indexed writer, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotWriter();
    error ZeroAddress();
    error EmptyHash();
    error InvalidRecordType(uint8 recordType);
    error RecordAlreadyExists(bytes32 recordId);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyWriter() {
        if (!isWriter[msg.sender]) revert NotWriter();
        _;
    }

    constructor() {
        owner = msg.sender;
        isWriter[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit WriterSet(msg.sender, true);
    }

    /// @notice Grant or revoke permission to anchor records (e.g. the backend wallet).
    function setWriter(address writer, bool allowed) external onlyOwner {
        if (writer == address(0)) revert ZeroAddress();
        isWriter[writer] = allowed;
        emit WriterSet(writer, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Anchor a record fingerprint. A record ID can be anchored only once;
    ///         there is no update or delete function, which is what makes the registry
    ///         tamper-resistant.
    function anchorRecord(
        bytes32 recordId,
        bytes32 batchKey,
        uint8 recordType,
        bytes32 dataHash
    ) external onlyWriter {
        if (recordType > MAX_RECORD_TYPE) revert InvalidRecordType(recordType);
        if (dataHash == bytes32(0)) revert EmptyHash();
        if (records[recordId].timestamp != 0) revert RecordAlreadyExists(recordId);

        uint64 anchoredAt = uint64(block.timestamp);
        records[recordId] = Record({
            dataHash: dataHash,
            batchKey: batchKey,
            recordType: recordType,
            submitter: msg.sender,
            timestamp: anchoredAt
        });

        emit RecordAnchored(recordId, batchKey, recordType, dataHash, msg.sender, anchoredAt);
    }

    /// @notice Read an anchored record. `exists` is false (and all other fields zero)
    ///         for unknown IDs.
    function getRecord(bytes32 recordId)
        external
        view
        returns (
            bool exists,
            bytes32 dataHash,
            bytes32 batchKey,
            uint8 recordType,
            address submitter,
            uint64 timestamp
        )
    {
        Record storage record = records[recordId];
        return (
            record.timestamp != 0,
            record.dataHash,
            record.batchKey,
            record.recordType,
            record.submitter,
            record.timestamp
        );
    }

    /// @notice Convenience check: does the record exist and does its anchored hash
    ///         equal `dataHash`?
    function verifyRecord(bytes32 recordId, bytes32 dataHash)
        external
        view
        returns (bool exists, bool matches)
    {
        Record storage record = records[recordId];
        exists = record.timestamp != 0;
        matches = exists && record.dataHash == dataHash;
    }
}
