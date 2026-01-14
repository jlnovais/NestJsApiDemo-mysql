import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MysqlDatabaseService } from './database/mysql-database.service';

describe('AppController', () => {
  let appController: AppController;
  let mysqlDatabaseService: jest.Mocked<MysqlDatabaseService>;

  beforeEach(async () => {
    const mockMysqlDatabaseService = {
      healthCheck: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: MysqlDatabaseService,
          useValue: mockMysqlDatabaseService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    mysqlDatabaseService = app.get(MysqlDatabaseService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
