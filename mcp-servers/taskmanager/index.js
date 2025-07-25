const { TaskManager } = require('@kazuph/mcp-taskmanager');

const taskManager = new TaskManager({
  storagePath: process.env.TASK_STORAGE_PATH || './tasks.json',
  port: process.env.MCP_PORT || 3005
});

taskManager.start().catch(console.error); 