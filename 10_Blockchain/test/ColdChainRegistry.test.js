const { expect } = require('chai');
const { ethers } = require('hardhat');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

const hash = (text) => ethers.sha256(ethers.toUtf8Bytes(text));
const ZERO_BYTES32 = ethers.ZeroHash;

describe('ColdChainRegistry', () => {
  async function deploy() {
    const [owner, writer, outsider] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory('ColdChainRegistry')).deploy();
    await registry.waitForDeployment();
    return { registry, owner, writer, outsider };
  }

  const recordId = hash('record-1');
  const batchKey = hash('batch-1');
  const dataHash = hash('payload-1');

  it('makes the deployer the owner and an authorised writer', async () => {
    const { registry, owner } = await deploy();
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.isWriter(owner.address)).to.equal(true);
  });

  it('anchors a record and emits RecordAnchored', async () => {
    const { registry, owner } = await deploy();
    await expect(registry.anchorRecord(recordId, batchKey, 0, dataHash))
      .to.emit(registry, 'RecordAnchored')
      .withArgs(recordId, batchKey, 0, dataHash, owner.address, anyValue);

    const record = await registry.getRecord(recordId);
    expect(record.exists).to.equal(true);
    expect(record.dataHash).to.equal(dataHash);
    expect(record.batchKey).to.equal(batchKey);
    expect(record.recordType).to.equal(0n);
    expect(record.submitter).to.equal(owner.address);
    expect(record.timestamp).to.be.greaterThan(0n);
  });

  it('reports unknown records as non-existent', async () => {
    const { registry } = await deploy();
    const record = await registry.getRecord(hash('nope'));
    expect(record.exists).to.equal(false);
    expect(record.dataHash).to.equal(ZERO_BYTES32);
    const [exists, matches] = await registry.verifyRecord(hash('nope'), dataHash);
    expect(exists).to.equal(false);
    expect(matches).to.equal(false);
  });

  it('verifyRecord distinguishes matching and tampered hashes', async () => {
    const { registry } = await deploy();
    await registry.anchorRecord(recordId, batchKey, 1, dataHash);

    let [exists, matches] = await registry.verifyRecord(recordId, dataHash);
    expect(exists).to.equal(true);
    expect(matches).to.equal(true);

    [exists, matches] = await registry.verifyRecord(recordId, hash('tampered-payload'));
    expect(exists).to.equal(true);
    expect(matches).to.equal(false);
  });

  it('never allows a record to be overwritten', async () => {
    const { registry } = await deploy();
    await registry.anchorRecord(recordId, batchKey, 0, dataHash);
    await expect(registry.anchorRecord(recordId, batchKey, 0, hash('other')))
      .to.be.revertedWithCustomError(registry, 'RecordAlreadyExists')
      .withArgs(recordId);
    expect((await registry.getRecord(recordId)).dataHash).to.equal(dataHash);
  });

  it('rejects empty hashes and unknown record types', async () => {
    const { registry } = await deploy();
    await expect(registry.anchorRecord(recordId, batchKey, 0, ZERO_BYTES32))
      .to.be.revertedWithCustomError(registry, 'EmptyHash');
    await expect(registry.anchorRecord(recordId, batchKey, 4, dataHash))
      .to.be.revertedWithCustomError(registry, 'InvalidRecordType')
      .withArgs(4);
  });

  it('only authorised writers can anchor', async () => {
    const { registry, writer, outsider } = await deploy();
    await expect(registry.connect(outsider).anchorRecord(recordId, batchKey, 0, dataHash))
      .to.be.revertedWithCustomError(registry, 'NotWriter');

    await registry.setWriter(writer.address, true);
    await registry.connect(writer).anchorRecord(recordId, batchKey, 0, dataHash);
    expect((await registry.getRecord(recordId)).submitter).to.equal(writer.address);

    await registry.setWriter(writer.address, false);
    await expect(registry.connect(writer).anchorRecord(hash('r2'), batchKey, 0, dataHash))
      .to.be.revertedWithCustomError(registry, 'NotWriter');
  });

  it('only the owner can manage writers and ownership', async () => {
    const { registry, writer, outsider } = await deploy();
    await expect(registry.connect(outsider).setWriter(writer.address, true))
      .to.be.revertedWithCustomError(registry, 'NotOwner');
    await expect(registry.connect(outsider).transferOwnership(outsider.address))
      .to.be.revertedWithCustomError(registry, 'NotOwner');
    await expect(registry.setWriter(ethers.ZeroAddress, true))
      .to.be.revertedWithCustomError(registry, 'ZeroAddress');

    await registry.transferOwnership(writer.address);
    expect(await registry.owner()).to.equal(writer.address);
  });
});
