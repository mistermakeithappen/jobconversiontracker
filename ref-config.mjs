// REF MCP Configuration for up-to-date documentation access
// This ensures we're always using the latest API references

export const REF_CONFIG = {
  apiKey: 'ref-2d993b8896ac2f8a93a8',
  apiUrl: 'https://api.ref.tools/mcp',
  
  // Configuration for MCP clients
  mcpConfig: {
    command: "npx",
    args: [
      "mcp-remote@0.1.0-0",
      "https://api.ref.tools/mcp",
      "--header",
      "x-ref-api-key:ref-2d993b8896ac2f8a93a8"
    ]
  }
}

// Note: REF MCP is already configured in claude_config.json
// This file serves as a reference for the configuration
// and can be used if you need to access REF programmatically