import dotenv from 'dotenv';
import minimist from 'minimist';
import { type Address, type Hex, parseEther } from 'viem';
import { calculateSafeTxHash, signSafeTx } from './tools/safe-adapter.js';

dotenv.config();

async function main() {
  const args = minimist(process.argv.slice(2), {
    string: ['safe', 'to', 'value', 'data', 'nonce', 'key'],
  });

  const cmd = args._[0];

  if (cmd === 'propose') {
    const { safe, to, value, data, nonce } = args;

    if (!safe || !to || !value) {
      console.error('Error: safe, to, and value parameters are required.');
      console.log('Usage: npm run dev propose -- --safe <safe_addr> --to <to_addr> --value <eth_val> [--data <calldata>] [--nonce <number>]');
      process.exit(1);
    }

    const details = {
      to: to as Address,
      value: parseEther(value),
      data: (data || '0x') as Hex,
      operation: 0,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: '0x0000000000000000000000000000000000000000' as Address,
      refundReceiver: '0x0000000000000000000000000000000000000000' as Address,
      nonce: BigInt(nonce || '0'),
    };

    const hash = calculateSafeTxHash(safe as Address, details);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SAFE TRANSACTION PROPOSAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Safe Address: ${safe}`);
    console.log(`To Destination: ${details.to}`);
    console.log(`Value:         ${value} ETH (${details.value} wei)`);
    console.log(`Nonce:         ${details.nonce}`);
    console.log(`Calldata:      ${details.data}`);
    console.log('─────────────────────────────────');
    console.log(`Safe Tx Hash:  ${hash}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else if (cmd === 'sign') {
    const { safe, to, value, data, nonce, key } = args;
    const signingKey = key || process.env.WALLET_PRIVATE_KEY;

    if (!safe || !to || !value || !signingKey) {
      console.error('Error: safe, to, value, and key parameters are required.');
      console.log('Usage: npm run dev sign -- --safe <safe_addr> --to <to_addr> --value <eth_val> --key <private_key> [--data <calldata>] [--nonce <number>]');
      process.exit(1);
    }

    const details = {
      to: to as Address,
      value: parseEther(value),
      data: (data || '0x') as Hex,
      operation: 0,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: '0x0000000000000000000000000000000000000000' as Address,
      refundReceiver: '0x0000000000000000000000000000000000000000' as Address,
      nonce: BigInt(nonce || '0'),
    };

    const { signature, signer, txHash } = await signSafeTx(
      safe as Address,
      details,
      signingKey as Hex
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SAFE SIGNATURE COMPILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Signer Address: ${signer}`);
    console.log(`Safe Tx Hash:   ${txHash}`);
    console.log(`Signature:      ${signature}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else {
    console.log('Pharos Swarm Multisig Coordinator CLI');
    console.log('Commands:');
    console.log('  propose   - Creates a transaction proposal and prints the hash');
    console.log('  sign      - Signs a transaction hash with the provided private key');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
