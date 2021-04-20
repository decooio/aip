const { Keyring } = require('@polkadot/keyring')
const { KeyringPair } = require('@polkadot/keyring/types')
const { ApiPromise, WsProvider } = require('@polkadot/api')
const { typesBundleForPolkadot, crustTypes } = require('@crustio/type-definitions')
const { CRUST_SECRET } = process.env;

const crustEndpoint = 'wss://api.crust.network'

const pinCrust = {
  placeStorageOrder: placeStorageOrder
}

async function placeStorageOrder(cid) {
  // 1. Try to connect to Crust Chain
  const chain = new ApiPromise({
    provider: new WsProvider(crustEndpoint),
    typesBundle: typesBundleForPolkadot
  })
  await chain.isReadyOrError;

  const size = 200 * 1024 * 1024; // 200 MB

  // 2. Construct tx
  const tx = chain.tx.market.placeStorageOrder(cid, size, 0);
  // 3. Send tx and disconnect chain
  await sendTx(tx, CRUST_SECRET);
  chain.disconnect();
}

/* PUBLIC METHODS */
/**
 * Check CIDv0 legality
 * @param {string} cid
 * @returns boolean
 */
function checkCid(cid) {
  return cid.length === 46 && cid.substr(0, 2) === 'Qm';
}

/**
 * Check seeds(12 words) legality
 * @param {string} seeds
 * @returns boolean
 */
function checkSeeds(seeds) {
  return seeds.split(' ').length === 12;
}

/**
 * Send tx to Crust Network
 * @param {import('@polkadot/api/types').SubmittableExtrinsic} tx
 * @param {string} seeds 12 secret words
 * @returns Promise<boolean> send tx success or failed
 */
async function sendTx(tx, seeds) {
  // 1. Load keyring
  console.log('⛓  Sending tx to chain...');
  const krp = loadKeyringPair(seeds);

  // 2. Send tx to chain
  return new Promise((resolve, reject) => {
    tx.signAndSend(krp, ({events = [], status}) => {
      console.log(
        `  ↪ 💸  Transaction status: ${status.type}, nonce: ${tx.nonce}`
      );

      if (
        status.isInvalid ||
        status.isDropped ||
        status.isUsurped ||
        status.isRetracted
      ) {
        reject(new Error('Invalid transaction'));
      } else {
        // Pass it
      }

      if (status.isInBlock) {
        events.forEach(({event: {method, section}}) => {
          if (section === 'system' && method === 'ExtrinsicFailed') {
            // Error with no detail, just return error
            console.error('  ↪ ❌  Send transaction failed');
            resolve(false);
          } else if (method === 'ExtrinsicSuccess') {
            console.log('  ↪ ✅  Send transaction success.');
            resolve(true);
          }
        });
      } else {
        // Pass it
      }
    }).catch(e => {
      reject(e);
    });
  });
}

/* PRIVATE METHODS  */
/**
 * Load keyring pair with seeds
 * @param {string} seeds
 */
function loadKeyringPair(seeds) {
  const kr = new Keyring({
    type: 'sr25519',
  });

  const krp = kr.addFromUri(seeds);
  return krp;
}

module.exports = pinCrust
