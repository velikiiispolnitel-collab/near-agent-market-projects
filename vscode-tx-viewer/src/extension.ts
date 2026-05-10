/**
 * NEAR Transaction Viewer - VS Code Extension
 * 
 * Detects NEAR transaction hashes in code and shows hover details.
 * Click to open in block explorer.
 */

import * as vscode from 'vscode';

// NEAR transaction hash pattern (base58, typically 44-48 chars)
const TX_HASH_PATTERN = /\b([123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{44,48})\b/g;

// NEAR RPC endpoint
const RPC_ENDPOINTS: Record<string, string> = {
  mainnet: 'https://rpc.mainnet.near.org',
  testnet: 'https://rpc.testnet.near.org',
};

interface TxAction {
  type: string;
  description: string;
  details: Record<string, unknown>;
}

interface TxDetails {
  hash: string;
  signerId: string;
  receiverId: string;
  actions: TxAction[];
  blockHash: string;
  status: string;
  gasUsed: string;
}

// Fetch transaction details from NEAR RPC
async function fetchTxDetails(txHash: string, network: string): Promise<TxDetails | null> {
  const endpoint = RPC_ENDPOINTS[network] || RPC_ENDPOINTS.mainnet;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'vscode-extension',
        method: 'tx',
        params: [txHash, 'dontcare'],
      }),
    });
    
    const data = await response.json();
    
    if (!data?.result) return null;
    
    const tx = data.result;
    const actions: TxAction[] = [];
    
    // Parse actions
    const txActions = tx.transaction?.actions || [];
    for (const action of txActions) {
      if (action.Transfer) {
        actions.push({
          type: 'Transfer',
          description: `Transfer ${(Number(action.Transfer.deposit) / 1e24).toFixed(4)} NEAR`,
          details: action.Transfer,
        });
      } else if (action.FunctionCall) {
        actions.push({
          type: 'FunctionCall',
          description: `Call ${action.FunctionCall.methodName}()`,
          details: action.FunctionCall,
        });
      } else if (action.CreateAccount) {
        actions.push({
          type: 'CreateAccount',
          description: 'Create new account',
          details: {},
        });
      } else if (action.DeployContract) {
        actions.push({
          type: 'DeployContract',
          description: 'Deploy contract',
          details: {},
        });
      } else if (action.Stake) {
        actions.push({
          type: 'Stake',
          description: `Stake ${(Number(action.Stake.stake) / 1e24).toFixed(4)} NEAR`,
          details: action.Stake,
        });
      } else if (action.AddKey) {
        actions.push({
          type: 'AddKey',
          description: 'Add access key',
          details: action.AddKey,
        });
      } else if (action.DeleteKey) {
        actions.push({
          type: 'DeleteKey',
          description: 'Delete access key',
          details: action.DeleteKey,
        });
      } else if (action.DeleteAccount) {
        actions.push({
          type: 'DeleteAccount',
          description: `Delete account → ${action.DeleteAccount.beneficiaryId}`,
          details: action.DeleteAccount,
        });
      }
    }
    
    return {
      hash: txHash,
      signerId: tx.transaction?.signer_id || 'unknown',
      receiverId: tx.transaction?.receiver_id || 'unknown',
      actions,
      blockHash: tx.receipts_outcome?.[0]?.block_hash || '',
      status: tx.status?.SuccessValue !== undefined ? 'Success' : 'Failed',
      gasUsed: tx.receipts_outcome?.[0]?.outcome?.gas_burnt?.toString() || '0',
    };
  } catch {
    return null;
  }
}

// Format transaction details as markdown
function formatTxMarkdown(tx: TxDetails, explorerUrl: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.supportHtml = true;
  
  md.appendMarkdown(`## 🔍 NEAR Transaction\n\n`);
  md.appendMarkdown(`**Hash:** \`${tx.hash}\`\n\n`);
  md.appendMarkdown(`**Signer:** \`${tx.signerId}\`\n\n`);
  md.appendMarkdown(`**Receiver:** \`${tx.receiverId}\`\n\n`);
  md.appendMarkdown(`**Status:** ${tx.status === 'Success' ? '✅' : '❌'} ${tx.status}\n\n`);
  md.appendMarkdown(`**Gas Used:** ${tx.gasUsed}\n\n`);
  
  if (tx.actions.length > 0) {
    md.appendMarkdown(`### Actions\n\n`);
    for (const action of tx.actions) {
      md.appendMarkdown(`- **${action.type}:** ${action.description}\n`);
    }
    md.appendMarkdown(`\n`);
  }
  
  md.appendMarkdown(`---\n\n`);
  md.appendMarkdown(`[🔗 Open in Explorer](${explorerUrl}${tx.hash})\n`);
  
  return md;
}

// Hover provider
class NearTxHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    const line = document.lineAt(position.line).text;
    const wordRange = document.getWordRangeAtPosition(position, TX_HASH_PATTERN);
    
    if (!wordRange) return;
    
    const hash = document.getText(wordRange);
    
    // Quick validation - NEAR tx hashes are base58
    if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{44,48}$/.test(hash)) {
      return;
    }
    
    const config = vscode.workspace.getConfiguration('nearTxViewer');
    const network = config.get<string>('network', 'mainnet');
    const explorerUrl = config.get<string>('explorerUrl', 'https://nearblocks.io/txns/');
    
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`🔍 **NEAR Transaction:** \`${hash.slice(0, 12)}...${hash.slice(-8)}\`\n\n`);
    md.appendMarkdown(`Loading details...\n\n`);
    md.appendMarkdown(`[🔗 Open in Explorer](${explorerUrl}${hash})`);
    
    // Fetch details asynchronously
    fetchTxDetails(hash, network).then(tx => {
      if (tx) {
        // Update hover with details (VS Code will re-render on next hover)
      }
    });
    
    return new vscode.Hover(md, wordRange);
  }
}

// Code lens provider
class NearTxCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    const text = document.getText();
    
    let match;
    TX_HASH_PATTERN.lastIndex = 0;
    
    while ((match = TX_HASH_PATTERN.exec(text)) !== null) {
      const hash = match[1];
      const pos = document.positionAt(match.index);
      const range = new vscode.Range(pos, pos.translate(0, hash.length));
      
      const lens = new vscode.CodeLens(range, {
        title: '🔍 View NEAR Tx',
        command: 'nearTxViewer.openInExplorer',
        arguments: [hash],
      });
      
      lenses.push(lens);
    }
    
    return lenses;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('NEAR Transaction Viewer extension activated');
  
  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider(
    { pattern: '**/*' },
    new NearTxHoverProvider()
  );
  
  // Register code lens provider
  const codeLensProvider = vscode.languages.registerCodeLensProvider(
    { pattern: '**/*' },
    new NearTxCodeLensProvider()
  );
  
  // Register command
  const openCommand = vscode.commands.registerCommand(
    'nearTxViewer.openInExplorer',
    (txHash: string) => {
      const config = vscode.workspace.getConfiguration('nearTxViewer');
      const explorerUrl = config.get<string>('explorerUrl', 'https://nearblocks.io/txns/');
      vscode.env.openExternal(vscode.Uri.parse(`${explorerUrl}${txHash}`));
    }
  );
  
  context.subscriptions.push(hoverProvider, codeLensProvider, openCommand);
}

export function deactivate() {}
