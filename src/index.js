import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import mysql from 'mysql2/promise';

let connectionPool = null;

function createConnectionPool(config = {}) {
    const defaultConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'test',
        charset: 'utf8mb4',
        timezone: '+00:00',
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true
    };

    const poolConfig = { ...defaultConfig, ...config };
    
    try {
        connectionPool = mysql.createPool(poolConfig);
        console.log('MySQL connection pool created successfully');
        return connectionPool;
    } catch (error) {
        console.error('Error creating MySQL connection pool:', error.message);
        throw error;
    }
}

async function getConnection() {
    if (!connectionPool) {
        createConnectionPool();
    }
    
    try {
        const connection = await connectionPool.getConnection();
        console.log('Database connection acquired from pool');
        return connection;
    } catch (error) {
        console.error('Error getting connection from pool:', error.message);
        throw error;
    }
}

async function executeQuery(sql, params = []) {
    const connection = await getConnection();
    try {
        const [results] = await connection.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Error executing query:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

async function closeConnectionPool() {
    if (connectionPool) {
        try {
            await connectionPool.end();
            connectionPool = null;
            console.log('MySQL connection pool closed');
        } catch (error) {
            console.error('Error closing connection pool:', error.message);
        }
    }
}

process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await closeConnectionPool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await closeConnectionPool();
    process.exit(0);
});

const server = new McpServer({
    name: 'Mysql Server MCP',
    version: '1.0.0',
});

server.registerTool('listTables', {
    title: 'List Tables',
    description: 'Lists all tables in the MySQL database',
}, async () => {
    try {
        const tables = await executeQuery('SHOW TABLES');
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

const transport = new StdioServerTransport();
await server.connect(transport);
