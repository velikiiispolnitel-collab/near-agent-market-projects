# NEAR Transaction Viewer - VS Code Extension

View NEAR transaction details inline in VS Code. Detects transaction hashes in code and shows hover details.

## Features

- **Hover**: Hover over a NEAR tx hash to see transaction details
- **Code Lens**: Click "View NEAR Tx" above detected hashes
- **Explorer Link**: Open any transaction in NEAR block explorer
- **Multi-network**: Support for mainnet and testnet

## Configuration

- `nearTxViewer.network` - Network to use (mainnet/testnet)
- `nearTxViewer.explorerUrl` - Block explorer URL

## Usage

1. Open any file containing NEAR transaction hashes
2. Hover over a hash to see details
3. Click the code lens or command to open in explorer
