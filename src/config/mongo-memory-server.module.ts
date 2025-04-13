import { Module, DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongodInstance: MongoMemoryServer;

@Module({})
export class MongoMemoryModule {
  static async forRoot(): Promise<DynamicModule> {
    mongodInstance = await MongoMemoryServer.create();
    const uri = mongodInstance.getUri();

    return {
      module: MongoMemoryModule,
      imports: [MongooseModule.forRoot(uri)],
      providers: [
        {
          provide: 'MONGO_MEMORY_SERVER',
          useValue: mongodInstance,
        },
      ],
      exports: ['MONGO_MEMORY_SERVER'],
    };
  }
}

export const closeInMemoryMongoConnection = async (): Promise<void> => {
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};
