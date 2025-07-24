import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import mysql from 'mysql2/promise';
import { z } from 'zod';

function createConnectionPool(config = {}) {
    const defaultConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'test',
        connectionLimit: 10,
    };

    const poolConfig = { ...defaultConfig, ...config };
    
    try {
        return  mysql.createPool(poolConfig);
    } catch (error) {
        console.error('Error creating MySQL connection pool:', error.message);
        throw error;
    }
}

const connectionPool = createConnectionPool();


const server = new McpServer({
    name: 'Mysql Server MCP',
    version: '1.0.0',
});

server.registerTool('listTables', {
    title: 'List Tables',
    description: 'Lists all tables in the MySQL database',
}, async () => {
    try {
        const [tables] = await connectionPool.query('SHOW TABLES');
        return {
            content: [{
                type: 'text',
                text: `Tables in database:\n${JSON.stringify(tables, null, 2)}`
            }]
        };
    } catch (error) {
        return {
            content: [{
                type: 'text',
                text: `Error listing tables: ${error.message}`
            }],
            isError: true
        };
    }
});

server.registerTool('executeQuery', {
    title: 'Execute Query',
    description: 'Executes a SQL query against the MySQL database',
    inputSchema: {
        statement: z.string(),
        params: z.array(z.any()).optional()
    }
}, async ({ statement, params = [] }) => {
    try {
        const [results, fields] = await connectionPool.query(statement, params);
        return {
            content: [{
                type: 'text',
                text: `Query executed successfully. Results:\n${JSON.stringify(results, null, 2)}`
            }],
            metadata: {
                fields: fields ? fields.map(field => field.name) : []
            }
        };
    } catch (error) {
        return {
            content: [{
                type: 'text',
                text: `Error executing query: ${error.message}`
            }],
            isError: true
        };
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
