import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface TextContent {
  type: 'text';
  text: string;
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['--env-file=.env', '--import', 'tsx', 'src/mcp/server.ts'],
  });
  const client = new Client(
    { name: 'escrubery-test', version: '0.0.0' },
    { capabilities: {} },
  );
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    console.log('tools expuestas:', tools.tools.map((t) => t.name).join(', '));
    const r = (await client.callTool({
      name: 'consultar_modelo',
      arguments: { proveedor: 'moonshot', modelo_id: 'kimi-k2-0905-preview' },
    })) as { content: TextContent[] };
    const txt = r.content?.[0]?.text ?? '';
    console.log('consultar_modelo (primeros 140):', txt.slice(0, 140));
    const v = (await client.callTool({
      name: 'verificar_evidencia',
      arguments: {},
    })) as { content: TextContent[] };
    console.log('verificar_evidencia:', v.content?.[0]?.text?.slice(0, 80));
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
