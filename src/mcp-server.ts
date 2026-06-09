import { PharosAgentKit, startMcpServer } from 'pharos-agent-kit';
import { 
  pharosMultisigProposeAction, 
  pharosMultisigSignAction, 
  pharosMultisigExecuteAction 
} from './actions/multisig-actions.js';
import dotenv from 'dotenv';

dotenv.config();

const privateKey = process.env.WALLET_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
const rpcUrl = process.env.PHAROS_RPC_URL || 'https://atlantic.dplabs-internal.com';

const agent = new PharosAgentKit(privateKey, rpcUrl);

// Assign privateKey explicitly to the agent for custom action handlers to pick up
(agent as any).privateKey = privateKey;

const actions = {
  PHAROS_MULTISIG_PROPOSE: pharosMultisigProposeAction as any,
  PHAROS_MULTISIG_SIGN: pharosMultisigSignAction as any,
  PHAROS_MULTISIG_EXECUTE: pharosMultisigExecuteAction as any,
};

async function main() {
  console.error('Starting Pharos Swarm Multisig Coordinator MCP Server...');
  await startMcpServer(actions, agent, {
    name: 'pharos-swarm-coordinator',
    version: '1.0.0',
  });
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
