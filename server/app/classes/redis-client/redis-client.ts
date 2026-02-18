import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisClient {
    client: any;
    constructor(
        private logger: Logger,
        private configService: ConfigService,
    ) {
        this.client = createClient({
            password: this.configService.get<string>('REDIS_PASSWORD'),
            socket: {
                host: this.configService.get<string>('REDIS_HOST'),
                port: this.configService.get<number>('REDIS_PORT') ?? 6379,
            },
        });
        this.client.on('error', (err) => {
            this.logger.log('Redis Client Error : ' + err);
        });
    }

    async connectRedis() {
        try {
            await this.client.connect();
            this.logger.log('Connected to Redis');
        } catch (error) {
            this.logger.error('Failed to connect to Redis : ' + error);
        }
    }

    async disconnectRedis() {
        try {
            await this.client.disconnect();
            this.logger.log('Disconnected from Redis');
        } catch (error) {
            this.logger.error('Failed to disconnect from Redis : ' + error);
        }
    }

    async set<T>(key: string, value: string): Promise<T> {
        try {
            const reply = await this.client.set(key, value);
            this.logger.log('Reply from Redis SET : ' + reply);
            return reply;
        } catch (error) {
            this.logger.error('Failed to set value in Redis : ' + error);
        }
    }

    async get(key: string): Promise<string | null> {
        try {
            const reply = await this.client.get(key);
            this.logger.log('Reply from Redis GET : ' + reply);
            return reply;
        } catch (error) {
            this.logger.error('Failed to get value from Redis : ' + error);
        }
    }

    async getAll(objectType: string): Promise<{ key: string; value: any }[]> {
        const pattern = `${objectType}:*`;
        const objects = [];

        try {
            let cursor = '0';
            do {
                const reply = await this.client.scan(cursor, { MATCH: pattern, COUNT: 50 });
                cursor = reply.cursor;
                const keys = reply.keys;

                // Debugging logs
                this.logger.log('Reply from Redis SCAN: ' + reply);
                this.logger.log('Total keys found so far: ' + keys.length);

                const objectsData = await Promise.all(
                    keys.map(async (key: string) => {
                        const object = await this.get(key);
                        return { key: key.replace(new RegExp(`^${objectType}:`), ''), value: JSON.parse(object) };
                    }),
                );
                objects.push(...objectsData);
            } while (cursor.toString() !== '0');
        } catch (error) {
            this.logger.error('Failed to get value from Redis : ' + error);
        }
        return objects;
    }

    async getKeys(objectType: string): Promise<string[]> {
        const pattern = `${objectType}:*`;
        let cursor = '0';
        let keys: string[] = [];

        try {
            do {
                // Perform the SCAN operation
                const reply = await this.client.scan(cursor, { MATCH: pattern, COUNT: 50 });

                cursor = reply.cursor; // Update the cursor
                keys = keys.concat(reply.keys); // Concatenate new keys

                // Debugging logs
                this.logger.log('Reply from Redis SCAN : ' + reply);
                this.logger.log('Total keys found so far : ' + keys.length);
            } while (cursor.toString() !== '0'); // Loop until cursor is '0'

            // Remove the prefix from the keys and return them
            return keys.map((key) => key.replace(new RegExp(`^${objectType}:`), ''));
        } catch (error) {
            this.logger.error('Failed to get keys from Redis using SCAN : ' + error);
            return [];
        }
    }

    async delete(key: string) {
        try {
            const reply = await this.client.del(key);
            this.logger.log('Reply from Redis DEL:', reply);
        } catch (error) {
            this.logger.error('Failed to delete value from Redis : ' + error);
        }
    }

    async deleteAllElements(objectType: string) {
        try {
            // Get all chatroom keys
            const chatroomKeys = await this.getKeys(objectType);
            if (chatroomKeys.length === 0) {
                this.logger.log('No elements "' + objectType + '" found to delete.');
                return;
            }

            // Delete each chatroom key
            for (const key of chatroomKeys) {
                await this.delete(`${objectType}:${key}`);
            }

            this.logger.log('Successfully deleted all elements "' + objectType + '".');
        } catch (error) {
            this.logger.error('Failed to delete all elements "' + objectType + '" : ' + error);
        }
    }
}
